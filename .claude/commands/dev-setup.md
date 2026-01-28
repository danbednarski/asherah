# Development Setup Guide

This skill helps developers set up and configure the Asherah crawler for development.

## Prerequisites

1. **Node.js 18+** - JavaScript runtime
2. **PostgreSQL 12+** - Database server
3. **Tor** - Anonymity network (daemon or browser)

## Installation Steps

### 1. Clone and Install Dependencies
```bash
cd /Users/danielbednarski/asherah
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your database credentials
```

Required environment variables:
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=onion_search
DB_USER=postgres
DB_PASSWORD=your_password
TOR_HOST=127.0.0.1
TOR_PORT=9050
```

### 3. Initialize Database
```bash
# Create database
createdb onion_search

# Apply schema
psql onion_search < schema.sql
psql onion_search < domain-locks.sql
psql onion_search < domain-reliability.sql
```

### 4. Start Tor
```bash
# Option A: Tor daemon
tor

# Option B: Tor Browser (uses port 9150 by default - update .env)
# Open Tor Browser and keep it running
```

### 5. Verify Setup
```bash
# Test database
psql onion_search -c "SELECT COUNT(*) FROM domains;"

# Test Tor
curl --socks5-hostname 127.0.0.1:9050 http://check.torproject.org
```

### 6. Start Crawler
```bash
npm start
# Or directly:
node index.js
```

### 7. Start API Server (separate terminal)
```bash
npm run api
# Or directly:
node api-server.js
```

## Development Workflow

### Running with Debug Output
```bash
LOG_LEVEL=debug node index.js
```

### Running Single Worker (for debugging)
Modify `index.js`:
```javascript
this.workerCount = 1;  // Instead of 10
```

### Testing Components Individually

**Test TorClient:**
```javascript
const TorClient = require('./torClient');
const client = new TorClient();
client.get('http://darkfailenbsdla5mal2mxn2uz66od5vtzd5qozslagrfzachha3f3id.onion/')
  .then(console.log)
  .catch(console.error);
```

**Test LinkExtractor:**
```javascript
const LinkExtractor = require('./linkExtractor');
const html = '<html><a href="http://test.onion/">Link</a></html>';
const links = LinkExtractor.extractFromHtml(html, 'http://example.onion/');
console.log(links);
```

**Test Database:**
```javascript
const Database = require('./database');
const db = new Database();
db.getStatistics().then(console.log);
```

### Watching Logs
```bash
# All workers
tail -f logs/*.log

# Specific worker
tail -f logs/crawler-worker-1.log

# Orchestrator only
tail -f logs/orchestrator.log
```

## Code Structure

```
/
├── index.js            # Entry point - OnionSearchEngine class
├── crawlerWorker.js    # CrawlerWorker class
├── database.js         # Database class
├── torClient.js        # TorClient class
├── torConfig.js        # TorConfig class
├── linkExtractor.js    # LinkExtractor static class
├── api.js              # OnionSearchAPI class
├── api-server.js       # API server launcher
├── schema.sql          # Database schema
├── domain-locks.sql    # Lock functions
├── domain-reliability.sql  # Reliability tracking
└── .env                # Environment config
```

## Making Changes

### Adding a New Database Table
1. Add CREATE TABLE to `schema.sql`
2. Add indexes if needed
3. Add methods to `database.js`
4. Re-run schema (or migrate manually)

### Modifying Crawl Logic
1. Edit `crawlerWorker.js` - `crawlUrl()` method
2. Test with single worker
3. Check log output for issues

### Adding API Endpoints
1. Edit `api.js` - add route in `setupRoutes()`
2. Restart API server
3. Test with curl or browser

### Changing Link Extraction
1. Edit `linkExtractor.js`
2. Test with sample HTML files in project root
3. Verify onion domain validation

## Troubleshooting

### "Connection refused" on Tor
- Start Tor daemon or Tor Browser
- Check port (9050 for daemon, 9150 for browser)
- Update TOR_PORT in .env

### Database connection errors
- Ensure PostgreSQL is running
- Check DB_* environment variables
- Verify database exists: `psql -l`

### Workers not processing
- Check `crawl_queue` has pending URLs
- Clear stuck domain locks
- Verify Tor is working

### High memory usage
- Reduce worker count
- Lower database connection pool
- Check for memory leaks in logs
