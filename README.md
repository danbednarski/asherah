# Onion Search Engine

A commercial-grade search engine for the Tor network, designed for journalists and researchers to discover and analyze onion services.

## Features

- **Concurrent Crawling**: 10 simultaneous workers for efficient data collection
- **Intelligent Link Extraction**: Finds and validates onion domains (56-character addresses)
- **Content Analysis**: Extracts clean text, metadata, and link relationships
- **PostgreSQL Storage**: Robust database schema for domains, pages, links, and headers
- **Priority Queue**: Base domains prioritized over paths for comprehensive coverage
- **Real-time Statistics**: Monitor crawl progress and database growth
- **Tor Integration**: DNS resolution through Tor for complete anonymity

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Orchestrator  │────│   Worker Pool    │────│   PostgreSQL    │
│                 │    │   (10 workers)   │    │    Database     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌─────────────────┐              │
         └──────────────│   Tor Proxy     │──────────────┘
                        │   (SOCKS5H)     │
                        └─────────────────┘
```

## Prerequisites

1. **PostgreSQL** (version 12+)
2. **Node.js** (version 18+) 
3. **Tor** daemon or browser running on localhost:9050

## Installation

```bash
# Clone and install dependencies
npm install

# Create database
createdb onion_search

# Copy environment configuration
cp .env.example .env
# Edit .env with your database credentials

# Initialize database schema
psql onion_search < schema.sql
```

## Usage

### Basic Crawling

```bash
npm start
```

The engine will:
1. Initialize the database schema
2. Add seed URL to crawl queue
3. Start 10 concurrent workers
4. Begin discovering and crawling onion links
5. Store all data in PostgreSQL

### Programmatic Usage

```javascript
const { OnionSearchEngine } = require('./index');

const engine = new OnionSearchEngine({
    workerCount: 10,
    database: {
        host: 'localhost',
        database: 'onion_search',
        user: 'postgres',
        password: 'your_password'
    }
});

await engine.initialize();
await engine.addSeedUrls(['http://example.onion/']);
await engine.start();

// Search functionality
const results = await engine.getSearchResults('marketplace');
```

## Database Schema

### Core Tables

- **domains**: Unique onion domains with metadata
- **pages**: Individual URLs with content and metadata
- **links**: Relationship mapping between pages
- **headers**: HTTP response headers
- **crawl_queue**: Priority queue for URLs to crawl
- **crawl_logs**: Detailed crawl history and performance

### Key Features

- Automatic domain extraction and validation
- Base domain prioritization (domain.onion/ > domain.onion/path)
- Duplicate URL handling with conflict resolution
- Performance indexes for search and analytics

## Data Collected

### Per Page
- Clean text content (HTML stripped)
- Page title and meta description
- H1 tags and language detection
- HTTP headers and status codes
- Response time and content length

### Per Link
- Source and target URLs
- Anchor text and position
- Link classification (internal/external/onion)
- Onion domain validation

### Analytics
- Crawl success/failure rates
- Domain discovery metrics
- Worker performance statistics
- Queue depth and processing speed

## Commercial Features

### Search API
```javascript
// Full-text search across all content
const results = await engine.getSearchResults('query', {
    limit: 50,
    offset: 0
});

// Domain-specific information
const domainInfo = await engine.getDomainInfo('example.onion');
```

### Data Export
```javascript
// Export crawl data and statistics
const exportData = await engine.exportData('json');
```

### Monitoring
- Real-time statistics every 30 seconds
- Worker health monitoring
- Database performance metrics
- Crawl queue depth tracking

## Configuration

### Environment Variables

- `DB_*`: PostgreSQL connection settings
- `TOR_*`: Tor proxy configuration  
- `WORKER_COUNT`: Number of concurrent crawlers
- `CRAWL_DELAY`: Delay between requests (ms)
- `LOG_LEVEL`: Logging verbosity

### Worker Options

```javascript
{
    workerCount: 10,           // Concurrent workers
    timeout: 85000,            // Request timeout (ms)
    retryAttempts: 2,          // Failed request retries
    crawlDelay: 2000,          // Delay between crawls (ms)
    maxContentSize: 2048576,   // Max page size (1MB)
    logLevel: 'info'           // Logging level
}
```

## Logging

Structured logging with Winston:
- `logs/orchestrator.log`: Main engine logs
- `logs/crawler-{worker-id}.log`: Individual worker logs
- Console output for real-time monitoring

## Security & Ethics

- DNS resolution through Tor for anonymity
- Respects robots.txt when present
- Rate limiting to avoid overloading services
- No credential storage or sensitive data logging
- Designed for defensive research and journalism

## Performance

- **Throughput**: ~50-100 pages/minute (depends on network/content)
- **Concurrency**: 10 workers with intelligent queue management
- **Storage**: Optimized PostgreSQL schema with proper indexing
- **Memory**: ~100-200MB for worker pool + database connections
- **Scalability**: Horizontal scaling via additional worker processes

## Troubleshooting

### Common Issues

1. **"Tor is not running"**: Start Tor daemon on localhost:9050
2. **Database connection errors**: Check PostgreSQL service and credentials
3. **"getaddrinfo ENOTFOUND"**: DNS not going through Tor (check socks5h://)
4. **Worker crashes**: Check logs for specific error details

### Monitoring Commands

```bash
# Check queue depth
psql onion_search -c "SELECT status, COUNT(*) FROM crawl_queue GROUP BY status;"

# View recent crawls
psql onion_search -c "SELECT url, status, crawled_at FROM crawl_logs ORDER BY crawled_at DESC LIMIT 10;"

# Worker statistics
tail -f logs/orchestrator.log
```