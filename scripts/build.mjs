import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import site from '../site.config.mjs';
import renderHome from './home.mjs';
import { createPages } from './pages.mjs';
import { SOUND_TRACKS } from '../public/sound.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'dist');
const esc = (text) => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateLabel = (date) => date.replaceAll('-', '.');
const timeLabel = seconds => `${Math.floor(Math.round(seconds) / 60)}:${String(Math.round(seconds) % 60).padStart(2, '0')}`;
const readTime = note => Math.max(1, Math.ceil([...(note.paragraphs || []), ...(note.sections || []).flatMap(section => section.paragraphs), ...(note.checklist || [])].join('').length / 350));
const slugs = new Set();
for (const note of site.notes) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(note.slug) || slugs.has(note.slug)) throw new Error(`Invalid or duplicate slug: ${note.slug}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(note.date)) throw new Error(`Invalid date: ${note.date}`);
  if (!(note.paragraphs?.length || note.sections?.length)) throw new Error(`Empty note: ${note.slug}`);
  if (note.sourcesReviewedAt && !/^\d{4}-\d{2}-\d{2}$/.test(note.sourcesReviewedAt)) throw new Error(`Invalid source review date: ${note.slug}`);
  for (const source of note.sources || []) if (new URL(source.url).protocol !== 'https:') throw new Error(`Invalid source: ${note.slug}`);
  slugs.add(note.slug);
}
for (const route of site.explorations || []) {
  if (!slugs.has(route.note) || route.sites.some(name => !site.websites.some(link => link.name === name))) throw new Error(`Broken exploration route: ${route.id}`);
}
if (!/^https:\/\//.test(site.github)) throw new Error('GitHub URL must use HTTPS');
if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(site.email)) throw new Error('Invalid email address');
if (!/^[a-z0-9_]{1,15}$/i.test(site.updates?.username || '')) throw new Error('Invalid X updates username');
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
  <meta name="theme-color" content="#f3f6fc"><meta name="color-scheme" content="light dark"><meta name="description" content="${esc(description)}">
  <meta property="og:type" content="${path?.startsWith('/notes/') && path !== '/notes/' ? 'article' : 'website'}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:locale" content="zh_CN">
  ${base && path ? `<link rel="canonical" href="${esc(base + path)}"><meta property="og:url" content="${esc(base + path)}">` : ''}
  <title>${esc(title)}</title><link rel="icon" type="image/svg+xml" href="/favicon.svg"><script src="/theme.js"></script><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/future.css">${path === '/' || path === '/updates/' ? '<link rel="stylesheet" href="/updates.css">' : ''}${path === '/updates/' ? '<script src="/updates.js" type="module"></script>' : ''}${path?.startsWith('/notes/') && path !== '/notes/' ? '<link rel="stylesheet" href="/reader.css">' : ''}<script src="/app.js" defer></script><script src="/experience.js" type="module"></script><script src="/library.js" type="module"></script><script src="/reader.js" type="module"></script>`;
}

const themeIcons = {
  light: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  dark: '<path d="M20.4 14.1A8.7 8.7 0 0 1 9.9 3.6 8.7 8.7 0 1 0 20.4 14.1Z"/>',
  system: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/>'
};
const themeIcon = (mode, className = '') => `<svg class="${className}" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${themeIcons[mode]}</svg>`;
function themeControl() {
  return `<div class="theme-control"><button class="icon-button theme-toggle" type="button" aria-label="外观设置" aria-controls="theme-menu" aria-expanded="false" aria-haspopup="dialog">${themeIcon('light','theme-sun')}${themeIcon('dark','theme-moon')}<span class="theme-auto-dot" aria-hidden="true"></span></button><div class="theme-menu" id="theme-menu" role="dialog" aria-label="外观设置" hidden><div class="theme-menu-heading"><span>外观</span><span class="mono">APPEARANCE</span></div><div role="group" aria-label="选择主题">${[['light','浅色'],['dark','深色'],['system','跟随系统']].map(([mode,label])=>`<button type="button" class="theme-option" data-theme-choice="${mode}" aria-pressed="false">${themeIcon(mode)}<span>${label}</span><span class="theme-check" aria-hidden="true">✓</span></button>`).join('')}</div><button class="motion-toggle" type="button" aria-label="暂停动态效果" aria-pressed="false"><span class="motion-icon" aria-hidden="true">Ⅱ</span><span class="motion-label">暂停动态</span></button></div><span class="theme-status sr-only" role="status" aria-live="polite"></span></div>`;
}

const jsonForHtml = value => JSON.stringify(value).replaceAll('<', '\\u003c');
const libraryItems = [
  ...site.notes.map(note => ({id:`note:${note.slug}`,kind:'note',name:note.title,description:note.excerpt,category:note.category,href:`/notes/${note.slug}/`,date:note.date,search:`${note.title} ${note.excerpt} ${note.category}`})),
  ...site.websites.map(link => ({id:`site:${link.url}`,kind:'site',name:link.name,description:link.description,category:link.category,href:link.url,external:true,search:`${link.name} ${link.description} ${link.category} ${new URL(link.url).hostname}`}))
];
const saveButton = (id,name) => `<button class="save-button" type="button" data-save-item="${esc(id)}" aria-label="收藏${esc(name)}" aria-pressed="false"><span class="save-symbol" data-save-icon aria-hidden="true">☆</span><span data-save-label>收藏</span></button>`;
const commandItems = [
  ...[['首页','/','个人网站首页'],['网站','/directory/',`探索 ${site.websites.length} 个网站入口`],['手记','/notes/',`阅读 ${site.notes.length} 篇手记`],['动态','/updates/',`@${site.updates.username} 的 Codex 重置消息与公开记录`],['收藏','/library/','收藏与最近打开'],['关于','/about/','个人介绍与联系方式'],['联系我','/about/#contact',site.email]].map(([name,href,description])=>({name,description,category:'页面',href})),
  ...(site.explorations || []).map(route => ({name:route.title,description:route.description,category:'探索路线',href:`/notes/#route-${route.id}`})),
  ...site.notes.map(note=>({name:note.title,description:note.excerpt,category:'手记',href:`/notes/${note.slug}/`,itemId:`note:${note.slug}`})),
  ...site.websites.map(link=>({name:link.name,description:link.description,category:link.category,href:link.url,external:true,itemId:`site:${link.url}`})),
  {name:'切换到深色',description:'夜间的冰蓝轨道',category:'外观',action:'dark'},
  {name:'切换到浅色',description:'清透的浅色空间',category:'外观',action:'light'},
  {name:'跟随系统外观',description:'使用设备当前的明暗偏好',category:'外观',action:'system'},
];
function experienceMarkup() {
  return `<script type="application/json" id="library-data">${jsonForHtml(libraryItems)}</script><script type="application/json" id="command-data">${jsonForHtml(commandItems)}</script>
    <dialog class="command-dialog" aria-labelledby="command-title"><div class="command-header"><div><span class="eyebrow mono">BITDRIFT / QUICK ACCESS</span><h2 id="command-title">想探索什么？</h2></div><button class="icon-button command-close" type="button" aria-label="关闭快捷搜索">×</button></div><label class="command-search"><span class="search-icon" aria-hidden="true"></span><span class="sr-only">搜索页面、手记或网站</span><input class="command-input" type="search" placeholder="搜索页面、手记、网站…" role="combobox" aria-expanded="true" aria-autocomplete="list" aria-controls="command-results" autocomplete="off" maxlength="100"></label><p class="command-count" role="status" aria-live="polite"></p><div id="command-results" class="command-results" role="listbox" aria-label="搜索结果"></div><p class="command-empty" hidden>没有找到结果，试试网站名或其他关键词。</p><div class="command-footer"><span><kbd>↑</kbd> <kbd>↓</kbd> 选择 <kbd>↵</kbd> 前往</span><span><kbd>esc</kbd> 关闭</span></div></dialog>
    <aside class="sound-dock" aria-label="音乐播放器" data-state="paused" data-track="${SOUND_TRACKS[0].id}"><audio class="sound-audio" preload="none" hidden></audio>
      <div class="sound-panel" id="sound-panel" hidden>
        <div class="sound-panel-top"><p class="mono">BITDRIFT / RADIO</p><button class="sound-panel-close icon-button" type="button" aria-label="关闭音乐面板">×</button></div>
        <div class="sound-track-heading"><span class="sound-cover" aria-hidden="true"><svg viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="8"/><ellipse cx="20" cy="20" rx="17" ry="6" transform="rotate(-30 20 20)"/><circle cx="32" cy="13" r="2"/></svg></span><div><h2 class="sound-title">${esc(SOUND_TRACKS[0].title)}</h2><p class="sound-description">${esc(SOUND_TRACKS[0].subtitle)}</p></div></div>
        <div class="sound-tracks" role="group" aria-label="选择音乐">${SOUND_TRACKS.map((track,index)=>`<button class="sound-track" type="button" data-sound-track="${track.id}" aria-pressed="${index===0}" aria-label="选择${esc(track.title)}"><span>${esc(track.title)}</span><small>${esc(track.mood)}</small><i aria-hidden="true"></i></button>`).join('')}</div>
        <div class="sound-timeline"><div class="sound-waveform" aria-hidden="true"><svg viewBox="0 0 288 46" preserveAspectRatio="none"><defs><clipPath id="sound-waveform-progress"><rect class="sound-waveform-mask" width="0" height="46"/></clipPath></defs><g class="sound-waveform-base"></g><g class="sound-waveform-played" clip-path="url(#sound-waveform-progress)"></g></svg><span class="sound-waveform-placeholder mono">SOUND IN ORBIT</span></div><label class="sr-only" for="sound-seek">播放进度</label><input id="sound-seek" class="sound-seek" type="range" min="0" max="${SOUND_TRACKS[0].duration}" step="0.1" value="0" aria-valuetext="0:00"><div class="sound-time"><span class="sound-elapsed mono">0:00</span><span class="sound-duration mono">${timeLabel(SOUND_TRACKS[0].duration)}</span></div></div>
        <div class="sound-section-row"><span class="sound-section" role="status" aria-live="polite">${esc(SOUND_TRACKS[0].artist)}</span><span class="sound-bpm mono">${SOUND_TRACKS[0].year} · VOCAL</span></div>
        <button class="sound-jump" type="button">${esc(SOUND_TRACKS[0].highlight.label)} <span class="mono">${timeLabel(SOUND_TRACKS[0].highlight.time)} ↗</span></button>
        <label class="sound-volume-label" for="sound-volume"><span>音量</span><output class="sound-volume-value" for="sound-volume">22%</output></label><input id="sound-volume" class="sound-volume" type="range" min="0" max="100" value="22" aria-label="音乐音量"><div class="sound-panel-bottom"><button class="sound-next" type="button" aria-label="下一首音乐" title="下一首音乐"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m7 6 8 6-8 6V6Zm10 0v12"/></svg></button><button class="sound-mute" type="button" aria-pressed="false">静音</button><button class="sound-repeat" type="button" aria-label="切换到单曲循环" aria-pressed="false">顺序播放</button></div><p class="sound-credit">Music by <a class="sound-source" href="${esc(SOUND_TRACKS[0].source)}" target="_blank" rel="noopener noreferrer">${esc(SOUND_TRACKS[0].artist)}</a> · <a class="sound-license" href="${esc(SOUND_TRACKS[0].licenseUrl)}" target="_blank" rel="noopener noreferrer">${esc(SOUND_TRACKS[0].license)}</a></p><p class="sound-status" role="status" aria-live="polite"></p>
      </div>
      <button class="sound-toggle" type="button" aria-label="播放${esc(SOUND_TRACKS[0].title)}" aria-pressed="false"><span class="sound-play-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="m8 5 11 7-11 7V5Z"/></svg></span><span class="sound-pause-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M8 5v14M16 5v14"/></svg></span><span class="sound-name"><span class="sound-dock-title">${esc(SOUND_TRACKS[0].title)}</span><small><span class="sound-state">点击播放</span><span class="sound-dock-time mono">0:00</span></small></span></button>
      <button class="sound-expand" type="button" aria-label="展开音乐控制" aria-expanded="false" aria-controls="sound-panel"><span aria-hidden="true">⌃</span></button><span class="sound-dock-progress" aria-hidden="true"></span>
    </aside>`;
}

function header(current = '') {
  return `<a class="skip-link" href="#main">跳到正文</a><div class="scroll-progress" aria-hidden="true"></div><div class="pointer-glow" aria-hidden="true"></div><header class="site-header"><div class="container header-inner">
    <a class="brand" href="/" aria-label="${esc(site.brand)}首页"><span class="brand-symbol" aria-hidden="true">b.</span><span>${esc(site.brand)}<small>IDEAS IN ORBIT</small></span></a>
    <nav class="main-nav" aria-label="主导航" id="main-nav">${[['home','/','首页'],['notes','/notes/','手记'],['directory','/directory/','网站'],['updates','/updates/','动态'],['library','/library/','收藏'],['about','/about/','关于']].map(([key,href,label])=>`<a href="${href}"${current === key ? ' aria-current="page" class="is-current"' : ''}>${label}</a>`).join('')}</nav>
    <div class="header-controls"><button class="command-open icon-button" type="button" aria-label="打开快捷搜索" title="快捷搜索（Ctrl / ⌘ K）" data-open-command><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg></button>${themeControl()}<button class="menu-toggle icon-button" type="button" aria-controls="main-nav" aria-expanded="false" aria-label="打开导航"><span></span><span></span></button></div>
  </div></header>${experienceMarkup()}`;
}

function footer() {
  return `<footer class="site-footer compact-footer"><div class="container footer-inner"><span>© ${new Date().getUTCFullYear()} ${esc(site.name)} · ${esc(site.brand)}</span><div class="footer-contact"><a href="mailto:${esc(site.email)}">${esc(site.email)}</a><button type="button" data-copy="${esc(site.email)}" data-copy-kind="email" aria-label="复制邮箱">复制</button><a href="${esc(site.github)}" target="_blank" rel="noopener noreferrer">GitHub ↗</a><a href="/about/">关于</a></div></div><p class="container email-status copy-status" role="status" aria-live="polite"></p></footer>`;
}
const pageKit = createPages(site, { esc, head, header, footer, saveButton, dateLabel, readTime, jsonForHtml });
await writeFile(resolve(out, 'index.html'), renderHome(site, { esc, head, header, footer, ...pageKit }));
for (const [path, html] of Object.entries(pageKit.pages)) {
  await mkdir(resolve(out, path), { recursive: true });
  await writeFile(resolve(out, path, 'index.html'), html);
}

for (const [index, note] of site.notes.entries()) {
  const next = site.notes[(index + 1) % site.notes.length];
  const toc = note.sections?.length ? `<nav class="article-toc" aria-label="文章目录"><span class="mono">IN THIS NOTE / 本篇目录</span><ol>${note.sections.map((section,i) => `<li><a href="#section-${i+1}">${esc(section.title)}</a></li>`).join('')}</ol></nav>` : '';
  const body = (note.paragraphs || []).map(p => `<p>${esc(p)}</p>`).join('') + (note.sections || []).map((section,i) => `<section class="article-section" aria-labelledby="section-${i+1}"><h2 id="section-${i+1}"><span class="mono" aria-hidden="true">0${i+1}</span>${esc(section.title)}</h2>${section.paragraphs.map(p => `<p>${esc(p)}</p>`).join('')}</section>`).join('');
  const checklist = note.checklist?.length ? `<aside class="article-checklist" aria-label="实践清单"><span class="mono">TRY THIS / 实践清单</span><ul>${note.checklist.map(item => `<li><span aria-hidden="true">✓</span>${esc(item)}</li>`).join('')}</ul></aside>` : '';
  const sources = note.sources?.length ? `<aside class="article-sources" aria-label="资料来源"><h2>资料与延伸阅读</h2><ul>${note.sources.map(source => `<li><a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.title)} <span aria-hidden="true">↗</span></a></li>`).join('')}</ul>${note.sourcesReviewedAt ? `<p>资料入口核对于 ${dateLabel(note.sourcesReviewedAt)}。</p>` : ''}</aside>` : '';
  const article = `<!doctype html><html lang="zh-CN" id="top"><head>${head(`${note.title} · ${site.brand}`, note.excerpt, `/notes/${note.slug}/`)}</head><body class="compact-article">${header('notes')}<main id="main" class="container article-page" data-reading-id="note:${note.slug}"><a class="article-back" href="/notes/">← 回到全部手记</a><div class="reader-toolbar" aria-label="阅读工具"><div class="reader-actions">${saveButton(`note:${note.slug}`,note.title)}<button class="reader-settings-toggle" type="button" aria-controls="reader-settings" aria-expanded="false" aria-haspopup="dialog">阅读设置</button></div><div class="reader-settings" id="reader-settings" role="dialog" aria-label="阅读设置" hidden><h2 class="reader-settings-title">阅读设置</h2><button class="reader-settings-close" type="button" aria-label="关闭阅读设置">×</button><span class="reader-settings-label">字号</span><div class="reader-size" role="group" aria-label="阅读字号"><button type="button" data-reader-size="normal" aria-label="标准字号" aria-pressed="true">标准</button><button type="button" data-reader-size="large" aria-label="大字号" aria-pressed="false">大字号</button></div><button class="reader-focus" type="button" data-reader-focus aria-pressed="false">专注阅读</button><button class="reader-restart" type="button" data-reader-reset hidden>重新开始阅读</button></div><div class="reader-progress-row"><div class="reader-progress" role="progressbar" aria-label="阅读进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span></span></div><span class="reader-percent mono">0%</span></div></div><aside class="reader-resume" aria-label="上次阅读位置" hidden><p class="reader-resume-message"></p><div><button type="button" data-reader-resume>继续上次阅读</button><button type="button" data-reader-reset>从头阅读</button></div></aside><article class="article-content"><div class="article-meta"><span class="category">${esc(note.category)}</span><time datetime="${esc(note.date)}">${dateLabel(note.date)}</time><span>约 ${readTime(note)} 分钟</span></div><h1>${esc(note.title)}</h1><p class="article-deck">${esc(note.excerpt)}</p><div class="article-author">${esc(site.name)} · ${esc(site.brand)}</div>${note.takeaway ? `<div class="article-takeaway"><span class="mono">TAKEAWAY</span><p>${esc(note.takeaway)}</p></div>` : ''}${toc}<div class="article-body">${body}${checklist}${sources}</div></article><nav class="article-next" aria-label="继续阅读"><span class="mono">ANOTHER NOTE</span><a href="/notes/${next.slug}/" data-visit-item="note:${next.slug}">${esc(next.title)} →</a></nav></main>${footer()}</body></html>`;
  const dir = resolve(out, 'notes', note.slug);
  await mkdir(dir, { recursive: true });
  await writeFile(resolve(dir, 'index.html'), article);
}

await writeFile(resolve(out, '404.html'), `<!doctype html><html lang="zh-CN" id="top"><head>${head(`页面未找到 · ${site.brand}`, '这个地址暂时没有内容。', null)}<meta name="robots" content="noindex"></head><body>${header()}<main id="main" class="container error-page"><p class="eyebrow mono">404 / OUT OF ORBIT</p><h1>这条轨道，<br>还没有留下记录。</h1><p>这个地址暂时没有内容。回到首页，继续看看。</p><a class="button button-accent" href="/">回到首页</a></main>${footer()}</body></html>`);
await writeFile(resolve(out, 'robots.txt'), `User-agent: *\nAllow: /\n${base ? `Sitemap: ${base}/sitemap.xml\n` : ''}`);
if (base) {
  const paths = ['/', '/notes/', '/directory/', '/updates/', '/library/', '/about/', ...site.notes.map(n => `/notes/${n.slug}/`)];
  await writeFile(resolve(out, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map(p => `<url><loc>${esc(base + p)}</loc></url>`).join('')}</urlset>`);
}
console.log(`Built homepage, ${Object.keys(pageKit.pages).length} index pages, ${site.notes.length} notes, ${site.websites.length} website links and 404 page → dist/`);
