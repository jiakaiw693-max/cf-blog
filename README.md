# 十点准时睡 · 比特漂流

一个记录 AI、科技与硬件发现的个人网站。深色主题采用深蓝底、冰蓝光线与紫色点缀，浅色主题采用淡蓝白底与深蓝文字。首页配有轨道展示区、渐变边框与滚动入场效果；点击 AI、硬件、科技可切换主视觉、介绍与对应关注方向入口。

页头「外观设置」可选择浅色、深色或跟随系统。默认跟随系统，手动选择会保存在当前浏览器，刷新及访问手记后仍保留。主题在页面显示前初始化，首页、手记与 404 使用同一套外观。

页头搜索按钮或 `Ctrl/Cmd + K` 可打开快捷搜索，查找页面、手记和网站，或切换主题与音乐状态。搜索结果支持方向键选择、回车进入、Esc 关闭。

网站包含个人介绍、三个关注方向、三篇独立阅读页面、24 个常用网站入口、关于与联系区。网站导航支持分类和搜索，涵盖 AI、开发、设计与社区。联系区公开 QQ 邮箱 `766043204@qq.com`，支持发送邮件、复制邮箱与复制小红书账号名。

页面适配手机和桌面，支持键盘导航与真实 404 页面。鼠标倾斜、按钮跟随、滚动浮动、轨道旋转和跑马灯均可通过「暂停动态效果」按钮暂停；系统开启减少动态效果时自动使用静态模式。正文随 HTML 输出，阅读内容无需等待 JavaScript。

右下角音乐浮窗提供播放、暂停、展开、收起、音量与静音控制。首次点击时，浏览器合成一段原创 96 BPM 太空电子声景，生成后循环播放；暂停后可从当前位置继续。音乐使用 Web Audio API，不请求外部音频；离开页面时停止播放。首次进入保持静音，点击播放后才开始。需要支持 Web Audio API 的现代浏览器。

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
| `public/styles.css` | 基础排版、响应式样式与动态效果 |
| `public/future.css` | 深浅配色、轨道界面、快捷搜索与音乐浮窗样式 |
| `public/theme.js` | 页面显示前的主题初始化、系统跟随与偏好保存 |
| `public/app.js` | 外观面板、手机导航、网站筛选、复制与可暂停的动态效果 |
| `public/experience.js` | 轨道切换、快捷搜索、复制反馈与音乐浮窗交互 |
| `public/sound.js` | 原创电子声景的合成、循环播放、暂停与音量控制 |
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
