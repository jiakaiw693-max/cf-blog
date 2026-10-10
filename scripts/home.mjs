export default function renderHome(site, { esc, head, header, footer, noteCards, siteCards, libraryMarkup }) {
  const featuredNames = ['ChatGPT', 'GitHub', 'Figma', 'IEEE Spectrum', 'iFixit', 'Wikipedia'];
  const featured = featuredNames.map(name => site.websites.find(link => link.name === name)).filter(Boolean);
  return `<!doctype html><html lang="zh-CN" id="top"><head>${head(site.title, site.description)}<link rel="preload" as="image" href="/assets/bitdrift-orb.webp"></head><body class="home-page compact-home">
${header('home')}<main id="main">
  <section class="hero container" aria-labelledby="hero-title">
    <div class="hero-copy"><p class="hero-kicker mono">BITDRIFT / PERSONAL SPACE</p><p class="intro-line">你好，我是 <strong>${esc(site.name)}</strong>。</p><h1 id="hero-title"><span class="hero-title-line">保持好奇，</span><span class="hero-title-line">慢慢<span class="gradient-text">记录。</span></span></h1><p class="hero-description">记录 AI、科技与硬件里的发现。</p><div class="hero-actions"><a class="button button-accent" href="/notes/" data-magnetic>阅读手记 <span aria-hidden="true">↗</span></a><a class="text-link" href="/directory/">探索网站 <span aria-hidden="true">→</span></a></div></div>
    <figure class="hero-art orbit-terminal compact-art" data-tilt data-orbit="ai"><div class="art-grid" aria-hidden="true"></div><div class="art-media"><img src="/assets/bitdrift-orb.webp" width="1536" height="1024" alt="玻璃与金属轨道球体" fetchpriority="high"></div><span class="compact-orbit" aria-hidden="true"></span><figcaption class="mono">AI / 科技 / 硬件</figcaption></figure>
  </section>
  <div class="container"><a class="home-updates" href="/updates/"><span class="home-updates-mark" aria-hidden="true">𝕏</span><span>Codex 重置动态 <span class="home-updates-account">@${esc(site.updates.username)}</span></span><span class="home-updates-open">查看 <span aria-hidden="true">→</span></span></a></div>
  ${libraryMarkup(true)}
  <section class="container home-section" aria-labelledby="latest-title"><div class="compact-heading"><h2 id="latest-title">最近的手记</h2><a class="more-link" href="/notes/">全部手记 <span aria-hidden="true">→</span></a></div><div class="notes-list">${noteCards(site.notes.slice(0, 3))}</div></section>
  <section class="container home-section featured-section" aria-labelledby="featured-title"><div class="compact-heading"><h2 id="featured-title">值得打开</h2><a class="more-link" href="/directory/">全部网站 <span aria-hidden="true">→</span></a></div><div class="directory-grid">${siteCards(featured)}</div></section>
</main>${footer()}</body></html>`;
}
