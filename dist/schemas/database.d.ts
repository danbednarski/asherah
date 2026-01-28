import { z } from 'zod';
export declare const CrawlStatusSchema: z.ZodEnum<["pending", "crawling", "completed", "failed"]>;
export declare const DomainRowSchema: z.ZodObject<{
    id: z.ZodNumber;
    domain: z.ZodString;
    title: z.ZodNullable<z.ZodString>;
    description: z.ZodNullable<z.ZodString>;
    first_seen: z.ZodDate;
    last_crawled: z.ZodNullable<z.ZodDate>;
    crawl_count: z.ZodNumber;
    crawl_status: z.ZodNullable<z.ZodEnum<["pending", "crawling", "completed", "failed"]>>;
    crawl_started_at: z.ZodNullable<z.ZodDate>;
    last_worker_id: z.ZodNullable<z.ZodString>;
    is_active: z.ZodBoolean;
    created_at: z.ZodDate;
    updated_at: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    id: number;
    domain: string;
    title: string | null;
    description: string | null;
    first_seen: Date;
    last_crawled: Date | null;
    crawl_count: number;
    crawl_status: "pending" | "crawling" | "completed" | "failed" | null;
    crawl_started_at: Date | null;
    last_worker_id: string | null;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
}, {
    id: number;
    domain: string;
    title: string | null;
    description: string | null;
    first_seen: Date;
    last_crawled: Date | null;
    crawl_count: number;
    crawl_status: "pending" | "crawling" | "completed" | "failed" | null;
    crawl_started_at: Date | null;
    last_worker_id: string | null;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
}>;
export declare const DomainUpsertResultSchema: z.ZodObject<{
    id: z.ZodNumber;
    domain: z.ZodString;
    crawl_count: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    id: number;
    domain: string;
    crawl_count: number;
}, {
    id: number;
    domain: string;
    crawl_count: number;
}>;
export declare const PageRowSchema: z.ZodObject<{
    id: z.ZodNumber;
    domain_id: z.ZodNumber;
    url: z.ZodString;
    path: z.ZodString;
    title: z.ZodNullable<z.ZodString>;
    content_text: z.ZodNullable<z.ZodString>;
    content_html: z.ZodNullable<z.ZodString>;
    status_code: z.ZodNullable<z.ZodNumber>;
    content_length: z.ZodNullable<z.ZodNumber>;
    content_type: z.ZodNullable<z.ZodString>;
    language: z.ZodNullable<z.ZodString>;
    meta_description: z.ZodNullable<z.ZodString>;
    h1_tags: z.ZodNullable<z.ZodArray<z.ZodString, "many">>;
    last_crawled: z.ZodDate;
    crawl_count: z.ZodNumber;
    is_accessible: z.ZodBoolean;
    created_at: z.ZodDate;
    updated_at: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    path: string;
    id: number;
    title: string | null;
    last_crawled: Date;
    crawl_count: number;
    created_at: Date;
    updated_at: Date;
    domain_id: number;
    url: string;
    content_text: string | null;
    content_html: string | null;
    status_code: number | null;
    content_length: number | null;
    content_type: string | null;
    language: string | null;
    meta_description: string | null;
    h1_tags: string[] | null;
    is_accessible: boolean;
}, {
    path: string;
    id: number;
    title: string | null;
    last_crawled: Date;
    crawl_count: number;
    created_at: Date;
    updated_at: Date;
    domain_id: number;
    url: string;
    content_text: string | null;
    content_html: string | null;
    status_code: number | null;
    content_length: number | null;
    content_type: string | null;
    language: string | null;
    meta_description: string | null;
    h1_tags: string[] | null;
    is_accessible: boolean;
}>;
export declare const PageUpsertResultSchema: z.ZodObject<{
    id: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    id: number;
}, {
    id: number;
}>;
export declare const QueueStatusSchema: z.ZodEnum<["pending", "processing", "completed", "failed"]>;
export declare const QueueItemSchema: z.ZodObject<{
    url: z.ZodString;
    domain: z.ZodString;
    priority: z.ZodNumber;
    attempts: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    domain: string;
    url: string;
    priority: number;
    attempts: number;
}, {
    domain: string;
    url: string;
    priority: number;
    attempts: number;
}>;
export declare const StatisticsRowSchema: z.ZodObject<{
    count: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    count: number;
}, {
    count: number;
}>;
export declare const DomainStatusRowSchema: z.ZodObject<{
    crawl_status: z.ZodNullable<z.ZodString>;
    count: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    crawl_status: string | null;
    count: number;
}, {
    crawl_status: string | null;
    count: number;
}>;
export declare const SearchResultRowSchema: z.ZodObject<{
    url: z.ZodString;
    title: z.ZodNullable<z.ZodString>;
    content_text: z.ZodNullable<z.ZodString>;
    meta_description: z.ZodNullable<z.ZodString>;
    domain: z.ZodString;
    last_crawled: z.ZodDate;
    status_code: z.ZodNullable<z.ZodNumber>;
    content_length: z.ZodNullable<z.ZodNumber>;
    headers: z.ZodNullable<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        value: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        value: string;
        name: string;
    }, {
        value: string;
        name: string;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    domain: string;
    title: string | null;
    last_crawled: Date;
    url: string;
    content_text: string | null;
    status_code: number | null;
    content_length: number | null;
    meta_description: string | null;
    headers: {
        value: string;
        name: string;
    }[] | null;
}, {
    domain: string;
    title: string | null;
    last_crawled: Date;
    url: string;
    content_text: string | null;
    status_code: number | null;
    content_length: number | null;
    meta_description: string | null;
    headers: {
        value: string;
        name: string;
    }[] | null;
}>;
export declare const LatestPageInfoSchema: z.ZodObject<{
    url: z.ZodString;
    title: z.ZodNullable<z.ZodString>;
    content_text: z.ZodNullable<z.ZodString>;
    full_content_length: z.ZodNumber;
    status_code: z.ZodNullable<z.ZodNumber>;
    content_type: z.ZodNullable<z.ZodString>;
    last_crawled: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    title: string | null;
    last_crawled: Date;
    url: string;
    content_text: string | null;
    status_code: number | null;
    content_type: string | null;
    full_content_length: number;
}, {
    title: string | null;
    last_crawled: Date;
    url: string;
    content_text: string | null;
    status_code: number | null;
    content_type: string | null;
    full_content_length: number;
}>;
export declare const HeaderInfoSchema: z.ZodObject<{
    name: z.ZodString;
    value: z.ZodString;
}, "strip", z.ZodTypeAny, {
    value: string;
    name: string;
}, {
    value: string;
    name: string;
}>;
export declare const DomainDetailsRowSchema: z.ZodObject<{
    id: z.ZodNumber;
    domain: z.ZodString;
    title: z.ZodNullable<z.ZodString>;
    description: z.ZodNullable<z.ZodString>;
    first_seen: z.ZodDate;
    last_crawled: z.ZodNullable<z.ZodDate>;
    crawl_count: z.ZodNumber;
    is_active: z.ZodBoolean;
    latest_page: z.ZodNullable<z.ZodObject<{
        url: z.ZodString;
        title: z.ZodNullable<z.ZodString>;
        content_text: z.ZodNullable<z.ZodString>;
        full_content_length: z.ZodNumber;
        status_code: z.ZodNullable<z.ZodNumber>;
        content_type: z.ZodNullable<z.ZodString>;
        last_crawled: z.ZodDate;
    }, "strip", z.ZodTypeAny, {
        title: string | null;
        last_crawled: Date;
        url: string;
        content_text: string | null;
        status_code: number | null;
        content_type: string | null;
        full_content_length: number;
    }, {
        title: string | null;
        last_crawled: Date;
        url: string;
        content_text: string | null;
        status_code: number | null;
        content_type: string | null;
        full_content_length: number;
    }>>;
    headers: z.ZodNullable<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        value: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        value: string;
        name: string;
    }, {
        value: string;
        name: string;
    }>, "many">>;
    total_pages: z.ZodNumber;
    outgoing_links_count: z.ZodNumber;
    incoming_links_count: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    id: number;
    domain: string;
    title: string | null;
    description: string | null;
    first_seen: Date;
    last_crawled: Date | null;
    crawl_count: number;
    is_active: boolean;
    headers: {
        value: string;
        name: string;
    }[] | null;
    latest_page: {
        title: string | null;
        last_crawled: Date;
        url: string;
        content_text: string | null;
        status_code: number | null;
        content_type: string | null;
        full_content_length: number;
    } | null;
    total_pages: number;
    outgoing_links_count: number;
    incoming_links_count: number;
}, {
    id: number;
    domain: string;
    title: string | null;
    description: string | null;
    first_seen: Date;
    last_crawled: Date | null;
    crawl_count: number;
    is_active: boolean;
    headers: {
        value: string;
        name: string;
    }[] | null;
    latest_page: {
        title: string | null;
        last_crawled: Date;
        url: string;
        content_text: string | null;
        status_code: number | null;
        content_type: string | null;
        full_content_length: number;
    } | null;
    total_pages: number;
    outgoing_links_count: number;
    incoming_links_count: number;
}>;
export declare const IncomingLinkRowSchema: z.ZodObject<{
    anchor_text: z.ZodNullable<z.ZodString>;
    link_type: z.ZodString;
    source_url: z.ZodString;
    source_title: z.ZodNullable<z.ZodString>;
    source_domain: z.ZodString;
    last_crawled: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    last_crawled: Date;
    anchor_text: string | null;
    link_type: string;
    source_url: string;
    source_title: string | null;
    source_domain: string;
}, {
    last_crawled: Date;
    anchor_text: string | null;
    link_type: string;
    source_url: string;
    source_title: string | null;
    source_domain: string;
}>;
export declare const OutgoingLinkRowSchema: z.ZodObject<{
    target_url: z.ZodString;
    target_domain: z.ZodNullable<z.ZodString>;
    anchor_text: z.ZodNullable<z.ZodString>;
    link_type: z.ZodString;
    position_on_page: z.ZodNumber;
    source_url: z.ZodString;
    source_title: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    anchor_text: string | null;
    link_type: string;
    source_url: string;
    source_title: string | null;
    target_url: string;
    target_domain: string | null;
    position_on_page: number;
}, {
    anchor_text: string | null;
    link_type: string;
    source_url: string;
    source_title: string | null;
    target_url: string;
    target_domain: string | null;
    position_on_page: number;
}>;
export declare const DomainLockResultSchema: z.ZodObject<{
    acquired: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    acquired: boolean;
}, {
    acquired: boolean;
}>;
export declare const DomainReleaseResultSchema: z.ZodObject<{
    released: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    released: boolean;
}, {
    released: boolean;
}>;
export declare const DomainExtendResultSchema: z.ZodObject<{
    extended: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    extended: boolean;
}, {
    extended: boolean;
}>;
export type DomainRow = z.infer<typeof DomainRowSchema>;
export type DomainUpsertResult = z.infer<typeof DomainUpsertResultSchema>;
export type PageRow = z.infer<typeof PageRowSchema>;
export type PageUpsertResult = z.infer<typeof PageUpsertResultSchema>;
export type QueueItem = z.infer<typeof QueueItemSchema>;
export type SearchResultRow = z.infer<typeof SearchResultRowSchema>;
export type DomainDetailsRow = z.infer<typeof DomainDetailsRowSchema>;
export type IncomingLinkRow = z.infer<typeof IncomingLinkRowSchema>;
export type OutgoingLinkRow = z.infer<typeof OutgoingLinkRowSchema>;
//# sourceMappingURL=database.d.ts.map