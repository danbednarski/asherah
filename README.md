# Asherah

A search engine and reconnaissance platform for Tor onion services, built for journalists and security researchers.

<!-- ![Screenshot](docs/screenshot.png) -->

## Features

- **Web Crawler** - Concurrent workers discover and index onion services, extracting content, metadata, and link relationships
- **Port Scanner** - TCP port scanning through Tor with service detection (HTTP, SSH, FTP, SMTP, and more)
- **Directory Scanner** - Brute-force path discovery with response classification and technology-specific profiles
- **Search API** - Full-text search with filters for titles, headers, ports, and paths, served through a web UI

## Architecture

```
                          ┌──────────────────────────────────────┐
                          │            PostgreSQL DB             │
                          └──────┬───────┬───────┬───────┬──────┘
                                 │       │       │       │
                    ┌────────────┘       │       │       └────────────┐
                    │                    │       │                    │
             ┌──────┴──────┐   ┌────────┴──┐ ┌─┴────────┐   ┌──────┴──────┐
             │   Crawler   │   │   Port    │ │    Dir    │   │  Search API │
             │ Orchestrator│   │  Scanner  │ │  Scanner  │   │  (Express)  │
             └──────┬──────┘   └─────┬────┘ └────┬──────┘   └─────────────┘
                    │                │            │
              ┌─────┴─────┐   ┌─────┴─────┐ ┌───┴───────┐
              │  Workers   │   │  Workers  │ │  Workers  │
              │  (N=10)    │   │  (N=3)    │ │  (N=3)    │
              └─────┬──────┘   └─────┬────┘ └────┬──────┘
                    │                │            │
                    └────────┬───────┘            │
                             │                    │
                      ┌──────┴──────┐             │
                      │  Tor SOCKS5 ├─────────────┘
                      │  (localhost) │
                      └─────────────┘
```

## Prerequisites

- **PostgreSQL** 12+
- **Node.js** 18+
- **Tor** daemon running on `localhost:9050`

## Installation

```bash
# Clone the repository
git clone git@github.com:danbednarski/asherah.git
cd asherah

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env
# Edit .env with your database credentials

# Create and initialize the database
createdb onion_search
psql onion_search < schema.sql
psql onion_search < schema-scanner.sql
psql onion_search < schema-dirscanner.sql
psql onion_search < domain-locks.sql
psql onion_search < domain-reliability.sql
psql onion_search < sql/combined-lock-status.sql

# Build
npm run build
```

## Configuration

All configuration is via environment variables (see `.env.example`):

| Variable | Default | Description |
|---|---|---|
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | `onion_search` | Database name |
| `DB_USER` | `postgres` | Database user |
| `DB_PASSWORD` | | Database password |
| `TOR_HOST` | `127.0.0.1` | Tor SOCKS5 proxy host |
| `TOR_PORT` | `9050` | Tor SOCKS5 proxy port |
| `WORKER_COUNT` | `10` | Number of concurrent crawler workers |
| `CRAWL_DELAY` | `2000` | Delay between requests (ms) |
| `REQUEST_TIMEOUT` | `45000` | Request timeout (ms) |
| `MAX_CONTENT_SIZE` | `1048576` | Max page size in bytes |
| `LOG_LEVEL` | `info` | Logging verbosity |

## Usage

### Run everything at once

```bash
npm start
```

### Run subsystems individually

```bash
# Web crawler
npm run start:crawler

# Port scanner
npm run start:scanner

# Directory scanner
npm run start:dirscanner

# Search API (default port 3000)
npm run start:api
```

### Development mode (tsx, no build step)

```bash
npm run crawler:dev
npm run scanner:dev
npm run dirscanner:dev
npm run api:dev
```

## Search API

The API serves a web interface at `http://localhost:3000` with the following endpoints:

| Endpoint | Description |
|---|---|
| `GET /` | Web UI with search form and results |
| `GET /search?q=...` | JSON search results |
| `GET /stats` | Crawler statistics |
| `GET /domain/:domain` | Domain detail page |

### Search query syntax

Queries support special filters that can be combined with free text:

| Filter | Example | Description |
|---|---|---|
| `title:` | `title:marketplace` | Match page titles |
| `http:` | `http:X-Powered-By` | Match HTTP response headers |
| `port:` | `port:22` | Filter by open port |
| `path:` | `path:/admin` | Filter by discovered path |

Example: `title:forum port:22` finds sites with "forum" in the title that have SSH open.

## Database Schema

The database is split across three schema files:

- **`schema.sql`** - Crawler tables: `domains`, `pages`, `links`, `headers`, `crawl_queue`, `crawl_logs`
- **`schema-scanner.sql`** - Port scanner tables: `scan_queue`, `scan_results`, `service_detections`
- **`schema-dirscanner.sql`** - Directory scanner tables: `dirscan_queue`, `dirscan_results`
- **`domain-locks.sql`** / **`domain-reliability.sql`** - Advisory locking and reliability tracking
- **`sql/combined-lock-status.sql`** - Optimized combined lock+status SQL functions

## Project Structure

```
src/
├── api/                  # Express search API and HTML templates
├── crawler/              # Web crawler worker
├── database/             # Database class, write buffer, queue manager
├── dirscanner/           # Directory scanner worker and path profiles
├── extraction/           # HTML content and link extraction
├── scanner/              # Port scanner, TCP scanner, service detection
├── schemas/              # Zod validation schemas
├── tor/                  # Tor SOCKS5 client configuration
├── types/                # TypeScript type definitions
├── utils/                # Logger, delay, domain utilities
├── index.ts              # Crawler orchestrator
├── scanner-orchestrator.ts
├── dirscanner-orchestrator.ts
└── api-server.ts         # API entry point
```

## License

MIT
