import type { CrawlerStatistics, SearchResult, ParsedQuery, DomainDetails, IncomingLink, OutgoingLink, PaginationOptions } from '../types/index.js';

export function escapeHtml(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function safeRenderHighlightedText(text: string | null | undefined): string {
  if (!text) return '';
  const escaped = escapeHtml(text);
  return escaped.replace(/&lt;(\/?)mark&gt;/gi, '<$1mark>');
}

export function findBestSnippet(content: string | null, parsedQuery: ParsedQuery): string {
  if (!content) return 'No content available';

  const maxSnippetLength = 300;
  const searchTerms: string[] = [];

  if (parsedQuery.text) {
    searchTerms.push(
      ...parsedQuery.text
        .toLowerCase()
        .split(' ')
        .filter((term) => term.length > 2)
    );
  }
  if (parsedQuery.title) {
    searchTerms.push(
      ...parsedQuery.title
        .toLowerCase()
        .split(' ')
        .filter((term) => term.length > 2)
    );
  }

  if (searchTerms.length === 0) {
    return content.length > maxSnippetLength ? content.substring(0, maxSnippetLength) + '...' : content;
  }

  const contentLower = content.toLowerCase();
  let bestPosition = 0;
  let bestScore = 0;

  for (let i = 0; i <= content.length - maxSnippetLength; i += 50) {
    const snippet = contentLower.substring(i, i + maxSnippetLength);
    let score = 0;

    for (const term of searchTerms) {
      let index = 0;
      let count = 0;
      while ((index = snippet.indexOf(term, index)) !== -1) {
        count++;
        index += term.length;
      }
      score += count * term.length;
    }

    if (score > bestScore) {
      bestScore = score;
      bestPosition = i;
    }
  }

  let snippet = content.substring(bestPosition, bestPosition + maxSnippetLength);

  if (bestPosition > 0) snippet = '...' + snippet;
  if (bestPosition + maxSnippetLength < content.length) snippet += '...';

  return snippet;
}

export function highlightSearchTerms(text: string | null, parsedQuery: ParsedQuery): string {
  if (!text) return '';

  let highlightedText = escapeHtml(text);
  const searchTerms: string[] = [];

  if (parsedQuery.text) {
    searchTerms.push(...parsedQuery.text.split(' ').filter((term) => term.length > 2));
  }
  if (parsedQuery.title) {
    searchTerms.push(...parsedQuery.title.split(' ').filter((term) => term.length > 2));
  }
  if (parsedQuery.header) {
    searchTerms.push(parsedQuery.header);
  }
  if (parsedQuery.value) {
    searchTerms.push(parsedQuery.value);
  }

  searchTerms.sort((a, b) => b.length - a.length);

  for (const term of searchTerms) {
    if (term.length > 1) {
      const lowerText = highlightedText.toLowerCase();
      const lowerTerm = term.toLowerCase();
      let result = '';
      let lastIndex = 0;

      let index = lowerText.indexOf(lowerTerm);
      while (index !== -1) {
        result += highlightedText.substring(lastIndex, index);
        result += '<mark>' + highlightedText.substring(index, index + term.length) + '</mark>';
        lastIndex = index + term.length;
        index = lowerText.indexOf(lowerTerm, lastIndex);
      }
      result += highlightedText.substring(lastIndex);
      highlightedText = result;
    }
  }

  return highlightedText;
}

export function createHeaderSnippet(
  headers: Array<{ name: string; value: string }> | null,
  parsedQuery: ParsedQuery
): string {
  if (!headers || !Array.isArray(headers)) return '';

  const matchingHeaders: Array<{ name: string; value: string }> = [];
  const searchHeader = parsedQuery.header ? parsedQuery.header.toLowerCase() : null;
  const searchValue = parsedQuery.value ? parsedQuery.value.toLowerCase() : null;

  for (const header of headers) {
    let matches = false;

    if (searchHeader && header.name.toLowerCase().includes(searchHeader)) {
      matches = true;
    }

    if (searchValue && header.value.toLowerCase().includes(searchValue)) {
      matches = true;
    }

    if (matches) {
      matchingHeaders.push(header);
    }
  }

  if (matchingHeaders.length === 0) return '';

  let snippet = '<h4>📡 Matching HTTP Headers:</h4>';

  for (const header of matchingHeaders.slice(0, 5)) {
    const highlightedName = highlightSearchTerms(header.name, parsedQuery);
    const highlightedValue = highlightSearchTerms(header.value, parsedQuery);

    snippet += `<div class="header-item">
      <span class="header-name">${safeRenderHighlightedText(highlightedName)}</span>:
      <span class="header-value">${safeRenderHighlightedText(highlightedValue)}</span>
    </div>`;
  }

  if (matchingHeaders.length > 5) {
    snippet += `<div style="color: #888; font-style: italic; margin-top: 5px;">
      ... and ${matchingHeaders.length - 5} more matching headers
    </div>`;
  }

  return snippet;
}

export function renderSearchResults(
  query: string,
  searchResults: SearchResult[] | null,
  parsedQuery: ParsedQuery | null
): string {
  if (!searchResults) return '';

  if (searchResults.length === 0) {
    return '<div class="error">No results found</div>';
  }

  let html = `<h3 style="color: #7864a1; margin-bottom: 20px;">Found ${searchResults.length} results for "${escapeHtml(query)}"</h3>`;

  const filters: string[] = [];
  if (parsedQuery?.title) {
    filters.push(
      `📝 Title contains: <code style="background: rgba(0,0,0,0.5); padding: 2px 6px; border-radius: 3px;">${escapeHtml(parsedQuery.title)}</code>`
    );
  }
  if (parsedQuery?.header || parsedQuery?.value) {
    filters.push(
      `📊 HTTP header: <code style="background: rgba(0,0,0,0.5); padding: 2px 6px; border-radius: 3px;">${escapeHtml(parsedQuery?.header ?? 'any')}: ${escapeHtml(parsedQuery?.value ?? 'any')}</code>`
    );
  }
  if (parsedQuery?.port) {
    filters.push(
      `🔌 Open port: <code style="background: rgba(0,0,0,0.5); padding: 2px 6px; border-radius: 3px;">${parsedQuery.port}</code>`
    );
  }
  if (filters.length > 0) {
    html += `<p style="color: #a0a0a0; margin-bottom: 20px;">${filters.join(' | ')}</p>`;
  }

  for (const result of searchResults) {
    const effectiveParsedQuery = parsedQuery ?? { text: null, header: null, value: null, title: null, port: null };
    let displayContent = result.content_text
      ? findBestSnippet(result.content_text, effectiveParsedQuery)
      : 'No content available';
    displayContent = highlightSearchTerms(displayContent, effectiveParsedQuery);

    let headerSnippet = '';
    if (parsedQuery?.header || parsedQuery?.value) {
      headerSnippet = createHeaderSnippet(result.headers, effectiveParsedQuery);
    }

    let displayTitle = result.title ?? 'Untitled';
    if (parsedQuery?.title && result.title) {
      displayTitle = highlightSearchTerms(result.title, { ...effectiveParsedQuery, title: parsedQuery.title });
    }

    html += `
      <div class="result">
        <a href="${escapeHtml(result.url)}" class="result-url" target="_blank" rel="noopener">${escapeHtml(result.url)}</a>
        <div class="result-title">${safeRenderHighlightedText(displayTitle)}</div>
        <div class="result-domain">🌐 <a href="/domain/${encodeURIComponent(result.domain)}" style="color: #00bfff; text-decoration: none;">${escapeHtml(result.domain)}</a></div>
        ${headerSnippet ? `<div class="result-headers">${headerSnippet}</div>` : ''}
        <div class="result-content">${safeRenderHighlightedText(displayContent)}</div>
        <div class="result-meta">
          <span>📅 ${new Date(result.last_crawled).toLocaleDateString()}</span>
          <span>📏 ${result.content_length ?? 0} chars</span>
          <span>🔗 Status: ${result.status_code ?? 'unknown'}</span>
        </div>
      </div>
    `;
  }

  return html;
}

export function getCSS(): string {
  return `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Source Code Pro', 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
      background: linear-gradient(135deg, #0c1420 0%, #162032 25%, #1a2332 50%, #0f1419 75%, #08101a 100%);
      color: #e6f3ff;
      min-height: 100vh;
      padding: 20px;
      position: relative;
      overflow-x: hidden;
    }

    body::before {
      content: '';
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background:
        radial-gradient(ellipse at 20% 30%, rgba(0, 191, 255, 0.08) 0%, transparent 50%),
        radial-gradient(ellipse at 80% 80%, rgba(0, 229, 153, 0.05) 0%, transparent 50%),
        radial-gradient(ellipse at 40% 60%, rgba(255, 107, 53, 0.03) 0%, transparent 50%);
      pointer-events: none;
      z-index: -1;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: rgba(15, 23, 42, 0.85);
      border: 1px solid rgba(0, 191, 255, 0.2);
      border-radius: 8px;
      box-shadow:
        0 0 30px rgba(0, 191, 255, 0.1),
        inset 0 1px 0 rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(20px);
      position: relative;
    }

    .container::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      border-radius: 8px;
      background: linear-gradient(135deg, rgba(0, 191, 255, 0.02) 0%, transparent 50%, rgba(0, 229, 153, 0.02) 100%);
      pointer-events: none;
    }

    .header {
      text-align: center;
      padding: 40px 20px;
      border-bottom: 1px solid rgba(0, 191, 255, 0.15);
      background: linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(30, 41, 59, 0.6));
      position: relative;
      z-index: 1;
    }

    .header h1 {
      font-size: 2.5em;
      letter-spacing: 2px;
      font-weight: 600;
      position: relative;
    }

    .site-name {
      display: inline-block;
    }

    .asherah {
      color: #00bfff;
      text-shadow:
        0 0 15px rgba(0, 191, 255, 0.6),
        0 0 30px rgba(0, 191, 255, 0.3);
      font-weight: 700;
    }

    .dot {
      color: #64748b;
      margin: 0 3px;
    }

    .onion {
      color: #00e599;
      text-shadow:
        0 0 15px rgba(0, 229, 153, 0.6),
        0 0 30px rgba(0, 229, 153, 0.3);
      font-weight: 700;
    }

    .search-section {
      padding: 40px;
    }

    .search-form {
      display: flex;
      gap: 15px;
      margin-bottom: 30px;
      flex-wrap: wrap;
    }

    .search-input {
      flex: 1;
      min-width: 300px;
      padding: 15px 20px;
      font-size: 16px;
      font-family: inherit;
      background: rgba(30, 41, 59, 0.5);
      border: 1px solid rgba(0, 191, 255, 0.3);
      border-radius: 6px;
      color: #e6f3ff;
      transition: all 0.3s ease;
    }

    .search-input:focus {
      outline: none;
      border-color: #00bfff;
      box-shadow: 0 0 0 3px rgba(0, 191, 255, 0.1);
      background: rgba(30, 41, 59, 0.8);
    }

    .search-input::placeholder {
      color: #64748b;
    }

    .search-btn {
      padding: 15px 25px;
      font-size: 16px;
      font-family: inherit;
      background: linear-gradient(135deg, #00bfff, #0ea5e9);
      border: none;
      border-radius: 6px;
      color: #ffffff;
      cursor: pointer;
      transition: all 0.2s ease;
      font-weight: 600;
      letter-spacing: 0.5px;
    }

    .search-btn:hover {
      background: linear-gradient(135deg, #0ea5e9, #0284c7);
      box-shadow: 0 4px 12px rgba(0, 191, 255, 0.3);
    }

    .search-btn:active {
      transform: translateY(1px);
    }

    .examples {
      background: rgba(30, 41, 59, 0.3);
      padding: 20px;
      border-radius: 6px;
      margin-bottom: 30px;
      border-left: 3px solid #00bfff;
    }

    .examples h3 {
      color: #00bfff;
      margin-bottom: 15px;
      font-size: 1.1em;
      font-weight: 600;
      display: flex;
      align-items: center;
    }

    .example {
      display: block;
      background: rgba(15, 23, 42, 0.6);
      padding: 12px 16px;
      margin: 8px 0;
      border-radius: 4px;
      color: #00e599;
      text-decoration: none;
      font-family: inherit;
      border: 1px solid rgba(0, 191, 255, 0.2);
      transition: all 0.2s ease;
      font-size: 0.95em;
    }

    .example:hover {
      background: rgba(15, 23, 42, 0.8);
      border-color: #00bfff;
      transform: translateX(3px);
      box-shadow: 0 2px 8px rgba(0, 191, 255, 0.2);
    }

    .result {
      background: rgba(30, 41, 59, 0.4);
      padding: 20px;
      margin: 15px 0;
      border-radius: 6px;
      border-left: 3px solid #00bfff;
      transition: all 0.2s ease;
      border: 1px solid rgba(0, 191, 255, 0.1);
    }

    .result:hover {
      background: rgba(30, 41, 59, 0.6);
      border-color: rgba(0, 191, 255, 0.3);
      box-shadow: 0 4px 12px rgba(0, 191, 255, 0.15);
    }

    .result-url {
      color: #00bfff;
      text-decoration: none;
      font-weight: 500;
      word-break: break-all;
      font-size: 0.9em;
    }

    .result-url:hover {
      color: #38bdf8;
      text-decoration: underline;
    }

    .result-title {
      color: #e6f3ff;
      font-size: 1.2em;
      margin: 10px 0;
      font-weight: 600;
    }

    .result-domain {
      color: #64748b;
      font-size: 0.85em;
      margin-bottom: 10px;
      font-family: inherit;
      font-weight: 500;
    }

    .result-content {
      color: #cbd5e1;
      line-height: 1.6;
      margin: 15px 0;
    }

    .result-headers {
      background: rgba(15, 23, 42, 0.5);
      border: 1px solid rgba(0, 191, 255, 0.2);
      border-radius: 4px;
      padding: 12px;
      margin: 12px 0;
      font-family: inherit;
      font-size: 0.9em;
    }

    .result-headers h4 {
      color: #00e599;
      margin-bottom: 8px;
      font-size: 0.9em;
      font-weight: 600;
    }

    .header-item {
      margin: 4px 0;
      color: #94a3b8;
    }

    .header-name {
      color: #00bfff;
      font-weight: 600;
    }

    .header-value {
      color: #e6f3ff;
    }

    .result-content mark {
      background: linear-gradient(135deg, rgba(0, 191, 255, 0.3), rgba(0, 229, 153, 0.3));
      color: #ffffff;
      padding: 2px 6px;
      border-radius: 3px;
      font-weight: 600;
      border: 1px solid rgba(0, 191, 255, 0.4);
    }

    .result-meta {
      color: #64748b;
      font-size: 0.8em;
      margin-top: 15px;
      display: flex;
      gap: 15px;
      flex-wrap: wrap;
    }

    .error {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: 6px;
      padding: 15px;
      color: #fca5a5;
      margin: 20px 0;
    }

    .error::before {
      content: '⚠ ';
      margin-right: 8px;
    }

    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 15px;
      margin-bottom: 30px;
    }

    .stat {
      background: rgba(30, 41, 59, 0.4);
      padding: 20px;
      border-radius: 6px;
      text-align: center;
      border: 1px solid rgba(0, 191, 255, 0.2);
      transition: all 0.2s ease;
    }

    .stat:hover {
      border-color: rgba(0, 191, 255, 0.4);
      box-shadow: 0 2px 8px rgba(0, 191, 255, 0.1);
    }

    .stat-number {
      font-size: 1.8em;
      color: #00e599;
      font-weight: 700;
      display: block;
    }

    .stat-label {
      color: #94a3b8;
      font-size: 0.85em;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 500;
      margin-top: 5px;
    }

    @media (max-width: 768px) {
      .search-form {
        flex-direction: column;
      }

      .search-input {
        min-width: 100%;
      }

      .header h1 {
        font-size: 2em;
      }

      .search-section {
        padding: 20px;
      }
    }
  `;
}

export function getHTMLInterface(
  query: string,
  searchResults: SearchResult[] | null,
  parsedQuery: ParsedQuery | null,
  error: string | null,
  stats: CrawlerStatistics | null
): string {
  const safeStats = stats ?? { totalDomains: 0, totalPages: 0, totalLinks: 0, queueSize: 0, activeCrawlers: 0, recentCrawls: 0, lockedDomains: 0, domainStatus: {} };

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>@$#3Я@#</title>
  <style>${getCSS()}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>
        <span class="site-name">
          <span class="asherah">asherah</span><span class="dot">.</span><span class="onion">onion</span>
        </span>
      </h1>
    </div>

    <div class="search-section">
      <form class="search-form" method="GET" action="/">
        <input
          type="text"
          name="q"
          class="search-input"
          value="${escapeHtml(query)}"
          placeholder='Search: bitcoin title:"market" http:"server: nginx" port:80'
          autocomplete="off"
          required
        >
        <button type="submit" class="search-btn">Search</button>
      </form>

      <div class="examples">
        <h3>Search Examples 🔍</h3>
        <a href="/?q=${encodeURIComponent('bitcoin cryptocurrency')}" class="example">bitcoin cryptocurrency</a>
        <a href="/?q=${encodeURIComponent('title:"market"')}" class="example">title:"market"</a>
        <a href="/?q=${encodeURIComponent('http:"server: nginx"')}" class="example">http:"server: nginx"</a>
        <a href="/?q=${encodeURIComponent('port:22')}" class="example">port:22 (SSH servers)</a>
        <a href="/?q=${encodeURIComponent('port:8333')}" class="example">port:8333 (Bitcoin nodes)</a>
        <a href="/?q=${encodeURIComponent('privacy port:443')}" class="example">privacy port:443</a>
      </div>

      <div class="stats">
        <div class="stat">
          <span class="stat-number">${safeStats.totalDomains}</span>
          <span class="stat-label">Domains</span>
        </div>
        <div class="stat">
          <span class="stat-number">${safeStats.totalPages}</span>
          <span class="stat-label">Pages</span>
        </div>
        <div class="stat">
          <span class="stat-number">${safeStats.totalLinks}</span>
          <span class="stat-label">Links</span>
        </div>
        <div class="stat">
          <span class="stat-number">${safeStats.queueSize}</span>
          <span class="stat-label">Queue</span>
        </div>
      </div>

      ${error ? `<div class="error">❌ Error: ${escapeHtml(error)}</div>` : ''}
      ${renderSearchResults(query, searchResults, parsedQuery)}
    </div>
  </div>
</body>
</html>
  `;
}

export function getDomainPageHTML(
  domainInfo: DomainDetails,
  incomingLinks: IncomingLink[],
  outgoingLinks: OutgoingLink[],
  _pagination: PaginationOptions
): string {
  const latestPage = domainInfo.latest_page;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(domainInfo.domain)} - @$#3Я@#</title>
  <style>${getCSS()}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>
        <span class="site-name">
          <span class="asherah">asherah</span><span class="dot">.</span><span class="onion">onion</span>
        </span>
      </h1>
      <div style="margin-top: 20px;">
        <a href="/" style="background: rgba(30, 41, 59, 0.5); border: 1px solid rgba(0, 191, 255, 0.3); color: #00bfff; padding: 8px 16px; border-radius: 4px; text-decoration: none; font-family: inherit;">← Back to Search</a>
      </div>
    </div>

    <div class="search-section">
      <div class="domain-detail">
        <h2 style="color: #00bfff; font-size: 2em; margin-bottom: 10px;">🌐 ${escapeHtml(domainInfo.domain)}</h2>
        <div class="domain-meta" style="color: #94a3b8; margin-bottom: 20px; display: flex; gap: 20px; flex-wrap: wrap;">
          <span>📅 First seen: ${new Date(domainInfo.first_seen).toLocaleDateString()}</span>
          <span>🕒 Last crawled: ${domainInfo.last_crawled ? new Date(domainInfo.last_crawled).toLocaleDateString() : 'Never'}</span>
          <span>🔢 Crawl count: ${domainInfo.crawl_count}</span>
          <span>📄 Total pages: ${domainInfo.total_pages}</span>
        </div>
        <div class="domain-stats" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 30px;">
          <div class="stat"><span class="stat-number">${domainInfo.incoming_links_count}</span><span class="stat-label">Incoming Links</span></div>
          <div class="stat"><span class="stat-number">${domainInfo.outgoing_links_count}</span><span class="stat-label">Outgoing Links</span></div>
          <div class="stat"><span class="stat-number">${domainInfo.total_pages}</span><span class="stat-label">Total Pages</span></div>
          <div class="stat"><span class="stat-number">${latestPage ? latestPage.status_code : 'N/A'}</span><span class="stat-label">Latest Status</span></div>
        </div>

        ${
          latestPage
            ? `
        <div class="domain-section">
          <h3 style="color: #00e599; margin-bottom: 15px;">📄 Latest Page Content</h3>
          <div class="result" style="margin-bottom: 20px;">
            <div class="result-title">${escapeHtml(latestPage.title ?? 'Untitled')}</div>
            <a href="${escapeHtml(latestPage.url)}" class="result-url" target="_blank" rel="noopener">${escapeHtml(latestPage.url)}</a>
            <div class="result-meta" style="margin: 10px 0;">
              <span>📅 ${new Date(latestPage.last_crawled).toLocaleDateString()}</span>
              <span>📏 ${latestPage.full_content_length} chars</span>
              <span>📦 ${escapeHtml(latestPage.content_type ?? 'unknown')}</span>
            </div>
            <div class="content-preview">
              <div style="color: #cbd5e1; line-height: 1.6;">
                ${escapeHtml(latestPage.content_text ?? 'No content available')}
              </div>
            </div>
          </div>
        </div>
        `
            : ''
        }

        ${
          domainInfo.headers && domainInfo.headers.length > 0
            ? `
        <div class="domain-section">
          <h3 style="color: #00e599; margin-bottom: 15px;">🔧 HTTP Headers</h3>
          <div class="result-headers">
            ${domainInfo.headers
              .map(
                (header) => `
              <div class="header-item">
                <span class="header-name">${escapeHtml(header.name)}</span>:
                <span class="header-value">${escapeHtml(header.value)}</span>
              </div>
            `
              )
              .join('')}
          </div>
        </div>
        `
            : ''
        }

        <div class="domain-section">
          <h3 style="color: #00e599; margin-bottom: 15px;">🔗 Who Links Here (${domainInfo.incoming_links_count})</h3>
          ${
            incomingLinks.length === 0
              ? '<div style="color: #64748b; font-style: italic;">No incoming links found</div>'
              : incomingLinks
                  .map(
                    (link) => `
              <div class="result" style="margin-bottom: 10px;">
                <div style="color: #cbd5e1; margin-bottom: 5px;">
                  <strong>"${escapeHtml(link.anchor_text ?? 'No anchor text')}"</strong>
                </div>
                <div style="font-size: 0.9em;">
                  From: <a href="/domain/${encodeURIComponent(link.source_domain)}" style="color: #00bfff;">${escapeHtml(link.source_domain)}</a>
                </div>
                <div style="font-size: 0.85em; color: #64748b;">
                  ${escapeHtml(link.source_title ?? 'Untitled page')} • ${new Date(link.last_crawled).toLocaleDateString()}
                </div>
              </div>
            `
                  )
                  .join('')
          }
        </div>

        <div class="domain-section">
          <h3 style="color: #00e599; margin-bottom: 15px;">➡️ Outgoing Links (${domainInfo.outgoing_links_count})</h3>
          ${
            outgoingLinks.length === 0
              ? '<div style="color: #64748b; font-style: italic;">No outgoing links found</div>'
              : outgoingLinks
                  .map(
                    (link) => `
              <div class="result" style="margin-bottom: 10px;">
                <div style="color: #cbd5e1; margin-bottom: 5px;">
                  <strong>"${escapeHtml(link.anchor_text ?? 'No anchor text')}"</strong>
                </div>
                <div style="font-size: 0.9em;">
                  To: ${
                    link.target_domain
                      ? `<a href="/domain/${encodeURIComponent(link.target_domain)}" style="color: #00bfff;">${escapeHtml(link.target_domain)}</a>`
                      : `<span style="color: #64748b;">${escapeHtml(link.target_url)}</span>`
                  }
                </div>
              </div>
            `
                  )
                  .join('')
          }
        </div>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}
