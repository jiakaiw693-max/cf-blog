# cf-blog 开发说明

本仓库使用 Astro 静态输出、TypeScript、Markdown 和 Pagefind，目标平台是 Cloudflare Workers Static Assets。完整使用及部署说明见 `README.md`。

## 结构与约定

- 文章放在 `src/content/blog/`，元数据由 `src/content.config.ts` 校验。公开文章统一使用 `src/lib/posts.ts` 的 `getPosts()`，排除草稿及尚未到发布日期的文章。
- `src/config.ts` 管理站点资料，`src/styles/global.css` 管理共享样式。
- 界面采用“个人观察手记”风格。`ObservationArt.astro` 是首页原生 SVG 插画，`CoverArt.astro` 按稳定种子生成文章与主题封面；插画为装饰，不进入阅读和搜索内容。文章编号按当前公开文章顺序生成，不作为永久 ID。
- 浏览器交互按职责放在 `src/scripts/`：`reading-list.ts` 管理本地收藏，`reader.ts` 管理字号、目录与进度，`site.ts` 管理导航、主题和快捷操作。收藏只保存公开文章 ID，任何来自本地存储的数据都需校验。
- `public/search.js` 是浏览器原生模块，在构建后的页面中按需加载 `/pagefind/pagefind.js`。不要把生成的 Pagefind 入口交给 Vite 打包。
- `dist/`、`.astro/`、`.wrangler/` 和 `node_modules/` 都是生成内容，不提交。不要提交 `.env` 或 Cloudflare 凭据。
- 项目没有运行时服务器、数据库或 Cloudflare 绑定。纯静态部署无需 `main` 入口或 Astro 服务端适配器。
- `wrangler.jsonc` 的 `name` 必须与 Cloudflare Worker 一致，默认是 `cf-blog`。静态资源目录为 `dist`，缺失路径使用真实 404 页面。

## 验证

使用 Node.js 22.12 或更新版本，推荐仓库 `.nvmrc` 指定的 Node.js 24。

```bash
npm ci
npm run check
npm run build:local
npx wrangler deploy --dry-run
```

`build:local` 可以使用本地地址。正式 `npm run build` 必须设置网站完整根地址 `SITE_URL`，它是构建变量，不是 Worker 运行时变量。构建先生成 Astro 页面，再生成 Pagefind 索引。

更改文章公开规则时，同时检查文章页、标签、归档、RSS、站点地图和搜索索引。更改页面交互时，检查手机布局、键盘操作和浅色/深色模式。

正式构建使用统一的 `BLOG_BUILD_TIME` 截止时间，确保一次构建中的所有公开输出一致；不要让草稿、未来文章或相关文章推荐进入公开搜索。搜索与收藏页不进入站点地图。动效尊重 `prefers-reduced-motion`，内容不依赖 JavaScript 显示。
