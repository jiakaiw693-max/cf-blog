import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import site from '../site.config.mjs';

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
  <meta name="theme-color" content="#f4f3ed"><meta name="description" content="${esc(description)}">
  <meta property="og:type" content="${path?.startsWith('/notes/') ? 'article' : 'website'}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:locale" content="zh_CN">
  ${base && path ? `<link rel="canonical" href="${esc(base + path)}"><meta property="og:url" content="${esc(base + path)}">` : ''}
  <title>${esc(title)}</title><link rel="icon" type="image/svg+xml" href="/favicon.svg"><link rel="stylesheet" href="/styles.css"><script src="/app.js" defer></script>`;
}

function header(home = false) {
  return `<a class="skip-link" href="#main">跳到正文</a><header class="site-header"><div class="container header-inner">
    <a class="brand" href="/" aria-label="${esc(site.brand)}首页"><span class="brand-symbol" aria-hidden="true">b.</span><span>${esc(site.brand)}<small>BITDRIFT</small></span></a>
    <nav class="main-nav" aria-label="主导航" id="main-nav"><a href="${home ? '' : '/'}#focus">关注</a><a href="${home ? '' : '/'}#notes">手记</a><a href="${home ? '' : '/'}#about">关于</a><a class="nav-contact" href="${home ? '' : '/'}#contact">联系我</a></nav>
    <button class="menu-toggle" type="button" aria-controls="main-nav" aria-expanded="false" aria-label="打开导航"><span></span><span></span></button>
  </div></header>`;
}

function footer() {
  return `<footer class="site-footer"><div class="container footer-inner"><span>© ${new Date().getUTCFullYear()} ${esc(site.name)} · ${esc(site.brand)}</span><span class="footer-note">保持好奇，慢慢记录。</span><a href="#top">回到顶部</a></div></footer>`;
}
const focusMarkup = site.focuses.map(f => `<article class="focus-item"><div class="focus-top"><span class="mono">/${esc(f.number)}</span><span class="focus-cross" aria-hidden="true">+</span></div><h3>${esc(f.label)}</h3><p class="focus-en mono">${esc(f.en)}</p><p class="focus-text">${esc(f.text)}</p><div class="tags">${f.tags.map(t => `<span>${esc(t)}</span>`).join('')}</div></article>`).join('');
const notesMarkup = site.notes.map((n, i) => `<article class="note-row"><div class="note-number mono">${String(i + 1).padStart(2, '0')}</div><div class="note-main"><div class="note-meta"><span class="category">${esc(n.category)}</span><time datetime="${esc(n.date)}">${dateLabel(n.date)}</time></div><h3><a href="/notes/${n.slug}/">${esc(n.title)}</a></h3><p>${esc(n.excerpt)}</p></div><a class="note-read" href="/notes/${n.slug}/" aria-label="阅读：${esc(n.title)}">阅读手记<span aria-hidden="true">＋</span></a></article>`).join('');
const html = `<!doctype html><html lang="zh-CN" id="top"><head>${head(site.title, site.description)}<link rel="preload" as="image" href="/assets/bitdrift-orb.webp"></head><body>
${header(true)}<main id="main">
<section class="hero container" aria-labelledby="hero-title"><div class="hero-copy"><p class="eyebrow mono">A PERSONAL SPACE FOR CURIOUS MINDS</p><p class="intro-line">你好，我是 <strong>${esc(site.name)}</strong></p><h1 id="hero-title">持续好奇，<br>记录<span class="word-highlight">所见</span>。</h1><p class="hero-description">${esc(site.introduction)}</p><div class="hero-actions"><a class="button button-dark" href="#notes">翻开我的手记</a><a class="text-link" href="${esc(site.github)}" target="_blank" rel="noopener noreferrer">在 GitHub 找到我</a></div><div class="hero-bottom"><span class="mono">OBSERVE. THINK. CREATE.</span><span>科技 / 日常 / 新发现</span></div></div>
<figure class="hero-art"><img src="/assets/bitdrift-orb.webp" width="1536" height="1024" alt="深色玻璃与金属球体，环绕着轨道，右侧映出黄绿色光" fetchpriority="high"><div class="art-top"><span class="mono">BITDRIFT / OBJECT 001</span><span class="art-tag">保持探索</span></div><figcaption><span>让好奇心<br>有自己的轨道。</span><span class="mono">IN ORBIT<br>IN PROGRESS</span></figcaption></figure></section>
<div class="topic-strip"><div class="container strip-inner"><span class="mono">MY FIELD NOTES</span><span>人工智能</span><span class="strip-star" aria-hidden="true">✳</span><span>硬件体验</span><span class="strip-star" aria-hidden="true">✳</span><span>科技观察</span><span class="strip-star" aria-hidden="true">✳</span><span>日常手记</span></div></div>
<section class="container section" id="focus" aria-labelledby="focus-title"><div class="section-heading"><div><p class="eyebrow mono">01 / THINGS I FOLLOW</p><h2 id="focus-title">好奇心的几个方向</h2></div><p class="section-description">从一个新发现出发，<br>多问一句，多试一次。</p></div><div class="focus-grid">${focusMarkup}</div></section>
<section class="notes-section" id="notes" aria-labelledby="notes-title"><div class="container section"><div class="section-heading"><div><p class="eyebrow mono">02 / THE NOTEBOOK</p><h2 id="notes-title">写下来，慢慢想</h2></div><span class="section-description">关于工具、体验与观察的手记</span></div><div class="notes-list">${notesMarkup}</div></div></section>
<section class="container section about-section" id="about" aria-labelledby="about-title"><div class="about-heading"><p class="eyebrow mono">03 / A LITTLE ABOUT ME</p><h2 id="about-title">认识一下，<br>屏幕这边的我。</h2><span class="about-signature">${esc(site.name)}<small>内容创作者 / 科技爱好者</small></span></div><div class="about-text">${site.about.map(p => `<p>${esc(p)}</p>`).join('')}<div class="about-principle"><span class="mono">A NOTE TO SELF</span><p>查证事实，<br>也保留自己的思考。</p></div></div></section>
<section class="contact-section" id="contact" aria-labelledby="contact-title"><div class="container contact-inner"><div><p class="eyebrow mono">04 / KEEP IN TOUCH</p><h2 id="contact-title">交换一个<br>好想法。</h2><p>关于科技的新发现，或一个值得讨论的问题。<br>欢迎来打个招呼。</p></div><div class="contact-links"><a href="${esc(site.github)}" target="_blank" rel="noopener noreferrer" class="contact-link"><span class="mono">GITHUB</span><strong>看看我在做什么</strong><span class="contact-plus" aria-hidden="true">＋</span></a><button class="contact-link copy-account" type="button" data-copy="${esc(site.socialAccount)}"><span>小红书</span><strong>${esc(site.socialAccount)}</strong><span class="copy-label">复制账号名</span></button><p class="copy-status" role="status" aria-live="polite"></p></div></div></section>
</main>${footer()}</body></html>`;
await writeFile(resolve(out, 'index.html'), html);

for (const [index, note] of site.notes.entries()) {
  const next = site.notes[(index + 1) % site.notes.length];
  const article = `<!doctype html><html lang="zh-CN" id="top"><head>${head(`${note.title} · ${site.brand}`, note.excerpt, `/notes/${note.slug}/`)}</head><body>${header()}<main id="main" class="container article-page"><a class="article-back" href="/#notes">回到全部手记</a><article><div class="article-meta"><span class="category">${esc(note.category)}</span><time datetime="${esc(note.date)}">${dateLabel(note.date)}</time></div><h1>${esc(note.title)}</h1><p class="article-deck">${esc(note.excerpt)}</p><div class="article-author">${esc(site.name)} · ${esc(site.brand)}</div><div class="article-body">${note.paragraphs.map(p => `<p>${esc(p)}</p>`).join('')}</div></article><nav class="article-next" aria-label="继续阅读"><span class="mono">ANOTHER NOTE</span><a href="/notes/${next.slug}/">${esc(next.title)}</a></nav></main>${footer()}</body></html>`;
  const dir = resolve(out, 'notes', note.slug);
  await mkdir(dir, { recursive: true });
  await writeFile(resolve(dir, 'index.html'), article);
}

await writeFile(resolve(out, '404.html'), `<!doctype html><html lang="zh-CN" id="top"><head>${head(`页面未找到 · ${site.brand}`, '这个地址暂时没有内容。', null)}<meta name="robots" content="noindex"></head><body>${header()}<main id="main" class="container error-page"><p class="eyebrow mono">404 / OUT OF ORBIT</p><h1>这条轨道，<br>还没有留下记录。</h1><p>这个地址暂时没有内容。回到首页，继续看看。</p><a class="button button-dark" href="/">回到首页</a></main>${footer()}</body></html>`);
await writeFile(resolve(out, 'robots.txt'), `User-agent: *\nAllow: /\n${base ? `Sitemap: ${base}/sitemap.xml\n` : ''}`);
if (base) {
  const paths = ['/', ...site.notes.map(n => `/notes/${n.slug}/`)];
  await writeFile(resolve(out, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map(p => `<url><loc>${esc(base + p)}</loc></url>`).join('')}</urlset>`);
}
console.log(`Built homepage, ${site.notes.length} notes and 404 page → dist/`);
