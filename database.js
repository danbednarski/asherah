const { Pool } = require('pg');
const genericPool = require('generic-pool');

class Database {
    constructor(config = {}) {
        this.config = {
            host: config.host || process.env.DB_HOST || 'localhost',
            port: config.port || process.env.DB_PORT || 5432,
            database: config.database || process.env.DB_NAME || 'onion_search',
            user: config.user || process.env.DB_USER || process.env.USER || 'danielbednarski',
            password: config.password || process.env.DB_PASSWORD || '',
            max: config.max || 20,
            idleTimeoutMillis: config.idleTimeoutMillis || 30000,
            connectionTimeoutMillis: config.connectionTimeoutMillis || 10000,
            // Ensure UTF-8 encoding
            charset: 'utf8',
            client_encoding: 'UTF8'
        };
        
        this.pool = new Pool(this.config);
        this.pool.on('error', (err) => {
            console.error('Database pool error:', err);
        });
    }

    async query(text, params = []) {
        const client = await this.pool.connect();
        try {
            const result = await client.query(text, params);
            return result;
        } finally {
            client.release();
        }
    }

    async transaction(callback) {
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

    async upsertDomain(domain, title = null, description = null) {
        const query = `
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
        const result = await this.query(query, [domain, title || null, description || null]);
        return result.rows[0];
    }

    async upsertPage(domainId, url, pageData) {
        const {
            title, contentText, contentHtml, statusCode, contentLength,
            contentType, language, metaDescription, h1Tags, path
        } = pageData;

        const query = `
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
        
        const result = await this.query(query, [
            domainId, url, path, title, contentText, contentHtml,
            statusCode, contentLength, contentType, language,
            metaDescription, h1Tags
        ]);
        return result.rows[0];
    }

    async insertLinks(pageId, links) {
        if (!links || links.length === 0) return;

        const values = links.map((link, index) => 
            `($1, $${index * 5 + 2}, $${index * 5 + 3}, $${index * 5 + 4}, $${index * 5 + 5}, $${index * 5 + 6})`
        ).join(',');

        const params = [pageId];
        links.forEach(link => {
            params.push(link.targetUrl, link.targetDomain, link.anchorText, link.linkType, link.position);
        });

        const query = `
            INSERT INTO links (source_page_id, target_url, target_domain, anchor_text, link_type, position_on_page)
            VALUES ${values}
            ON CONFLICT DO NOTHING
        `;

        await this.query(query, params);
    }

    async insertHeaders(pageId, headers) {
        if (!headers || Object.keys(headers).length === 0) return;

        const headerEntries = Object.entries(headers);
        const values = headerEntries.map((_, index) => 
            `($1, $${index * 2 + 2}, $${index * 2 + 3})`
        ).join(',');

        const params = [pageId];
        headerEntries.forEach(([name, value]) => {
            params.push(name.toLowerCase(), String(value));
        });

        const query = `
            INSERT INTO headers (page_id, header_name, header_value)
            VALUES ${values}
            ON CONFLICT DO NOTHING
        `;

        await this.query(query, params);
    }

    async addToCrawlQueue(urls, priority = 100) {
        if (!Array.isArray(urls)) urls = [urls];
        
        const values = urls.map((url, index) => {
            const domain = this.extractOnionDomain(url);
            const baseDomainPriority = this.isBaseDomain(url) ? priority - 50 : priority;
            return `($${index * 3 + 1}, $${index * 3 + 2}, $${index * 3 + 3})`;
        }).join(',');

        const params = [];
        urls.forEach(url => {
            const domain = this.extractOnionDomain(url);
            const baseDomainPriority = this.isBaseDomain(url) ? priority - 50 : priority;
            params.push(url, domain, baseDomainPriority);
        });

        const query = `
            INSERT INTO crawl_queue (url, domain, priority)
            VALUES ${values}
            ON CONFLICT (url) DO UPDATE SET
                priority = LEAST(crawl_queue.priority, EXCLUDED.priority),
                status = CASE 
                    WHEN crawl_queue.status = 'failed' THEN 'pending'
                    ELSE crawl_queue.status
                END
        `;

        await this.query(query, params);
    }

    async getNextUrls(workerId, limit = 10) {
        // Prioritize URLs with focus on domain discovery over subpath crawling
        const query = `
            WITH source_reliability AS (
                -- Calculate success rate for each source domain based on their provided links
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
                HAVING COUNT(DISTINCT l.target_domain) >= 3  -- Only consider sources with 3+ domain links
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
                        WHEN cq.url ~ '^https?://[a-z2-7]{56}\\.onion/?$' THEN 1  -- Root domain
                        ELSE 0  -- Sub-path
                    END as is_root_domain
                FROM crawl_queue cq
                LEFT JOIN domains d ON cq.domain = d.domain
                LEFT JOIN links l ON cq.url = l.target_url
                LEFT JOIN pages source_page ON l.source_page_id = source_page.id
                LEFT JOIN domains source_domain ON source_page.domain_id = source_domain.id
                LEFT JOIN source_reliability sr ON source_domain.domain = sr.source_domain
                WHERE cq.status = 'pending' 
                AND cq.attempts < 3  -- Reduced retry limit for faster failure recognition
                AND (cq.last_attempt IS NULL OR cq.last_attempt < NOW() - INTERVAL '1 minute' * POWER(2, LEAST(cq.attempts, 6)))  -- Exponential backoff
                AND NOT EXISTS (
                    SELECT 1 FROM domain_locks dl 
                    WHERE dl.domain = cq.domain 
                    AND dl.expires_at > NOW() 
                    AND dl.worker_id != $1
                )
                GROUP BY cq.id, cq.url, cq.domain, cq.priority, cq.attempts, d.crawl_count, d.id
                ORDER BY 
                    -- 1. Uncrawled root domains from reliable sources (best discovery potential)
                    CASE WHEN COALESCE(d.crawl_count, 0) = 0 AND 
                              CASE WHEN cq.url ~ '^https?://[a-z2-7]{56}\\.onion/?$' THEN 1 ELSE 0 END = 1 AND 
                              COALESCE(MAX(sr.domain_success_rate), 0.3) > 0.5 THEN 0
                    -- 2. Any uncrawled root domains (general discovery)
                         WHEN COALESCE(d.crawl_count, 0) = 0 AND 
                              CASE WHEN cq.url ~ '^https?://[a-z2-7]{56}\\.onion/?$' THEN 1 ELSE 0 END = 1 THEN 1
                    -- 3. Subpaths from lightly crawled but successful domains (depth exploration)
                         WHEN COALESCE(d.crawl_count, 0) > 0 AND 
                              COALESCE((SELECT COUNT(*) FROM pages p WHERE p.domain_id = d.id), 0) < 10 AND 
                              CASE WHEN cq.url ~ '^https?://[a-z2-7]{56}\\.onion/?$' THEN 1 ELSE 0 END = 0 THEN 2
                    -- 4. More subpaths from moderately crawled domains
                         WHEN COALESCE(d.crawl_count, 0) > 0 AND 
                              COALESCE((SELECT COUNT(*) FROM pages p WHERE p.domain_id = d.id), 0) < 50 AND 
                              CASE WHEN cq.url ~ '^https?://[a-z2-7]{56}\\.onion/?$' THEN 1 ELSE 0 END = 0 THEN 3
                    -- 5. Everything else (heavily crawled domains)
                         ELSE 4
                    END,
                    -- Within each tier, prioritize by source reliability
                    COALESCE(MAX(sr.domain_success_rate), 0.3) DESC,
                    -- Then by base priority
                    cq.priority ASC,
                    -- Then by fewer attempts
                    cq.attempts ASC,
                    -- Finally by age
                    cq.added_at ASC
                LIMIT $2
            ),
            available_urls AS (
                SELECT pu.id 
                FROM prioritized_urls pu
                JOIN crawl_queue cq ON pu.id = cq.id
                FOR UPDATE OF cq SKIP LOCKED
            )
            UPDATE crawl_queue 
            SET status = 'processing', worker_id = $1, last_attempt = NOW(), attempts = attempts + 1
            WHERE id IN (SELECT id FROM available_urls)
            RETURNING url, domain, priority, attempts
        `;
        
        const result = await this.query(query, [workerId, limit]);
        return result.rows;
    }

    async markUrlCompleted(url, success = true, error = null) {
        if (success) {
            const query = `
                UPDATE crawl_queue 
                SET status = 'completed', error_message = NULL, worker_id = NULL
                WHERE url = $1
            `;
            await this.query(query, [url]);
        } else {
            // Check attempts and either retry or permanently fail
            const query = `
                UPDATE crawl_queue 
                SET status = CASE 
                    WHEN attempts >= 3 THEN 'failed'
                    ELSE 'pending'
                END,
                error_message = $2::text, 
                worker_id = NULL
                WHERE url = $1
            `;
            await this.query(query, [url, error || null]);
        }
    }

    async logCrawl(url, status, statusCode = null, responseTime = null, contentLength = null, error = null, workerId = null) {
        const query = `
            INSERT INTO crawl_logs (url, status, status_code, response_time_ms, content_length, error_message, worker_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `;
        await this.query(query, [url, status, statusCode, responseTime, contentLength, error, workerId]);
    }

    extractOnionDomain(url) {
        const match = url.match(/([a-z2-7]{56}\.onion)/i);
        return match ? match[1].toLowerCase() : null;
    }

    isBaseDomain(url) {
        try {
            const urlObj = new URL(url);
            const path = urlObj.pathname;
            return path === '/' || path === '';
        } catch {
            return false;
        }
    }

    async acquireDomainLock(domain, workerId) {
        const result = await this.query('SELECT acquire_domain_lock($1, $2) as acquired', [domain, workerId]);
        return result.rows[0].acquired;
    }

    async releaseDomainLock(domain, workerId) {
        const result = await this.query('SELECT release_domain_lock($1, $2) as released', [domain, workerId]);
        return result.rows[0].released;
    }

    async extendDomainLock(domain, workerId) {
        const result = await this.query('SELECT extend_domain_lock($1, $2) as extended', [domain, workerId]);
        return result.rows[0].extended;
    }

    async updateDomainStatus(domain, status, workerId = null) {
        const query = `
            UPDATE domains 
            SET crawl_status = $2::text, last_worker_id = $3::text, crawl_started_at = CASE 
                WHEN $2::text = 'crawling' THEN NOW() 
                ELSE crawl_started_at 
            END
            WHERE domain = $1
        `;
        await this.query(query, [domain, status, workerId || null]);
    }

    async getStatistics() {
        const queries = {
            totalDomains: 'SELECT COUNT(*) as count FROM domains',
            totalPages: 'SELECT COUNT(*) as count FROM pages',
            totalLinks: 'SELECT COUNT(*) as count FROM links',
            queueSize: 'SELECT COUNT(*) as count FROM crawl_queue WHERE status = \'pending\'',
            activeCrawlers: 'SELECT COUNT(DISTINCT worker_id) as count FROM crawl_queue WHERE status = \'processing\'',
            recentCrawls: 'SELECT COUNT(*) as count FROM crawl_logs WHERE crawled_at > NOW() - INTERVAL \'1 hour\'',
            lockedDomains: 'SELECT COUNT(*) as count FROM domain_locks WHERE expires_at > NOW()'
        };

        const results = {};
        for (const [key, query] of Object.entries(queries)) {
            const result = await this.query(query);
            results[key] = parseInt(result.rows[0].count);
        }

        // Get domain status breakdown
        const domainStatusQuery = `
            SELECT crawl_status, COUNT(*) as count 
            FROM domains 
            GROUP BY crawl_status
        `;
        const statusResult = await this.query(domainStatusQuery);
        results.domainStatus = {};
        statusResult.rows.forEach(row => {
            results.domainStatus[row.crawl_status] = parseInt(row.count);
        });

        return results;
    }


    async close() {
        await this.pool.end();
    }
}

module.exports = Database;