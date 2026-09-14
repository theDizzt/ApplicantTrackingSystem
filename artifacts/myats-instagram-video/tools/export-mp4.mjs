import { mkdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const frames = resolve(root, '.frames');
const output = resolve(root, 'My_ATS_Instagram_4x5.mp4');
const chromium = process.env.CHROMIUM || '/repl/tools/bin/chromium';
const sourceFps = 1;
const outputFps = 24;
const frameCount = 30;

mkdirSync(frames, { recursive: true });
rmSync(output, { force: true });
for (const entry of (await import('node:fs')).readdirSync(frames)) {
  rmSync(resolve(frames, entry), { force: true });
}
for (let frame = 0; frame < frameCount; frame += 1) {
  const target = resolve(frames, `frame-${String(frame).padStart(4, '0')}.png`);
  const result = spawnSync(chromium, [
    '--headless', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
    '--window-size=1080,1350', `--screenshot=${target}`,
    `file://${resolve(root, 'public/render.html')}?f=${frame * 12}`,
  ], { stdio: 'ignore' });
  if (result.status !== 0) throw new Error(`Chromium failed at frame ${frame}`);
}

const encode = spawnSync('ffmpeg', [
  '-y', '-framerate', String(sourceFps), '-i', resolve(frames, 'frame-%04d.png'),
  '-vf', `fps=${outputFps},format=yuv420p`,
  '-c:v', 'libx264', '-profile:v', 'high', '-level', '4.0',
  '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-r', String(outputFps), output,
], { stdio: 'inherit' });
if (encode.status !== 0) throw new Error('ffmpeg encode failed');
rmSync(frames, { recursive: true, force: true });
console.log(output);