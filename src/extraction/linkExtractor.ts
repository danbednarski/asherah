import cheerio from 'cheerio';
import { extractOnionDomain, isBaseDomain, validateOnionDomain } from '../utils/domain.js';
import type {
  ExtractedLink,
  LinkExtractionResult,
  NewUrlsResult,
  LinkType,
  LinkSource,
  PageMetadata,
} from '../types/index.js';

export class LinkExtractor {
  private readonly onionRegex = /([a-z2-7]{56}\.onion)/gi;
  private readonly urlRegex = /https?:\/\/[a-z2-7]{56}\.onion[^\s'"<>]*/gi;

  normalizeUrl(url: string, baseUrl: string): string | null {
    try {
      let normalizedUrl = url;

      if (normalizedUrl.startsWith('//')) {
        normalizedUrl = 'http:' + normalizedUrl;
      } else if (normalizedUrl.startsWith('/')) {
        const base = new URL(baseUrl);
        normalizedUrl = `${base.protocol}//${base.host}${normalizedUrl}`;
      } else if (!normalizedUrl.startsWith('http')) {
        const base = new URL(baseUrl);
        normalizedUrl = `${base.protocol}//${base.host}/${normalizedUrl}`;
      }

      const urlObj = new URL(normalizedUrl);
      urlObj.hash = '';
      return urlObj.href;
    } catch {
      return null;
    }
  }

  extractFromHtml(html: string, baseUrl: string): LinkExtractionResult {
    const $ = cheerio.load(html, {
      xmlMode: false,
    });

    const links: ExtractedLink[] = [];
    const onionDomains = new Set<string>();
    const seenUrls = new Set<string>();
    let position = 0;

    const baseDomain = extractOnionDomain(baseUrl);

    // Helper to process a URL and add it to links
    const processUrl = (url: string | undefined, anchorText: string, source: LinkSource): void => {
      if (!url || url.startsWith('#') || url.startsWith('mailto:') || url.startsWith('javascript:') || url.startsWith('data:')) {
        return;
      }

      const normalizedUrl = this.normalizeUrl(url, baseUrl);
      if (!normalizedUrl || seenUrls.has(normalizedUrl)) return;
      seenUrls.add(normalizedUrl);

      const targetDomain = extractOnionDomain(normalizedUrl);
      const isOnion = !!targetDomain;
      const isInternal = targetDomain === baseDomain;

      let linkType: LinkType = 'external';
      if (isOnion) {
        linkType = isInternal ? 'internal' : 'onion';
        if (targetDomain) {
          onionDomains.add(targetDomain);
        }
      }

      links.push({
        targetUrl: normalizedUrl,
        targetDomain,
        anchorText: anchorText.substring(0, 500),
        linkType,
        position: position++,
        isOnion,
        source,
      });
    };

    // 1. Extract from <a href> tags (primary source)
    $('a[href]').each((_, element) => {
      const $el = $(element);
      processUrl($el.attr('href'), $el.text().trim(), 'a');
    });

    // 2. Extract from resource elements
    // Images - could be hosted on other onion services
    $('img[src]').each((_, element) => {
      processUrl($(element).attr('src'), $(element).attr('alt') || 'image', 'img');
    });

    // Scripts - could reveal APIs or CDNs
    $('script[src]').each((_, element) => {
      processUrl($(element).attr('src'), 'script', 'script');
    });

    // Stylesheets
    $('link[href]').each((_, element) => {
      processUrl($(element).attr('href'), 'stylesheet', 'link');
    });

    // Iframes and frames - embedded content
    $('iframe[src], frame[src]').each((_, element) => {
      processUrl($(element).attr('src'), 'iframe', 'iframe');
    });

    // Forms - action targets
    $('form[action]').each((_, element) => {
      processUrl($(element).attr('action'), 'form', 'form');
    });

    // Media elements
    $('video[src], audio[src]').each((_, element) => {
      processUrl($(element).attr('src'), 'media', 'media');
    });

    // Source elements inside video/audio
    $('source[src]').each((_, element) => {
      processUrl($(element).attr('src'), 'media-source', 'source');
    });

    // Object and embed elements
    $('object[data]').each((_, element) => {
      processUrl($(element).attr('data'), 'object', 'object');
    });

    $('embed[src]').each((_, element) => {
      processUrl($(element).attr('src'), 'embed', 'embed');
    });

    // Base href (sets base URL for the page)
    $('base[href]').each((_, element) => {
      processUrl($(element).attr('href'), 'base', 'base');
    });

    // Meta refresh redirects
    $('meta[http-equiv="refresh"]').each((_, element) => {
      const content = $(element).attr('content');
      if (content) {
        const urlMatch = content.match(/url=(.+)/i);
        if (urlMatch?.[1]) {
          processUrl(urlMatch[1].trim(), 'meta-refresh', 'meta');
        }
      }
    });

    // 3. Extract onions from raw text (catches mentions in comments, code blocks, etc.)
    const textOnions = this.extractOnionsFromText(html);
    for (const domain of textOnions) {
      onionDomains.add(domain);
    }

    return {
      links,
      onionDomains: Array.from(onionDomains),
      onionLinks: links.filter((link) => link.isOnion),
    };
  }

  extractOnionsFromText(text: string): string[] {
    const onions = new Set<string>();

    // Reset regex lastIndex
    this.onionRegex.lastIndex = 0;
    const matches = text.match(this.onionRegex);

    if (matches) {
      for (const match of matches) {
        const domain = match.toLowerCase();
        if (validateOnionDomain(domain)) {
          onions.add(domain);
        }
      }
    }

    // Reset regex lastIndex
    this.urlRegex.lastIndex = 0;
    const urlMatches = text.match(this.urlRegex);
    if (urlMatches) {
      for (const url of urlMatches) {
        const domain = extractOnionDomain(url);
        if (domain) {
          onions.add(domain);
        }
      }
    }

    return Array.from(onions);
  }

  extractPageMetadata(html: string, url: string): PageMetadata {
    const $ = cheerio.load(html, {
      xmlMode: false,
    });

    const title = $('title').first().text().trim() || '';
    const metaDescription = $('meta[name="description"]').attr('content') || '';
    const language = $('html').attr('lang') || $('meta[http-equiv="content-language"]').attr('content') || '';

    const h1Tags: string[] = [];
    $('h1').each((_, element) => {
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
        contentText,
        path,
      };
    } catch {
      return {
        title: title.substring(0, 500),
        metaDescription: metaDescription.substring(0, 1000),
        language: language.substring(0, 10),
        h1Tags: h1Tags.slice(0, 10),
        contentText,
        path: '/',
      };
    }
  }

  extractCleanText($: cheerio.Root): string {
    $('script, style, nav, footer, header, aside, .ad, .advertisement').remove();

    const text = $('body')
      .text()
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim();

    return text.substring(0, 50000);
  }

  findNewUrls(links: ExtractedLink[], knownDomains = new Set<string>()): NewUrlsResult {
    const newUrls: string[] = [];
    const newDomains: string[] = [];

    for (const link of links) {
      if (link.isOnion && link.targetDomain) {
        if (!knownDomains.has(link.targetDomain)) {
          newDomains.push(link.targetDomain);
          knownDomains.add(link.targetDomain);
        }
        newUrls.push(link.targetUrl);
      }
    }

    return {
      newUrls: [...new Set(newUrls)],
      newDomains: [...new Set(newDomains)],
    };
  }

  prioritizeUrls(urls: string[]): string[] {
    return urls.sort((a, b) => {
      const aIsBase = isBaseDomain(a);
      const bIsBase = isBaseDomain(b);

      if (aIsBase && !bIsBase) return -1;
      if (!aIsBase && bIsBase) return 1;

      return a.length - b.length;
    });
  }
}
