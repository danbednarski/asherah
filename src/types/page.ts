export interface Page {
  id: number;
  domain_id: number;
  url: string;
  path: string;
  title: string | null;
  content_text: string | null;
  content_html: string | null;
  status_code: number | null;
  content_length: number | null;
  content_type: string | null;
  language: string | null;
  meta_description: string | null;
  h1_tags: string[] | null;
  last_crawled: Date;
  crawl_count: number;
  is_accessible: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface PageUpsertResult {
  id: number;
}

export interface PageData {
  title: string | null;
  contentText: string | null;
  contentHtml: string | null;
  statusCode: number | null;
  contentLength: number;
  contentType: string | null;
  language: string | null;
  metaDescription: string | null;
  h1Tags: string[];
  path: string;
}

export interface PageMetadata {
  title: string;
  metaDescription: string;
  language: string;
  h1Tags: string[];
  contentText: string;
  path: string;
}

export interface SearchResult {
  url: string;
  title: string | null;
  content_text: string | null;
  meta_description: string | null;
  domain: string;
  last_crawled: Date;
  status_code: number | null;
  content_length: number | null;
  headers: Array<{ name: string; value: string }> | null;
}
