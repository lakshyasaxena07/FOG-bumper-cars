// Recorder node: owns the ride/session lifecycle and the per-camera recorders.
import { randomBytes } from 'node:crypto';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AppConfig } from '../services/config';
import { getLogger } from '../services/logger';
import type { PreviewManager } from '../services/preview';
import { EVENTS, type EventBus } from '../shared/events';
import type { AppState, CameraReadiness, CameraState, RideStatus, TriggerState } from '../shared/types';
import { CameraRecorder, describeSource, type SpawnFn } from './camera';

const log = getLogger('recorder');
const pad = (n: number) => String(n).padStart(2, '0');
const stamp = (d: Date) =>
  `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;

interface Session {
  id: string;
  dir: string;
  cameras: CameraRecorder[];
  startedAt: Date;
  timer: ReturnType<typeof setTimeout> | null;
}

async function writeMetadata(s: Session, status: string, reason: string | null = null, notes = '') {
  const end = status === 'recording' ? null : new Date();
  const meta = {
    session_id: s.id,
    status,
    start_time: s.startedAt.toISOString(),
    end_time: end?.toISOString() ?? null,
    duration_seconds: end ? Number(((end.getTime() - s.startedAt.getTime()) / 1000).toFixed(2)) : null,
    stop_reason: reason,
    notes,
    cameras: s.cameras.map((c) => c.state()),
  };
  const file = join(s.dir, 'session.json');
  await writeFile(`${file}.tmp`, JSON.stringify(meta, null, 2));
  await rename(`${file}.tmp`, file); // atomic: never a half-written session.json
}

export class RecorderManager {
  private session: Session | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private ride: RideStatus = 'idle';
  private lastCameras: CameraState[] | null = null;
  private lastSession: AppState['lastSession'] = null;
  private triggerState: TriggerState | null = null;
  private rideEndsAt: number | null = null;
  private diskFreeGb: number | null = null;
  private notes = '';

  constructor(
    private cfg: AppConfig,
    private bus: EventBus,
    private opts: { spawnFn?: SpawnFn; fatal?: string | null; previewManager?: PreviewManager } = {},
  ) {
    bus.subscribe(EVENTS.RIDE_START, () => this.startRide());
    bus.subscribe(EVENTS.RIDE_END, (data) => this.endRide(data));
    for (const c of cfg.cameras) log.info(`Camera ${c.id} (${c.name}) <- ${describeSource(c.source)}`);
  }

  getState(): AppState {
    const s = this.session;
    const readiness: Record<string, CameraReadiness> = this.opts.previewManager
      ? this.opts.previewManager.getReadiness()
      : {};
    return {
      venue: this.cfg.venue.name ?? 'Venue',
      ride: this.ride,
      sessionId: s?.id ?? null,
      startedAt: s?.startedAt.toISOString() ?? null,
      cameras: s
        ? s.cameras.map((c) => c.state())
        : (this.lastCameras ??
          this.cfg.cameras.map((c) => ({ id: c.id, name: c.name, status: 'idle' as const, frames: 0, file: null, error: null }))),
      lastSession: this.lastSession,
      readiness,
      trigger: this.triggerState,
      rideEndsAt: this.rideEndsAt,
      diskFreeGb: this.diskFreeGb,
      notes: this.notes,
    };
  }

  /** Update trigger state; called by backend/index.ts when trigger fires. */
  updateTriggerState(ts: TriggerState): void {
    this.triggerState = ts;
    this.notify();
  }

  /** Update disk status; called by backend/index.ts periodically. */
  updateDiskStatus(freeGb: number): void {
    this.diskFreeGb = freeGb;
    this.notify();
  }

  /** Set per-ride notes. */
  setNotes(notes: string): void {
    this.notes = notes;
  }

  /** Start/end/shutdown run strictly one after another, so they can never overlap. */
  private run<T>(task: () => Promise<T>): Promise<T> {
    const result = this.queue.then(task);
    this.queue = result.catch(() => undefined);
    return result;
  }

  private notify() {
    void this.bus.publish(EVENTS.STATE_CHANGED, this.getState());
  }

  startRide() {
    return this.run(async () => {
      try {
        await this.start();
      } catch (err) {
        log.error('Could not start ride', err);
        await this.bus.publish(EVENTS.NOTICE, { level: 'error', text: `Could not start ride: ${(err as Error).message}` });
        if (this.session) await this.finalize('start_error');
        else await this.bus.publish(EVENTS.RIDE_FINISHED, { sessionId: null, status: 'failed' });
      }
    });
  }

  endRide({ reason = 'trigger', sessionId }: { reason?: string; sessionId?: string } = {}) {
    return this.run(async () => {
      if (!this.session || (sessionId && sessionId !== this.session.id)) {
        log.info('No active ride - end request ignored');
        return;
      }
      await this.finalize(reason);
    });
  }

  shutdown() {
    return this.endRide({ reason: 'shutdown' });
  }

  /** Synchronous last resort for process 'exit': kill every running ffmpeg. */
  killAll() {
    this.session?.cameras.forEach((c) => c.kill());
  }

  private async start() {
    if (this.session) {
      log.warn(`Ride ${this.session.id} is already active - start ignored`);
      return;
    }
    if (this.opts.fatal) throw new Error(this.opts.fatal);

    // --- readiness guard ---
    const preview = this.opts.previewManager;
    if (preview) {
      const readiness = preview.getReadiness();
      const notReady = this.cfg.cameras.filter((c) => !preview.isReady(c.id));
      if (notReady.length > 0) {
        const details = notReady.map((c) => `${c.name} (${readiness[c.id]?.reason ?? 'unknown'})`).join(', ');
        const msg = `Camera(s) not ready: ${details}`;
        log.error(msg);
        await this.bus.publish(EVENTS.NOTICE, { level: 'error', text: msg });
        await this.bus.publish(EVENTS.RIDE_FINISHED, { sessionId: null, status: 'failed' });
        return;
      }
    }

    const rec = this.cfg.recording;
    const startedAt = new Date();
    const id = `${stamp(startedAt)}_${randomBytes(3).toString('hex')}`;
    const dir = join(this.cfg.sessionsDir, `ride_${id}`);
    await mkdir(this.cfg.sessionsDir, { recursive: true });
    await mkdir(dir); // fails loudly if it exists: rides never share a folder

    // Reset per-ride notes
    this.notes = '';

    const cameras = this.cfg.cameras.map(
      (c) => new CameraRecorder(c, rec, join(dir, `${c.id}.${rec.format}`), { spawnFn: this.opts.spawnFn, onChange: () => this.notify() }),
    );
    const session: Session = (this.session = { id, dir, cameras, startedAt, timer: null });
    this.ride = 'starting';
    this.lastCameras = null;

    // Set rideEndsAt in state if duration is configured
    const limits = [rec.ride_duration_seconds, rec.max_duration_seconds].filter((x): x is number => !!x && x > 0);
    if (limits.length) {
      this.rideEndsAt = Date.now() + Math.min(...limits) * 1000;
    } else {
      this.rideEndsAt = null;
    }

    this.notify();

    // Notify preview manager that cameras are now recording
    if (preview) {
      for (const cam of this.cfg.cameras) preview.setRecording(cam.id, true);
    }

    await Promise.all(cameras.map((c) => c.start())); // all cameras connect in parallel

    const live = cameras.filter((c) => c.status === 'recording').map((c) => c.cam.id);
    log.info(`Ride ${id} started - ${live.length}/${cameras.length} cameras recording [${live.join(', ')}]`);
    if (!live.length) {
      log.error('No camera could be started - ride aborted');
      await this.bus.publish(EVENTS.NOTICE, { level: 'error', text: 'No camera could be started - ride aborted' });
      await this.finalize('no_camera_available');
      return;
    }
    if (live.length < cameras.length) {
      await this.bus.publish(EVENTS.NOTICE, { level: 'warning', text: `Only ${live.length}/${cameras.length} cameras are recording` });
    }

    if (limits.length) {
      // sessionId guards against ending a *later* ride by mistake
      session.timer = setTimeout(() => void this.endRide({ reason: 'time_limit', sessionId: id }), Math.min(...limits) * 1000);
      session.timer.unref();
    }
    this.ride = 'recording';
    await writeMetadata(session, 'recording'); // leaves a trace even after a hard crash
    this.notify();
    await this.bus.publish(EVENTS.RIDE_STARTED, { sessionId: id });
  }

  private async finalize(reason: string) {
    const s = this.session!;
    if (s.timer) clearTimeout(s.timer);
    this.ride = 'stopping';
    this.notify();
    await Promise.all(s.cameras.map((c) => c.stop())); // all stop together

    // Release preview pipes
    const preview = this.opts.previewManager;
    if (preview) {
      for (const cam of this.cfg.cameras) preview.setRecording(cam.id, false);
    }

    const done = s.cameras.filter((c) => c.status === 'completed').length;
    const status = done === s.cameras.length ? 'completed' : done ? 'partial' : 'failed';
    try {
      await writeMetadata(s, status, reason, this.notes);
    } catch (err) {
      log.error(`Could not write session.json for ${s.id}`, err);
    }
    this.lastCameras = s.cameras.map((c) => c.state());
    this.lastSession = { id: s.id, status };
    this.session = null;
    this.ride = 'idle';
    this.rideEndsAt = null;
    this.notify();
    log.info(`Ride ${s.id} finished: ${status} (${reason})`);
    await this.bus.publish(EVENTS.RIDE_FINISHED, { sessionId: s.id, status });
  }
}
