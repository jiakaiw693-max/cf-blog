import { readFileSync, readdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { getSiteUrl } from './site-url.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const local = process.argv.includes('--local');
const publicationCutoff = new Date().toISOString();
let site;
try { site = getSiteUrl({ required: !local }); }
catch (error) { console.error(error.message); process.exit(1); }

function hasIndexableHtml(directory) {
  return readdirSync(directory, { withFileTypes: true }).some(entry => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return hasIndexableHtml(path);
    return entry.name.endsWith('.html') && /<[\w:-]+\b[^>]*\sdata-pagefind-body(?:\s|=|>)/i.test(readFileSync(path, 'utf8'));
  });
}

for (const [name, args] of [['astro', ['build']], ['pagefind', ['--site', 'dist']]]) {
  if (name === 'pagefind' && !hasIndexableHtml(resolve(root, 'dist'))) {
    rmSync(resolve(root, 'dist/pagefind'), { recursive: true, force: true });
    console.info('没有公开文章，跳过搜索索引生成。');
    continue;
  }
  const manifestPath = resolve(root, 'node_modules', name, 'package.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const bin = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin[name];
  const result = spawnSync(process.execPath, [resolve(dirname(manifestPath), bin), ...args], {
    cwd: root,
    env: { ...process.env, SITE_URL: site, BLOG_BUILD_TIME: publicationCutoff },
    stdio: 'inherit',
  });
  if (result.error) { console.error(result.error.message); process.exit(1); }
  if (result.status !== 0) process.exit(result.status ?? 1);
}
