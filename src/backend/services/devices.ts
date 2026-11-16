// Lists DirectShow (Windows) webcam names through ffmpeg.
import { spawn } from 'node:child_process';

export function parseDshow(text: string): string[] {
  const names = [...text.matchAll(/"([^"]+)" \(video\)/g)].map((m) => m[1]);
  return [...new Set(names)];
}

export function listWebcams(ffmpegPath: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, ['-hide_banner', '-list_devices', 'true', '-f', 'dshow', '-i', 'dummy'], { windowsHide: true });
    let out = '';
    proc.stderr.on('data', (d) => (out += d));
    proc.on('error', reject);
    proc.on('close', () => resolve(parseDshow(out)));
  });
}
