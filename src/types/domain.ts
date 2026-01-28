export type CrawlStatus = 'pending' | 'crawling' | 'completed' | 'failed';

export interface Domain {
  id: number;
  domain: string;
  title: string | null;
  description: string | null;
  first_seen: Date;
  last_crawled: Date | null;
  crawl_count: number;
  crawl_status: CrawlStatus;
  crawl_started_at: Date | null;
  last_worker_id: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface DomainUpsertResult {
  id: number;
  domain: string;
  crawl_count: number;
}

export interface DomainDetails extends Domain {
  latest_page: LatestPageInfo | null;
  headers: HeaderInfo[] | null;
  total_pages: number;
  outgoing_links_count: number;
  incoming_links_count: number;
}

export interface LatestPageInfo {
  url: string;
  title: string | null;
  content_text: string | null;
  full_content_length: number;
  status_code: number | null;
  content_type: string | null;
  last_crawled: Date;
}

export interface HeaderInfo {
  name: string;
  value: string;
}
