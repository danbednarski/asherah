import { z } from 'zod';

// Domain schemas
export const CrawlStatusSchema = z.enum(['pending', 'crawling', 'completed', 'failed']);

export const DomainRowSchema = z.object({
  id: z.number(),
  domain: z.string(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  first_seen: z.coerce.date(),
  last_crawled: z.coerce.date().nullable(),
  crawl_count: z.number(),
  crawl_status: CrawlStatusSchema.nullable(),
  crawl_started_at: z.coerce.date().nullable(),
  last_worker_id: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

export const DomainUpsertResultSchema = z.object({
  id: z.number(),
  domain: z.string(),
  crawl_count: z.number(),
});

// Page schemas
export const PageRowSchema = z.object({
  id: z.number(),
  domain_id: z.number(),
  url: z.string(),
  path: z.string(),
  title: z.string().nullable(),
  content_text: z.string().nullable(),
  content_html: z.string().nullable(),
  status_code: z.number().nullable(),
  content_length: z.number().nullable(),
  content_type: z.string().nullable(),
  language: z.string().nullable(),
  meta_description: z.string().nullable(),
  h1_tags: z.array(z.string()).nullable(),
  last_crawled: z.coerce.date(),
  crawl_count: z.number(),
  is_accessible: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

export const PageUpsertResultSchema = z.object({
  id: z.number(),
});

// Queue schemas
export const QueueStatusSchema = z.enum(['pending', 'processing', 'completed', 'failed']);

export const QueueItemSchema = z.object({
  url: z.string(),
  domain: z.string(),
  priority: z.number(),
  attempts: z.number(),
});

// Statistics schemas
export const StatisticsRowSchema = z.object({
  count: z.coerce.number(),
});

export const DomainStatusRowSchema = z.object({
  crawl_status: z.string().nullable(),
  count: z.coerce.number(),
});

// Search result schemas
export const SearchResultRowSchema = z.object({
  url: z.string(),
  title: z.string().nullable(),
  content_text: z.string().nullable(),
  meta_description: z.string().nullable(),
  domain: z.string(),
  last_crawled: z.coerce.date(),
  status_code: z.number().nullable(),
  content_length: z.number().nullable(),
  headers: z.array(z.object({
    name: z.string(),
    value: z.string(),
  })).nullable(),
});

// Domain details schemas
export const LatestPageInfoSchema = z.object({
  url: z.string(),
  title: z.string().nullable(),
  content_text: z.string().nullable(),
  full_content_length: z.number(),
  status_code: z.number().nullable(),
  content_type: z.string().nullable(),
  last_crawled: z.coerce.date(),
});

export const HeaderInfoSchema = z.object({
  name: z.string(),
  value: z.string(),
});

export const DomainDetailsRowSchema = z.object({
  id: z.number(),
  domain: z.string(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  first_seen: z.coerce.date(),
  last_crawled: z.coerce.date().nullable(),
  crawl_count: z.number(),
  is_active: z.boolean(),
  latest_page: LatestPageInfoSchema.nullable(),
  headers: z.array(HeaderInfoSchema).nullable(),
  total_pages: z.coerce.number(),
  outgoing_links_count: z.coerce.number(),
  incoming_links_count: z.coerce.number(),
});

// Link schemas
export const IncomingLinkRowSchema = z.object({
  anchor_text: z.string().nullable(),
  link_type: z.string(),
  source_url: z.string(),
  source_title: z.string().nullable(),
  source_domain: z.string(),
  last_crawled: z.coerce.date(),
});

export const OutgoingLinkRowSchema = z.object({
  target_url: z.string(),
  target_domain: z.string().nullable(),
  anchor_text: z.string().nullable(),
  link_type: z.string(),
  position_on_page: z.number(),
  source_url: z.string(),
  source_title: z.string().nullable(),
});

// Domain lock schemas
export const DomainLockResultSchema = z.object({
  acquired: z.boolean(),
});

export const DomainReleaseResultSchema = z.object({
  released: z.boolean(),
});

export const DomainExtendResultSchema = z.object({
  extended: z.boolean(),
});

export type DomainRow = z.infer<typeof DomainRowSchema>;
export type DomainUpsertResult = z.infer<typeof DomainUpsertResultSchema>;
export type PageRow = z.infer<typeof PageRowSchema>;
export type PageUpsertResult = z.infer<typeof PageUpsertResultSchema>;
export type QueueItem = z.infer<typeof QueueItemSchema>;
export type SearchResultRow = z.infer<typeof SearchResultRowSchema>;
export type DomainDetailsRow = z.infer<typeof DomainDetailsRowSchema>;
export type IncomingLinkRow = z.infer<typeof IncomingLinkRowSchema>;
export type OutgoingLinkRow = z.infer<typeof OutgoingLinkRowSchema>;
