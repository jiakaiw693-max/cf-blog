# 嘉凯的博客 · cf-blog

一个以文章阅读为主的个人博客，使用 Astro、TypeScript、Markdown 和 Pagefind，部署到 **Cloudflare Workers Static Assets**。

用 Markdown 写文章，推送到 GitHub 后自动构建。网页和搜索索引在构建时生成，由 Cloudflare 分发；运行网站无需数据库或常驻 Node.js 服务。源码、npm 锁文件和 Workers 配置都在仓库根目录，可以直接连接 Cloudflare Workers 的 Git 构建。

这是完整的 Astro 项目，已经替换仓库原有的 React / Vite 模板。Cloudflare 账户、域名和部署设置由仓库所有者配置，下面提供完整操作步骤。

## 已包含的功能

首页与置顶文章、文章列表和自动分页、文章详情和目录、中文标签页、时间归档、标题与正文搜索、RSS、站点地图、robots.txt、自定义 404，以及手机适配、浅色/深色模式、代码高亮和代码复制。

文章统一由 `src/content/blog/` 下的 Markdown 文件管理。草稿和发布日期尚未到来的文章，不会生成公开页面，也不会出现在标签、归档、RSS、站点地图或搜索里。没有文章、没有标签和没有搜索结果时，都有对应的空状态。

## 本地运行

使用 Node.js **22.12 或更新版本**，推荐 Node.js 24。项目已包含 `.nvmrc` 和 npm 锁文件。

```bash
git clone https://github.com/jiakaiw693-max/cf-blog.git
cd cf-blog
npm ci
npm run dev
```

开发地址为 `http://localhost:4321`。开发服务可以预览文章和布局；完整搜索索引在构建时生成。

想验证完整网站及搜索：

```bash
npm run check
npm run build:local
npm run preview
```

`build:local` 允许未配置站点地址时使用本地地址。正式构建 `npm run build` 要求先设置 `SITE_URL`，避免生成错误的 RSS 和 canonical 链接。

本地也可以将 `.env.example` 复制为 `.env`，填入站点地址。`.env` 不会被提交到 Git。

## 部署到已连接 GitHub 的 Cloudflare Workers

源码和 `package-lock.json` 已放在仓库根目录。不要提交 `node_modules`、`dist`、`.env` 或 `.wrangler`。

如果还没创建 Worker，在 Cloudflare 控制台的 **Workers & Pages** 中创建应用，选择连接 Git 仓库，选中 `jiakaiw693-max/cf-blog`。选择 Workers 的构建流程。

### 修改 Worker 名称

`wrangler.jsonc` 中默认的 `name` 是 **`cf-blog`**。建议在 Cloudflare 中也使用这个 Worker 名称；如果你已创建的 Worker 叫别的名字，把这里的 `name` 改成对应名称后提交。它需要与 Cloudflare Worker 一致，不要求与 GitHub 仓库同名。

本项目是纯静态输出，不需要添加 `main`、服务端适配器或 `ASSETS` 绑定。构建产物目录是 `dist`。

### 填写构建设置

在 Cloudflare 的 Workers & Pages 中打开该 Worker，进入 **Settings → Build**，填写：

| 设置 | 本仓库使用的值 |
| --- | --- |
| Git 仓库 | `jiakaiw693-max/cf-blog` |
| 生产分支 | `main` |
| 根目录 | 仓库根目录，保持默认即可 |
| 构建命令 | `npm run build` |
| 部署命令 | `npx wrangler deploy` |
| 构建变量 `SITE_URL` | 实际网站根地址，例如 `https://cf-blog.你的子域.workers.dev` |
| 构建变量 `NODE_VERSION` | `24`，也可以使用仓库自带的 `.nvmrc` |

使用 Cloudflare 提供的默认依赖安装流程即可，npm 锁文件已提交。如果控制台提供自定义安装命令，使用 `npm ci`。只运行 `npx wrangler deploy` 不会生成网页，必须先执行构建命令。

`SITE_URL` 是**构建变量**，需要在运行构建命令之前可用。它不是 `wrangler.jsonc` 中的运行时 `vars`，因为 RSS、SEO 信息和站点地图在构建时生成。

首次配置时，在 Cloudflare 中确认自己的 `workers.dev` 子域，用完整的正式 HTTPS 地址填入 `SITE_URL`。不要直接复制示例中的“你的子域”，也不要使用本地地址。配置保存后手动触发一次构建；之后推送到 `main` 就会自动更新。

项目中的实际构建顺序是 Astro 生成网页，然后 Pagefind 索引文章，最后由 Wrangler 上传 `dist`。使用 Cloudflare 自带 Git 集成时，不需要另建 GitHub Actions 部署流程。

### 上线后检查

访问首页、任意文章和中文标签页；在搜索页面尝试搜索“科技”或“笔记”；查看 `/rss.xml` 和 `/sitemap-index.xml` 的链接是否使用你的正式域名；访问一个不存在的路径，确认返回 404 页面。

如果之后绑定自定义域名，把 `SITE_URL` 改成自定义域名，然后重新构建部署一次。域名的 DNS 和绑定设置在 Cloudflare 控制台完成。

## 修改个人资料和外观

`src/config.ts` 管理博客标题、作者、简介和每页文章数量。首页介绍在 `src/pages/index.astro`，关于页面在 `src/pages/about/index.astro`，统一颜色、字体和手机布局在 `src/styles/global.css`。

项目带有三篇标记为“示例”的文章，便于查看页面、标签和搜索效果。正式写作时，可以替换或删除 `welcome.md`、`markdown-notes.md` 和 `questions-first.md`。不要把示例内容当成已经发布过的个人经历。

`writing-template.md` 默认是草稿，可以复制为新文件继续使用。

## 发布新文章

在 `src/content/blog/` 创建一个 Markdown 文件，例如 `my-first-post.md`：

```markdown
---
title: "我的第一篇文章"
description: "用一两句话概括文章的内容。"
publishedAt: 2026-10-02T14:00:00+08:00
tags: ["科技", "学习"]
draft: false
featured: false
---

从这里开始写正文。

## 一个小标题

继续展开你的想法。
```

这篇文章的地址是 `/posts/my-first-post/`。文件名决定网址，不必随着文章标题修改。要明确指定固定地址，也可以添加 `slug: my-fixed-url`。

`draft: true` 会排除公开输出；`featured: true` 可以将文章放到首页置顶区域。多个置顶文章存在时，首页使用发布日期最新的一篇。可选的 `updatedAt` 表示更新时间，不应早于发布日期。自己的正式文章可以删除 `example`，它只用于标记本项目自带的示例文章。

日期建议使用带时区的完整写法，例如 `2026-10-02T14:00:00+08:00`。未来发布日期只会在**到时后的下一次构建**中出现；本项目不配置定时发布任务。草稿状态控制网站输出，不改变源文件在 GitHub 仓库中的可见性。

图片可以放进 `public/images/`，并在文章里写：

```markdown
![描述图片内容](/images/my-photo.webp)
```

这里的路径需要对应真实存在的图片。项目没有图片或外部字体依赖，初始页面加载不需要第三方素材服务。

写完并推送到生产分支后，Cloudflare 会自动重新构建和部署，页面与搜索索引一同更新。

## 常用命令

- `npm run dev`：开发预览
- `npm run check`：Astro 与 TypeScript 检查
- `npm run build:local`：完整本地构建，包含搜索
- `npm run build`：使用已配置的 `SITE_URL` 构建
- `npm run preview`：预览生成后的完整静态网站
- `npm run preview:worker`：在 Wrangler 中验证 Workers 访问行为（先构建）
- `npm run deploy`：本地手动构建并部署，需要你自己的 Cloudflare 登录；连接 GitHub 自动部署时不必运行

## 文件位置

- `src/config.ts`：站点名称、作者、简介和分页数量。
- `src/content/blog/`：Markdown 文章和写作模板。
- `src/pages/`：首页、文章、标签、归档、关于、搜索等页面，以及 RSS 和 robots 输出。
- `src/components/`、`src/layouts/`：共用组件和页面布局。
- `src/styles/global.css`：配色、排版和移动端样式。
- `public/`：图标、响应头配置和搜索脚本；放在这里的图片可通过根路径引用。
- `scripts/`：构建流程和 `SITE_URL` 校验。
- `wrangler.jsonc`：Workers 名称、静态资源目录和 404 配置。
- `dist/`：生成的网页及搜索索引，由构建生成，不提交到仓库。

## 常见问题

**构建提示缺少 `SITE_URL`？** 在 Cloudflare 的构建变量中添加正式地址，再重新构建。本地仅预览时可以运行 `npm run build:local`。

**开发预览中搜索不可用？** 搜索依赖生成后的 Pagefind 索引。运行 `npm run build:local`，再运行 `npm run preview` 测试完整搜索。

**新文章没出现？** 检查文件是否位于 `src/content/blog/`、`draft` 是否为 `false`、发布日期是否已到，以及 Cloudflare 最新构建是否成功。

**Worker 名称不匹配？** 将 `wrangler.jsonc` 的 `name` 与 Cloudflare 中的 Worker 名称设为一致。本项目默认是 `cf-blog`。

**RSS 或站点地图还是旧域名？** 修改构建变量 `SITE_URL`，然后重新构建。仅绑定域名不会重写已生成的链接。

## 官方资料

- [Astro 内容集合](https://docs.astro.build/en/guides/content-collections/)
- [Astro 部署到 Cloudflare](https://docs.astro.build/en/guides/deploy/cloudflare/)
- [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)
- [Workers 构建配置](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)
- [Pagefind](https://pagefind.app/docs/)
