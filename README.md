# 十点准时睡 · 比特漂流

一个记录 AI、科技与硬件发现的个人网站。首页展示三篇最新手记与六个精选网站，有本机记录时显示继续阅读和最多四个收藏。完整内容分为手记、网站、动态、收藏与关于五个独立页面。

深色主题采用深蓝底与冰蓝光线，浅色主题采用淡蓝白底与深蓝文字。首页保留轨道球体和轻量入场效果。页头「外观设置」可选择浅色、深色或跟随系统，也可暂停动态效果；系统开启减少动态效果时自动使用静态模式。外观默认跟随系统，手动选择保存在当前浏览器。

页头搜索按钮或 `Ctrl/Cmd + K` 可打开快捷搜索，查找页面、手记和网站，或切换主题。搜索结果支持方向键选择、回车进入、Esc 关闭。

`/notes/` 收录九篇手记，页底折叠面板提供四条主题探索路线。`/directory/` 收录 36 个网站，支持分类与搜索。`/library/` 汇总收藏和最近打开，`/about/` 放个人介绍与联系信息。QQ 邮箱 `766043204@qq.com` 支持发送邮件和复制。

页面适配手机和桌面，支持键盘导航与真实 404 页面。正文随 HTML 输出，阅读内容无需等待 JavaScript。

音乐通过右下角浮窗控制，提供 Sascha Ende 的三首完整人声歌曲：《Just A Fool (feat. Zara Taylor)》《Love》《Impatient (feat. Zara Taylor)》。MP3 来自作者官网，随网站部署，首次点击播放才加载。

浮窗提供播放和展开按钮，展开后可切歌、定位、调节音量和切换单曲循环。默认顺序播放，离开页面会停止声音。曲目与音量偏好保存在当前浏览器，再次进入页面需点击播放。波形来自完整音频，歌曲段落入口依据作者说明。

三首音乐以 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) 使用。播放器显示原曲名、作者、来源链接和许可；下载地址及文件校验值见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。网站代码与音乐分别适用各自许可。

个人介绍与文章为本次网站制作撰写的内容，新的六篇科技说明稿于 2026-10-05 加入。可在 `site.config.mjs` 里直接修改或删除。页面日期表示文章在本站的发布时间。

## 免费 X 动态

`/updates/` 展示 [@thsottiaux](https://x.com/thsottiaux) 的 X 官方公开时间线。首页保留一个轻量入口，导航与快捷搜索也可进入。仅打开动态页时加载官方组件，深浅主题跟随网站设置，提供刷新按钮与直接打开 X 的入口。

打开页面会自动加载；成功载入后每五分钟尝试重新载入。页面隐藏、正在操作时间线或向下阅读时会延后自动刷新。刷新失败时保留原来的时间线；首次加载失败时显示紧凑提示和原站入口，由用户点击重试，不连续自动请求。内容等待最多 15 秒，官方脚本加载最多 10 秒。页底时间表示本次组件载入时间。

此方案沿用 Cloudflare Workers Static Assets 免费部署，无需 X API 密钥、数据库、定时 Worker 或付费抓取服务。使用 X 官方嵌入，内容、显示顺序、可用性与更新速度由 X 决定；不保存推文副本，不筛选关键词，也不保证秒级更新。部分网络环境或 X 的访问限制可能影响显示，届时可使用页面上的 X 链接。

关注账号在 `site.config.mjs` 的 `updates.username` 修改，填写公开用户名，不含 `@`。官方嵌入说明见 [X Help：嵌入时间线](https://help.x.com/en/using-x/embed-x-feed)。

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
| `site.config.mjs` | 个人资料、关注方向、主题路线、文章、公开邮箱、X 动态账号与 GitHub 链接 |
| `site.links.mjs` | 36 个网站入口的名称、网址、分类、简介与图标颜色 |
| `public/styles.css` | 基础排版、响应式样式与动态效果 |
| `public/future.css` | 共享深浅配色、首页轨道、独立页面与浮窗样式 |
| `public/theme.js` | 页面显示前的主题初始化、系统跟随与偏好保存 |
| `public/app.js` | 外观面板、手机导航、复制与可暂停的动态效果 |
| `public/experience.js` | 快捷搜索、复制反馈与播放器进度、曲目和波形交互 |
| `public/library.js` | 首页收藏预览、完整收藏、最近打开与列表筛选地址 |
| `public/library-store.js` | 已知内容校验、本机存储与存储失效回退 |
| `public/reader.js` | 阅读进度、继续阅读、大字号、专注模式与目录位置 |
| `public/reader.css` | 阅读设置浮层、进度条与专注阅读布局 |
| `public/updates.js` | X 官方时间线、刷新、主题跟随与加载失败提示 |
| `public/updates.css` | 首页动态入口与动态页的响应式样式 |
| `public/sound.js` | 曲目元数据与原生音频播放、循环、切歌、定位和媒体状态 |
| `public/audio/` | 三首完整人声 MP3 与预先计算的音频波形 |
| `THIRD_PARTY_NOTICES.md` | 音乐来源、CC BY 4.0 署名和文件校验值 |
| `public/assets/bitdrift-orb.webp` | 首页主视觉 |
| `scripts/check-player.mjs` | 媒体生命周期检查，覆盖取消加载、定位、切歌、结束与释放 |
| `scripts/build.mjs` | 生成全部页面、快捷搜索数据与可选 sitemap |
| `scripts/home.mjs` | 精简首页与内容预览 |
| `scripts/pages.mjs` | 手记、网站、动态、收藏、关于页面与共用卡片 |
| `wrangler.jsonc` | Cloudflare Workers 名称和静态资源配置 |

新增手记时，在 `notes` 数组里添加一项，提供唯一的英文 `slug`、分类、日期、标题与摘要。正文可用 `paragraphs`，或用 `sections` 提供小标题和段落；`takeaway` 是要点，`checklist` 是实践清单，`sources` 是资料标题与 HTTPS 地址，`sourcesReviewedAt` 是实际核对日期。每篇手记自动生成 `/notes/slug/` 页面。主题路线在 `explorations` 中配置，`note` 指向文章 slug，`sites` 使用网站导航中已存在的名称。构建器会检查路线指向，并将网站、文章和路线加入快捷搜索。当前采用手动发布，配置中的所有手记都会进入网站；准备好内容后再添加到该数组。

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

## 收藏与阅读

点击文章或网站旁的“收藏”，可在 `/library/` 找回；首页预览最多四个收藏。网站支持分类、关键词和“只看收藏”组合筛选，手记支持分类、搜索及日期和标题排序。列表页的筛选条件保存在地址中。最近打开记录最多保存 24 个，支持清空。

文章页显示收藏按钮和阅读进度，字号与专注模式收在“阅读设置”中。有阅读记录时可点击“重新开始阅读”清除当前文章进度；读完的文章也可重新记录。再次打开有未完成阅读记录的文章会显示“继续上次阅读”，点击才恢复位置。首页列出最近一篇未读完的手记；有收藏或续读记录时才显示个人区域。收藏和阅读记录保存在当前浏览器，存储被阻止时仍可在本页操作。

`npm run check` 包含页面与链接校验，以及 52 项功能检查：16 项音频生命周期检查、20 项收藏和列表筛选检查、16 项阅读记录、字号偏好与位置计算检查。界面修改还需检查键盘操作、桌面和手机布局、浏览器错误。
