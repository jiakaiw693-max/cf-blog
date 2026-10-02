import { existsSync } from 'node:fs';

const envFile = new URL('../.env', import.meta.url);
if (existsSync(envFile)) process.loadEnvFile(envFile);

export function getSiteUrl({ required = false } = {}) {
  // Pages provides the actual deployment URL during its build. Explicit
  // SITE_URL still wins, especially when using a stable custom domain.
  const value = process.env.SITE_URL?.trim() || (process.env.CF_PAGES ? process.env.CF_PAGES_URL?.trim() : undefined);
  if (required && !value) {
    throw new Error('缺少网站地址：Workers 请在 Settings → Build 的构建变量中设置 SITE_URL；Pages 会自动使用 CF_PAGES_URL，也可手动设置 SITE_URL。本地预览请使用 npm run build:local。');
  }
  const url = new URL(value || 'http://localhost:4321');
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('SITE_URL 必须是网站根地址，例如 https://blog.example.com，不含账号、路径、查询参数或片段。');
  }
  if ((process.env.WORKERS_CI || process.env.CF_PAGES) && (url.protocol !== 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) {
    throw new Error('Cloudflare 构建的 SITE_URL 需要使用正式 HTTPS 地址，不能使用本地地址。');
  }
  return url.origin;
}
