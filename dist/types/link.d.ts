export type LinkType = 'internal' | 'external' | 'onion';
export interface Link {
    id: number;
    source_page_id: number;
    target_url: string;
    target_domain: string | null;
    anchor_text: string | null;
    link_type: LinkType;
    position_on_page: number;
    created_at: Date;
}
export type LinkSource = 'a' | 'img' | 'script' | 'link' | 'iframe' | 'form' | 'media' | 'source' | 'object' | 'embed' | 'base' | 'meta' | 'text';
export interface ExtractedLink {
    targetUrl: string;
    targetDomain: string | null;
    anchorText: string;
    linkType: LinkType;
    position: number;
    isOnion: boolean;
    source: LinkSource;
}
export interface LinkExtractionResult {
    links: ExtractedLink[];
    onionDomains: string[];
    onionLinks: ExtractedLink[];
}
export interface NewUrlsResult {
    newUrls: string[];
    newDomains: string[];
}
export interface IncomingLink {
    anchor_text: string | null;
    link_type: LinkType;
    source_url: string;
    source_title: string | null;
    source_domain: string;
    last_crawled: Date;
}
export interface OutgoingLink {
    target_url: string;
    target_domain: string | null;
    anchor_text: string | null;
    link_type: LinkType;
    position_on_page: number;
    source_url: string;
    source_title: string | null;
}
//# sourceMappingURL=link.d.ts.map