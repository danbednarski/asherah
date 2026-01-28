import type { CrawlerStatistics, SearchResult, ParsedQuery, DomainDetails, IncomingLink, OutgoingLink, PaginationOptions } from '../types/index.js';
export declare function escapeHtml(text: string | null | undefined): string;
export declare function safeRenderHighlightedText(text: string | null | undefined): string;
export declare function findBestSnippet(content: string | null, parsedQuery: ParsedQuery): string;
export declare function highlightSearchTerms(text: string | null, parsedQuery: ParsedQuery): string;
export declare function createHeaderSnippet(headers: Array<{
    name: string;
    value: string;
}> | null, parsedQuery: ParsedQuery): string;
export declare function renderSearchResults(query: string, searchResults: SearchResult[] | null, parsedQuery: ParsedQuery | null): string;
export declare function getCSS(): string;
export declare function getHTMLInterface(query: string, searchResults: SearchResult[] | null, parsedQuery: ParsedQuery | null, error: string | null, stats: CrawlerStatistics | null): string;
export declare function getDomainPageHTML(domainInfo: DomainDetails, incomingLinks: IncomingLink[], outgoingLinks: OutgoingLink[], _pagination: PaginationOptions): string;
//# sourceMappingURL=templates.d.ts.map