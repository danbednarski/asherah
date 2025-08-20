        let currentResults = [];

        // Load stats on page load
        window.onload = function() {
            loadStats();
        };

        function findBestSnippet(content, parsedQuery) {
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

        function highlightSearchTerms(text, parsedQuery) {
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

        function createHeaderSnippet(headers, parsedQuery) {
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
                const highlightedName = highlightSearchTerms(header.name, parsedQuery);
                const highlightedValue = highlightSearchTerms(header.value, parsedQuery);
                
                snippet += '<div class="header-item">' +
                    '<span class="header-name">' + highlightedName + '</span>: ' +
                    '<span class="header-value">' + highlightedValue + '</span>' +
                '</div>';
            });
            
            if (matchingHeaders.length > 5) {
                snippet += '<div style="color: #888; font-style: italic; margin-top: 5px;">' +
                    '... and ' + (matchingHeaders.length - 5) + ' more matching headers' +
                '</div>';
            }
            
            return snippet;
        }

        function setQuery(query) {
            document.getElementById('searchInput').value = query;
            performSearch();
        }

        async function loadStats() {
            try {
                const response = await fetch('/stats');
                const stats = await response.json();
                
                const statsHtml = '<div class="stat">' +
                        '<span class="stat-number">' + (stats.totalDomains || 0) + '</span>' +
                        '<span class="stat-label">Domains</span>' +
                    '</div>' +
                    '<div class="stat">' +
                        '<span class="stat-number">' + (stats.totalPages || 0) + '</span>' +
                        '<span class="stat-label">Pages</span>' +
                    '</div>' +
                    '<div class="stat">' +
                        '<span class="stat-number">' + (stats.totalLinks || 0) + '</span>' +
                        '<span class="stat-label">Links</span>' +
                    '</div>' +
                    '<div class="stat">' +
                        '<span class="stat-number">' + (stats.queueSize || 0) + '</span>' +
                        '<span class="stat-label">Queue</span>' +
                    '</div>';
                
                document.getElementById('stats').innerHTML = statsHtml;
            } catch (error) {
                console.error('Failed to load stats:', error);
            }
        }

        async function performSearch(event) {
            if (event) event.preventDefault();
            console.log('performSearch called');
            
            const query = document.getElementById('searchInput').value.trim();
            console.log('Query:', query);
            if (!query) return false;
            
            const resultsDiv = document.getElementById('results');
            resultsDiv.innerHTML = '<div class="loading">🔍 Searching...</div>';
            console.log('Loading message set');
            
            try {
                const response = await fetch('/search?q=' + encodeURIComponent(query) + '&limit=20');
                console.log('Response status:', response.status);
                const data = await response.json();
                console.log('Response data:', data);
                
                if (!response.ok) {
                    throw new Error(data.error || 'Search failed');
                }
                
                currentResults = data.results;
                console.log('About to call displayResults');
                displayResults(data);
                console.log('displayResults called');
                
            } catch (error) {
                console.error('Search error:', error);
                resultsDiv.innerHTML = '<div class="error">❌ Error: ' + error.message + '</div>';
            }
            
            return false;
        }

        function displayResults(data) {
            console.log('displayResults called with data:', data);
            const resultsDiv = document.getElementById('results');
            console.log('Results div found:', resultsDiv);
            
            if (data.results.length === 0) {
                console.log('No results found');
                resultsDiv.innerHTML = '<div class="error">No results found</div>';
                return;
            }
            console.log('Processing', data.results.length, 'results');
            
            let html = '<h3 style="color: #7864a1; margin-bottom: 20px;">Found ' + data.results.length + ' results for "' + data.query + '"</h3>';
            
            let filters = [];
            if (data.parsedQuery.title) {
                filters.push('📝 Title contains: <code style="background: rgba(0,0,0,0.5); padding: 2px 6px; border-radius: 3px;">' + data.parsedQuery.title + '</code>');
            }
            if (data.parsedQuery.header || data.parsedQuery.value) {
                filters.push('📊 HTTP header: <code style="background: rgba(0,0,0,0.5); padding: 2px 6px; border-radius: 3px;">' + (data.parsedQuery.header || 'any') + ': ' + (data.parsedQuery.value || 'any') + '</code>');
            }
            if (filters.length > 0) {
                html += '<p style="color: #a0a0a0; margin-bottom: 20px;">' + filters.join(' | ') + '</p>';
            }
            
            data.results.forEach(result => {
                // Create content snippet and highlight matches
                let displayContent;
                let headerSnippet = '';
                
                // Handle content text
                if (result.content_text) {
                    displayContent = findBestSnippet(result.content_text, data.parsedQuery);
                    displayContent = highlightSearchTerms(displayContent, data.parsedQuery);
                } else {
                    displayContent = 'No content preview available';
                }
                
                // Handle HTTP headers if this is a header search
                if (data.parsedQuery.header || data.parsedQuery.value) {
                    headerSnippet = createHeaderSnippet(result.headers, data.parsedQuery);
                }
                
                // Highlight title matches
                let displayTitle = result.title || 'Untitled';
                if (data.parsedQuery.title && result.title) {
                    displayTitle = highlightSearchTerms(result.title, { title: data.parsedQuery.title });
                }

                html += '<div class="result">' +
                        '<a href="' + result.url + '" class="result-url" target="_blank" rel="noopener">' + result.url + '</a>' +
                        '<div class="result-title">' + displayTitle + '</div>' +
                        '<div class="result-domain">🌐 <a href="#" onclick="showDomainPage('' + result.domain + '')" style="color: #00bfff; text-decoration: none;">' + result.domain + '</a></div>' +
                        (headerSnippet ? '<div class="result-headers">' + headerSnippet + '</div>' : '') +
                        '<div class="result-content">' + displayContent + '</div>' +
                        '<div class="result-meta">' +
                            '<span>📅 ' + new Date(result.last_crawled).toLocaleDateString() + '</span>' +
                            '<span>📏 ' + (result.content_length || 0) + ' chars</span>' +
                            '<span>🔗 Status: ' + (result.status_code || 'unknown') + '</span>' +
                        '</div>' +
                    '</div>';
            });
            
            console.log('Final HTML length:', html.length);
            resultsDiv.innerHTML = html;
            console.log('HTML set to results div');
        }

        async function showDomainPage(domain) {
            const resultsDiv = document.getElementById('results');
            resultsDiv.innerHTML = '<div class="loading">Loading domain information...</div>';
            
            try {
                const response = await fetch('/domain/' + encodeURIComponent(domain));
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.error || 'Failed to load domain information');
                }
                
                displayDomainPage(data);
                
            } catch (error) {
                resultsDiv.innerHTML = '<div class="error">❌ Error: ' + error.message + '</div>';
            }
        }

        function displayDomainPage(data) {
            const resultsDiv = document.getElementById('results');
            const domain = data.domain;
            const latestPage = domain.latest_page;
            
            let html = '<div style="margin-bottom: 20px;">' +
                '<button onclick="window.location.reload()" style="background: rgba(30, 41, 59, 0.5); border: 1px solid rgba(0, 191, 255, 0.3); color: #00bfff; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-family: inherit;">← Back to Search</button>' +
                '</div>' +
                '<div class="domain-detail">' +
                '<h2 style="color: #00bfff; font-size: 2em; margin-bottom: 10px;">🌐 ' + domain.domain + '</h2>' +
                '<div class="domain-meta" style="color: #94a3b8; margin-bottom: 20px; display: flex; gap: 20px; flex-wrap: wrap;">' +
                '<span>📅 First seen: ' + new Date(domain.first_seen).toLocaleDateString() + '</span>' +
                '<span>🕒 Last crawled: ' + new Date(domain.last_crawled).toLocaleDateString() + '</span>' +
                '<span>🔢 Crawl count: ' + domain.crawl_count + '</span>' +
                '<span>📄 Total pages: ' + domain.total_pages + '</span>' +
                '</div>' +
                '<div class="domain-stats" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 30px;">' +
                '<div class="stat"><span class="stat-number">' + domain.incoming_links_count + '</span><span class="stat-label">Incoming Links</span></div>' +
                '<div class="stat"><span class="stat-number">' + domain.outgoing_links_count + '</span><span class="stat-label">Outgoing Links</span></div>' +
                '<div class="stat"><span class="stat-number">' + domain.total_pages + '</span><span class="stat-label">Total Pages</span></div>' +
                '<div class="stat"><span class="stat-number">' + (latestPage ? latestPage.status_code : 'N/A') + '</span><span class="stat-label">Latest Status</span></div>' +
                '</div>';

            // Latest page information
            if (latestPage) {
                html += '<div class="domain-section">' +
                    '<h3 style="color: #00e599; margin-bottom: 15px;">📄 Latest Page Content</h3>' +
                    '<div class="result" style="margin-bottom: 20px;">' +
                    '<div class="result-title">' + (latestPage.title || 'Untitled') + '</div>' +
                    '<a href="' + latestPage.url + '" class="result-url" target="_blank" rel="noopener">' + latestPage.url + '</a>' +
                    '<div class="result-meta" style="margin: 10px 0;">' +
                    '<span>📅 ' + new Date(latestPage.last_crawled).toLocaleDateString() + '</span>' +
                    '<span>📏 ' + (latestPage.full_content_length || 0) + ' chars</span>' +
                    '<span>📦 ' + (latestPage.content_type || 'unknown') + '</span>' +
                    '</div>' +
                    '<div class="content-preview">' +
                    '<div id="content-preview" style="color: #cbd5e1; line-height: 1.6; max-height: 200px; overflow: hidden;">' +
                    (latestPage.content_text || 'No content available') +
                    '</div>' +
                    (latestPage.full_content_length > 1000 ? 
                        '<button onclick="toggleContentExpand()" id="expand-btn" style="background: rgba(0, 191, 255, 0.2); border: 1px solid #00bfff; color: #00bfff; padding: 5px 10px; border-radius: 3px; cursor: pointer; margin-top: 10px; font-family: inherit;">Show Full Content</button>' 
                        : ''
                    ) +
                    '</div>' +
                    '</div>' +
                    '</div>';
            }

            // HTTP Headers
            if (domain.headers && domain.headers.length > 0) {
                html += '<div class="domain-section">' +
                    '<h3 style="color: #00e599; margin-bottom: 15px;">🔧 HTTP Headers</h3>' +
                    '<div class="result-headers">' +
                    domain.headers.map(function(header) {
                        return '<div class="header-item">' +
                            '<span class="header-name">' + header.name + '</span>: ' +
                            '<span class="header-value">' + header.value + '</span>' +
                            '</div>';
                    }).join('') +
                    '</div>' +
                    '</div>';
            }

            // Incoming Links
            html += '<div class="domain-section">' +
                '<h3 style="color: #00e599; margin-bottom: 15px;">🔗 Who Links Here (' + domain.incoming_links_count + ')</h3>' +
                '<div id="incoming-links">' +
                '<div class="loading">Loading incoming links...</div>' +
                '</div>' +
                '</div>' +
                '<div class="domain-section">' +
                '<h3 style="color: #00e599; margin-bottom: 15px;">➡️ Outgoing Links (' + domain.outgoing_links_count + ')</h3>' +
                '<div id="outgoing-links">' +
                '<div class="loading">Loading outgoing links...</div>' +
                '</div>' +
                '</div>';

            html += '</div>';
            resultsDiv.innerHTML = html;

            // Load links data
            loadDomainLinks(domain.domain);
        }

        async function loadDomainLinks(domain) {
            try {
                const response = await fetch('/domain/' + encodeURIComponent(domain));
                const data = await response.json();
                
                // Display incoming links
                const incomingDiv = document.getElementById('incoming-links');
                if (data.incomingLinks.length === 0) {
                    incomingDiv.innerHTML = '<div style="color: #64748b; font-style: italic;">No incoming links found</div>';
                } else {
                    let incomingHtml = '';
                    data.incomingLinks.forEach(function(link) {
                        incomingHtml += '<div class="result" style="margin-bottom: 10px;">' +
                            '<div style="color: #cbd5e1; margin-bottom: 5px;">' +
                            '<strong>"' + (link.anchor_text || 'No anchor text') + '"</strong>' +
                            '</div>' +
                            '<div style="font-size: 0.9em;">' +
                            'From: <a href="#" onclick="showDomainPage('' + link.source_domain + '')" style="color: #00bfff;">' + link.source_domain + '</a>' +
                            '</div>' +
                            '<div style="font-size: 0.85em; color: #64748b;">' +
                            (link.source_title || 'Untitled page') + ' • ' + new Date(link.last_crawled).toLocaleDateString() +
                            '</div>' +
                            '</div>';
                    });
                    incomingDiv.innerHTML = incomingHtml;
                }

                // Display outgoing links
                const outgoingDiv = document.getElementById('outgoing-links');
                if (data.outgoingLinks.length === 0) {
                    outgoingDiv.innerHTML = '<div style="color: #64748b; font-style: italic;">No outgoing links found</div>';
                } else {
                    let outgoingHtml = '';
                    data.outgoingLinks.forEach(function(link) {
                        outgoingHtml += '<div class="result" style="margin-bottom: 10px;">' +
                            '<div style="color: #cbd5e1; margin-bottom: 5px;">' +
                            '<strong>"' + (link.anchor_text || 'No anchor text') + '"</strong>' +
                            '</div>' +
                            '<div style="font-size: 0.9em;">' +
                            'To: ' + (link.target_domain ? 
                                '<a href="#" onclick="showDomainPage('' + link.target_domain + '')" style="color: #00bfff;">' + link.target_domain + '</a>' :
                                '<span style="color: #64748b;">' + link.target_url + '</span>'
                            ) +
                            '</div>' +
                            '</div>';
                    });
                    outgoingDiv.innerHTML = outgoingHtml;
                }

            } catch (error) {
                document.getElementById('incoming-links').innerHTML = '<div class="error">Error loading links: ' + error.message + '</div>';
                document.getElementById('outgoing-links').innerHTML = '<div class="error">Error loading links: ' + error.message + '</div>';
            }
        }

        function toggleContentExpand() {
            const preview = document.getElementById('content-preview');
            const btn = document.getElementById('expand-btn');
            
            if (preview.style.maxHeight === '200px') {
                preview.style.maxHeight = 'none';
                btn.textContent = 'Show Less';
            } else {
                preview.style.maxHeight = '200px';
                btn.textContent = 'Show Full Content';
            }
        }
