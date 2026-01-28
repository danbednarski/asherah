import type { DatabaseConfig } from './crawler.js';
export interface ApiOptions {
    port?: number;
    database?: DatabaseConfig;
}
export interface ParsedQuery {
    text: string | null;
    header: string | null;
    value: string | null;
    title: string | null;
    port: number | null;
}
export interface PaginationOptions {
    incomingPage: number;
    outgoingPage: number;
    limit: number;
}
export interface SearchQueryParams {
    q?: string;
    limit?: string;
    offset?: string;
}
export interface DomainQueryParams {
    incomingPage?: string;
    outgoingPage?: string;
    limit?: string;
}
//# sourceMappingURL=api.d.ts.map