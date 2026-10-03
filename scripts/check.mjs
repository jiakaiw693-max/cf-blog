import { readdir, readFile, access } from 'node:fs/promises';
import { join, resolve, extname } from 'node:path';
import { SOUND_TRACKS } from '../public/sound.js';

const out = resolve('dist');
async function list(dir) {
  const paths = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) paths.push(...await list(path));
    else paths.push(path);
  }
  return paths;
}
const files = await list(out);
const errors = [];
for (const track of SOUND_TRACKS) {
  try {
    const audio = await readFile(join(out, track.src.replace(/^\//, '')));
    if (audio.length < 1024 || audio.length > 25 * 1024 * 1024 || !(audio.subarray(0, 3).toString() === 'ID3' || (audio[0] === 255 && (audio[1] & 224) === 224))) {
      errors.push(`${track.title}: invalid MP3 or oversized asset`);
    }
  } catch { errors.push(`${track.title}: missing bundled audio ${track.src}`); }
}
let links = 0;
for (const file of files.filter(f => extname(f) === '.html')) {
  const html = await readFile(file, 'utf8');
  if (!html.includes('lang="zh-CN"') || !html.includes('name="viewport"')) errors.push(`${file}: missing document metadata`);
  for (const match of html.matchAll(/(?:href|src)="([^"\s]+)"/g)) {
    const href = match[1];
    if (/^(https?:|mailto:|data:)/.test(href)) continue;
    links++;
    const [path, anchor] = href.split('#');
    const target = path ? join(out, path.replace(/^\//, '')) : file;
    const finalPath = path.endsWith('/') ? join(target, 'index.html') : target;
    try {
      await access(finalPath);
      if (anchor && extname(finalPath) === '.html') {
        const targetHtml = await readFile(finalPath, 'utf8');
        if (!targetHtml.includes(`id="${anchor}"`)) errors.push(`${file}: unknown anchor ${href}`);
      }
    } catch { errors.push(`${file}: broken reference ${href}`); }
  }
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else console.log(`Checked ${files.filter(f => extname(f) === '.html').length} pages, ${links} local links/assets and ${SOUND_TRACKS.length} bundled MP3s.`);
