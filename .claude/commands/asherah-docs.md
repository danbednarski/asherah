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
│           OnionSearchEngine (index.js)          │
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
│  (SOCKS5H:9050)  │
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
- Combined: `bitcoin title:"marketplace"`

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
