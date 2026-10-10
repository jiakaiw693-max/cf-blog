import { formatUpdateTime } from './updates-data.js';

const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const time = (value, label) => `<span>${label} <time datetime="${escape(value)}">${escape(formatUpdateTime(value))}</time></span>`;
export function renderUpdateCards(feed) {
  return feed.items.map(item => `<article class="update-card" data-update-id="${escape(item.id)}">
    <div class="update-card-top"><span class="update-kind">${item.kind === 'record' ? '重置记录 · 社区整理' : '公开消息 · 社区摘要'}</span><a href="${escape(item.url)}" target="_blank" rel="noopener noreferrer" aria-label="查看原帖：${escape(item.title)}">原帖 <span aria-hidden="true">↗</span></a></div>
    <h2>${escape(item.title)}</h2><p class="update-summary">${escape(item.summary)}</p>
    <div class="update-times">${item.postedAt ? time(item.postedAt, '消息发布') : ''}${item.eventAt ? time(item.eventAt, item.approximate ? '记录时间（约）' : '记录时间') : ''}${item.scope ? `<span>适用范围 ${escape(item.scope)}</span>` : ''}</div>
  </article>`).join('');
}
