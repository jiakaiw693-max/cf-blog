# 十点准时睡 · 比特漂流

一个记录 AI、科技与硬件发现的个人网站。首页采用炭黑背景、冷白文字与青绿色点缀，配有玻璃金属轨道球体主视觉、柔光卡片和滚动入场效果。

网站包含个人介绍、三个关注方向、三篇独立阅读页面、24 个常用网站入口、关于与联系区。网站导航支持分类和搜索，涵盖 AI、开发、设计与社区。联系区公开 QQ 邮箱 `766043204@qq.com`，支持发送邮件、复制邮箱与复制小红书账号名。

页面适配手机和桌面，支持键盘导航与真实 404 页面。鼠标倾斜、按钮跟随、滚动浮动、轨道旋转和跑马灯均可通过「暂停动态效果」按钮暂停；系统开启减少动态效果时自动使用静态模式。正文随 HTML 输出，阅读内容无需等待 JavaScript。

首版个人介绍和三篇手记是本次制作撰写的初始内容，可在 `site.config.mjs` 里直接修改或删除。

## 配置到 Cloudflare Workers

在 Cloudflare 控制台进入 **Workers & Pages → Create application → Import a repository**，连接 GitHub 并选择 `jiakaiw693-max/cf-blog`。填写：

| 配置项 | 填写内容 |
| --- | --- |
| Worker 名称 | `cf-blog` |
| 生产分支 | `main` |
| 构建命令 | `npm run build` |
| 部署命令 | `npx wrangler deploy` |
| 根目录 | 留空，使用仓库根目录 |
| Node.js | 仓库 `.nvmrc` 已指定 `22` |
| 环境变量 | 首次部署可留空 |

保存并部署后，Cloudflare 会给出实际的 `workers.dev` 地址。后续推送 `main` 可自动构建部署。Worker 名称应与 `wrangler.jsonc` 里的 `name` 一致；已有 Worker 使用其他名字时，将配置文件里的 `name` 改成实际名字。

这是 Workers Static Assets 项目。静态资源目录已在 `wrangler.jsonc` 中设置为 `./dist`，无需填写 Worker 脚本入口、配置数据库或添加 API 密钥。

第一次部署不要求预先知道域名。获得稳定的正式地址后，在 `site.config.mjs` 的 `url` 填完整 HTTPS 根地址并重新部署，网站会生成 canonical 链接、Open Graph 地址与 `sitemap.xml`。也支持 Cloudflare 构建环境变量 `SITE_URL`；配置文件中的 `url` 优先。地址必须是网站根地址，例如 `https://example.com`。

### 仓库此前已连接 Cloudflare Pages

新的提交会按已有 Cloudflare 项目的设置触发构建。若继续使用 **Pages**，构建命令为 `npm run build`，输出目录为 `dist`，根目录使用仓库根，Pages 自动上传资源，无需执行 `wrangler deploy`。Pages 可使用自动注入的 `CF_PAGES_URL` 生成地址；正式域名建议通过 `SITE_URL` 或 `site.config.mjs` 设置。

要使用 **Workers**，请按上面的步骤创建或连接 Worker。GitHub 提交本身不会把已有 Pages 项目转换成 Worker。

## 编辑内容

| 文件 | 用途 |
| --- | --- |
| `site.config.mjs` | 名字、品牌、个人简介、关注方向、手记、公开邮箱与 GitHub 链接 |
| `site.links.mjs` | 24 个网站入口的名称、网址、分类、简介与图标颜色 |
| `public/styles.css` | 配色、字体、排版与响应式样式 |
| `public/app.js` | 手机导航、网站筛选、复制功能与可暂停的动态效果 |
| `public/assets/bitdrift-orb.webp` | 首页主视觉 |
| `scripts/build.mjs` | 生成首页、手记页面、404 与可选 sitemap |
| `scripts/home.mjs` | 首页结构与网站导航卡片 |
| `wrangler.jsonc` | Cloudflare Workers 名称和静态资源配置 |

新增手记时，在 `notes` 数组里添加一项，提供唯一的英文 `slug`、分类、日期、标题、摘要和 `paragraphs`。每篇手记自动生成 `/notes/slug/` 页面。当前采用手动发布，配置中的所有手记都会进入网站；准备好内容后再添加到该数组。

## 本地运行

使用 Node.js 22 或更新版本：

```bash
npm ci
npm run check
npm run dev
```

`npm run dev` 会先构建，再使用 Wrangler 启动本地 Workers 预览。检查正式部署配置可执行：

```bash
npx wrangler deploy --dry-run
```

真实上线需要 Cloudflare 控制台部署成功。本地构建与 dry-run 用于验证代码和配置。

## 部署参考

- [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)
- [Workers 与 Git 仓库集成](https://developers.cloudflare.com/workers/ci-cd/builds/)
- [Workers 构建设置](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)
- [静态路由与 404 页面](https://developers.cloudflare.com/workers/static-assets/routing/static-site-generation/)
