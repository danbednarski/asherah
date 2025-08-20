const express = require('express');
const cors = require('cors');
const Database = require('./database');

class OnionSearchAPI {
    constructor(options = {}) {
        this.app = express();
        this.port = options.port || 3000;
        this.database = new Database(options.database || {});
        
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
        
        // Request logging
        this.app.use((req, res, next) => {
            console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
            next();
        });
    }

    setupRoutes() {
        // Frontend - home page with optional search results
        this.app.get('/', async (req, res) => {
            try {
                const { q: query, limit = '50', offset = '0' } = req.query;
                let searchResults = null;
                let parsedQuery = null;
                
                if (query) {
                    parsedQuery = this.parseQuery(query);
                    const limitInt = parseInt(limit) || 50;
                    const offsetInt = parseInt(offset) || 0;
                    
                    searchResults = await this.searchCombined(
                        parsedQuery.text, 
                        parsedQuery.header, 
                        parsedQuery.value, 
                        parsedQuery.title,
                        limitInt, 
                        offsetInt
                    );
                }
                
                const stats = await this.getStats();
                res.send(this.getHTMLInterface(query, searchResults, parsedQuery, null, stats));
            } catch (error) {
                const stats = await this.getStats();
                res.send(this.getHTMLInterface(query || '', null, null, error.message, stats));
            }
        });

        // Search endpoint (for API compatibility)
        this.app.get('/search', async (req, res) => {
            try {
                const { q: query, limit = '50', offset = '0' } = req.query;
                
                if (!query) {
                    return res.redirect('/?error=' + encodeURIComponent('Search query is required'));
                }

                // Redirect to home page with search results
                res.redirect(`/?q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`);
            } catch (error) {
                res.redirect('/?error=' + encodeURIComponent(error.message));
            }
        });

        // Statistics endpoint
        this.app.get('/stats', async (req, res) => {
            try {
                const stats = await this.database.getStatistics();
                res.json(stats);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Domain detail endpoint
        this.app.get('/domain/:domain', async (req, res) => {
            try {
                const { domain } = req.params;
                const { incomingPage = '1', outgoingPage = '1', limit = '10' } = req.query;
                
                if (!domain || !domain.endsWith('.onion')) {
                    return res.redirect('/?error=' + encodeURIComponent('Valid onion domain required'));
                }

                const domainInfo = await this.getDomainDetails(domain);
                if (!domainInfo) {
                    return res.redirect('/?error=' + encodeURIComponent('Domain not found'));
                }

                const limitInt = parseInt(limit) || 10;
                const incomingOffset = (parseInt(incomingPage) - 1) * limitInt;
                const outgoingOffset = (parseInt(outgoingPage) - 1) * limitInt;

                const [incomingLinks, outgoingLinks] = await Promise.all([
                    this.getIncomingLinks(domain, limitInt, incomingOffset),
                    this.getOutgoingLinks(domain, limitInt, outgoingOffset)
                ]);

                res.send(this.getDomainPageHTML(domainInfo, incomingLinks, outgoingLinks, {
                    incomingPage: parseInt(incomingPage),
                    outgoingPage: parseInt(outgoingPage),
                    limit: limitInt
                }));
            } catch (error) {
                res.redirect('/?error=' + encodeURIComponent(error.message));
            }
        });

    }

    parseQuery(query) {
        const result = {
            text: null,
            header: null,
            value: null,
            title: null
        };

        let remainingQuery = query;

        // Look for title:"title text" pattern (case insensitive)
        const titleMatch = remainingQuery.match(/title:\s*"([^"]+)"/i);
        if (titleMatch) {
            result.title = titleMatch[1].trim();
            remainingQuery = remainingQuery.replace(/title:\s*"[^"]+"/i, '').trim();
        }

        // Look for http:"header: value" pattern (case insensitive)
        const httpMatch = remainingQuery.match(/http:\s*"([^"]+)"/i);
        if (httpMatch) {
            const headerContent = httpMatch[1];
            const colonIndex = headerContent.indexOf(':');
            
            if (colonIndex > 0) {
                result.header = headerContent.substring(0, colonIndex).trim();
                result.value = headerContent.substring(colonIndex + 1).trim();
            } else {
                result.header = headerContent.trim();
            }
            
            remainingQuery = remainingQuery.replace(/http:\s*"[^"]+"/i, '').trim();
        }

        // Whatever is left becomes text search
        if (remainingQuery) {
            result.text = remainingQuery.trim();
        }

        // Clean up empty strings
        if (!result.text) result.text = null;
        if (!result.header) result.header = null;
        if (!result.value) result.value = null;
        if (!result.title) result.title = null;

        return result;
    }

    escapeHtml(text) {
        if (!text) return '';
        return text.replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;')
                  .replace(/"/g, '&quot;')
                  .replace(/'/g, '&#39;');
    }

    // Safe HTML renderer that only allows <mark> tags for highlighting
    safeRenderHighlightedText(text) {
        if (!text) return '';
        
        // Use a simple whitelist approach: escape everything first, then restore only <mark> tags
        const escaped = this.escapeHtml(text);
        
        // Only restore <mark> and </mark> tags - nothing else
        return escaped.replace(/&lt;(\/?)mark&gt;/gi, '<$1mark>');
    }

    async getStats() {
        try {
            return await this.database.getStatistics();
        } catch (error) {
            return { totalDomains: 0, totalPages: 0, totalLinks: 0, queueSize: 0 };
        }
    }

    getHTMLInterface(query = '', searchResults = null, parsedQuery = null, error = null, stats = null) {
        if (!stats) stats = { totalDomains: 0, totalPages: 0, totalLinks: 0, queueSize: 0 };
        
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>@$#3Я@#</title>
    <style>
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

        .header p {
            font-size: 1.1em;
            color: #94a3b8;
            margin-bottom: 25px;
            font-weight: 400;
            letter-spacing: 0.5px;
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

        .results {
            margin-top: 30px;
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

        .result-meta span::before {
            margin-right: 4px;
        }

        .loading {
            text-align: center;
            color: #00bfff;
            font-size: 1.2em;
            margin: 30px 0;
        }

        .loading::before {
            content: '⟳ ';
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
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
    </style>
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
                    value="${this.escapeHtml(query)}"
                    placeholder='Search content or use tags like: bitcoin title:"market" http:"server: nginx"'
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
                <a href="/?q=${encodeURIComponent('privacy title:"marketplace"')}" class="example">privacy title:"marketplace"</a>
                <a href="/?q=${encodeURIComponent('title:"bazaar" http:"content-type: text"')}" class="example">title:"bazaar" http:"content-type: text"</a>
            </div>
            
            <div class="stats">
                <div class="stat">
                    <span class="stat-number">${stats.totalDomains || 0}</span>
                    <span class="stat-label">Domains</span>
                </div>
                <div class="stat">
                    <span class="stat-number">${stats.totalPages || 0}</span>
                    <span class="stat-label">Pages</span>
                </div>
                <div class="stat">
                    <span class="stat-number">${stats.totalLinks || 0}</span>
                    <span class="stat-label">Links</span>
                </div>
                <div class="stat">
                    <span class="stat-number">${stats.queueSize || 0}</span>
                    <span class="stat-label">Queue</span>
                </div>
            </div>
            
            ${error ? `<div class="error">❌ Error: ${this.escapeHtml(error)}</div>` : ''}
            ${this.renderSearchResults(query, searchResults, parsedQuery)}
        </div>
    </div>

</body>
</html>
        `;
    }

    renderSearchResults(query, searchResults, parsedQuery) {
        if (!searchResults) return '';
        
        if (searchResults.length === 0) {
            return '<div class="error">No results found</div>';
        }
        
        let html = `<h3 style="color: #7864a1; margin-bottom: 20px;">Found ${searchResults.length} results for "${this.escapeHtml(query)}"</h3>`;
        
        let filters = [];
        if (parsedQuery && parsedQuery.title) {
            filters.push(`📝 Title contains: <code style="background: rgba(0,0,0,0.5); padding: 2px 6px; border-radius: 3px;">${this.escapeHtml(parsedQuery.title)}</code>`);
        }
        if (parsedQuery && (parsedQuery.header || parsedQuery.value)) {
            filters.push(`📊 HTTP header: <code style="background: rgba(0,0,0,0.5); padding: 2px 6px; border-radius: 3px;">${this.escapeHtml(parsedQuery.header || 'any')}: ${this.escapeHtml(parsedQuery.value || 'any')}</code>`);
        }
        if (filters.length > 0) {
            html += `<p style="color: #a0a0a0; margin-bottom: 20px;">${filters.join(' | ')}</p>`;
        }
        
        searchResults.forEach(result => {
            // Create content snippet
            let displayContent = result.content_text ? 
                this.findBestSnippet(result.content_text, parsedQuery || {}) : 
                'No content available';
            displayContent = this.highlightSearchTerms(displayContent, parsedQuery || {});
            
            // Handle HTTP headers if this is a header search
            let headerSnippet = '';
            if (parsedQuery && (parsedQuery.header || parsedQuery.value)) {
                headerSnippet = this.createHeaderSnippet(result.headers, parsedQuery);
            }
            
            // Highlight title matches
            let displayTitle = result.title || 'Untitled';
            if (parsedQuery && parsedQuery.title && result.title) {
                displayTitle = this.highlightSearchTerms(result.title, { title: parsedQuery.title });
            }

            html += `
                <div class="result">
                    <a href="${this.escapeHtml(result.url)}" class="result-url" target="_blank" rel="noopener">${this.escapeHtml(result.url)}</a>
                    <div class="result-title">${this.safeRenderHighlightedText(displayTitle)}</div>
                    <div class="result-domain">🌐 <a href="/domain/${encodeURIComponent(result.domain)}" style="color: #00bfff; text-decoration: none;">${this.escapeHtml(result.domain)}</a></div>
                    ${headerSnippet ? `<div class="result-headers">${headerSnippet}</div>` : ''}
                    <div class="result-content">${this.safeRenderHighlightedText(displayContent)}</div>
                    <div class="result-meta">
                        <span>📅 ${new Date(result.last_crawled).toLocaleDateString()}</span>
                        <span>📏 ${result.content_length || 0} chars</span>
                        <span>🔗 Status: ${result.status_code || 'unknown'}</span>
                    </div>
                </div>
            `;
        });
        
        return html;
    }

    findBestSnippet(content, parsedQuery) {
        if (!content) return 'No content available';
        
        const maxSnippetLength = 300;
        
        // Simple truncation for now - can be enhanced later
        return content.length > maxSnippetLength 
            ? content.substring(0, maxSnippetLength) + '...'
            : content;
    }

    highlightSearchTerms(text, parsedQuery) {
        if (!text || !parsedQuery) return this.escapeHtml(text);
        
        let highlightedText = this.escapeHtml(text);
        const searchTerms = [];
        
        // Collect all search terms
        if (parsedQuery.text) {
            searchTerms.push(...parsedQuery.text.split(' ').filter(term => term.length > 2));
        }
        if (parsedQuery.title) {
            searchTerms.push(...parsedQuery.title.split(' ').filter(term => term.length > 2));
        }
        if (parsedQuery.header) {
            searchTerms.push(parsedQuery.header);
        }
        if (parsedQuery.value) {
            searchTerms.push(parsedQuery.value);
        }
        
        // Sort by length (longest first) to avoid nested highlighting issues
        searchTerms.sort((a, b) => b.length - a.length);
        
        searchTerms.forEach(term => {
            if (term.length > 1) {
                const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                highlightedText = highlightedText.replace(regex, '<mark>$1</mark>');
            }
        });
        
        return highlightedText;
    }

    createHeaderSnippet(headers, parsedQuery) {
        if (!headers || !Array.isArray(headers)) return '';
        
        let matchingHeaders = [];
        const searchHeader = parsedQuery.header ? parsedQuery.header.toLowerCase() : null;
        const searchValue = parsedQuery.value ? parsedQuery.value.toLowerCase() : null;
        
        headers.forEach(header => {
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
        });
        
        if (matchingHeaders.length === 0) return '';
        
        let snippet = '<h4>📡 Matching HTTP Headers:</h4>';
        
        matchingHeaders.slice(0, 5).forEach(header => { // Show max 5 headers
            const highlightedName = this.highlightSearchTerms(header.name, parsedQuery);
            const highlightedValue = this.highlightSearchTerms(header.value, parsedQuery);
            
            snippet += `<div class="header-item">
                <span class="header-name">${this.safeRenderHighlightedText(highlightedName)}</span>: 
                <span class="header-value">${this.safeRenderHighlightedText(highlightedValue)}</span>
            </div>`;
        });
        
        if (matchingHeaders.length > 5) {
            snippet += `<div style="color: #888; font-style: italic; margin-top: 5px;">
                ... and ${matchingHeaders.length - 5} more matching headers
            </div>`;
        }
        
        return snippet;
    }

    getDomainPageHTML(domainInfo, incomingLinks, outgoingLinks, pagination) {
        const latestPage = domainInfo.latest_page;
        
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.escapeHtml(domainInfo.domain)} - @$#3Я@#</title>
    <style>
        /* Include the same CSS styles as main page */
        ${this.getCSS()}
    </style>
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
                <h2 style="color: #00bfff; font-size: 2em; margin-bottom: 10px;">🌐 ${this.escapeHtml(domainInfo.domain)}</h2>
                <div class="domain-meta" style="color: #94a3b8; margin-bottom: 20px; display: flex; gap: 20px; flex-wrap: wrap;">
                    <span>📅 First seen: ${new Date(domainInfo.first_seen).toLocaleDateString()}</span>
                    <span>🕒 Last crawled: ${new Date(domainInfo.last_crawled).toLocaleDateString()}</span>
                    <span>🔢 Crawl count: ${domainInfo.crawl_count}</span>
                    <span>📄 Total pages: ${domainInfo.total_pages}</span>
                </div>
                <div class="domain-stats" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 30px;">
                    <div class="stat"><span class="stat-number">${domainInfo.incoming_links_count}</span><span class="stat-label">Incoming Links</span></div>
                    <div class="stat"><span class="stat-number">${domainInfo.outgoing_links_count}</span><span class="stat-label">Outgoing Links</span></div>
                    <div class="stat"><span class="stat-number">${domainInfo.total_pages}</span><span class="stat-label">Total Pages</span></div>
                    <div class="stat"><span class="stat-number">${latestPage ? latestPage.status_code : 'N/A'}</span><span class="stat-label">Latest Status</span></div>
                </div>

                ${latestPage ? `
                <div class="domain-section">
                    <h3 style="color: #00e599; margin-bottom: 15px;">📄 Latest Page Content</h3>
                    <div class="result" style="margin-bottom: 20px;">
                        <div class="result-title">${this.escapeHtml(latestPage.title || 'Untitled')}</div>
                        <a href="${this.escapeHtml(latestPage.url)}" class="result-url" target="_blank" rel="noopener">${this.escapeHtml(latestPage.url)}</a>
                        <div class="result-meta" style="margin: 10px 0;">
                            <span>📅 ${new Date(latestPage.last_crawled).toLocaleDateString()}</span>
                            <span>📏 ${latestPage.full_content_length || 0} chars</span>
                            <span>📦 ${this.escapeHtml(latestPage.content_type || 'unknown')}</span>
                        </div>
                        <div class="content-preview">
                            <div style="color: #cbd5e1; line-height: 1.6;">
                                ${this.escapeHtml(latestPage.content_text || 'No content available')}
                            </div>
                        </div>
                    </div>
                </div>
                ` : ''}

                ${domainInfo.headers && domainInfo.headers.length > 0 ? `
                <div class="domain-section">
                    <h3 style="color: #00e599; margin-bottom: 15px;">🔧 HTTP Headers</h3>
                    <div class="result-headers">
                        ${domainInfo.headers.map(header => `
                            <div class="header-item">
                                <span class="header-name">${this.escapeHtml(header.name)}</span>: 
                                <span class="header-value">${this.escapeHtml(header.value)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}

                <div class="domain-section">
                    <h3 style="color: #00e599; margin-bottom: 15px;">🔗 Who Links Here (${domainInfo.incoming_links_count})</h3>
                    ${incomingLinks.length === 0 ? 
                        '<div style="color: #64748b; font-style: italic;">No incoming links found</div>' :
                        incomingLinks.map(link => `
                            <div class="result" style="margin-bottom: 10px;">
                                <div style="color: #cbd5e1; margin-bottom: 5px;">
                                    <strong>"${this.escapeHtml(link.anchor_text || 'No anchor text')}"</strong>
                                </div>
                                <div style="font-size: 0.9em;">
                                    From: <a href="/domain/${encodeURIComponent(link.source_domain)}" style="color: #00bfff;">${this.escapeHtml(link.source_domain)}</a>
                                </div>
                                <div style="font-size: 0.85em; color: #64748b;">
                                    ${this.escapeHtml(link.source_title || 'Untitled page')} • ${new Date(link.last_crawled).toLocaleDateString()}
                                </div>
                            </div>
                        `).join('')
                    }
                </div>

                <div class="domain-section">
                    <h3 style="color: #00e599; margin-bottom: 15px;">➡️ Outgoing Links (${domainInfo.outgoing_links_count})</h3>
                    ${outgoingLinks.length === 0 ?
                        '<div style="color: #64748b; font-style: italic;">No outgoing links found</div>' :
                        outgoingLinks.map(link => `
                            <div class="result" style="margin-bottom: 10px;">
                                <div style="color: #cbd5e1; margin-bottom: 5px;">
                                    <strong>"${this.escapeHtml(link.anchor_text || 'No anchor text')}"</strong>
                                </div>
                                <div style="font-size: 0.9em;">
                                    To: ${link.target_domain ? 
                                        `<a href="/domain/${encodeURIComponent(link.target_domain)}" style="color: #00bfff;">${this.escapeHtml(link.target_domain)}</a>` :
                                        `<span style="color: #64748b;">${this.escapeHtml(link.target_url)}</span>`
                                    }
                                </div>
                            </div>
                        `).join('')
                    }
                </div>
            </div>
        </div>
    </div>
</body>
</html>
        `;
    }

    getCSS() {
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

    async searchCombined(textQuery = null, headerName = null, headerValue = null, titleQuery = null, limit = 50, offset = 0) {
        let textCondition = '';
        let headerCondition = '';
        let titleCondition = '';
        let params = [];
        let paramIndex = 1;

        if (textQuery) {
            textCondition = `
                AND (
                    p.title ILIKE $${paramIndex} 
                    OR p.content_text ILIKE $${paramIndex} 
                    OR p.meta_description ILIKE $${paramIndex}
                )
            `;
            params.push(`%${textQuery}%`);
            paramIndex++;
        }

        if (titleQuery) {
            titleCondition = `
                AND p.title ILIKE $${paramIndex}
            `;
            params.push(`%${titleQuery}%`);
            paramIndex++;
        }

        if (headerName || headerValue) {
            let headerWhere = '';
            if (headerName) {
                headerWhere += `h.header_name ILIKE $${paramIndex}`;
                params.push(`%${headerName}%`);
                paramIndex++;
            }
            if (headerValue) {
                if (headerWhere) headerWhere += ' AND ';
                headerWhere += `h.header_value ILIKE $${paramIndex}`;
                params.push(`%${headerValue}%`);
                paramIndex++;
            }
            
            headerCondition = `
                AND EXISTS (
                    SELECT 1 FROM headers h 
                    WHERE h.page_id = p.id AND ${headerWhere}
                )
            `;
        }

        // Add limit and offset as parameters
        const limitParam = paramIndex;
        const offsetParam = paramIndex + 1;
        params.push(limit, offset);

        const searchQuery = `
            SELECT 
                p.url,
                p.title,
                p.content_text,
                p.meta_description,
                d.domain,
                p.last_crawled,
                p.status_code,
                p.content_length,
                -- Include headers for header search highlighting
                (
                    SELECT json_agg(
                        json_build_object('name', h.header_name, 'value', h.header_value)
                    )
                    FROM headers h 
                    WHERE h.page_id = p.id
                ) as headers
            FROM pages p
            JOIN domains d ON p.domain_id = d.id
            WHERE p.is_accessible = true
            ${textCondition}
            ${titleCondition}
            ${headerCondition}
            GROUP BY p.id, p.url, p.title, p.content_text, p.meta_description, d.domain, p.last_crawled, p.status_code, p.content_length
            ORDER BY p.last_crawled DESC
            LIMIT $${limitParam} OFFSET $${offsetParam}
        `;
        
        const result = await this.database.query(searchQuery, params);
        return result.rows;
    }

    findBestSnippet(content, parsedQuery) {
        if (!content) return 'No content available';
            
            const maxSnippetLength = 300;
            
            // Collect all search terms
            const searchTerms = [];
            if (parsedQuery.text) {
                searchTerms.push(...parsedQuery.text.toLowerCase().split(' ').filter(term => term.length > 2));
            }
            if (parsedQuery.title) {
                searchTerms.push(...parsedQuery.title.toLowerCase().split(' ').filter(term => term.length > 2));
            }
            
            if (searchTerms.length === 0) {
                // No search terms, just return truncated content
                return content.length > maxSnippetLength 
                    ? content.substring(0, maxSnippetLength) + '...'
                    : content;
            }
            
            const contentLower = content.toLowerCase();
            let bestPosition = 0;
            let bestScore = 0;
            
            // Find the position with the most search term matches
            for (let i = 0; i <= content.length - maxSnippetLength; i += 50) {
                const snippet = contentLower.substring(i, i + maxSnippetLength);
                let score = 0;
                
                searchTerms.forEach(term => {
                    // Simple indexOf counting instead of regex for searching
                    let index = 0;
                    let count = 0;
                    while ((index = snippet.indexOf(term, index)) !== -1) {
                        count++;
                        index += term.length;
                    }
                    score += count * term.length;
                });
                
                if (score > bestScore) {
                    bestScore = score;
                    bestPosition = i;
                }
            }
            
            // Extract the best snippet
            let snippet = content.substring(bestPosition, bestPosition + maxSnippetLength);
            
            // Add ellipsis if needed
            if (bestPosition > 0) snippet = '...' + snippet;
            if (bestPosition + maxSnippetLength < content.length) snippet += '...';
            
            return snippet;
        }

    highlightSearchTerms(text, parsedQuery) {
        if (!text) return text;
        
        let highlightedText = text;
        const searchTerms = [];
        
        // Collect all search terms
        if (parsedQuery.text) {
            searchTerms.push(...parsedQuery.text.split(' ').filter(term => term.length > 2));
        }
        if (parsedQuery.title) {
            searchTerms.push(...parsedQuery.title.split(' ').filter(term => term.length > 2));
        }
        if (parsedQuery.header) {
            searchTerms.push(parsedQuery.header);
        }
        if (parsedQuery.value) {
            searchTerms.push(parsedQuery.value);
        }
        
        // Sort by length (longest first) to avoid nested highlighting issues
        searchTerms.sort((a, b) => b.length - a.length);
        
        searchTerms.forEach(term => {
            if (term.length > 1) { // Lowered threshold for header searches
                // Simple case-insensitive replacement without complex regex
                const lowerText = highlightedText.toLowerCase();
                const lowerTerm = term.toLowerCase();
                let result = '';
                let lastIndex = 0;
                
                let index = lowerText.indexOf(lowerTerm);
                while (index !== -1) {
                    // Add text before the match
                    result += highlightedText.substring(lastIndex, index);
                    // Add highlighted match
                    result += '<mark>' + highlightedText.substring(index, index + term.length) + '</mark>';
                    lastIndex = index + term.length;
                    // Find next occurrence
                    index = lowerText.indexOf(lowerTerm, lastIndex);
                }
                // Add remaining text
                result += highlightedText.substring(lastIndex);
                highlightedText = result;
            }
        });
        
        return highlightedText;
    }

    createHeaderSnippet(headers, parsedQuery) {
        if (!headers || !Array.isArray(headers)) return '';
        
        let matchingHeaders = [];
        const searchHeader = parsedQuery.header ? parsedQuery.header.toLowerCase() : null;
        const searchValue = parsedQuery.value ? parsedQuery.value.toLowerCase() : null;
        
        headers.forEach(header => {
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
        });
        
        if (matchingHeaders.length === 0) return '';
        
        let snippet = '<h4>📡 Matching HTTP Headers:</h4>';
        
        matchingHeaders.slice(0, 5).forEach(header => { // Show max 5 headers
            const highlightedName = this.highlightSearchTerms(header.name, parsedQuery);
            const highlightedValue = this.highlightSearchTerms(header.value, parsedQuery);
            
            snippet += '<div class="header-item">' +
                '<span class="header-name">' + this.safeRenderHighlightedText(highlightedName) + '</span>: ' +
                '<span class="header-value">' + this.safeRenderHighlightedText(highlightedValue) + '</span>' +
            '</div>';
        });
        
        if (matchingHeaders.length > 5) {
            snippet += '<div style="color: #888; font-style: italic; margin-top: 5px;">' +
                '... and ' + (matchingHeaders.length - 5) + ' more matching headers' +
            '</div>';
        }
        
        return snippet;
    }

    async searchCombined(textQuery = null, headerName = null, headerValue = null, titleQuery = null, limit = 50, offset = 0) {
        let textCondition = '';
        let headerCondition = '';
        let titleCondition = '';
        let params = [];
        let paramIndex = 1;

        if (textQuery) {
            textCondition = `
                AND (
                    p.title ILIKE $${paramIndex} 
                    OR p.content_text ILIKE $${paramIndex} 
                    OR p.meta_description ILIKE $${paramIndex}
                )
            `;
            params.push(`%${textQuery}%`);
            paramIndex++;
        }

        if (titleQuery) {
            titleCondition = `
                AND p.title ILIKE $${paramIndex}
            `;
            params.push(`%${titleQuery}%`);
            paramIndex++;
        }

        if (headerName || headerValue) {
            let headerWhere = '';
            if (headerName) {
                headerWhere += `h.header_name ILIKE $${paramIndex}`;
                params.push(`%${headerName}%`);
                paramIndex++;
            }
            if (headerValue) {
                if (headerWhere) headerWhere += ' AND ';
                headerWhere += `h.header_value ILIKE $${paramIndex}`;
                params.push(`%${headerValue}%`);
                paramIndex++;
            }
            
            headerCondition = `
                AND EXISTS (
                    SELECT 1 FROM headers h 
                    WHERE h.page_id = p.id AND ${headerWhere}
                )
            `;
        }

        // Add limit and offset as parameters
        const limitParam = paramIndex;
        const offsetParam = paramIndex + 1;
        params.push(limit, offset);

        const searchQuery = `
            SELECT 
                p.url,
                p.title,
                p.content_text,
                p.meta_description,
                d.domain,
                p.last_crawled,
                p.status_code,
                p.content_length,
                -- Include headers for header search highlighting
                (
                    SELECT json_agg(
                        json_build_object('name', h.header_name, 'value', h.header_value)
                    )
                    FROM headers h 
                    WHERE h.page_id = p.id
                ) as headers
            FROM pages p
            JOIN domains d ON p.domain_id = d.id
            WHERE p.is_accessible = true
            ${textCondition}
            ${titleCondition}
            ${headerCondition}
            GROUP BY p.id, p.url, p.title, p.content_text, p.meta_description, d.domain, p.last_crawled, p.status_code, p.content_length
            ORDER BY p.last_crawled DESC
            LIMIT $${limitParam} OFFSET $${offsetParam}
        `;
        
        const result = await this.database.query(searchQuery, params);
        return result.rows;
    }

    async getDomainDetails(domain) {
        const query = `
            SELECT 
                d.id,
                d.domain,
                d.title,
                d.description,
                d.first_seen,
                d.last_crawled,
                d.crawl_count,
                d.is_active,
                -- Get the most recent page for this domain
                (
                    SELECT json_build_object(
                        'url', p.url,
                        'title', p.title,
                        'content_text', SUBSTRING(p.content_text, 1, 1000),
                        'full_content_length', LENGTH(p.content_text),
                        'status_code', p.status_code,
                        'content_type', p.content_type,
                        'last_crawled', p.last_crawled
                    )
                    FROM pages p 
                    WHERE p.domain_id = d.id AND p.is_accessible = true
                    ORDER BY p.last_crawled DESC 
                    LIMIT 1
                ) as latest_page,
                -- Get HTTP headers from the most recent page
                (
                    SELECT json_agg(
                        json_build_object('name', h.header_name, 'value', h.header_value)
                    )
                    FROM headers h
                    WHERE h.page_id = (
                        SELECT p.id 
                        FROM pages p 
                        WHERE p.domain_id = d.id AND p.is_accessible = true 
                        ORDER BY p.last_crawled DESC 
                        LIMIT 1
                    )
                ) as headers,
                -- Count stats
                (SELECT COUNT(*) FROM pages WHERE domain_id = d.id AND is_accessible = true) as total_pages,
                (SELECT COUNT(*) FROM links l JOIN pages p ON l.source_page_id = p.id WHERE p.domain_id = d.id) as outgoing_links_count,
                (SELECT COUNT(*) FROM links WHERE target_domain = d.domain) as incoming_links_count
            FROM domains d
            WHERE d.domain = $1
        `;
        
        const result = await this.database.query(query, [domain]);
        return result.rows[0] || null;
    }

    async getIncomingLinks(domain, limit = 10, offset = 0) {
        const query = `
            SELECT 
                l.anchor_text,
                l.link_type,
                p.url as source_url,
                p.title as source_title,
                d.domain as source_domain,
                p.last_crawled
            FROM links l
            JOIN pages p ON l.source_page_id = p.id
            JOIN domains d ON p.domain_id = d.id
            WHERE l.target_domain = $1
            ORDER BY p.last_crawled DESC
            LIMIT $2 OFFSET $3
        `;
        
        const result = await this.database.query(query, [domain, limit, offset]);
        return result.rows;
    }

    async getOutgoingLinks(domain, limit = 10, offset = 0) {
        const query = `
            SELECT 
                l.target_url,
                l.target_domain,
                l.anchor_text,
                l.link_type,
                l.position_on_page,
                p.url as source_url,
                p.title as source_title
            FROM links l
            JOIN pages p ON l.source_page_id = p.id
            JOIN domains d ON p.domain_id = d.id
            WHERE d.domain = $1
            ORDER BY l.position_on_page ASC, l.id DESC
            LIMIT $2 OFFSET $3
        `;
        
        const result = await this.database.query(query, [domain, limit, offset]);
        return result.rows;
    }

    async start() {
        return new Promise((resolve) => {
            this.server = this.app.listen(this.port, () => {
                console.log(`🌐 Onion Search API running on http://localhost:${this.port}`);
                console.log('📚 Available endpoints:');
                console.log('  GET / - Web interface (open in browser)');
                console.log('  GET /search?q=query - Search with tag support');
                console.log('  GET /stats - Crawler statistics');
                console.log('');
                console.log('🔍 Search examples:');
                console.log('  "bitcoin" - search text content');
                console.log('  "http:\\"server: nginx\\"" - search HTTP headers');
                console.log('  "marketplace http:\\"content-type: text\\"" - combined search');
                resolve();
            });
        });
    }

    async stop() {
        if (this.server) {
            this.server.close();
        }
        await this.database.close();
    }
}

module.exports = OnionSearchAPI;