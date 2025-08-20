const cheerio = require('cheerio');
const { URL } = require('url');

class LinkExtractor {
    constructor() {
        this.onionRegex = /([a-z2-7]{56}\.onion)/gi;
        this.urlRegex = /https?:\/\/[a-z2-7]{56}\.onion[^\s\'"<>]*/gi;
    }

    extractOnionDomain(url) {
        const match = url.match(/([a-z2-7]{56}\.onion)/i);
        return match ? match[1].toLowerCase() : null;
    }

    isOnionUrl(url) {
        return this.onionRegex.test(url);
    }

    normalizeUrl(url, baseUrl) {
        try {
            if (url.startsWith('//')) {
                url = 'http:' + url;
            } else if (url.startsWith('/')) {
                const base = new URL(baseUrl);
                url = `${base.protocol}//${base.host}${url}`;
            } else if (!url.startsWith('http')) {
                const base = new URL(baseUrl);
                url = `${base.protocol}//${base.host}/${url}`;
            }
            
            const urlObj = new URL(url);
            urlObj.hash = '';
            return urlObj.href;
        } catch (error) {
            return null;
        }
    }

    extractFromHtml(html, baseUrl) {
        const $ = cheerio.load(html, {
            decodeEntities: true,
            xmlMode: false,
            normalizeWhitespace: false
        });
        const links = [];
        const onionDomains = new Set();
        let position = 0;

        $('a[href]').each((index, element) => {
            const $link = $(element);
            const href = $link.attr('href');
            const anchorText = $link.text().trim();
            
            if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('javascript:')) {
                return;
            }

            const normalizedUrl = this.normalizeUrl(href, baseUrl);
            if (!normalizedUrl) return;

            const targetDomain = this.extractOnionDomain(normalizedUrl);
            const isOnion = !!targetDomain;
            const baseDomain = this.extractOnionDomain(baseUrl);
            const isInternal = targetDomain === baseDomain;

            let linkType = 'external';
            if (isOnion) {
                linkType = isInternal ? 'internal' : 'onion';
                onionDomains.add(targetDomain);
            }

            links.push({
                targetUrl: normalizedUrl,
                targetDomain: targetDomain,
                anchorText: anchorText.substring(0, 500),
                linkType: linkType,
                position: position++,
                isOnion: isOnion
            });
        });

        const textOnions = this.extractOnionsFromText(html);
        textOnions.forEach(domain => onionDomains.add(domain));

        return {
            links: links,
            onionDomains: Array.from(onionDomains),
            onionLinks: links.filter(link => link.isOnion)
        };
    }

    extractOnionsFromText(text) {
        const onions = new Set();
        const matches = text.match(this.onionRegex);
        
        if (matches) {
            matches.forEach(match => {
                const domain = match.toLowerCase();
                if (this.validateOnionDomain(domain)) {
                    onions.add(domain);
                }
            });
        }

        const urlMatches = text.match(this.urlRegex);
        if (urlMatches) {
            urlMatches.forEach(url => {
                const domain = this.extractOnionDomain(url);
                if (domain) {
                    onions.add(domain);
                }
            });
        }

        return Array.from(onions);
    }

    validateOnionDomain(domain) {
        if (!domain || typeof domain !== 'string') return false;
        
        const parts = domain.split('.');
        if (parts.length !== 2 || parts[1] !== 'onion') return false;
        
        const address = parts[0];
        if (address.length !== 56) return false;
        
        return /^[a-z2-7]+$/.test(address);
    }

    extractPageMetadata(html, url) {
        const $ = cheerio.load(html, {
            decodeEntities: true,
            xmlMode: false,
            normalizeWhitespace: false
        });
        
        const title = $('title').first().text().trim() || '';
        const metaDescription = $('meta[name="description"]').attr('content') || '';
        const language = $('html').attr('lang') || $('meta[http-equiv="content-language"]').attr('content') || '';
        
        const h1Tags = [];
        $('h1').each((index, element) => {
            const text = $(element).text().trim();
            if (text) h1Tags.push(text);
        });

        const contentText = this.extractCleanText($);
        
        try {
            const urlObj = new URL(url);
            const path = urlObj.pathname + urlObj.search;
            
            return {
                title: title.substring(0, 500),
                metaDescription: metaDescription.substring(0, 1000),
                language: language.substring(0, 10),
                h1Tags: h1Tags.slice(0, 10),
                contentText: contentText,
                path: path
            };
        } catch (error) {
            return {
                title: title.substring(0, 500),
                metaDescription: metaDescription.substring(0, 1000),
                language: language.substring(0, 10),
                h1Tags: h1Tags.slice(0, 10),
                contentText: contentText,
                path: '/'
            };
        }
    }

    extractCleanText($) {
        $('script, style, nav, footer, header, aside, .ad, .advertisement').remove();
        
        const text = $('body').text()
            .replace(/\s+/g, ' ')
            .replace(/\n+/g, '\n')
            .trim();
            
        return text.substring(0, 50000);
    }

    findNewUrls(links, knownDomains = new Set()) {
        const newUrls = [];
        const newDomains = [];
        
        links.forEach(link => {
            if (link.isOnion && link.targetDomain) {
                if (!knownDomains.has(link.targetDomain)) {
                    newDomains.push(link.targetDomain);
                    knownDomains.add(link.targetDomain);
                }
                newUrls.push(link.targetUrl);
            }
        });

        return {
            newUrls: [...new Set(newUrls)],
            newDomains: [...new Set(newDomains)]
        };
    }

    prioritizeUrls(urls) {
        return urls.sort((a, b) => {
            const aIsBase = this.isBaseDomain(a);
            const bIsBase = this.isBaseDomain(b);
            
            if (aIsBase && !bIsBase) return -1;
            if (!aIsBase && bIsBase) return 1;
            
            return a.length - b.length;
        });
    }

    isBaseDomain(url) {
        try {
            const urlObj = new URL(url);
            const path = urlObj.pathname;
            return path === '/' || path === '';
        } catch {
            return false;
        }
    }
}

module.exports = LinkExtractor;