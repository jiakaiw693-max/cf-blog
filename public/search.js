// Pagefind is generated after Astro's build. Keep this a native browser module
// so its dynamic import is not transformed by the framework's bundler.
/** @typedef {{url: string, meta: {title?: string}, excerpt: string}} SearchData */
/** @typedef {{data: () => Promise<SearchData>}} SearchResult */
/** @typedef {{search: (query: string) => Promise<{results: SearchResult[]}>}} SearchIndex */

const input = /** @type {HTMLInputElement} */ (document.querySelector('#search-input'));
const form = /** @type {HTMLFormElement} */ (document.querySelector('#search-form'));
const clear = /** @type {HTMLButtonElement} */ (document.querySelector('#search-clear'));
const status = /** @type {HTMLElement} */ (document.querySelector('#search-status'));
const results = /** @type {HTMLOListElement} */ (document.querySelector('#search-results'));
const more = /** @type {HTMLButtonElement} */ (document.querySelector('#search-more'));
/** @type {Promise<SearchIndex> | undefined} */
let indexPromise;
/** @type {SearchResult[]} */
let matches = [];
let shown = 0;
let requestId = 0;
let timer = 0;

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
  for (const data of batch) {
    const url = new URL(data.url, location.origin);
    if (url.origin !== location.origin) continue;
    const item = document.createElement('li'); item.className = 'search-result';
    const heading = document.createElement('h2');
    const link = document.createElement('a'); link.href = `${url.pathname}${url.hash}`; link.textContent = data.meta.title ?? '阅读文章';
    heading.append(link);
    const excerpt = document.createElement('p'); appendExcerpt(excerpt, data.excerpt);
    item.append(heading, excerpt); results.append(item);
  }
  shown += batch.length;
  more.hidden = shown >= matches.length;
}

async function runSearch() {
  const query = input.value.trim();
  const id = ++requestId;
  clear.hidden = input.value.length === 0;
  const url = new URL(location.href);
  if (query) url.searchParams.set('q', query); else url.searchParams.delete('q');
  history.replaceState(null, '', `${url.pathname}${url.search}`);
  results.replaceChildren(); more.hidden = true; matches = []; shown = 0;
  results.removeAttribute('aria-busy');
  if (!query) { status.textContent = '输入关键词，搜索本站文章。'; return; }
  status.textContent = '正在查找…'; results.setAttribute('aria-busy', 'true');
  try {
    indexPromise ??= import('/pagefind/pagefind.js');
    const index = await indexPromise;
    const response = await index.search(query);
    if (id !== requestId) return;
    matches = response.results;
    status.textContent = matches.length ? `找到 ${matches.length} 篇相关文章。` : '没有找到相关文章，试试更简短的关键词。';
    await appendResults(id);
  } catch (error) {
    console.error('文章搜索加载失败', error);
    indexPromise = undefined;
    if (id === requestId) status.textContent = '搜索暂时不可用，请稍后重试，或查看文章列表。';
  } finally { if (id === requestId) results.removeAttribute('aria-busy'); }
}

input.addEventListener('input', () => {
  window.clearTimeout(timer);
  requestId++; clear.hidden = input.value.length === 0;
  timer = window.setTimeout(runSearch, 180);
});
form.addEventListener('submit', event => { event.preventDefault(); window.clearTimeout(timer); void runSearch(); });
clear.addEventListener('click', () => { window.clearTimeout(timer); input.value = ''; input.focus(); void runSearch(); });
more.addEventListener('click', async () => {
  more.disabled = true;
  try { await appendResults(requestId); } catch { status.textContent = '部分结果加载失败，请重试。'; }
  finally { more.disabled = false; }
});
input.value = (new URL(location.href).searchParams.get('q') ?? '').slice(0, 200);
if (input.value.trim()) void runSearch();
export {};
