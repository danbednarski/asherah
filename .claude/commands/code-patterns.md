# Code Patterns & Conventions

This skill documents the coding patterns and conventions used in the Asherah codebase.

**Note:** The codebase uses TypeScript. Source files are in `src/`, compiled output in `dist/`.

## Architecture Patterns

### Class-Based Components
All major components are TypeScript classes:
- `CrawlerWorker` - Individual crawler instance (`src/crawler/worker.ts`)
- `Database` - Data access layer (`src/database/database.ts`)
- `TorClient` - HTTP client (`src/tor/client.ts`)
- `TorConfig` - Tor proxy configuration (`src/tor/config.ts`)
- `LinkExtractor` - HTML parsing and link extraction (`src/extraction/linkExtractor.ts`)

### Dependency Injection
Workers receive dependencies through constructor:
```javascript
class CrawlerWorker {
    constructor(workerId, database, options = {}) {
        this.workerId = workerId;
        this.database = database;
        this.torClient = new TorClient(options);
        // ...
    }
}
```

### Winston Logging
Each component creates its own logger:
```javascript
this.logger = winston.createLogger({
    level: options.logLevel || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) =>
            `${timestamp} ${level.toUpperCase()} [Worker-${this.workerId}] ${message}`
        )
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({
            filename: `logs/crawler-worker-${this.workerId}.log`,
            maxsize: 10485760,  // 10MB
            maxFiles: 5
        })
    ]
});
```

## Database Patterns

### Connection Pooling
Uses `pg` Pool with configuration:
```javascript
this.pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'onion_search',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    max: 20,                    // Max connections
    idleTimeoutMillis: 30000,   // 30 seconds
    connectionTimeoutMillis: 10000
});
```

### Parameterized Queries
All queries use parameterized statements to prevent SQL injection:
```javascript
async upsertDomain(domain, title, description) {
    const result = await this.query(`
        INSERT INTO domains (domain, title, description)
        VALUES ($1, $2, $3)
        ON CONFLICT (domain) DO UPDATE SET
            title = COALESCE(EXCLUDED.title, domains.title),
            description = COALESCE(EXCLUDED.description, domains.description),
            updated_at = NOW()
        RETURNING id
    `, [domain, title, description]);
    return result.rows[0].id;
}
```

### Transactions
Multi-step operations use transactions:
```javascript
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
```

### Upsert Pattern
Uses ON CONFLICT for idempotent inserts:
```javascript
INSERT INTO table (columns)
VALUES ($1, $2)
ON CONFLICT (unique_column) DO UPDATE SET
    column = EXCLUDED.column,
    updated_at = NOW()
RETURNING id
```

## Error Handling

### Try-Catch with Logging
```javascript
async crawlUrl(url) {
    try {
        const response = await this.torClient.get(url);
        // Process response
        return { success: true, data };
    } catch (error) {
        this.logger.error(`Failed to crawl ${url}: ${error.message}`);
        return { success: false, error: error.message };
    }
}
```

### Graceful Degradation
Non-critical failures don't stop processing:
```javascript
// Link extraction failure doesn't abort page storage
let links = [];
try {
    links = LinkExtractor.extractFromHtml(html, url);
} catch (e) {
    this.logger.warn(`Link extraction failed: ${e.message}`);
}
// Continue with page storage even if links failed
```

### Retry with Backoff
```typescript
async makeRequest(url: string, options: AxiosRequestConfig = {}): Promise<TorResult> {
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
        try {
            const response = await axios(config);
            return { success: true, status: response.status, data, headers };
        } catch (error) {
            lastError = error;
            if (attempt < this.retryAttempts) {
                await delay(this.retryDelay * attempt);
            }
        }
    }
    return { success: false, error: lastError?.message };
}
```

### Streaming with Size Limits
For large content, use streaming to download partial content instead of failing:
```typescript
private async readStreamWithLimit(stream: Readable, maxBytes: number): Promise<{ data: string; truncated: boolean }> {
    const chunks: Buffer[] = [];
    let totalBytes = 0;

    stream.on('data', (chunk: Buffer) => {
        if (totalBytes >= maxBytes) {
            stream.destroy();  // Stop reading
            return;
        }
        chunks.push(chunk.subarray(0, maxBytes - totalBytes));
        totalBytes += chunk.length;
    });
    // Returns partial content with truncated flag
}
```

### Accept All HTTP Status Codes
Use `validateStatus: () => true` to capture 4xx/5xx response bodies:
```typescript
const config: AxiosRequestConfig = {
    // ... other config
    validateStatus: () => true,  // Don't throw on 4xx/5xx
};
// Now we can save error page content and extract links from 404 pages
```

## Async Patterns

### Async/Await Throughout
All async operations use async/await:
```javascript
async start() {
    this.isRunning = true;
    while (this.isRunning) {
        await this.crawlBatch();
        await this.delay(this.crawlDelay);
    }
}
```

### Parallel Processing
Workers run independently:
```javascript
async start() {
    for (let i = 1; i <= this.workerCount; i++) {
        const worker = new CrawlerWorker(`worker-${i}`, this.database, this.options);
        this.workers.push(worker);
        worker.start();  // Non-blocking - runs in background
    }
}
```

### Graceful Shutdown
```javascript
async stop() {
    this.isRunning = false;

    // Stop all workers
    await Promise.all(this.workers.map(w => w.stop()));

    // Clear intervals
    if (this.statsInterval) {
        clearInterval(this.statsInterval);
    }

    // Close database connections
    await this.database.close();
}
```

## URL/Domain Handling

### Onion Validation
```javascript
validateOnionDomain(domain) {
    // V3 onion: 56 chars from [a-z2-7] + .onion
    const pattern = /^[a-z2-7]{56}\.onion$/;
    return pattern.test(domain.toLowerCase());
}
```

### URL Normalization
```javascript
normalizeUrl(url, baseUrl) {
    try {
        // Handle relative URLs
        if (url.startsWith('//')) {
            return 'http:' + url;
        }
        if (url.startsWith('/')) {
            const base = new URL(baseUrl);
            return `${base.protocol}//${base.host}${url}`;
        }
        // Validate full URL
        new URL(url);
        return url;
    } catch {
        return null;  // Invalid URL
    }
}
```

### Domain Extraction
```javascript
extractDomain(url) {
    try {
        const parsed = new URL(url);
        return parsed.hostname;
    } catch {
        // Try regex fallback
        const match = url.match(/([a-z2-7]{56}\.onion)/i);
        return match ? match[1].toLowerCase() : null;
    }
}
```

## Configuration Patterns

### Environment Variables with Defaults
```javascript
const config = {
    dbHost: process.env.DB_HOST || 'localhost',
    dbPort: parseInt(process.env.DB_PORT || '5432'),
    torPort: parseInt(process.env.TOR_PORT || '9050'),
    workerCount: parseInt(process.env.WORKER_COUNT || '10'),
    timeout: parseInt(process.env.REQUEST_TIMEOUT || '45000')
};
```

### Options Object Pattern
```javascript
class CrawlerWorker {
    constructor(workerId, database, options = {}) {
        this.timeout = options.timeout || 45000;
        this.retryAttempts = options.retryAttempts || 2;
        this.crawlDelay = options.crawlDelay || 2000;
        this.maxContentSize = options.maxContentSize || 1048576;
    }
}
```

## Express API Patterns

### Async Route Handlers
```javascript
app.get('/search', async (req, res) => {
    try {
        const results = await this.database.search(req.query.q);
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
```

### HTML Response with Template Literals
```javascript
app.get('/', async (req, res) => {
    const stats = await this.database.getStatistics();
    res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Onion Search</title></head>
        <body>
            <h1>Search</h1>
            <p>Domains: ${stats.totalDomains}</p>
            <!-- ... -->
        </body>
        </html>
    `);
});
```

## Naming Conventions

### Variables
- camelCase for variables and functions
- UPPER_SNAKE_CASE for constants
- Descriptive names (`crawlDelay` not `cd`)

### Files
- camelCase for JavaScript files
- kebab-case for SQL files
- Descriptive names matching primary export

### Database
- snake_case for tables and columns
- Singular table names (`domain` not `domains`) - though this project uses plural
- Descriptive index names (`idx_table_column`)

### Logging
- Emoji indicators for quick scanning:
  - `✅` Success (2xx response)
  - `⚠️` HTTP error (4xx/5xx but content saved)
  - `❌` Failure (network error)
  - `🔒` Lock operations
  - `📊` Statistics/content info
  - `🔗` Links found
  - `📝` Text-extracted domains
  - `🎯` URL claimed for crawling
  - `🚫` Domain unreachable
