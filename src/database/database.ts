import pg from 'pg';
import type { PoolClient, QueryResult, QueryResultRow } from 'pg';
import {
  DomainUpsertResultSchema,
  PageUpsertResultSchema,
  QueueItemSchema,
  StatisticsRowSchema,
  DomainStatusRowSchema,
  DomainLockResultSchema,
  DomainReleaseResultSchema,
  DomainExtendResultSchema,
  SearchResultRowSchema,
  DomainDetailsRowSchema,
  IncomingLinkRowSchema,
  OutgoingLinkRowSchema,
  type DomainUpsertResult,
  type PageUpsertResult,
  type QueueItem,
  type SearchResultRow,
  type DomainDetailsRow,
  type IncomingLinkRow,
  type OutgoingLinkRow,
} from '../schemas/index.js';
import type { DatabaseConfig, CrawlerStatistics, PageData, ExtractedLink } from '../types/index.js';
import { extractOnionDomain, isBaseDomain } from '../utils/domain.js';

const { Pool } = pg;

export class Database {
  private readonly pool: pg.Pool;

  constructor(config: Partial<DatabaseConfig> = {}) {
    const poolConfig = {
      host: config.host ?? process.env['DB_HOST'] ?? 'localhost',
      port: config.port ?? parseInt(process.env['DB_PORT'] ?? '5432', 10),
      database: config.database ?? process.env['DB_NAME'] ?? 'onion_search',
      user: config.user ?? process.env['DB_USER'] ?? process.env['USER'] ?? 'postgres',
      password: config.password ?? process.env['DB_PASSWORD'] ?? '',
      max: config.max ?? 20,
      idleTimeoutMillis: config.idleTimeoutMillis ?? 30000,
      connectionTimeoutMillis: config.connectionTimeoutMillis ?? 10000,
    };

    this.pool = new Pool(poolConfig);
    this.pool.on('error', (err) => {
      console.error('Database pool error:', err);
    });
  }

  async query<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []): Promise<QueryResult<T>> {
    const client = await this.pool.connect();
    try {
      return await client.query<T>(text, params);
    } finally {
      client.release();
    }
  }

  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async upsertDomain(
    domain: string,
    title: string | null = null,
    description: string | null = null
  ): Promise<DomainUpsertResult> {
    const queryText = `
      INSERT INTO domains (domain, title, description, last_crawled)
      VALUES ($1, $2::text, $3::text, NOW())
      ON CONFLICT (domain)
      DO UPDATE SET
        title = COALESCE($2::text, domains.title),
        description = COALESCE($3::text, domains.description),
        last_crawled = NOW(),
        crawl_count = domains.crawl_count + 1,
        updated_at = NOW()
      RETURNING id, domain, crawl_count
    `;
    const result = await this.query(queryText, [domain, title, description]);
    const row = result.rows[0];
    if (!row) {
      throw new Error('No row returned from upsertDomain');
    }
    return DomainUpsertResultSchema.parse(row);
  }

  async upsertPage(domainId: number, url: string, pageData: PageData): Promise<PageUpsertResult> {
    const {
      title,
      contentText,
      contentHtml,
      statusCode,
      contentLength,
      contentType,
      language,
      metaDescription,
      h1Tags,
      path,
    } = pageData;

    const queryText = `
      INSERT INTO pages (
        domain_id, url, path, title, content_text, content_html,
        status_code, content_length, content_type, language,
        meta_description, h1_tags, last_crawled, crawl_count
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), 1)
      ON CONFLICT (url)
      DO UPDATE SET
        title = $4,
        content_text = $5,
        content_html = $6,
        status_code = $7,
        content_length = $8,
        content_type = $9,
        language = $10,
        meta_description = $11,
        h1_tags = $12,
        last_crawled = NOW(),
        crawl_count = pages.crawl_count + 1,
        is_accessible = true,
        updated_at = NOW()
      RETURNING id
    `;

    const result = await this.query(queryText, [
      domainId,
      url,
      path,
      title,
      contentText,
      contentHtml,
      statusCode,
      contentLength,
      contentType,
      language,
      metaDescription,
      h1Tags,
    ]);
    const row = result.rows[0];
    if (!row) {
      throw new Error('No row returned from upsertPage');
    }
    return PageUpsertResultSchema.parse(row);
  }

  async insertLinks(pageId: number, links: ExtractedLink[]): Promise<void> {
    if (!links || links.length === 0) return;

    const values = links
      .map(
        (_, index) =>
          `($1, $${index * 5 + 2}, $${index * 5 + 3}, $${index * 5 + 4}, $${index * 5 + 5}, $${index * 5 + 6})`
      )
      .join(',');

    const params: unknown[] = [pageId];
    for (const link of links) {
      params.push(link.targetUrl, link.targetDomain, link.anchorText, link.linkType, link.position);
    }

    const queryText = `
      INSERT INTO links (source_page_id, target_url, target_domain, anchor_text, link_type, position_on_page)
      VALUES ${values}
      ON CONFLICT DO NOTHING
    `;

    await this.query(queryText, params);
  }

  async insertHeaders(pageId: number, headers: Record<string, string>): Promise<void> {
    if (!headers || Object.keys(headers).length === 0) return;

    const headerEntries = Object.entries(headers);
    const values = headerEntries.map((_, index) => `($1, $${index * 2 + 2}, $${index * 2 + 3})`).join(',');

    const params: unknown[] = [pageId];
    for (const [name, value] of headerEntries) {
      params.push(name.toLowerCase(), String(value));
    }

    const queryText = `
      INSERT INTO headers (page_id, header_name, header_value)
      VALUES ${values}
      ON CONFLICT DO NOTHING
    `;

    await this.query(queryText, params);
  }

  async addToCrawlQueue(urls: string | string[], priority = 100): Promise<void> {
    const urlArray = Array.isArray(urls) ? urls : [urls];

    const values = urlArray
      .map((_, index) => `($${index * 3 + 1}, $${index * 3 + 2}, $${index * 3 + 3})`)
      .join(',');

    const params: unknown[] = [];
    for (const url of urlArray) {
      const domain = extractOnionDomain(url);
      const baseDomainPriority = isBaseDomain(url) ? priority - 50 : priority;
      params.push(url, domain, baseDomainPriority);
    }

    const queryText = `
      INSERT INTO crawl_queue (url, domain, priority)
      VALUES ${values}
      ON CONFLICT (url) DO UPDATE SET
        priority = LEAST(crawl_queue.priority, EXCLUDED.priority),
        status = CASE
          WHEN crawl_queue.status = 'failed' THEN 'pending'
          ELSE crawl_queue.status
        END
    `;

    await this.query(queryText, params);
  }

  async getNextUrls(workerId: string, limit = 10): Promise<QueueItem[]> {
    const queryText = `
      WITH source_reliability AS (
        SELECT
          sd.domain as source_domain,
          COUNT(DISTINCT l.target_domain) as domains_linked,
          COUNT(DISTINCT td.domain) FILTER (WHERE td.crawl_count > 0) as successful_domains,
          COALESCE(
            COUNT(DISTINCT td.domain) FILTER (WHERE td.crawl_count > 0)::float /
            NULLIF(COUNT(DISTINCT l.target_domain), 0),
            0.3
          ) as domain_success_rate
        FROM domains sd
        JOIN pages sp ON sd.id = sp.domain_id
        JOIN links l ON sp.id = l.source_page_id AND l.target_domain IS NOT NULL
        LEFT JOIN domains td ON l.target_domain = td.domain
        GROUP BY sd.domain
        HAVING COUNT(DISTINCT l.target_domain) >= 3
      ),
      domain_activity AS (
        -- Track when we last attempted any URL for each domain
        SELECT
          domain,
          MAX(last_attempt) as last_domain_attempt,
          COUNT(*) FILTER (WHERE status = 'pending') as pending_urls
        FROM crawl_queue
        GROUP BY domain
      ),
      prioritized_urls AS (
        SELECT
          cq.id,
          cq.url,
          cq.domain,
          cq.priority,
          cq.attempts,
          COALESCE(d.crawl_count, 0) as domain_crawl_count,
          COALESCE(
            (SELECT COUNT(*) FROM pages p WHERE p.domain_id = d.id),
            0
          ) as domain_pages_count,
          COALESCE(MAX(sr.domain_success_rate), 0.3) as best_source_reliability,
          CASE
            WHEN cq.url ~ '^https?://[a-z2-7]{56}\\.onion/?$' THEN 1
            ELSE 0
          END as is_root_domain,
          -- How long since we last attempted any URL for this domain (in minutes)
          COALESCE(
            EXTRACT(EPOCH FROM (NOW() - da.last_domain_attempt)) / 60,
            9999
          ) as minutes_since_domain_activity,
          -- Penalize domains with many pending URLs (they may be spam/dead)
          COALESCE(da.pending_urls, 0) as domain_pending_urls
        FROM crawl_queue cq
        LEFT JOIN domains d ON cq.domain = d.domain
        LEFT JOIN domain_activity da ON cq.domain = da.domain
        LEFT JOIN links l ON cq.url = l.target_url
        LEFT JOIN pages source_page ON l.source_page_id = source_page.id
        LEFT JOIN domains source_domain ON source_page.domain_id = source_domain.id
        LEFT JOIN source_reliability sr ON source_domain.domain = sr.source_domain
        WHERE cq.status = 'pending'
        AND cq.attempts < 3
        AND (cq.last_attempt IS NULL OR cq.last_attempt < NOW() - INTERVAL '1 minute' * POWER(2, LEAST(cq.attempts, 6)))
        AND NOT EXISTS (
          SELECT 1 FROM domain_locks dl
          WHERE dl.domain = cq.domain
          AND dl.expires_at > NOW()
          AND dl.worker_id != $1
        )
        -- Skip domains marked as failed/inactive
        AND (d.is_active IS NULL OR d.is_active = true)
        AND (d.crawl_status IS NULL OR d.crawl_status != 'failed')
        GROUP BY cq.id, cq.url, cq.domain, cq.priority, cq.attempts, d.crawl_count, d.id, da.last_domain_attempt, da.pending_urls
        ORDER BY
          -- First priority tier: New domains vs explored domains vs domains with many pending URLs
          CASE
               -- New domains from reliable sources (root URL, never crawled)
               WHEN COALESCE(d.crawl_count, 0) = 0 AND
                    CASE WHEN cq.url ~ '^https?://[a-z2-7]{56}\\.onion/?$' THEN 1 ELSE 0 END = 1 AND
                    COALESCE(MAX(sr.domain_success_rate), 0.3) > 0.5 THEN 0
               -- New domains (root URL)
               WHEN COALESCE(d.crawl_count, 0) = 0 AND
                    CASE WHEN cq.url ~ '^https?://[a-z2-7]{56}\\.onion/?$' THEN 1 ELSE 0 END = 1 THEN 1
               -- Domains we haven't touched in a while (>30 min) - prefer breadth
               WHEN COALESCE(EXTRACT(EPOCH FROM (NOW() - da.last_domain_attempt)) / 60, 9999) > 30 THEN 2
               -- Subpaths of known working domains (few pages crawled)
               WHEN COALESCE(d.crawl_count, 0) > 0 AND
                    COALESCE((SELECT COUNT(*) FROM pages p WHERE p.domain_id = d.id), 0) < 10 AND
                    CASE WHEN cq.url ~ '^https?://[a-z2-7]{56}\\.onion/?$' THEN 1 ELSE 0 END = 0 THEN 3
               -- More subpaths of known domains
               WHEN COALESCE(d.crawl_count, 0) > 0 AND
                    COALESCE((SELECT COUNT(*) FROM pages p WHERE p.domain_id = d.id), 0) < 50 AND
                    CASE WHEN cq.url ~ '^https?://[a-z2-7]{56}\\.onion/?$' THEN 1 ELSE 0 END = 0 THEN 4
               -- Deprioritize domains with tons of pending URLs (likely spam or huge sites)
               WHEN COALESCE(da.pending_urls, 0) > 100 THEN 6
               ELSE 5
          END,
          -- Within same tier, prefer domains not recently accessed (spread the load)
          COALESCE(EXTRACT(EPOCH FROM (NOW() - da.last_domain_attempt)) / 60, 9999) DESC,
          -- Then by source reliability
          COALESCE(MAX(sr.domain_success_rate), 0.3) DESC,
          cq.priority ASC,
          cq.attempts ASC,
          cq.added_at ASC
        LIMIT $2
      ),
      top_candidates AS (
        -- Get top 50 candidates, then randomly pick from them to reduce contention
        SELECT * FROM prioritized_urls LIMIT 50
      ),
      randomized AS (
        SELECT id FROM top_candidates ORDER BY RANDOM() LIMIT $2
      ),
      available_urls AS (
        SELECT r.id
        FROM randomized r
        JOIN crawl_queue cq ON r.id = cq.id
        FOR UPDATE OF cq SKIP LOCKED
      )
      UPDATE crawl_queue
      SET status = 'processing', worker_id = $1, last_attempt = NOW(), attempts = attempts + 1
      WHERE id IN (SELECT id FROM available_urls)
      RETURNING url, domain, priority, attempts
    `;

    const result = await this.query(queryText, [workerId, limit]);
    return result.rows.map((row) => QueueItemSchema.parse(row));
  }

  async markUrlCompleted(url: string, success = true, error: string | null = null): Promise<void> {
    if (success) {
      const queryText = `
        UPDATE crawl_queue
        SET status = 'completed', error_message = NULL, worker_id = NULL
        WHERE url = $1
      `;
      await this.query(queryText, [url]);
    } else {
      const queryText = `
        UPDATE crawl_queue
        SET status = CASE
          WHEN attempts >= 3 THEN 'failed'
          ELSE 'pending'
        END,
        error_message = $2::text,
        worker_id = NULL
        WHERE url = $1
      `;
      await this.query(queryText, [url, error]);
    }
  }

  async markDomainConnectionFailed(domain: string, error: string): Promise<number> {
    // Mark all pending URLs for this domain as failed when we can't connect to the domain at all
    const queryText = `
      UPDATE crawl_queue
      SET status = 'failed',
          error_message = $2::text,
          worker_id = NULL
      WHERE domain = $1
      AND status IN ('pending', 'processing')
      RETURNING url
    `;
    const result = await this.query(queryText, [domain, `Domain unreachable: ${error}`]);

    // Also mark the domain as failed in the domains table
    await this.query(
      `UPDATE domains SET crawl_status = 'failed', is_active = false WHERE domain = $1`,
      [domain]
    );

    return result.rowCount ?? 0;
  }

  async logCrawl(
    url: string,
    status: 'success' | 'error',
    statusCode: number | null = null,
    responseTime: number | null = null,
    contentLength: number | null = null,
    error: string | null = null,
    workerId: string | null = null
  ): Promise<void> {
    const queryText = `
      INSERT INTO crawl_logs (url, status, status_code, response_time_ms, content_length, error_message, worker_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;
    await this.query(queryText, [url, status, statusCode, responseTime, contentLength, error, workerId]);
  }

  async acquireDomainLock(domain: string, workerId: string): Promise<boolean> {
    const result = await this.query('SELECT acquire_domain_lock($1, $2) as acquired', [domain, workerId]);
    const row = result.rows[0];
    if (!row) {
      return false;
    }
    return DomainLockResultSchema.parse(row).acquired;
  }

  async releaseDomainLock(domain: string, workerId: string): Promise<boolean> {
    const result = await this.query('SELECT release_domain_lock($1, $2) as released', [domain, workerId]);
    const row = result.rows[0];
    if (!row) {
      return false;
    }
    return DomainReleaseResultSchema.parse(row).released;
  }

  async extendDomainLock(domain: string, workerId: string): Promise<boolean> {
    const result = await this.query('SELECT extend_domain_lock($1, $2) as extended', [domain, workerId]);
    const row = result.rows[0];
    if (!row) {
      return false;
    }
    return DomainExtendResultSchema.parse(row).extended;
  }

  async acquireDomainLockAndSetCrawling(domain: string, workerId: string): Promise<boolean> {
    const result = await this.query(
      'SELECT acquire_domain_lock_and_set_crawling($1, $2) as acquired',
      [domain, workerId]
    );
    const row = result.rows[0];
    if (!row) {
      return false;
    }
    return DomainLockResultSchema.parse(row).acquired;
  }

  async releaseDomainLockAndSetCompleted(domain: string, workerId: string): Promise<boolean> {
    const result = await this.query(
      'SELECT release_domain_lock_and_set_completed($1, $2) as released',
      [domain, workerId]
    );
    const row = result.rows[0];
    if (!row) {
      return false;
    }
    return DomainReleaseResultSchema.parse(row).released;
  }

  async claimUrl(url: string, workerId: string): Promise<void> {
    await this.query(
      "UPDATE crawl_queue SET worker_id = $2, status = 'processing', last_attempt = NOW(), attempts = attempts + 1 WHERE url = $1 AND status = 'pending'",
      [url, workerId]
    );
  }

  async updateDomainStatus(domain: string, status: string, workerId: string | null = null): Promise<void> {
    const queryText = `
      UPDATE domains
      SET crawl_status = $2::text, last_worker_id = $3::text, crawl_started_at = CASE
        WHEN $2::text = 'crawling' THEN NOW()
        ELSE crawl_started_at
      END
      WHERE domain = $1
    `;
    await this.query(queryText, [domain, status, workerId]);
  }

  async getStatistics(): Promise<CrawlerStatistics> {
    const queries = {
      totalDomains: 'SELECT COUNT(*) as count FROM domains',
      totalPages: 'SELECT COUNT(*) as count FROM pages',
      totalLinks: 'SELECT COUNT(*) as count FROM links',
      queueSize: "SELECT COUNT(*) as count FROM crawl_queue WHERE status = 'pending'",
      activeCrawlers: "SELECT COUNT(DISTINCT worker_id) as count FROM crawl_queue WHERE status = 'processing'",
      recentCrawls: "SELECT COUNT(*) as count FROM crawl_logs WHERE crawled_at > NOW() - INTERVAL '1 hour'",
      lockedDomains: 'SELECT COUNT(*) as count FROM domain_locks WHERE expires_at > NOW()',
    };

    const results: Record<string, number> = {};
    for (const [key, queryText] of Object.entries(queries)) {
      const result = await this.query(queryText);
      const row = result.rows[0];
      if (row) {
        results[key] = StatisticsRowSchema.parse(row).count;
      } else {
        results[key] = 0;
      }
    }

    const domainStatusQuery = `
      SELECT crawl_status, COUNT(*) as count
      FROM domains
      GROUP BY crawl_status
    `;
    const statusResult = await this.query(domainStatusQuery);
    const domainStatus: Record<string, number> = {};
    for (const row of statusResult.rows) {
      const parsed = DomainStatusRowSchema.parse(row);
      const statusKey = parsed.crawl_status ?? 'unknown';
      domainStatus[statusKey] = parsed.count;
    }

    return {
      totalDomains: results['totalDomains'] ?? 0,
      totalPages: results['totalPages'] ?? 0,
      totalLinks: results['totalLinks'] ?? 0,
      queueSize: results['queueSize'] ?? 0,
      activeCrawlers: results['activeCrawlers'] ?? 0,
      recentCrawls: results['recentCrawls'] ?? 0,
      lockedDomains: results['lockedDomains'] ?? 0,
      domainStatus,
    };
  }

  async searchCombined(
    textQuery: string | null = null,
    headerName: string | null = null,
    headerValue: string | null = null,
    titleQuery: string | null = null,
    limit = 50,
    offset = 0,
    port: number | null = null,
    path: string | null = null
  ): Promise<SearchResultRow[]> {
    let textCondition = '';
    let headerCondition = '';
    let titleCondition = '';
    let portCondition = '';
    let pathCondition = '';
    const params: unknown[] = [];
    let paramIndex = 1;

    if (textQuery) {
      textCondition = `
        AND (
          p.title ILIKE $${paramIndex}
          OR p.content_text ILIKE $${paramIndex}
          OR p.meta_description ILIKE $${paramIndex}
        )
      `;
      params.push(`%${textQuery}%`);
      paramIndex++;
    }

    if (titleQuery) {
      titleCondition = `
        AND p.title ILIKE $${paramIndex}
      `;
      params.push(`%${titleQuery}%`);
      paramIndex++;
    }

    if (headerName || headerValue) {
      let headerWhere = '';
      if (headerName && headerValue) {
        // Specific header:value search (e.g., http:"Server: Apache")
        headerWhere += `h.header_name ILIKE $${paramIndex}`;
        params.push(`%${headerName}%`);
        paramIndex++;
        headerWhere += ` AND h.header_value ILIKE $${paramIndex}`;
        params.push(`%${headerValue}%`);
        paramIndex++;
      } else if (headerName) {
        // No colon — search both names and values (e.g., http:"Win32")
        headerWhere += `(h.header_name ILIKE $${paramIndex} OR h.header_value ILIKE $${paramIndex})`;
        params.push(`%${headerName}%`);
        paramIndex++;
      } else if (headerValue) {
        headerWhere += `h.header_value ILIKE $${paramIndex}`;
        params.push(`%${headerValue}%`);
        paramIndex++;
      }

      headerCondition = `
        AND EXISTS (
          SELECT 1 FROM headers h
          WHERE h.page_id = p.id AND ${headerWhere}
        )
      `;
    }

    if (port !== null) {
      portCondition = `
        AND EXISTS (
          SELECT 1 FROM port_scans ps
          WHERE ps.domain = d.domain AND ps.port = $${paramIndex} AND ps.state = 'open'
        )
      `;
      params.push(port);
      paramIndex++;
    }

    if (path !== null) {
      pathCondition = `
        AND EXISTS (
          SELECT 1 FROM dirscan_results dr
          WHERE dr.domain = d.domain AND dr.path ILIKE $${paramIndex} AND dr.is_interesting = true
        )
      `;
      params.push(`%${path}%`);
      paramIndex++;
    }

    const limitParam = paramIndex;
    const offsetParam = paramIndex + 1;
    params.push(limit, offset);

    const searchQuery = `
      SELECT
        p.url,
        p.title,
        p.content_text,
        p.meta_description,
        d.domain,
        p.last_crawled,
        p.status_code,
        p.content_length,
        (
          SELECT json_agg(
            json_build_object('name', h.header_name, 'value', h.header_value)
          )
          FROM headers h
          WHERE h.page_id = p.id
        ) as headers
      FROM pages p
      JOIN domains d ON p.domain_id = d.id
      WHERE p.is_accessible = true
      ${textCondition}
      ${titleCondition}
      ${headerCondition}
      ${portCondition}
      ${pathCondition}
      GROUP BY p.id, p.url, p.title, p.content_text, p.meta_description, d.domain, p.last_crawled, p.status_code, p.content_length
      ORDER BY p.last_crawled DESC
      LIMIT $${limitParam} OFFSET $${offsetParam}
    `;

    const result = await this.query(searchQuery, params);
    return result.rows.map((row) => SearchResultRowSchema.parse(row));
  }

  async getDomainDetails(domain: string): Promise<DomainDetailsRow | null> {
    const queryText = `
      SELECT
        d.id,
        d.domain,
        d.title,
        d.description,
        d.first_seen,
        d.last_crawled,
        d.crawl_count,
        d.is_active,
        (
          SELECT json_build_object(
            'url', p.url,
            'title', p.title,
            'content_text', SUBSTRING(p.content_text, 1, 1000),
            'full_content_length', LENGTH(p.content_text),
            'status_code', p.status_code,
            'content_type', p.content_type,
            'last_crawled', p.last_crawled
          )
          FROM pages p
          WHERE p.domain_id = d.id AND p.is_accessible = true
          ORDER BY p.last_crawled DESC
          LIMIT 1
        ) as latest_page,
        (
          SELECT json_agg(
            json_build_object('name', h.header_name, 'value', h.header_value)
          )
          FROM headers h
          WHERE h.page_id = (
            SELECT p.id
            FROM pages p
            WHERE p.domain_id = d.id AND p.is_accessible = true
            ORDER BY p.last_crawled DESC
            LIMIT 1
          )
        ) as headers,
        (SELECT COUNT(*) FROM pages WHERE domain_id = d.id AND is_accessible = true) as total_pages,
        (SELECT COUNT(*) FROM links l JOIN pages p ON l.source_page_id = p.id WHERE p.domain_id = d.id) as outgoing_links_count,
        (SELECT COUNT(*) FROM links WHERE target_domain = d.domain) as incoming_links_count
      FROM domains d
      WHERE d.domain = $1
    `;

    const result = await this.query(queryText, [domain]);
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return DomainDetailsRowSchema.parse(row);
  }

  async getIncomingLinks(domain: string, limit = 10, offset = 0): Promise<IncomingLinkRow[]> {
    const queryText = `
      SELECT
        l.anchor_text,
        l.link_type,
        p.url as source_url,
        p.title as source_title,
        d.domain as source_domain,
        p.last_crawled
      FROM links l
      JOIN pages p ON l.source_page_id = p.id
      JOIN domains d ON p.domain_id = d.id
      WHERE l.target_domain = $1
      ORDER BY p.last_crawled DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await this.query(queryText, [domain, limit, offset]);
    return result.rows.map((row) => IncomingLinkRowSchema.parse(row));
  }

  async getOutgoingLinks(domain: string, limit = 10, offset = 0): Promise<OutgoingLinkRow[]> {
    const queryText = `
      SELECT
        l.target_url,
        l.target_domain,
        l.anchor_text,
        l.link_type,
        l.position_on_page,
        p.url as source_url,
        p.title as source_title
      FROM links l
      JOIN pages p ON l.source_page_id = p.id
      JOIN domains d ON p.domain_id = d.id
      WHERE d.domain = $1
      ORDER BY l.position_on_page ASC, l.id DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await this.query(queryText, [domain, limit, offset]);
    return result.rows.map((row) => OutgoingLinkRowSchema.parse(row));
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async clearAllLocks(): Promise<{ domain: number; scan: number; dirscan: number }> {
    const results = { domain: 0, scan: 0, dirscan: 0 };

    const domainResult = await this.query('DELETE FROM domain_locks');
    results.domain = domainResult.rowCount ?? 0;

    const scanResult = await this.query('DELETE FROM scan_locks');
    results.scan = scanResult.rowCount ?? 0;

    try {
      const dirscanResult = await this.query('DELETE FROM dirscan_locks');
      results.dirscan = dirscanResult.rowCount ?? 0;
    } catch {
      // Table may not exist yet
    }

    return results;
  }

  // ==================== Scanner Methods ====================

  async getNextScans(workerId: string, limit = 1): Promise<Array<{
    id: number;
    domainId: number | null;
    domain: string;
    profile: 'quick' | 'standard' | 'full' | 'crypto';
    ports: number[] | null;
    priority: number;
    attempts: number;
  }>> {
    const queryText = `
      WITH available_scans AS (
        SELECT sq.id
        FROM scan_queue sq
        WHERE sq.status = 'pending'
        AND sq.attempts < 3
        AND (sq.last_attempt IS NULL OR sq.last_attempt < NOW() - INTERVAL '5 minutes' * POWER(2, LEAST(sq.attempts, 4)))
        AND NOT EXISTS (
          SELECT 1 FROM scan_locks sl
          WHERE sl.domain = sq.domain
          AND sl.expires_at > NOW()
          AND sl.worker_id != $1
        )
        ORDER BY sq.priority ASC, sq.created_at ASC
        LIMIT $2
        FOR UPDATE OF sq SKIP LOCKED
      )
      UPDATE scan_queue
      SET status = 'processing', worker_id = $1, last_attempt = NOW(), attempts = attempts + 1
      WHERE id IN (SELECT id FROM available_scans)
      RETURNING id, domain_id, domain, profile, ports, priority, attempts
    `;

    const result = await this.query(queryText, [workerId, limit]);
    return result.rows.map((row) => ({
      id: row.id as number,
      domainId: row.domain_id as number | null,
      domain: row.domain as string,
      profile: row.profile as 'quick' | 'standard' | 'full' | 'crypto',
      ports: row.ports as number[] | null,
      priority: row.priority as number,
      attempts: row.attempts as number,
    }));
  }

  async returnScanToQueue(scanId: number): Promise<void> {
    const queryText = `
      UPDATE scan_queue
      SET status = 'pending', worker_id = NULL
      WHERE id = $1
    `;
    await this.query(queryText, [scanId]);
  }

  async markScanCompleted(scanId: number): Promise<void> {
    const queryText = `
      UPDATE scan_queue
      SET status = 'completed', worker_id = NULL
      WHERE id = $1
    `;
    await this.query(queryText, [scanId]);
  }

  async markScanFailed(scanId: number, error: string): Promise<void> {
    const queryText = `
      UPDATE scan_queue
      SET status = CASE
        WHEN attempts >= 3 THEN 'failed'
        ELSE 'pending'
      END,
      error_message = $2::text,
      worker_id = NULL
      WHERE id = $1
    `;
    await this.query(queryText, [scanId, error]);
  }

  async acquireScanLock(domain: string, workerId: string): Promise<boolean> {
    const result = await this.query('SELECT acquire_scan_lock($1, $2) as acquired', [domain, workerId]);
    const row = result.rows[0];
    return row?.acquired === true;
  }

  async releaseScanLock(domain: string, workerId: string): Promise<boolean> {
    const result = await this.query('SELECT release_scan_lock($1, $2) as released', [domain, workerId]);
    const row = result.rows[0];
    return row?.released === true;
  }

  async insertPortScan(
    domainId: number,
    domain: string,
    port: number,
    state: string,
    responseTimeMs: number,
    banner: string | null
  ): Promise<number> {
    const queryText = `
      INSERT INTO port_scans (domain_id, domain, port, state, response_time_ms, banner, scanned_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (domain, port)
      DO UPDATE SET
        state = $4,
        response_time_ms = $5,
        banner = COALESCE($6, port_scans.banner),
        scanned_at = NOW()
      RETURNING id
    `;
    const result = await this.query(queryText, [domainId, domain, port, state, responseTimeMs, banner]);
    const row = result.rows[0];
    if (!row) {
      throw new Error('No row returned from insertPortScan');
    }
    return row.id as number;
  }

  async getPortScanId(domain: string, port: number): Promise<number | null> {
    const queryText = `SELECT id FROM port_scans WHERE domain = $1 AND port = $2`;
    const result = await this.query(queryText, [domain, port]);
    const row = result.rows[0];
    return row ? (row.id as number) : null;
  }

  async insertDetectedService(
    portScanId: number,
    domain: string,
    port: number,
    serviceName: string,
    serviceVersion: string | null,
    confidence: number,
    rawBanner: string | null
  ): Promise<void> {
    const queryText = `
      INSERT INTO detected_services (port_scan_id, domain, port, service_name, service_version, confidence, raw_banner, first_seen, last_seen)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      ON CONFLICT DO NOTHING
    `;
    await this.query(queryText, [portScanId, domain, port, serviceName, serviceVersion, confidence, rawBanner]);
  }

  async addToScanQueue(
    domain: string,
    profile: string = 'standard',
    ports: number[] | null = null,
    priority: number = 100
  ): Promise<void> {
    // Try to get domain_id if domain exists
    const domainResult = await this.query('SELECT id FROM domains WHERE domain = $1', [domain]);
    const domainId = domainResult.rows[0]?.id ?? null;

    const queryText = `
      INSERT INTO scan_queue (domain_id, domain, profile, ports, priority)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (domain) DO UPDATE SET
        priority = LEAST(scan_queue.priority, EXCLUDED.priority),
        profile = EXCLUDED.profile,
        ports = COALESCE(EXCLUDED.ports, scan_queue.ports),
        status = CASE
          WHEN scan_queue.status = 'failed' THEN 'pending'
          ELSE scan_queue.status
        END
    `;
    await this.query(queryText, [domainId, domain, profile, ports, priority]);
  }

  async getScannerStatistics(): Promise<{
    totalScans: number;
    activeWorkers: number;
    queueSize: number;
    openPorts: number;
    servicesDetected: number;
    recentScans: number;
  }> {
    const queries = {
      totalScans: "SELECT COUNT(*) as count FROM scan_queue WHERE status = 'completed'",
      activeWorkers: "SELECT COUNT(DISTINCT worker_id) as count FROM scan_queue WHERE status = 'processing'",
      queueSize: "SELECT COUNT(*) as count FROM scan_queue WHERE status = 'pending'",
      openPorts: "SELECT COUNT(*) as count FROM port_scans WHERE state = 'open'",
      servicesDetected: 'SELECT COUNT(*) as count FROM detected_services',
      recentScans: "SELECT COUNT(*) as count FROM port_scans WHERE scanned_at > NOW() - INTERVAL '1 hour'",
    };

    const results: Record<string, number> = {};
    for (const [key, queryText] of Object.entries(queries)) {
      try {
        const result = await this.query(queryText);
        const row = result.rows[0];
        results[key] = row?.count ? parseInt(row.count, 10) : 0;
      } catch {
        results[key] = 0;
      }
    }

    return {
      totalScans: results['totalScans'] ?? 0,
      activeWorkers: results['activeWorkers'] ?? 0,
      queueSize: results['queueSize'] ?? 0,
      openPorts: results['openPorts'] ?? 0,
      servicesDetected: results['servicesDetected'] ?? 0,
      recentScans: results['recentScans'] ?? 0,
    };
  }

  async getPortScanResults(domain: string): Promise<Array<{
    port: number;
    state: string;
    responseTimeMs: number | null;
    banner: string | null;
    scannedAt: Date;
    serviceName: string | null;
    serviceVersion: string | null;
  }>> {
    const queryText = `
      SELECT
        ps.port,
        ps.state,
        ps.response_time_ms,
        ps.banner,
        ps.scanned_at,
        ds.service_name,
        ds.service_version
      FROM port_scans ps
      LEFT JOIN detected_services ds ON ps.id = ds.port_scan_id
      WHERE ps.domain = $1
      ORDER BY ps.port ASC
    `;
    const result = await this.query(queryText, [domain]);
    return result.rows.map((row) => ({
      port: row.port as number,
      state: row.state as string,
      responseTimeMs: row.response_time_ms as number | null,
      banner: row.banner as string | null,
      scannedAt: new Date(row.scanned_at as string),
      serviceName: row.service_name as string | null,
      serviceVersion: row.service_version as string | null,
    }));
  }

  async populateScanQueueFromDomains(
    limit: number = 1000,
    profile: string = 'standard'
  ): Promise<number> {
    // Add active domains that haven't been scanned yet to the scan queue
    // Prioritize by recency of successful HTTP responses
    const queryText = `
      INSERT INTO scan_queue (domain_id, domain, profile, priority, status)
      SELECT
        d.id,
        d.domain,
        $2,
        CASE
          -- Crawled in last 24 hours with success
          WHEN EXISTS (
            SELECT 1 FROM pages p WHERE p.domain_id = d.id
            AND p.status_code >= 200 AND p.status_code < 400
            AND p.last_crawled > NOW() - INTERVAL '1 day'
          ) THEN 10
          -- Crawled in last week with success
          WHEN EXISTS (
            SELECT 1 FROM pages p WHERE p.domain_id = d.id
            AND p.status_code >= 200 AND p.status_code < 400
            AND p.last_crawled > NOW() - INTERVAL '7 days'
          ) THEN 30
          -- Crawled in last month with success
          WHEN EXISTS (
            SELECT 1 FROM pages p WHERE p.domain_id = d.id
            AND p.status_code >= 200 AND p.status_code < 400
            AND p.last_crawled > NOW() - INTERVAL '30 days'
          ) THEN 50
          -- Older successful crawl
          WHEN EXISTS (
            SELECT 1 FROM pages p WHERE p.domain_id = d.id
            AND p.status_code >= 200 AND p.status_code < 400
          ) THEN 100
          -- No successful crawl
          ELSE 200
        END as priority,
        'pending'
      FROM domains d
      WHERE d.is_active = true
      AND NOT EXISTS (
        SELECT 1 FROM scan_queue sq WHERE sq.domain = d.domain
      )
      ORDER BY d.last_crawled DESC NULLS LAST
      LIMIT $1
      ON CONFLICT (domain) DO NOTHING
    `;
    const result = await this.query(queryText, [limit, profile]);
    return result.rowCount ?? 0;
  }

  async queueDomainForScan(domain: string, priority: number = 100): Promise<void> {
    // Quick insert - used when crawler discovers new domains
    const queryText = `
      INSERT INTO scan_queue (domain, profile, priority, status)
      VALUES ($1, 'standard', $2, 'pending')
      ON CONFLICT (domain) DO NOTHING
    `;
    await this.query(queryText, [domain, priority]);
  }

  // ==================== Dir Scanner Methods ====================

  async getNextDirScans(workerId: string, limit = 1): Promise<Array<{
    id: number;
    domainId: number | null;
    domain: string;
    profile: 'quick' | 'standard' | 'full';
    priority: number;
    attempts: number;
  }>> {
    const queryText = `
      WITH available_scans AS (
        SELECT dq.id
        FROM dirscan_queue dq
        WHERE dq.status = 'pending'
        AND dq.attempts < 3
        AND (dq.last_attempt IS NULL OR dq.last_attempt < NOW() - INTERVAL '5 minutes' * POWER(2, LEAST(dq.attempts, 4)))
        AND NOT EXISTS (
          SELECT 1 FROM dirscan_locks dl
          WHERE dl.domain = dq.domain
          AND dl.expires_at > NOW()
          AND dl.worker_id != $1
        )
        ORDER BY dq.priority ASC, dq.created_at ASC
        LIMIT $2
        FOR UPDATE OF dq SKIP LOCKED
      )
      UPDATE dirscan_queue
      SET status = 'processing', worker_id = $1, last_attempt = NOW(), attempts = attempts + 1
      WHERE id IN (SELECT id FROM available_scans)
      RETURNING id, domain_id, domain, profile, priority, attempts
    `;

    const result = await this.query(queryText, [workerId, limit]);
    return result.rows.map((row) => ({
      id: row.id as number,
      domainId: row.domain_id as number | null,
      domain: row.domain as string,
      profile: row.profile as 'quick' | 'standard' | 'full',
      priority: row.priority as number,
      attempts: row.attempts as number,
    }));
  }

  async returnDirscanToQueue(scanId: number): Promise<void> {
    const queryText = `
      UPDATE dirscan_queue
      SET status = 'pending', worker_id = NULL
      WHERE id = $1
    `;
    await this.query(queryText, [scanId]);
  }

  async markDirscanCompleted(scanId: number): Promise<void> {
    const queryText = `
      UPDATE dirscan_queue
      SET status = 'completed', worker_id = NULL
      WHERE id = $1
    `;
    await this.query(queryText, [scanId]);
  }

  async markDirscanFailed(scanId: number, error: string): Promise<void> {
    const queryText = `
      UPDATE dirscan_queue
      SET status = CASE
        WHEN attempts >= 3 THEN 'failed'
        ELSE 'pending'
      END,
      error_message = $2::text,
      worker_id = NULL
      WHERE id = $1
    `;
    await this.query(queryText, [scanId, error]);
  }

  async acquireDirscanLock(domain: string, workerId: string): Promise<boolean> {
    const result = await this.query('SELECT acquire_dirscan_lock($1, $2) as acquired', [domain, workerId]);
    const row = result.rows[0];
    return row?.acquired === true;
  }

  async releaseDirscanLock(domain: string, workerId: string): Promise<boolean> {
    const result = await this.query('SELECT release_dirscan_lock($1, $2) as released', [domain, workerId]);
    const row = result.rows[0];
    return row?.released === true;
  }

  async extendDirscanLock(domain: string, workerId: string): Promise<boolean> {
    const result = await this.query('SELECT extend_dirscan_lock($1, $2) as extended', [domain, workerId]);
    const row = result.rows[0];
    return row?.extended === true;
  }

  async insertDirscanResult(
    domainId: number,
    domain: string,
    result: {
      path: string;
      statusCode: number;
      contentLength: number | null;
      contentType: string | null;
      responseTimeMs: number;
      serverHeader: string | null;
      redirectUrl: string | null;
      bodySnippet: string | null;
      isInteresting: boolean;
      interestReason: string | null;
    }
  ): Promise<number> {
    const queryText = `
      INSERT INTO dirscan_results (
        domain_id, domain, path, status_code, content_length,
        content_type, response_time_ms, server_header, redirect_url,
        body_snippet, is_interesting, interest_reason, scanned_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
      ON CONFLICT (domain, path)
      DO UPDATE SET
        status_code = $4,
        content_length = $5,
        content_type = $6,
        response_time_ms = $7,
        server_header = $8,
        redirect_url = $9,
        body_snippet = COALESCE($10, dirscan_results.body_snippet),
        is_interesting = $11,
        interest_reason = $12,
        scanned_at = NOW()
      RETURNING id
    `;
    const dbResult = await this.query(queryText, [
      domainId,
      domain,
      result.path,
      result.statusCode,
      result.contentLength,
      result.contentType,
      result.responseTimeMs,
      result.serverHeader,
      result.redirectUrl,
      result.bodySnippet,
      result.isInteresting,
      result.interestReason,
    ]);
    const row = dbResult.rows[0];
    if (!row) {
      throw new Error('No row returned from insertDirscanResult');
    }
    return row.id as number;
  }

  async populateDirscanQueueFromDomains(
    limit: number = 1000,
    profile: string = 'standard'
  ): Promise<number> {
    // Only queue domains that have confirmed HTTP access:
    // - Open port 80 or 443 in port_scans
    // - OR successful page crawls (status 200-399)
    const queryText = `
      INSERT INTO dirscan_queue (domain_id, domain, profile, priority, status)
      SELECT
        d.id,
        d.domain,
        $2,
        CASE
          WHEN EXISTS (
            SELECT 1 FROM pages p WHERE p.domain_id = d.id
            AND p.status_code >= 200 AND p.status_code < 400
            AND p.last_crawled > NOW() - INTERVAL '1 day'
          ) THEN 10
          WHEN EXISTS (
            SELECT 1 FROM pages p WHERE p.domain_id = d.id
            AND p.status_code >= 200 AND p.status_code < 400
            AND p.last_crawled > NOW() - INTERVAL '7 days'
          ) THEN 30
          WHEN EXISTS (
            SELECT 1 FROM port_scans ps WHERE ps.domain = d.domain
            AND ps.port IN (80, 443) AND ps.state = 'open'
          ) THEN 40
          WHEN EXISTS (
            SELECT 1 FROM pages p WHERE p.domain_id = d.id
            AND p.status_code >= 200 AND p.status_code < 400
          ) THEN 50
          ELSE 200
        END as priority,
        'pending'
      FROM domains d
      WHERE d.is_active = true
      AND (
        EXISTS (
          SELECT 1 FROM port_scans ps WHERE ps.domain = d.domain
          AND ps.port IN (80, 443) AND ps.state = 'open'
        )
        OR EXISTS (
          SELECT 1 FROM pages p WHERE p.domain_id = d.id
          AND p.status_code >= 200 AND p.status_code < 400
        )
      )
      AND NOT EXISTS (
        SELECT 1 FROM dirscan_queue dq WHERE dq.domain = d.domain
      )
      AND NOT EXISTS (
        SELECT 1 FROM dirscan_results dr WHERE dr.domain = d.domain
      )
      ORDER BY d.last_crawled DESC NULLS LAST
      LIMIT $1
      ON CONFLICT (domain) DO NOTHING
    `;
    const result = await this.query(queryText, [limit, profile]);
    return result.rowCount ?? 0;
  }

  async getDirscannerStatistics(): Promise<{
    totalScans: number;
    activeWorkers: number;
    queueSize: number;
    interestingFindings: number;
    recentScans: number;
  }> {
    const queries = {
      totalScans: "SELECT COUNT(*) as count FROM dirscan_queue WHERE status = 'completed'",
      activeWorkers: "SELECT COUNT(DISTINCT worker_id) as count FROM dirscan_queue WHERE status = 'processing'",
      queueSize: "SELECT COUNT(*) as count FROM dirscan_queue WHERE status = 'pending'",
      interestingFindings: 'SELECT COUNT(*) as count FROM dirscan_results WHERE is_interesting = true',
      recentScans: "SELECT COUNT(DISTINCT domain) as count FROM dirscan_results WHERE scanned_at > NOW() - INTERVAL '1 hour'",
    };

    const results: Record<string, number> = {};
    for (const [key, queryText] of Object.entries(queries)) {
      try {
        const result = await this.query(queryText);
        const row = result.rows[0];
        results[key] = row?.count ? parseInt(row.count, 10) : 0;
      } catch {
        results[key] = 0;
      }
    }

    return {
      totalScans: results['totalScans'] ?? 0,
      activeWorkers: results['activeWorkers'] ?? 0,
      queueSize: results['queueSize'] ?? 0,
      interestingFindings: results['interestingFindings'] ?? 0,
      recentScans: results['recentScans'] ?? 0,
    };
  }
}
