# 十点准时睡 · 比特漂流

一个记录 AI、科技与硬件发现的个人网站。深色主题采用深蓝底、冰蓝光线与紫色点缀，浅色主题采用淡蓝白底与深蓝文字。首页配有轨道观测场景、流动航线、分层卡片与滚动入场效果；点击 AI、硬件、科技可切换主视觉、介绍与对应关注方向入口。

页头「外观设置」可选择浅色、深色或跟随系统。默认跟随系统，手动选择会保存在当前浏览器，刷新及访问手记后仍保留。主题在页面显示前初始化，首页、手记与 404 使用同一套外观。

页头搜索按钮或 `Ctrl/Cmd + K` 可打开快捷搜索，查找页面、手记和网站，或切换主题与音乐状态。搜索结果支持方向键选择、回车进入、Esc 关闭。

网站包含个人介绍、三个关注方向、四条主题探索路线、九篇独立阅读页面、36 个网站入口、音乐电台、关于与联系区。路线将文章和相关资源连在一起，覆盖 AI 实践、个人网站搭建、硬件与科技阅读。手记支持分类筛选；新增文章包含阅读时间、段落目录、实践清单和相关资料。网站导航支持六个分类与关键词搜索。联系区公开 QQ 邮箱 `766043204@qq.com`，支持发送邮件、复制邮箱与复制小红书账号名。

页面适配手机和桌面，支持键盘导航与真实 404 页面。鼠标倾斜、按钮跟随、滚动浮动、轨道旋转和跑马灯均可通过「暂停动态效果」按钮暂停；系统开启减少动态效果时自动使用静态模式。正文随 HTML 输出，阅读内容无需等待 JavaScript。

音乐电台与右下角浮窗提供 Sascha Ende 的三首完整人声歌曲。默认《Just A Fool (feat. Zara Taylor)》为女声电子流行；《Love》为电子舞曲；《Impatient (feat. Zara Taylor)》为钢琴与电子氛围的抒情曲。两首带 Zara Taylor 名字的合作曲保留完整原曲名与演唱信息。三首 MP3 来自作者官网，约 3:31、3:48 和 2:36，随网站部署，首次点击播放才加载。

浮窗支持播放、暂停、切歌、定位、音量、静音，以及顺序播放与单曲循环切换。每首首次播放会读取完整音频并在当前页面缓存，暂停加载时取消读取。波形来自完整文件的解码数据。歌曲段落入口依据作者页面的说明：《Just A Fool》副歌在 0:56，《Love》律动段在 1:19；《Impatient》使用进度条定位。音乐区卡片与浮窗共用同一个音频元素，播放状态同步。

离开页面会停止声音并释放缓存。浏览器保存曲目与音量偏好，进入文章页后保留选择，返回页面后需点击播放。音乐状态与动态效果暂停独立。顺序播放为每次访问的默认模式。

三首音乐以 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) 使用。播放器显示原曲名、作者、来源链接和许可；下载地址及文件校验值见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。音频文件保留官方下载内容。音乐区封面由本网站的 CSS 绘制，属于本站视觉设计。网站代码与音乐分别适用各自许可。

个人介绍与文章为本次网站制作撰写的内容，新的六篇科技说明稿于 2026-10-05 加入。可在 `site.config.mjs` 里直接修改或删除。页面日期表示文章在本站的发布时间。

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
| `site.config.mjs` | 个人资料、关注方向、主题路线、文章、公开邮箱与 GitHub 链接 |
| `site.links.mjs` | 36 个网站入口的名称、网址、分类、简介与图标颜色 |
| `public/styles.css` | 基础排版、响应式样式与动态效果 |
| `public/future.css` | 深浅配色、轨道界面、快捷搜索与音乐浮窗样式 |
| `public/theme.js` | 页面显示前的主题初始化、系统跟随与偏好保存 |
| `public/app.js` | 外观面板、手机导航、网站筛选、复制与可暂停的动态效果 |
| `public/experience.js` | 轨道切换、快捷搜索、复制反馈与播放器进度、曲目和波形交互 |
| `public/sound.js` | 曲目元数据与原生音频播放、循环、切歌、定位和媒体状态 |
| `public/audio/` | 三首完整人声 MP3 与预先计算的音频波形 |
| `THIRD_PARTY_NOTICES.md` | 音乐来源、CC BY 4.0 署名和文件校验值 |
| `public/assets/bitdrift-orb.webp` | 首页主视觉 |
| `scripts/check-player.mjs` | 媒体生命周期检查，覆盖取消加载、定位、切歌、结束与释放 |
| `scripts/build.mjs` | 生成首页、手记页面、404 与可选 sitemap |
| `scripts/home.mjs` | 首页结构与网站导航卡片 |
| `wrangler.jsonc` | Cloudflare Workers 名称和静态资源配置 |

新增手记时，在 `notes` 数组里添加一项，提供唯一的英文 `slug`、分类、日期、标题与摘要。正文可用 `paragraphs`，或用 `sections` 提供小标题和段落；`takeaway` 是要点，`checklist` 是实践清单，`sources` 是资料标题与 HTTPS 地址，`sourcesReviewedAt` 是实际核对日期。每篇手记自动生成 `/notes/slug/` 页面。主题路线在 `explorations` 中配置，`note` 指向文章 slug，`sites` 使用网站导航中已存在的名称。构建器会检查路线指向，并将网站、文章、路线和歌曲加入快捷搜索。当前采用手动发布，配置中的所有手记都会进入网站；准备好内容后再添加到该数组。

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
