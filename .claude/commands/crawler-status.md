# Check Crawler Status

This skill checks the current status of the Asherah Tor crawler.

## Instructions

When the user invokes this skill, perform the following checks:

1. **Database Status** - Query the PostgreSQL database for:
   - Total domains discovered
   - Total pages crawled
   - Total links found
   - Crawl queue status (pending, processing, completed, failed)
   - Currently locked domains
   - Recent crawl activity (last hour)

2. **Process Status** - Check if crawler processes are running:
   - Main orchestrator process (node index.js)
   - API server process (node api-server.js)

3. **Tor Status** - Verify Tor proxy is accessible on port 9050

4. **Log Analysis** - Check recent log entries for errors or warnings

## Database Queries

```sql
-- Overall statistics
SELECT
  (SELECT COUNT(*) FROM domains) as total_domains,
  (SELECT COUNT(*) FROM pages) as total_pages,
  (SELECT COUNT(*) FROM links) as total_links;

-- Queue status
SELECT status, COUNT(*) as count
FROM crawl_queue
GROUP BY status;

-- Locked domains
SELECT domain, worker_id, locked_at, expires_at
FROM domain_locks
WHERE expires_at > NOW();

-- Recent activity (last hour)
SELECT status, COUNT(*) as count
FROM crawl_logs
WHERE crawled_at > NOW() - INTERVAL '1 hour'
GROUP BY status;

-- Recent errors
SELECT url, error_message, crawled_at
FROM crawl_logs
WHERE status = 'error'
ORDER BY crawled_at DESC
LIMIT 5;
```

## Log Paths

- Orchestrator: `logs/orchestrator.log`
- Workers: `logs/crawler-worker-{1-10}.log`

## Expected Output

Provide a summary including:
- Total domains, pages, and links
- Queue breakdown by status
- Active workers/locks
- Any recent errors or warnings
- Overall health assessment
