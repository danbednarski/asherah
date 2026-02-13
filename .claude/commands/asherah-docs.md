# Asherah Tor Crawler Documentation

This skill provides comprehensive documentation for the Asherah Tor web crawler project.

## Project Overview

**Asherah** is a commercial-grade search engine for the Tor network, designed for journalists and researchers to discover and analyze onion services.

- **Entry Point:** `src/index.ts` (main orchestrator)
- **API Server:** `src/api/server.ts`
- **Language:** TypeScript (compiled to `dist/`)
- **License:** MIT
- **Node Version:** 18+

## Architecture

```
┌─────────────────────────────────────────────────┐
│           OnionSearchEngine (index.ts)          │
│              Main Orchestrator                   │
└──────────────┬──────────────────────────────────┘
               │
        ┌──────┴──────────────────────────┐
        ▼                                 ▼
┌──────────────────┐          ┌──────────────────┐
│   Worker Pool    │◄────────►│   PostgreSQL     │
│   (10 workers)   │          │                  │
│                  │          │  - domains       │
│  CrawlerWorker   │          │  - pages         │
│  instances       │          │  - links         │
└────────┬─────────┘          │  - headers       │
         │                    │  - crawl_queue   │
         ▼                    │  - crawl_logs    │
┌──────────────────┐          │  - domain_locks  │
│   Tor Network    │          └──────────────────┘
│  (SOCKS5H:9050)  │                  ▲
└──────────────────┘                  │
                                      │
┌─────────────────────────────────────┴───────────┐
│         ScannerOrchestrator (scanner-orchestrator.ts)
│              Port Scanner                        │
└──────────────┬──────────────────────────────────┘
               │
        ┌──────┴──────────────────────────┐
        ▼                                 ▼
┌──────────────────┐          ┌──────────────────┐
│ PortScanWorkers  │          │  Scanner Tables  │
│   (3 workers)    │          │  - scan_queue    │
│                  │          │  - port_scans    │
│  TorPortScanner  │          │  - detected_     │
│  ServiceDetector │          │    services      │
└────────┬─────────┘          │  - scan_locks    │
         │                    └──────────────────┘
         ▼
┌──────────────────┐
│   Tor Network    │
│   (SOCKS5:9050)  │
│   Raw TCP/IP     │
└──────────────────┘
```

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Main orchestrator - initializes DB, spawns workers, reports stats |
| `src/crawler/worker.ts` | Individual worker - fetches URLs, extracts content, stores data |
| `src/database/database.ts` | PostgreSQL connection pool and all data operations |
| `src/tor/client.ts` | HTTP client through SOCKS5H Tor proxy with streaming support |
| `src/tor/config.ts` | Tor proxy configuration and validation |
| `src/extraction/linkExtractor.ts` | HTML parsing, link extraction, metadata extraction |
| `src/api/server.ts` | Express REST API and web search interface |
| `src/types/*.ts` | TypeScript type definitions |
| `src/schemas/*.ts` | Zod validation schemas |
| `schema.sql` | Main database schema |
| `domain-locks.sql` | Domain locking mechanism |
| `domain-reliability.sql` | Domain reliability tracking |
| `schema-scanner.sql` | Port scanner database schema |
| `src/scanner/tcp-scanner.ts` | SOCKS5 TCP port scanning |
| `src/scanner/worker.ts` | Port scan worker class |
| `src/scanner/service-detector.ts` | Banner analysis and service ID |
| `src/scanner/port-profiles.ts` | Port sets (quick/standard/full/crypto) |
| `src/scanner-orchestrator.ts` | Scanner main orchestrator |

## Core Components

### OnionSearchEngine (index.js)
Central orchestrator that:
- Initializes database schema
- Spawns and manages worker pool
- Reports statistics every 2 minutes
- Handles graceful shutdown (SIGINT)
- Provides search interface

### CrawlerWorker (crawlerWorker.js)
Individual crawler that:
- Acquires domain locks for exclusive crawling
- Fetches URLs through TorClient
- Extracts content via LinkExtractor
- Stores data in database transactions
- Processes batches of 3 URLs per cycle

### Database (database.js)
PostgreSQL layer with:
- Connection pooling (max 20 connections)
- Domain/page/link upserts
- Crawl queue management
- Domain locking functions
- Statistics aggregation

### TorClient (src/tor/client.ts)
HTTP client that:
- Routes all requests through SOCKS5H proxy
- Handles DNS through Tor (no leaks)
- Implements retry with exponential backoff
- Spoofs Firefox 91.0 User-Agent
- **Streaming truncation**: When `maxContentLength` is specified, uses streaming to download only up to the limit instead of failing. This allows crawling large pages by getting partial content rather than erroring out. The response includes a `truncated: true` flag when content was cut off.
- **HTTP error handling**: Returns response body and headers even for 4xx/5xx responses (not just 2xx). This allows saving error page content and extracting any links from them.

### LinkExtractor (linkExtractor.js)
HTML parser that:
- Extracts all links using Cheerio
- Validates onion domains (56-char base32)
- Extracts page metadata (title, description, h1s)
- Classifies links (internal/external/onion)

## Database Schema

### Main Tables
- **domains** - Onion domains discovered (62-char addresses)
- **pages** - Crawled page content and metadata
- **links** - Links between pages with anchor text
- **headers** - HTTP response headers
- **crawl_queue** - URL queue with priority
- **crawl_logs** - Crawl attempt history
- **domain_locks** - Concurrent access control

### Key Indexes
- `domains.domain` - Domain lookups
- `pages.url` - Page lookups
- `crawl_queue.priority, status` - Queue prioritization
- `domain_locks.domain, expires_at` - Lock management

## Configuration

### Environment Variables (.env)
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=onion_search
DB_USER=postgres
DB_PASSWORD=your_password
TOR_HOST=127.0.0.1
TOR_PORT=9050
WORKER_COUNT=10
CRAWL_DELAY=2000
REQUEST_TIMEOUT=45000
```

### Runtime Defaults
- Workers: 10 concurrent
- Batch size: 3 URLs/worker
- Crawl delay: 2000ms between batches
- HTTP timeout: 45 seconds
- Retry attempts: 2 (total 3)
- Domain lock: 10 minutes
- Content limit: 1MB/page (truncates gracefully, doesn't fail)
- Text limit: 50KB extracted

## URL Processing Pipeline

1. **Selection** - `getNextUrls()` retrieves pending URLs by priority
2. **Locking** - Worker acquires exclusive domain lock (10 min)
3. **Fetching** - TorClient makes HTTP GET through SOCKS5H
4. **Parsing** - LinkExtractor processes HTML response
5. **Storage** - Database transaction stores all data
6. **Discovery** - New onion URLs added to queue
7. **Release** - Domain lock released

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Web interface with search |
| `/stats` | GET | JSON statistics |
| `/domain/:domain` | GET | Domain details with links |
| `/search?q=` | GET | Search redirect |

### Search Syntax
- Standard text: `bitcoin`
- Title search: `title:"marketplace"`
- Header search: `http:"Server: nginx"`
- Port filter: `port:22` (only domains with port 22 open)
- Combined: `bitcoin title:"marketplace" port:80`

## Running the Crawler

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Start Tor (must be running on port 9050)
tor  # or use Tor Browser

# Initialize database (PostgreSQL must be running)
psql -c "CREATE DATABASE onion_search;"
psql onion_search < schema.sql
psql onion_search < domain-locks.sql
psql onion_search < domain-reliability.sql

# Start crawler
npm start  # or: node dist/index.js

# Start API server (separate terminal)
npm run api  # or: node dist/api/server.js

# Development mode (auto-rebuild)
npm run dev
```

## Logs

- **Orchestrator:** `logs/orchestrator.log`
- **Workers:** `logs/crawler-worker-{1-10}.log`

## Monitoring Commands

```bash
# Queue status
psql onion_search -c "SELECT status, COUNT(*) FROM crawl_queue GROUP BY status;"

# Recent crawls
psql onion_search -c "SELECT url, status FROM crawl_logs ORDER BY crawled_at DESC LIMIT 10;"

# Live worker output
tail -f logs/orchestrator.log

# Database size
psql onion_search -c "SELECT pg_size_pretty(pg_database_size('onion_search'));"
```

## Dependencies

- **axios** - HTTP client
- **cheerio** - HTML parsing
- **cors** - CORS middleware
- **express** - Web framework
- **generic-pool** - Connection pooling
- **pg** - PostgreSQL client
- **socks-proxy-agent** - SOCKS5H proxy
- **winston** - Logging
- **zod** - Runtime type validation
- **typescript** - TypeScript compiler (dev)

## Security Features

- SOCKS5H proxy (DNS through Tor - no leaks)
- Firefox User-Agent spoofing
- Rate limiting (2s delay + random jitter)
- Domain locking (prevents concurrent crawling)
- Parameterized SQL (no injection)
- HTML escaping in API responses
- Content size limits

## Onion Domain Validation

Valid V3 onion addresses:
- 56 lowercase characters from `[a-z2-7]`
- Followed by `.onion`
- Total length: 62 characters
- Regex: `/([a-z2-7]{56}\.onion)/gi`

## Graceful Shutdown

On SIGINT:
1. Stop accepting new URLs
2. Complete in-flight crawls
3. Release all domain locks
4. Close worker processes
5. Drain database pool
6. Exit cleanly

## Port Scanner

The port scanner provides Shodan-like service discovery for onion domains.

### Running the Scanner

```bash
# Development mode
npm run scanner:dev

# Production
npm run build && npm run scanner

# With environment variables
SCANNER_WORKERS=5 TOR_HOST=127.0.0.1 TOR_PORT=9050 npm run scanner
```

### Scanner Architecture

1. **ScannerOrchestrator** - Spawns workers, populates queue, reports stats
2. **PortScanWorker** - Processes scan queue, acquires domain locks
3. **TorPortScanner** - Raw TCP through SOCKS5 (not HTTP)
4. **ServiceDetector** - Banner analysis and service identification

### Scan Profiles

| Profile | Ports | Use Case |
|---------|-------|----------|
| quick | 5 | Fast discovery |
| standard | 25+ | General purpose (default) |
| full | 100+ | Security assessment |
| crypto | 30+ | Cryptocurrency nodes |

### Auto-Queue Integration

- Crawler auto-queues new domains for port scanning
- Scanner prioritizes recently-crawled domains (more likely to be online)
- Priority: 10 (24h) → 30 (week) → 50 (month) → 100 (older) → 200 (never crawled)

### Service Detection

Detects: SSH, HTTP, nginx, Apache, MySQL, PostgreSQL, Redis, MongoDB, FTP, SMTP, IRC, Bitcoin, Ethereum, Monero, VNC, Telnet, IMAP, POP3, Tor Control, SOCKS

### Scanner Monitoring

```bash
# Queue status
psql onion_search -c "SELECT status, COUNT(*) FROM scan_queue GROUP BY status;"

# Open ports found
psql onion_search -c "SELECT port, COUNT(*) FROM port_scans WHERE state='open' GROUP BY port ORDER BY count DESC;"

# Detected services
psql onion_search -c "SELECT service_name, COUNT(*) FROM detected_services GROUP BY service_name ORDER BY count DESC;"

# Live output
tail -f logs/scanner-orchestrator.log
```

### Vulnerability Analysis

Query for potentially vulnerable services:

```sql
-- Old PHP versions
SELECT domain, raw_banner FROM detected_services
WHERE raw_banner ILIKE '%PHP/5.%' OR raw_banner ILIKE '%PHP/7.0%';

-- Old OpenSSL (Heartbleed)
SELECT domain, raw_banner FROM detected_services
WHERE raw_banner ILIKE '%OpenSSL/1.0.1%';

-- Old SSH
SELECT domain, service_version FROM detected_services
WHERE service_name = 'ssh' AND service_version LIKE 'OpenSSH_5%';
```
