# Database Schema Reference

This skill provides the complete database schema for the Asherah crawler.

## Tables Overview

### Crawler Tables
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `domains` | Discovered onion domains | domain, title, crawl_status |
| `pages` | Crawled page content | url, title, content_text |
| `links` | Links between pages | source_page_id, target_url |
| `headers` | HTTP response headers | page_id, header_name, header_value |
| `crawl_queue` | URL processing queue | url, priority, status |
| `crawl_logs` | Crawl attempt history | url, status, error_message |
| `domain_locks` | Concurrent access control | domain, worker_id, expires_at |

### Scanner Tables
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `scan_queue` | Port scan job queue | domain, profile, ports, priority, status |
| `port_scans` | Port scan results | domain, port, state, banner |
| `detected_services` | Identified services | domain, port, service_name, service_version |
| `scan_locks` | Scanner concurrency control | domain, worker_id, expires_at |

## Detailed Schema

### domains
```sql
CREATE TABLE domains (
    id              SERIAL PRIMARY KEY,
    domain          VARCHAR(62) UNIQUE NOT NULL,  -- 56 char + .onion
    first_seen      TIMESTAMP DEFAULT NOW(),
    last_crawled    TIMESTAMP,
    crawl_count     INTEGER DEFAULT 0,
    is_active       BOOLEAN DEFAULT true,
    title           VARCHAR(500),
    description     TEXT,
    crawl_status    VARCHAR(20) DEFAULT 'pending',  -- pending/crawling/completed/failed
    last_worker_id  VARCHAR(50),
    crawl_started_at TIMESTAMP,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);
```

### pages
```sql
CREATE TABLE pages (
    id              SERIAL PRIMARY KEY,
    domain_id       INTEGER REFERENCES domains(id) ON DELETE CASCADE,
    url             TEXT UNIQUE NOT NULL,
    path            VARCHAR(2000),
    title           VARCHAR(500),
    content_text    TEXT,           -- Up to 50,000 chars
    content_html    TEXT,           -- Only if < 100KB
    status_code     INTEGER,
    content_length  INTEGER,
    content_type    VARCHAR(100),
    language        VARCHAR(10),
    meta_description TEXT,
    h1_tags         TEXT[],         -- Array of h1 text
    last_crawled    TIMESTAMP DEFAULT NOW(),
    crawl_count     INTEGER DEFAULT 1,
    is_accessible   BOOLEAN DEFAULT true,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);
```

### links
```sql
CREATE TABLE links (
    id              SERIAL PRIMARY KEY,
    source_page_id  INTEGER REFERENCES pages(id) ON DELETE CASCADE,
    target_url      TEXT NOT NULL,
    target_domain   VARCHAR(62),
    anchor_text     TEXT,           -- First 500 chars
    link_type       VARCHAR(20),    -- internal/external/onion
    position_on_page INTEGER,
    created_at      TIMESTAMP DEFAULT NOW()
);
```

### headers
```sql
CREATE TABLE headers (
    id              SERIAL PRIMARY KEY,
    page_id         INTEGER REFERENCES pages(id) ON DELETE CASCADE,
    header_name     VARCHAR(100),
    header_value    TEXT,
    created_at      TIMESTAMP DEFAULT NOW()
);
```

### crawl_queue
```sql
CREATE TABLE crawl_queue (
    id              SERIAL PRIMARY KEY,
    url             TEXT UNIQUE NOT NULL,
    domain          VARCHAR(62) NOT NULL,
    priority        INTEGER DEFAULT 100,    -- Lower = higher priority
    added_at        TIMESTAMP DEFAULT NOW(),
    attempts        INTEGER DEFAULT 0,
    last_attempt    TIMESTAMP,
    status          VARCHAR(20) DEFAULT 'pending',  -- pending/processing/completed/failed
    error_message   TEXT,
    worker_id       VARCHAR(50),
    source_domain   VARCHAR(62)
);
```

### crawl_logs
```sql
CREATE TABLE crawl_logs (
    id              SERIAL PRIMARY KEY,
    url             TEXT NOT NULL,
    status          VARCHAR(20),    -- success/error/timeout
    status_code     INTEGER,
    response_time_ms INTEGER,
    content_length  INTEGER,
    error_message   TEXT,
    worker_id       VARCHAR(50),
    crawled_at      TIMESTAMP DEFAULT NOW()
);
```

### domain_locks
```sql
CREATE TABLE domain_locks (
    id              SERIAL PRIMARY KEY,
    domain          VARCHAR(62) UNIQUE NOT NULL,
    worker_id       VARCHAR(50) NOT NULL,
    locked_at       TIMESTAMP DEFAULT NOW(),
    expires_at      TIMESTAMP DEFAULT NOW() + INTERVAL '10 minutes',
    created_at      TIMESTAMP DEFAULT NOW()
);
```

## Indexes

```sql
-- Domains
CREATE INDEX idx_domains_domain ON domains(domain);
CREATE INDEX idx_domains_last_crawled ON domains(last_crawled);
CREATE INDEX idx_domains_crawl_status ON domains(crawl_status);

-- Pages
CREATE INDEX idx_pages_domain_id ON pages(domain_id);
CREATE INDEX idx_pages_url ON pages(url);
CREATE INDEX idx_pages_last_crawled ON pages(last_crawled);

-- Links
CREATE INDEX idx_links_source_page_id ON links(source_page_id);
CREATE INDEX idx_links_target_domain ON links(target_domain);

-- Headers
CREATE INDEX idx_headers_page_id ON headers(page_id);

-- Crawl Queue
CREATE INDEX idx_crawl_queue_priority ON crawl_queue(priority);
CREATE INDEX idx_crawl_queue_status ON crawl_queue(status);
CREATE INDEX idx_crawl_queue_domain ON crawl_queue(domain);

-- Crawl Logs
CREATE INDEX idx_crawl_logs_url ON crawl_logs(url);
CREATE INDEX idx_crawl_logs_crawled_at ON crawl_logs(crawled_at);

-- Domain Locks
CREATE INDEX idx_domain_locks_domain ON domain_locks(domain);
CREATE INDEX idx_domain_locks_expires_at ON domain_locks(expires_at);
```

## Custom Functions

### extract_onion_domain(url)
Extracts the 56-char onion domain from a URL.

### is_base_domain(url)
Returns true if URL is a root domain (no path or just `/`).

### acquire_domain_lock(domain, worker_id)
Atomically acquires a domain lock, returns success boolean.

### release_domain_lock(domain, worker_id)
Releases a domain lock owned by the worker.

### extend_domain_lock(domain, worker_id, minutes)
Extends an existing lock's expiration time.

## Scanner Tables Schema

### scan_queue
```sql
CREATE TABLE scan_queue (
    id SERIAL PRIMARY KEY,
    domain_id INTEGER REFERENCES domains(id) ON DELETE CASCADE,
    domain VARCHAR(62) NOT NULL,
    profile VARCHAR(50) DEFAULT 'standard',
    ports INTEGER[],                          -- NULL = use profile defaults
    priority INTEGER DEFAULT 100,             -- Lower = higher priority
    status VARCHAR(20) DEFAULT 'pending',     -- pending/in_progress/completed/failed
    worker_id VARCHAR(50),
    attempts INTEGER DEFAULT 0,
    last_attempt TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);
```

### port_scans
```sql
CREATE TABLE port_scans (
    id SERIAL PRIMARY KEY,
    domain_id INTEGER REFERENCES domains(id) ON DELETE CASCADE,
    domain VARCHAR(62) NOT NULL,
    port INTEGER NOT NULL,
    state VARCHAR(20) NOT NULL,               -- open/closed/filtered/timeout
    response_time_ms INTEGER,
    banner TEXT,                              -- Raw banner (max 4KB)
    scanned_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(domain, port)
);
```

### detected_services
```sql
CREATE TABLE detected_services (
    id SERIAL PRIMARY KEY,
    port_scan_id INTEGER REFERENCES port_scans(id) ON DELETE CASCADE,
    domain VARCHAR(62) NOT NULL,
    port INTEGER NOT NULL,
    service_name VARCHAR(100),                -- ssh, http, mysql, etc.
    service_version VARCHAR(100),             -- Extracted version string
    confidence INTEGER,                       -- 0-100
    raw_banner TEXT,
    first_seen TIMESTAMP DEFAULT NOW(),
    last_seen TIMESTAMP DEFAULT NOW()
);
```

### scan_locks
```sql
CREATE TABLE scan_locks (
    domain VARCHAR(62) PRIMARY KEY,
    worker_id VARCHAR(50) NOT NULL,
    locked_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '30 minutes'
);
```

## Scanner Functions

### acquire_scan_lock(domain, worker_id)
Atomically acquires a scan lock, returns success boolean.

### release_scan_lock(domain, worker_id)
Releases a scan lock owned by the worker.

### extend_scan_lock(domain, worker_id, minutes)
Extends an existing lock's expiration time.

## Common Queries

```sql
-- Find pages with specific content
SELECT url, title FROM pages
WHERE content_text ILIKE '%search_term%';

-- Get all links from a domain
SELECT l.target_url, l.anchor_text
FROM links l
JOIN pages p ON l.source_page_id = p.id
JOIN domains d ON p.domain_id = d.id
WHERE d.domain = 'example.onion';

-- Domain statistics
SELECT d.domain, COUNT(p.id) as pages, MAX(p.last_crawled) as last_activity
FROM domains d
LEFT JOIN pages p ON d.id = p.domain_id
GROUP BY d.id
ORDER BY pages DESC;

-- Queue health check
SELECT status, COUNT(*), AVG(attempts) as avg_attempts
FROM crawl_queue
GROUP BY status;

-- Scanner: Open ports by frequency
SELECT port, COUNT(*) as count
FROM port_scans WHERE state = 'open'
GROUP BY port ORDER BY count DESC;

-- Scanner: Services detected
SELECT service_name, service_version, COUNT(*) as count
FROM detected_services
GROUP BY service_name, service_version
ORDER BY count DESC;

-- Scanner: Domains with specific port open
SELECT DISTINCT domain FROM port_scans
WHERE port = 22 AND state = 'open';

-- Scanner: Vulnerable services (old PHP)
SELECT domain, port, raw_banner
FROM detected_services
WHERE raw_banner ILIKE '%PHP/5.%';

-- Scanner: Queue health
SELECT status, COUNT(*), AVG(attempts) as avg_attempts
FROM scan_queue GROUP BY status;
```
