# cf-blog 开发说明

本仓库为十点准时睡 · 比特漂流的个人网站，使用原生 HTML、CSS 与 JavaScript，通过 Node.js 构建静态页面，部署到 Cloudflare Workers Static Assets。

- 内容集中在 `site.config.mjs`，共享样式在 `public/styles.css`，浏览器交互在 `public/app.js`。
- `scripts/build.mjs` 将 `public/` 复制到 `dist/`，生成首页、手记页和 404 页。所有配置中的手记均会公开，准备好后再写入数组。
- `url` 为空时仍可构建；正式域名提供后才生成 canonical 和 sitemap。地址优先级为配置 `url`、`SITE_URL`、Pages 的 `CF_PAGES_URL`。
- 不提交 `dist/`、`node_modules/`、`.wrangler/`、`work/`、`outputs/`、`.env` 或凭据。
- Worker 名称默认 `cf-blog`，需与 Cloudflare 实际名称一致。静态资源为 `./dist`，无需 `main`。
- 保持原生内容可读、键盘可用、手机布局正常，动效尊重 `prefers-reduced-motion`。链接和复制行为须实际可用。
- 个人人物资料需要来自已确认信息。首版手记允许用户直接修改。

验证使用 Node.js 22 或更新版本：`npm ci`、`npm run check`、`npx wrangler deploy --dry-run`。界面变更另外检查桌面与手机、文章导航和浏览器错误。
