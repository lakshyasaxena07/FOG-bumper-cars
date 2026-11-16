// Creates two synthetic videos so the app can be tested without cameras.
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'test', 'videos');
const ffmpeg = process.env.FFMPEG_PATH ?? 'ffmpeg';
mkdirSync(out, { recursive: true });

for (const [name, source] of [['cam1', 'testsrc2=size=640x480:rate=25'], ['cam2', 'smptebars=size=640x480:rate=25']]) {
  const file = join(out, `${name}.mp4`);
  const r = spawnSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', source,
    '-t', '20', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', file], { stdio: 'inherit' });
  if (r.error || r.status !== 0) {
    console.error(`Failed to create ${file}. Is ffmpeg installed? (set FFMPEG_PATH if needed)`);
    process.exit(1);
  }
  console.log('created', file);
}
