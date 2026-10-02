# cf-blog 开发说明

本仓库为十点准时睡 · 比特漂流的个人网站，使用原生 HTML、CSS 与 JavaScript，通过 Node.js 构建静态页面，部署到 Cloudflare Workers Static Assets。

- 个人内容集中在 `site.config.mjs`，网站导航在 `site.links.mjs`，基础样式在 `public/styles.css`，未来感界面在 `public/future.css`；基础交互在 `public/app.js`，轨道、快捷搜索与音乐浮窗在 `public/experience.js`。
- `scripts/build.mjs` 将 `public/` 复制到 `dist/`，使用 `scripts/home.mjs` 生成首页，并生成手记页和 404 页。所有配置中的手记均会公开，准备好后再写入数组。
- `url` 为空时仍可构建；正式域名提供后才生成 canonical 和 sitemap。地址优先级为配置 `url`、`SITE_URL`、Pages 的 `CF_PAGES_URL`。
- 不提交 `dist/`、`node_modules/`、`.wrangler/`、`work/`、`outputs/`、`.env` 或凭据。
- Worker 名称默认 `cf-blog`，需与 Cloudflare 实际名称一致。静态资源为 `./dist`，无需 `main`。
- 保持原生内容可读、键盘可用、手机布局正常，动效尊重 `prefers-reduced-motion`，保留动态效果暂停按钮。指针效果仅在精确指针设备启用，动画帧按事件调度，避免空闲时持续运行。
- 深浅主题使用共享样式的语义颜色变量，最终配色在 `public/future.css`。`public/theme.js` 在样式前加载，只保存本机外观偏好；默认跟随系统，存储不可用时仍可切换。主题变更须保留动效暂停状态，首页、文章与 404 共用控件。
- 网站分类、搜索与空结果提示须同步更新；链接使用官方 HTTPS 地址，在新标签页打开时保留 `noopener noreferrer`。邮箱来自用户明确提供的信息，发送邮件与复制须实际可用。
- 快捷搜索数据由构建器生成，包含页面、手记、网站与操作。新增导航或手记须同步检查搜索；保留原生 dialog、键盘选择、Esc 关闭与焦点返回。
- 原创音乐由 `public/sound.js` 使用 Web Audio API 合成，仅在用户点击时播放。曲目元数据由 `SOUND_TRACKS` 导出，构建器与播放器共用。保留浮窗播放、暂停、切歌、定位、音量与静音控件；暂停和离页须停止声音，快速切歌与定位须避免多个声源叠加或旧请求回写。波形和段落须来自实际音乐数据，进度仅在播放且页面可见时更新；用户拖动时保留预览值。曲目与音量偏好保存到 `bitdrift-radio`，存储不可用时仍可操作；仅保存偏好，离页后不自动恢复播放。音乐播放状态与动态效果暂停状态独立。
- 个人人物资料需要来自已确认信息。首版手记允许用户直接修改。

验证使用 Node.js 22 或更新版本：`npm ci`、`npm run check`、`npx wrangler deploy --dry-run`。界面变更另外检查桌面与手机、文章导航和浏览器错误。
