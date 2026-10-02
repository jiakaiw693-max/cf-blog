// Generated Pagefind must remain a native browser import, outside Vite's bundle.
/** @typedef {{url: string, meta: {title?: string, date?: string}, excerpt: string}} SearchData */
/** @typedef {{data: () => Promise<SearchData>}} SearchResult */
/** @typedef {{search: (query: string | null, options?: {filters?: Record<string,string>, sort?: Record<string,string>}) => Promise<{results: SearchResult[]}>}} SearchIndex */
const input = /** @type {HTMLInputElement} */ (document.querySelector('#search-input'));
const form = /** @type {HTMLFormElement} */ (document.querySelector('#search-form'));
const clear = /** @type {HTMLButtonElement} */ (document.querySelector('#search-clear'));
const tag = /** @type {HTMLSelectElement} */ (document.querySelector('#search-tag'));
const sort = /** @type {HTMLSelectElement} */ (document.querySelector('#search-sort'));
const status = /** @type {HTMLElement} */ (document.querySelector('#search-status'));
const results = /** @type {HTMLOListElement} */ (document.querySelector('#search-results'));
const more = /** @type {HTMLButtonElement} */ (document.querySelector('#search-more'));
const suggestions = /** @type {HTMLElement} */ (document.querySelector('#search-suggestions'));
const postCount = Number(document.querySelector('[data-post-count]')?.getAttribute('data-post-count') ?? 0);
/** @type {Promise<SearchIndex> | undefined} */
let indexPromise;
/** @type {SearchResult[]} */
let matches = [];
let shown = 0, requestId = 0, timer = 0;
/** @param {HTMLElement} parent @param {string} excerpt */
function appendExcerpt(parent, excerpt) {
  const parsed = new DOMParser().parseFromString(excerpt, 'text/html');
  /** @param {Node} node @param {Node} target */
  function copy(node, target) {
    if (node.nodeType === Node.TEXT_NODE) target.appendChild(document.createTextNode(node.textContent ?? ''));
    else if (node instanceof Element && node.tagName === 'MARK') {
      const mark = document.createElement('mark'); mark.textContent = node.textContent; target.appendChild(mark);
    } else for (const child of node.childNodes) copy(child, target);
  }
  for (const node of parsed.body.childNodes) copy(node, parent);
}
/** @param {number} id */
async function appendResults(id) {
  const start = shown;
  const batch = await Promise.all(matches.slice(start, start + 8).map(match => match.data()));
  if (id !== requestId) return;
  const fragment = document.createDocumentFragment();
  for (const data of batch) {
    const url = new URL(data.url, location.origin);
    if (url.origin !== location.origin || !url.pathname.startsWith('/posts/')) continue;
    const item = document.createElement('li'); item.className = 'search-result';
    if (data.meta.date) {
      const date = new Date(data.meta.date);
      if (Number.isFinite(date.getTime())) {
        const time = document.createElement('time'); time.dateTime = date.toISOString();
        time.textContent = new Intl.DateTimeFormat('zh-CN', {year:'numeric',month:'2-digit',day:'2-digit',timeZone:'Asia/Shanghai'}).format(date).replaceAll('/', '.'); item.append(time);
      }
    }
    const heading = document.createElement('h2'), link = document.createElement('a');
    link.href = `${url.pathname}${url.hash}`; link.textContent = data.meta.title ?? '阅读文章'; heading.append(link);
    const excerpt = document.createElement('p'); appendExcerpt(excerpt, typeof data.excerpt === 'string' ? data.excerpt : '');
    item.append(heading, excerpt); fragment.append(item);
  }
  results.append(fragment); shown = start + batch.length; more.hidden = shown >= matches.length;
}
function resetResults() {
  results.replaceChildren(); results.removeAttribute('aria-busy');
  more.hidden = true; more.disabled = false; matches = []; shown = 0;
  clear.hidden = input.value.length === 0;
}
async function runSearch() {
  const query = input.value.trim(), selectedTag = tag.value, id = ++requestId;
  const url = new URL(location.href);
  if (query) url.searchParams.set('q', query); else url.searchParams.delete('q');
  if (selectedTag) url.searchParams.set('tag', selectedTag); else url.searchParams.delete('tag');
  if (sort.value !== 'relevance') url.searchParams.set('sort', sort.value); else url.searchParams.delete('sort');
  history.replaceState(null, '', `${url.pathname}${url.search}`);
  resetResults(); suggestions.hidden = !!query || !!selectedTag;
  if (postCount === 0) { suggestions.hidden = true; status.textContent = '暂时还没有公开的文章，发布后就能搜索。'; return; }
  if (!query && !selectedTag) { status.textContent = '输入关键词，或选择一个主题。'; return; }
  status.textContent = '正在查找…'; results.setAttribute('aria-busy', 'true');
  try {
    indexPromise ??= import('/pagefind/pagefind.js');
    const index = await indexPromise;
    /** @type {{filters?: Record<string,string>, sort?: Record<string,string>}} */
    const options = {};
    if (selectedTag) options.filters = {tag: selectedTag};
    if (sort.value !== 'relevance') options.sort = {date: sort.value === 'newest' ? 'desc' : 'asc'};
    const response = await index.search(query || null, options);
    if (id !== requestId) return;
    matches = response.results;
    status.textContent = matches.length ? `找到 ${matches.length} 篇${selectedTag ? `“${selectedTag}”主题下的` : '相关'}文章。` : '没有找到相关文章，试试其他关键词或主题。';
    await appendResults(id);
  } catch (error) {
    if (id !== requestId) return;
    console.error('文章搜索加载失败', error); indexPromise = undefined;
    status.textContent = '搜索暂时不可用，请稍后重试，或查看文章列表。';
  } finally { if (id === requestId) results.removeAttribute('aria-busy'); }
}
/** @param {Event} event */
function scheduleSearch(event) {
  clearTimeout(timer); requestId++; resetResults(); status.textContent = '正在输入…';
  if (event instanceof InputEvent && event.isComposing) return;
  timer = window.setTimeout(runSearch, 180);
}
input.addEventListener('input', scheduleSearch);
input.addEventListener('compositionend', scheduleSearch);
form.addEventListener('submit', event => { event.preventDefault(); clearTimeout(timer); void runSearch(); });
for (const select of [tag, sort]) select.addEventListener('change', () => { clearTimeout(timer); void runSearch(); });
clear.addEventListener('click', () => { clearTimeout(timer); input.value = ''; input.focus(); void runSearch(); });
for (const button of document.querySelectorAll('button[data-search-query]')) button.addEventListener('click', () => {
  clearTimeout(timer); input.value = /** @type {HTMLButtonElement} */ (button).dataset.searchQuery ?? ''; tag.value = ''; input.focus(); void runSearch();
});
more.addEventListener('click', async () => {
  const id = requestId; more.disabled = true;
  try { await appendResults(id); } catch { if (id === requestId) status.textContent = '部分结果加载失败，请重试。'; }
  finally { if (id === requestId) more.disabled = false; }
});
const params = new URL(location.href).searchParams;
input.value = (params.get('q') ?? '').slice(0, 200);
if (location.hash === '#search-input') input.focus();
const initialTag = params.get('tag') ?? '';
tag.value = [...tag.options].some(option => option.value === initialTag) ? initialTag : '';
sort.value = ['newest', 'oldest'].includes(params.get('sort') ?? '') ? params.get('sort') : 'relevance';
clear.hidden = !input.value;
if (input.value.trim() || tag.value || postCount === 0) void runSearch();
export {};
