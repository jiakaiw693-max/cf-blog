import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { getSiteUrl } from './site-url.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const local = process.argv.includes('--local');
let site;
try { site = getSiteUrl({ required: !local }); }
catch (error) { console.error(error.message); process.exit(1); }

for (const [name, args] of [['astro', ['build']], ['pagefind', ['--site', 'dist']]]) {
  const manifestPath = resolve(root, 'node_modules', name, 'package.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const bin = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin[name];
  const result = spawnSync(process.execPath, [resolve(dirname(manifestPath), bin), ...args], {
    cwd: root,
    env: { ...process.env, SITE_URL: site },
    stdio: 'inherit',
  });
  if (result.error) { console.error(result.error.message); process.exit(1); }
  if (result.status !== 0) process.exit(result.status ?? 1);
}
