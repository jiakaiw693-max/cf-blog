import { existsSync } from 'node:fs';

const envFile = new URL('../.env', import.meta.url);
if (existsSync(envFile)) process.loadEnvFile(envFile);

export function getSiteUrl({ required = false } = {}) {
  const value = process.env.SITE_URL?.trim();
  if (required && !value) {
    throw new Error('请设置 SITE_URL 为网站的完整地址。Cloudflare 中在构建变量设置；本地可复制 .env.example 为 .env，或使用 npm run build:local。');
  }
  const url = new URL(value || 'http://localhost:4321');
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('SITE_URL 必须是网站根地址，例如 https://blog.example.com，不含账号、路径、查询参数或片段。');
  }
  if (process.env.WORKERS_CI && (url.protocol !== 'https:' || ['localhost', '127.0.0.1'].includes(url.hostname))) {
    throw new Error('Cloudflare 构建的 SITE_URL 需要使用正式 HTTPS 地址，不能使用本地地址。');
  }
  return url.origin;
}
