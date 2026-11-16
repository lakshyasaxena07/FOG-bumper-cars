// Prints webcam names (Windows DirectShow) to copy into config/venue.yaml.
import { spawn } from 'node:child_process';

const ffmpeg = process.env.FFMPEG_PATH ?? 'ffmpeg';
const p = spawn(ffmpeg, ['-hide_banner', '-list_devices', 'true', '-f', 'dshow', '-i', 'dummy']);
let out = '';
p.stderr.on('data', (d) => (out += d));
p.on('error', (e) => {
  console.error(`Cannot run ffmpeg ('${ffmpeg}'): ${e.message}`);
  process.exit(1);
});
p.on('close', () => {
  const names = [...new Set([...out.matchAll(/"([^"]+)" \(video\)/g)].map((m) => m[1]))];
  if (!names.length) console.log('No webcams found.');
  names.forEach((n, i) => console.log(`#${i}  "${n}"`));
  console.log('\nUse the index (source: 0) or the exact name in config/venue.yaml.');
});
