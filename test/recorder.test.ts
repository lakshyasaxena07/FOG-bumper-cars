// Automated tests: real manager + real trigger logic, with a fake ffmpeg process (no camera needed).
import { EventEmitter } from 'node:events';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { afterEach, describe, expect, it } from 'vitest';
import { mask } from '../src/backend/managers/camera';
import { RecorderManager } from '../src/backend/managers/recorderManager';
import { loadConfig } from '../src/backend/services/config';
import { EVENTS, EventBus } from '../src/backend/shared/events';
import { KeyboardTrigger } from '../src/backend/triggers/keyboardTrigger';

type Plan = { neverReady?: boolean; dieAfterMs?: number; stallAfterMs?: number };

/** Fake ffmpeg process. neverReady = cannot open, dieAfterMs = crash, stallAfterMs = frozen stream. */
function fakeChild(outPath: string, { neverReady, dieAfterMs, stallAfterMs }: Plan = {}) {
  const proc: any = new EventEmitter(); // eslint-disable-line @typescript-eslint/no-explicit-any
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  let closed = false;
  let frames = 0;
  let ticker: NodeJS.Timeout | undefined;
  const finish = (code: number) => {
    if (closed) return;
    closed = true;
    clearInterval(ticker);
    setImmediate(() => proc.emit('close', code));
  };
  proc.stdin = { on() {}, write: (t: string) => t.startsWith('q') && setTimeout(() => finish(0), 20) };
  proc.kill = () => finish(1);
  if (neverReady) {
    setTimeout(() => (proc.stderr.emit('data', 'Connection refused\n'), finish(1)), 50);
    return proc;
  }
  writeFileSync(outPath, 'fake video data');
  ticker = setInterval(() => proc.stdout.emit('data', `frame=${(frames += 5)}\nprogress=continue\n`), 50);
  if (dieAfterMs) setTimeout(() => (proc.stderr.emit('data', 'Error reading from device\n'), finish(1)), dieAfterMs);
  if (stallAfterMs) setTimeout(() => clearInterval(ticker), stallAfterMs);
  return proc;
}

const cleanups: Array<() => unknown> = [];
afterEach(async () => {
  for (const c of cleanups.splice(0)) await c();
});

function setup(sources: Array<string | number>, plan: Record<string, Plan> = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'bumper-'));
  const cfgPath = join(dir, 'venue.json'); // JSON is valid YAML
  writeFileSync(cfgPath, JSON.stringify({
    recording: { width: 320, height: 240, fps: 10, open_timeout_seconds: 2, disconnect_timeout_seconds: 1 },
    storage: { sessions_dir: join(dir, 'sessions') },
    cameras: sources.map((source, i) => ({ id: `camera_${i + 1}`, name: `Cam ${i + 1}`, source })),
  }));
  const bus = new EventBus();
  const manager = new RecorderManager(loadConfig(cfgPath, dir, dir), bus, {
    spawnFn: (args, cam) => fakeChild(args[args.length - 1], plan[cam.id]),
  });
  cleanups.push(async () => {
    await manager.shutdown();
    rmSync(dir, { recursive: true, force: true });
  });
  const root = join(dir, 'sessions');
  return {
    bus, manager,
    sessions: () => (existsSync(root) ? readdirSync(root).filter((n) => n.startsWith('ride_')) : []),
    meta: (folder: string) => JSON.parse(readFileSync(join(root, folder, 'session.json'), 'utf8')),
    path: (folder: string, file: string) => join(root, folder, file),
  };
}

const ride = async (bus: EventBus, ms = 600) => {
  await bus.publish(EVENTS.RIDE_START);
  await sleep(ms);
  await bus.publish(EVENTS.RIDE_END);
};

describe('recorder', () => {
  it('two cameras record, finalize and write session.json', async () => {
    const h = setup(['a.mp4', 'b.mp4']);
    await ride(h.bus);
    const [folder] = h.sessions();
    const meta = h.meta(folder);
    expect(meta.status).toBe('completed');
    expect(meta.duration_seconds).toBeGreaterThan(0.4);
    expect(meta.cameras).toHaveLength(2);
    for (const cam of meta.cameras) {
      expect(cam.status).toBe('completed');
      expect(cam.frames).toBeGreaterThan(0);
      expect(existsSync(h.path(folder, cam.file))).toBe(true);
    }
  });

  it('a second ride gets a new folder', async () => {
    const h = setup(['a.mp4', 'b.mp4']);
    await ride(h.bus, 300);
    await ride(h.bus, 300);
    expect(new Set(h.sessions()).size).toBe(2);
  });

  it('unavailable camera gives a partial session and no empty file', async () => {
    const h = setup(['a.mp4', 'b.mp4'], { camera_2: { neverReady: true } });
    await ride(h.bus);
    const [folder] = h.sessions();
    const meta = h.meta(folder);
    expect(meta.status).toBe('partial');
    expect(meta.cameras.map((c: any) => c.status)).toEqual(['completed', 'unavailable']); // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(meta.cameras[1].file).toBeNull();
    expect(existsSync(h.path(folder, 'camera_2.mp4'))).toBe(false);
  });

  it('all cameras unavailable aborts the ride as failed', async () => {
    const h = setup(['a.mp4', 'b.mp4'], { camera_1: { neverReady: true }, camera_2: { neverReady: true } });
    await h.bus.publish(EVENTS.RIDE_START);
    expect(h.meta(h.sessions()[0]).status).toBe('failed');
    expect(h.manager.getState().ride).toBe('idle');
  });

  it('camera disconnect: the other camera keeps recording, no credentials stored', async () => {
    const h = setup(['a.mp4', 'rtsp://user:secret@host/stream'], { camera_2: { dieAfterMs: 300 } });
    await ride(h.bus, 1200);
    const [folder] = h.sessions();
    const meta = h.meta(folder);
    const [c1, c2] = meta.cameras;
    expect(meta.status).toBe('partial');
    expect([c1.status, c2.status]).toEqual(['completed', 'failed']);
    expect(c2.error).toMatch(/ended unexpectedly/);
    expect(c1.frames).toBeGreaterThan(c2.frames);
    expect(readFileSync(h.path(folder, 'session.json'), 'utf8')).not.toContain('secret');
  });

  it('frozen stream is detected by the watchdog', async () => {
    const h = setup(['a.mp4', 'b.mp4'], { camera_2: { stallAfterMs: 300 } });
    await ride(h.bus, 2500);
    const [c1, c2] = h.meta(h.sessions()[0]).cameras;
    expect(c1.status).toBe('completed');
    expect(c2.status).toBe('failed');
    expect(c2.error).toMatch(/no frames/);
  });

  it('shutdown without E still finalizes the ride', async () => {
    const h = setup(['a.mp4', 'b.mp4']);
    await h.bus.publish(EVENTS.RIDE_START);
    await sleep(400);
    await h.manager.shutdown();
    expect(h.meta(h.sessions()[0]).stop_reason).toBe('shutdown');
  });

  it('config rejects shared sources', () => {
    expect(() => setup(['rtsp://x/1', 'rtsp://x/1'])).toThrow(/same source/);
    expect(() => setup([0, 0])).toThrow(/same source/);
  });

  it('masks RTSP credentials', () => {
    expect(mask('rtsp://admin:pw@192.168.1.5/s')).toBe('rtsp://***@192.168.1.5/s');
  });
});

describe('keyboard trigger', () => {
  it('ignores duplicate S and idle E', async () => {
    const h = setup(['a.mp4', 'b.mp4']);
    const ends: unknown[] = [];
    h.bus.subscribe(EVENTS.RIDE_END, (d) => ends.push(d));
    const trigger = new KeyboardTrigger(h.bus, 0);
    await trigger.handleKey('e'); // idle: nothing published
    expect(ends).toHaveLength(0);
    await trigger.handleKey('s');
    await trigger.handleKey('s'); // duplicate
    await sleep(300);
    await trigger.handleKey('e');
    expect(h.sessions()).toHaveLength(1);
    expect(ends).toHaveLength(1);
  });

  it('debounce ignores rapid repeats of the same key', async () => {
    const h = setup(['a.mp4', 'b.mp4']);
    const starts: unknown[] = [];
    h.bus.subscribe(EVENTS.RIDE_START, (d) => starts.push(d));
    const trigger = new KeyboardTrigger(h.bus, 5);
    await trigger.handleKey('s');
    await trigger.handleKey('s');
    expect(starts).toHaveLength(1);
  });

  it('Q stops an active ride safely and asks the app to quit', async () => {
    const h = setup(['a.mp4', 'b.mp4']);
    const trigger = new KeyboardTrigger(h.bus, 0);
    await trigger.handleKey('s');
    await sleep(400);
    expect(await trigger.handleKey('q')).toBe(false);
    const meta = h.meta(h.sessions()[0]);
    expect([meta.status, meta.stop_reason]).toEqual(['completed', 'quit']);
  });
});
