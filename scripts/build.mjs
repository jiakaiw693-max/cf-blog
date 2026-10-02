import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import site from '../site.config.mjs';
import renderHome from './home.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'dist');
const esc = (text) => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateLabel = (date) => date.replaceAll('-', '.');
const slugs = new Set();
for (const note of site.notes) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(note.slug) || slugs.has(note.slug)) throw new Error(`Invalid or duplicate slug: ${note.slug}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(note.date)) throw new Error(`Invalid date: ${note.date}`);
  slugs.add(note.slug);
}
if (!/^https:\/\//.test(site.github)) throw new Error('GitHub URL must use HTTPS');
if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(site.email)) throw new Error('Invalid email address');
for (const link of site.websites) {
  const url = new URL(link.url);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error(`Invalid website URL: ${link.name}`);
  if (!/^#[a-f0-9]{6}$/i.test(link.accent)) throw new Error(`Invalid website color: ${link.name}`);
}
const siteUrl = site.url || process.env.SITE_URL || (process.env.CF_PAGES ? process.env.CF_PAGES_URL : '') || '';
let base = '';
if (siteUrl) {
  const parsed = new URL(siteUrl);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash || ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)) {
    throw new Error('Website URL must be a public HTTPS root URL, for example https://example.com');
  }
  base = parsed.origin;
}
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await cp(resolve(root, 'public'), out, { recursive: true });

function head(title, description, path = '/') {
  return `<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#0b0f10"><meta name="description" content="${esc(description)}">
  <meta property="og:type" content="${path?.startsWith('/notes/') ? 'article' : 'website'}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:locale" content="zh_CN">
  ${base && path ? `<link rel="canonical" href="${esc(base + path)}"><meta property="og:url" content="${esc(base + path)}">` : ''}
  <title>${esc(title)}</title><link rel="icon" type="image/svg+xml" href="/favicon.svg"><link rel="stylesheet" href="/styles.css"><script src="/app.js" defer></script>`;
}

function header(home = false) {
  return `<a class="skip-link" href="#main">跳到正文</a><div class="scroll-progress" aria-hidden="true"></div><div class="pointer-glow" aria-hidden="true"></div><header class="site-header"><div class="container header-inner">
    <a class="brand" href="/" aria-label="${esc(site.brand)}首页"><span class="brand-symbol" aria-hidden="true">b.</span><span>${esc(site.brand)}<small>BITDRIFT / PERSONAL SPACE</small></span></a>
    <nav class="main-nav" aria-label="主导航" id="main-nav"><a href="${home ? '' : '/'}#focus" data-section="focus">关注</a><a href="${home ? '' : '/'}#notes" data-section="notes">手记</a><a href="${home ? '' : '/'}#directory" data-section="directory">网站导航</a><a href="${home ? '' : '/'}#about" data-section="about">关于</a><a class="nav-contact" href="${home ? '' : '/'}#contact" data-section="contact">联系我 <span aria-hidden="true">＋</span></a></nav>
    <button class="menu-toggle" type="button" aria-controls="main-nav" aria-expanded="false" aria-label="打开导航"><span></span><span></span></button>
  </div></header>`;
}

function footer() {
  return `<footer class="site-footer"><div class="container footer-inner"><a class="footer-brand" href="/">${esc(site.brand)}<span class="mono">BITDRIFT</span></a><span>© ${new Date().getUTCFullYear()} ${esc(site.name)}<br><span class="footer-note">保持好奇，慢慢记录。</span></span><a class="back-top" href="#top">回到顶部 <span aria-hidden="true">↑</span></a></div></footer>`;
}
const focusMarkup = site.focuses.map(f => `<article class="focus-item hover-surface" data-reveal><div class="focus-top"><span class="mono">/${esc(f.number)}</span><span class="focus-cross" aria-hidden="true">+</span></div><h3>${esc(f.label)}</h3><p class="focus-en mono">${esc(f.en)}</p><p class="focus-text">${esc(f.text)}</p><div class="tags">${f.tags.map(t => `<span>${esc(t)}</span>`).join('')}</div></article>`).join('');
const notesMarkup = site.notes.map((n, i) => `<article class="note-row" data-reveal><div class="note-number mono">${String(i + 1).padStart(2, '0')}</div><div class="note-main"><div class="note-meta"><span class="category">${esc(n.category)}</span><time datetime="${esc(n.date)}">${dateLabel(n.date)}</time></div><h3><a href="/notes/${n.slug}/">${esc(n.title)}</a></h3><p>${esc(n.excerpt)}</p></div><a class="note-read" href="/notes/${n.slug}/" aria-label="阅读：${esc(n.title)}">阅读手记<span aria-hidden="true">＋</span></a></article>`).join('');
const html = renderHome(site, { esc, head, header, footer, focusMarkup, notesMarkup });
await writeFile(resolve(out, 'index.html'), html);

for (const [index, note] of site.notes.entries()) {
  const next = site.notes[(index + 1) % site.notes.length];
  const article = `<!doctype html><html lang="zh-CN" id="top"><head>${head(`${note.title} · ${site.brand}`, note.excerpt, `/notes/${note.slug}/`)}</head><body>${header()}<main id="main" class="container article-page"><a class="article-back" href="/#notes">回到全部手记</a><article><div class="article-meta"><span class="category">${esc(note.category)}</span><time datetime="${esc(note.date)}">${dateLabel(note.date)}</time></div><h1>${esc(note.title)}</h1><p class="article-deck">${esc(note.excerpt)}</p><div class="article-author">${esc(site.name)} · ${esc(site.brand)}</div><div class="article-body">${note.paragraphs.map(p => `<p>${esc(p)}</p>`).join('')}</div></article><nav class="article-next" aria-label="继续阅读"><span class="mono">ANOTHER NOTE</span><a href="/notes/${next.slug}/">${esc(next.title)}</a></nav></main>${footer()}</body></html>`;
  const dir = resolve(out, 'notes', note.slug);
  await mkdir(dir, { recursive: true });
  await writeFile(resolve(dir, 'index.html'), article);
}

await writeFile(resolve(out, '404.html'), `<!doctype html><html lang="zh-CN" id="top"><head>${head(`页面未找到 · ${site.brand}`, '这个地址暂时没有内容。', null)}<meta name="robots" content="noindex"></head><body>${header()}<main id="main" class="container error-page"><p class="eyebrow mono">404 / OUT OF ORBIT</p><h1>这条轨道，<br>还没有留下记录。</h1><p>这个地址暂时没有内容。回到首页，继续看看。</p><a class="button button-accent" href="/">回到首页</a></main>${footer()}</body></html>`);
await writeFile(resolve(out, 'robots.txt'), `User-agent: *\nAllow: /\n${base ? `Sitemap: ${base}/sitemap.xml\n` : ''}`);
if (base) {
  const paths = ['/', ...site.notes.map(n => `/notes/${n.slug}/`)];
  await writeFile(resolve(out, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map(p => `<url><loc>${esc(base + p)}</loc></url>`).join('')}</urlset>`);
}
console.log(`Built homepage, ${site.notes.length} notes, ${site.websites.length} website links and 404 page → dist/`);
