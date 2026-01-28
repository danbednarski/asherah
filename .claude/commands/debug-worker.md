# Debug Crawler Worker

This skill helps diagnose issues with individual crawler workers.

## Worker Architecture

Each `CrawlerWorker` instance:
- Has a unique worker ID (`worker-1` through `worker-10`)
- Maintains its own database connection
- Processes batches of 3 URLs per cycle
- Logs to `logs/crawler-worker-{N}.log`

## Common Issues

### 1. Worker Not Processing URLs

**Symptoms:** Worker shows no activity in logs

**Check:**
```sql
-- Are there pending URLs?
SELECT COUNT(*) FROM crawl_queue WHERE status = 'pending';

-- Are all domains locked?
SELECT COUNT(*) FROM domain_locks WHERE expires_at > NOW();

-- Check specific worker's activity
SELECT * FROM crawl_logs
WHERE worker_id = 'worker-1'
ORDER BY crawled_at DESC LIMIT 10;
```

**Solutions:**
- Ensure URLs exist in queue
- Clear expired domain locks
- Check Tor connectivity

### 2. Tor Connection Failures

**Symptoms:** All requests timing out or connection refused

**Check:**
```bash
# Test Tor proxy
curl --socks5-hostname 127.0.0.1:9050 http://check.torproject.org

# Verify Tor is running
pgrep -l tor
```

**Solutions:**
- Start Tor daemon or Tor Browser
- Check Tor port (default 9050)
- Verify no firewall blocking

### 3. Database Connection Errors

**Symptoms:** "Connection refused" or pool exhausted errors

**Check:**
```bash
# Test PostgreSQL
psql onion_search -c "SELECT 1;"

# Check connections
psql -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'onion_search';"
```

**Solutions:**
- Ensure PostgreSQL is running
- Check connection pool settings (max 20)
- Verify .env credentials

### 4. Domain Lock Starvation

**Symptoms:** Workers idle despite pending URLs

**Check:**
```sql
-- Show all active locks
SELECT * FROM domain_locks WHERE expires_at > NOW();

-- Find domains with pending URLs but locked
SELECT DISTINCT cq.domain
FROM crawl_queue cq
JOIN domain_locks dl ON cq.domain = dl.domain
WHERE cq.status = 'pending' AND dl.expires_at > NOW();
```

**Solutions:**
- Wait for locks to expire (10 min max)
- Manually release stuck locks:
```sql
DELETE FROM domain_locks WHERE expires_at < NOW();
```

### 5. High Failure Rate

**Symptoms:** Many URLs failing repeatedly

**Check:**
```sql
-- Failure rate by domain
SELECT domain,
       COUNT(*) FILTER (WHERE status = 'error') as failures,
       COUNT(*) FILTER (WHERE status = 'success') as successes
FROM crawl_logs
WHERE crawled_at > NOW() - INTERVAL '1 hour'
GROUP BY domain
ORDER BY failures DESC
LIMIT 10;

-- Common error messages
SELECT error_message, COUNT(*)
FROM crawl_logs
WHERE status = 'error'
GROUP BY error_message
ORDER BY COUNT(*) DESC
LIMIT 5;
```

**Solutions:**
- Increase timeout for slow sites
- Check if Tor circuit is degraded
- Some onion services are simply offline

### 6. Understanding HTTP Error Responses

**Note:** The crawler now saves content from 4xx/5xx responses (not just 2xx). This is by design.

**Console output meanings:**
- `✅ SUCCESS! (200)` - Normal successful crawl
- `⚠️ HTTP 404 (saved content anyway)` - Got error page, but still saved content and extracted links
- `❌ FAILED: ECONNREFUSED` - Network-level failure, no content to save

**Check HTTP status distribution:**
```sql
SELECT status_code, COUNT(*)
FROM pages
GROUP BY status_code
ORDER BY COUNT(*) DESC;
```

### 7. Content Truncation

Large pages (>1MB) are truncated instead of failing. Look for `(truncated)` in logs:
```
📊 Content: 1048576 chars (truncated)
```

This is normal behavior - we get partial content rather than nothing.

## Key Files for Debugging

| File | Contains |
|------|----------|
| `src/crawler/worker.ts:crawlUrl()` | Main crawl logic |
| `src/tor/client.ts:makeRequest()` | HTTP request with retries and streaming |
| `src/database/database.ts:getNextUrls()` | URL selection query |
| `src/database/database.ts:acquireDomainLock()` | Lock acquisition |

## Useful Log Patterns

```bash
# Find all errors for a worker
grep "ERROR" logs/crawler-worker-1.log | tail -20

# Find lock acquisition issues
grep "Lock" logs/crawler-worker-1.log | tail -20

# Find timeout errors
grep -i "timeout" logs/crawler-worker-*.log | tail -20

# Success rate check
grep -c "SUCCESS" logs/crawler-worker-1.log
grep -c "FAILED" logs/crawler-worker-1.log
```
