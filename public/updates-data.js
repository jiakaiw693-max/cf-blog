export const UPDATE_SOURCE = Object.freeze({
  id: 'codex-reset-observatory',
  name: 'Codex Reset Observatory',
  url: 'https://codex.gussuriworks.com/',
  endpoint: 'https://codex.gussuriworks.com/api/current?locale=zh',
  interval: 10 * 60 * 1000
});

const text = (value, length = 700) => typeof value === 'string' ? value.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim().slice(0, length) : '';
export function updateDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}
function postUrl(value, username) {
  try {
    const url = new URL(value);
    const match = url.pathname.match(/^\/([a-z0-9_]{1,15})\/status\/(\d{8,25})\/?$/i);
    if (url.protocol !== 'https:' || !['x.com', 'twitter.com'].includes(url.hostname) || url.username || url.password || url.port || !match || match[1].toLowerCase() !== username.toLowerCase()) return null;
    return `https://x.com/${username}/status/${match[2]}`;
  } catch { return null; }
}
function itemFrom(value, username) {
  if (!value || !['activity', 'record'].includes(value.kind)) return null;
  const url = postUrl(value.url, username);
  const postedAt = updateDate(value.postedAt);
  const eventAt = updateDate(value.eventAt);
  const summary = text(value.summary);
  if (!url || (!postedAt && !eventAt) || !summary) return null;
  return {
    id: `${value.kind}:${url.split('/').pop()}:${eventAt || postedAt}`,
    kind: value.kind,
    title: text(value.title, 90) || (value.kind === 'record' ? '额度相关记录' : '公开消息'),
    summary, url, postedAt, eventAt, scope: text(value.scope, 90),
    approximate: value.approximate === true
  };
}

// 浏览器存储、构建快照和上游数据共用校验，原帖只能指向指定账号。
export function readUpdateFeed(value, username) {
  if (!value || value.version !== 1 || value.username !== username || value.provider !== UPDATE_SOURCE.id || !Array.isArray(value.items)) throw new Error('Invalid updates feed');
  const fetchedAt = updateDate(value.fetchedAt);
  const sourceCheckedAt = updateDate(value.sourceCheckedAt);
  if (!fetchedAt || !sourceCheckedAt) throw new Error('Missing updates timestamps');
  const seen = new Set();
  const items = value.items.slice(0, 30).map(item => itemFrom(item, username)).filter(item => {
    if (!item || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  }).sort((a, b) => Date.parse(b.eventAt || b.postedAt) - Date.parse(a.eventAt || a.postedAt)).slice(0, 10);
  if (!items.length) throw new Error('No usable updates');
  return {
    version: 1, username, provider: UPDATE_SOURCE.id, fetchedAt, sourceCheckedAt,
    sourceUpdatedAt: updateDate(value.sourceUpdatedAt), sourceStale: value.sourceStale === true,
    items
  };
}

export function feedFromObservatory(value, username, fetchedAt = new Date().toISOString()) {
  if (value?.schemaVersion !== 'public-v1' || !value.dataHealth || !Array.isArray(value.viewModel?.recentHistory)) throw new Error('Unsupported source response');
  const items = value.viewModel.recentHistory.slice(0, 20).map(record => ({
    kind: 'record', title: record.title, summary: record.summary,
    url: record.source, postedAt: record.signalAt, eventAt: record.resetAt || record.date, scope: record.scope || record.details?.scope,
    approximate: record.executionTimePrecision === 'approximate'
  }));
  const activity = value.latestTiboActivity;
  if (activity?.sourceUrl && activity.text) items.push({
    kind: 'activity', title: '最近收录的公开消息', summary: activity.text,
    url: activity.sourceUrl, postedAt: activity.createdAt
  });
  return readUpdateFeed({
    version: 1, username, provider: UPDATE_SOURCE.id, fetchedAt,
    sourceCheckedAt: value.checkedAt, sourceUpdatedAt: value.updatedAt,
    sourceStale: value.dataHealth.stale === true || value.dataHealth.overall !== 'ok', items
  }, username);
}

export function formatUpdateTime(value) {
  const valid = updateDate(value);
  if (!valid) return '时间未提供';
  return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(valid));
}
export const updateFeedIsStale = (feed, now = Date.now()) => feed.sourceStale || now - Date.parse(feed.sourceCheckedAt) > 2 * 60 * 60 * 1000;
