# Add Seed URLs

This skill helps add new seed URLs to the Asherah crawler queue.

## Instructions

When adding seed URLs to the crawler:

1. **Validate URLs** - Ensure each URL:
   - Contains a valid V3 onion domain (56 chars from `[a-z2-7]` + `.onion`)
   - Uses `http://` protocol (not https, as most onion services don't use TLS)
   - Is properly formatted

2. **Add to Queue** - Insert into `crawl_queue` table with:
   - `priority = 1` (highest priority for seeds)
   - `status = 'pending'`
   - `attempts = 0`

## SQL Template

```sql
INSERT INTO crawl_queue (url, domain, priority, status)
VALUES
  ('http://example56chardomainhere.onion/', 'example56chardomainhere.onion', 1, 'pending')
ON CONFLICT (url) DO UPDATE SET
  priority = LEAST(crawl_queue.priority, 1),
  status = CASE WHEN crawl_queue.status = 'failed' THEN 'pending' ELSE crawl_queue.status END;
```

## Validation Regex

```javascript
// Valid onion domain pattern
/^[a-z2-7]{56}\.onion$/

// Valid onion URL pattern
/^http:\/\/[a-z2-7]{56}\.onion(\/.*)?$/
```

## Common Seed Sources

Popular directory sites for onion discovery:
- DarkFail (directory of verified onion sites)
- TorTaxi (onion link aggregator)
- Ahmia (clearnet search engine for onion sites)

## Notes

- Seeds are given priority 1 (highest)
- Root domains are prioritized over subpaths
- Failed URLs can be re-queued by setting status back to 'pending'
- The crawler automatically discovers new URLs from crawled pages
