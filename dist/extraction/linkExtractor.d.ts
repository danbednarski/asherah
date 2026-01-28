import type { ExtractedLink, LinkExtractionResult, NewUrlsResult, PageMetadata } from '../types/index.js';
export declare class LinkExtractor {
    private readonly onionRegex;
    private readonly urlRegex;
    normalizeUrl(url: string, baseUrl: string): string | null;
    extractFromHtml(html: string, baseUrl: string): LinkExtractionResult;
    extractOnionsFromText(text: string): string[];
    extractPageMetadata(html: string, url: string): PageMetadata;
    extractCleanText($: cheerio.Root): string;
    findNewUrls(links: ExtractedLink[], knownDomains?: Set<string>): NewUrlsResult;
    prioritizeUrls(urls: string[]): string[];
}
//# sourceMappingURL=linkExtractor.d.ts.map