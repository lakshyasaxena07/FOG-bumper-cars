// One CameraRecorder = one ffmpeg process = one output file. Cameras never share state.
import { spawn, type ChildProcess } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { basename } from 'node:path';
import type { CameraConfig, RecordingConfig, Source } from '../services/config';
import { listWebcams } from '../services/devices';
import { getLogger } from '../services/logger';
import type { CameraState, CameraStatus } from '../shared/types';

const log = getLogger('camera');
const FORCE_KILL_MS = 8000;

export type SpawnFn = (args: string[], cam: CameraConfig) => ChildProcess;

/** Hide RTSP credentials in logs. */
export const mask = (text: unknown) => String(text).replace(/\/\/[^@/\s]+@/g, '//***@');

export const describeSource = (s: Source) =>
  s.type === 'webcam' ? `webcam ${s.name ? `"${s.name}"` : `#${s.index}`}` : s.type === 'stream' ? mask(s.url) : s.path;

export const createSpawn = (ffmpegPath: string): SpawnFn => (args) =>
  spawn(ffmpegPath, args, { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });

async function inputArgs(cam: CameraConfig, rec: RecordingConfig): Promise<string[]> {
  const { source } = cam;
  const extra = cam.input_args ?? [];
  if (source.type === 'webcam') {
    if (process.platform === 'win32') {
      const name = source.name ?? (await listWebcams(rec.ffmpeg_path))[source.index ?? 0];
      if (!name) throw new Error(`Webcam #${source.index} not found (run: npm run cameras)`);
      return [...extra, '-f', 'dshow', '-i', `video=${name}`];
    }
    return [...extra, '-f', 'v4l2', '-i', source.name ?? `/dev/video${source.index}`];
  }
  if (source.type === 'stream') {
    const rtsp = source.url.toLowerCase().startsWith('rtsp');
    const opts = rtsp ? ['-rtsp_transport', 'tcp', '-timeout', String(rec.open_timeout_seconds * 1e6)] : [];
    return [...extra, ...opts, '-i', source.url];
  }
  return [...extra, '-re', '-stream_loop', '-1', '-i', source.path]; // dev file: real-time, looping
}

export async function buildArgs(cam: CameraConfig, rec: RecordingConfig, outPath: string): Promise<string[]> {
  const container = ['mp4', 'mov', 'm4v'].includes(rec.format)
    ? ['-movflags', '+frag_keyframe+empty_moov+default_base_moof'] // playable even after a crash
    : [];
  return [
    '-hide_banner', '-loglevel', 'error',
    ...(await inputArgs(cam, rec)),
    '-an',
    '-vf', `scale=${rec.width}:${rec.height},fps=${rec.fps}`,
    '-c:v', rec.video_codec, ...rec.encoder_args,
    '-pix_fmt', 'yuv420p', '-g', String(rec.fps * 2),
    ...container,
    '-progress', 'pipe:1', '-nostats', '-y', outPath,
  ];
}

export class CameraRecorder {
  status: CameraStatus = 'idle';
  error: string | null = null;
  frames = 0;

  private proc: ChildProcess | null = null;
  private stopping = false;
  private done = false;
  private lastProgress = 0;
  private buffer = '';
  private stderr = '';
  private timers: NodeJS.Timeout[] = [];
  private ready: Promise<boolean>;
  private exited: Promise<void>;
  private readyDone!: (ok: boolean) => void;
  private exitedDone!: () => void;
  private spawnFn: SpawnFn;
  private onChange: () => void;

  constructor(
    readonly cam: CameraConfig,
    private rec: RecordingConfig,
    readonly outPath: string,
    opts: { spawnFn?: SpawnFn; onChange?: () => void } = {},
  ) {
    this.spawnFn = opts.spawnFn ?? createSpawn(rec.ffmpeg_path);
    this.onChange = opts.onChange ?? (() => {});
    this.ready = new Promise((r) => (this.readyDone = r));
    this.exited = new Promise((r) => (this.exitedDone = r));
  }

  /** Starts ffmpeg. Resolves true once frames flow, false if the camera could not start. Never rejects. */
  async start(): Promise<boolean> {
    this.setStatus('connecting');
    try {
      this.proc = this.spawnFn(await buildArgs(this.cam, this.rec, this.outPath), this.cam);
    } catch (err) {
      this.fail('unavailable', (err as Error).message);
      this.readyDone(false);
      this.exitedDone();
      this.done = true;
      return false;
    }
    const proc = this.proc;
    proc.stdin?.on('error', () => {}); // process already gone; the close handler reports the outcome
    proc.stdout?.on('data', (chunk) => this.onProgress(chunk));
    proc.stderr?.on('data', (chunk) => (this.stderr = (this.stderr + mask(chunk)).slice(-1000)));
    proc.on('error', (err) => void this.onClose(null, `Cannot start ffmpeg: ${err.message}`));
    proc.on('close', (code) => void this.onClose(code));

    this.timers.push(
      setTimeout(() => {
        if (this.status !== 'connecting') return;
        this.fail('unavailable', `No video received within ${this.rec.open_timeout_seconds}s`);
        this.kill();
      }, this.rec.open_timeout_seconds * 1000),
      setInterval(() => this.checkStall(), 500),
    );
    return this.ready;
  }

  /** Graceful stop: ffmpeg finalizes the file when it receives 'q'. Force-kills if it hangs. */
  async stop() {
    if (!this.proc || this.done) return;
    this.stopping = true;
    this.proc.stdin?.write('q\n');
    const force = setTimeout(() => {
      log.warn(`[${this.cam.id}] ffmpeg did not stop in time - killing it`);
      this.kill();
    }, FORCE_KILL_MS);
    await this.exited;
    clearTimeout(force);
  }

  /** Immediate kill. Synchronous, so it is safe inside process 'exit'. */
  kill() {
    this.proc?.kill();
  }

  state(): CameraState {
    return {
      id: this.cam.id, name: this.cam.name, status: this.status, frames: this.frames, error: this.error,
      file: this.frames > 0 ? basename(this.outPath) : null,
    };
  }

  // ---------------- internals ----------------
  private setStatus(status: CameraStatus) {
    this.status = status;
    this.onChange();
  }

  private fail(status: CameraStatus, error: string) {
    this.error = error;
    log.error(`[${this.cam.id}] ${this.cam.name}: ${error}`);
    this.setStatus(status);
  }

  private onProgress(chunk: Buffer | string) {
    this.buffer += chunk;
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() ?? '';
    for (const line of lines) {
      const match = /^frame=(\d+)/.exec(line);
      if (!match) continue;
      this.frames = Number(match[1]);
      this.lastProgress = Date.now();
      if (this.status === 'connecting' && this.frames > 0) {
        log.info(`[${this.cam.id}] recording -> ${basename(this.outPath)}`);
        this.setStatus('recording');
        this.readyDone(true);
      } else this.onChange();
    }
  }

  private checkStall() {
    const limit = this.rec.disconnect_timeout_seconds * 1000;
    if (this.status !== 'recording' || Date.now() - this.lastProgress <= limit) return;
    this.fail('failed', `Camera disconnected (no frames for ${this.rec.disconnect_timeout_seconds}s)`);
    this.kill();
  }

  private async onClose(code: number | null, startError?: string) {
    if (this.done) return;
    this.done = true;
    this.timers.forEach((t) => (clearTimeout(t), clearInterval(t)));
    const tail = this.stderr.trim().split('\n').slice(-2).join(' | ');
    const detail = startError ?? (tail ? `: ${tail}` : '');

    if (this.status === 'connecting') {
      this.fail('unavailable', startError ?? `Could not open camera${detail}`);
    } else if (this.status === 'recording' || this.status === 'failed') {
      if (this.status === 'failed') {
        // already marked by the stall watchdog; keep that message
      } else if (!this.stopping) this.fail('failed', `Camera stream ended unexpectedly (exit code ${code})${detail}`);
      else if (this.frames > 0) this.setStatus('completed');
      else this.fail('failed', 'No frames were recorded');
    }
    if (this.frames === 0) await rm(this.outPath, { force: true }); // never leave empty/invalid files
    else log.info(`[${this.cam.id}] stopped - ${this.frames} frames written`);
    this.readyDone(false);
    this.exitedDone();
  }
}
