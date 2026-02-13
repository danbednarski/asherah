# Port Scanner Development Guide

## Overview

The Asherah port scanner provides Shodan-like service discovery for onion domains. It uses raw TCP connections through Tor's SOCKS5 proxy to scan ports and identify running services.

## Architecture

```
ScannerOrchestrator
       │
       ├── PortScanWorker 1
       ├── PortScanWorker 2
       └── PortScanWorker N
              │
              ├── TorPortScanner (SOCKS5 TCP)
              └── ServiceDetector (banner analysis)
```

## SOCKS5 TCP Connection Pattern

Use the `socks` library for raw TCP through Tor (NOT axios or socks-proxy-agent):

```typescript
import { SocksClient, SocksClientOptions } from 'socks';

const options: SocksClientOptions = {
  proxy: {
    host: '127.0.0.1',
    port: 9050,
    type: 5,  // SOCKS5
  },
  command: 'connect',
  destination: {
    host: 'example.onion',
    port: 80,
  },
  timeout: 30000,
};

const { socket } = await SocksClient.createConnection(options);
// socket is a net.Socket connected through Tor
```

## Banner Grabbing

```typescript
async function grabBanner(socket: net.Socket, timeout = 5000): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    const timer = setTimeout(() => {
      resolve(Buffer.concat(chunks).toString('utf8'));
    }, timeout);

    socket.on('data', (chunk) => {
      chunks.push(chunk);
      if (chunks.reduce((a, b) => a + b.length, 0) > 4096) {
        clearTimeout(timer);
        resolve(Buffer.concat(chunks).toString('utf8').slice(0, 4096));
      }
    });
  });
}
```

## Rate Limiting

- Tor adds 2-10s latency per connection
- Max 5 concurrent connections per worker
- 200ms between probes on same domain
- Domain locking prevents duplicate scans

## Error Types

| Error | Meaning | Port State |
|-------|---------|------------|
| `ECONNREFUSED` | Port closed | closed |
| `ETIMEDOUT` | No response | filtered/timeout |
| `SOCKS failure` | Tor circuit issue | retry |
| Connection success | Port accepting connections | open |

## Key Files

| File | Purpose |
|------|---------|
| `src/scanner/tcp-scanner.ts` | Core SOCKS5 TCP scanning via `socks` library |
| `src/scanner/worker.ts` | PortScanWorker class (mirrors CrawlerWorker) |
| `src/scanner/service-detector.ts` | Banner analysis, 20+ service signatures |
| `src/scanner/port-profiles.ts` | Port sets (quick/standard/full/crypto) |
| `src/scanner/index.ts` | Module exports |
| `src/scanner-orchestrator.ts` | Main orchestrator, queue population |
| `src/types/scanner.ts` | TypeScript interfaces |
| `src/schemas/scanner.ts` | Zod validation schemas |
| `schema-scanner.sql` | Database tables and functions |

## Running the Scanner

```bash
# Development mode
npm run scanner:dev

# Production
npm run build
npm run scanner

# With environment variables
SCANNER_WORKERS=5 TOR_HOST=127.0.0.1 TOR_PORT=9050 npm run scanner
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SCANNER_WORKERS` | 3 | Number of concurrent workers |
| `TOR_HOST` | 127.0.0.1 | Tor SOCKS5 proxy host |
| `TOR_PORT` | 9050 | Tor SOCKS5 proxy port |
| `SCANNER_TIMEOUT` | 30000 | Connection timeout (ms) |
| `SCANNER_MAX_CONCURRENT` | 5 | Max concurrent connections per worker |
| `SCANNER_PROBE_DELAY` | 200 | Delay between probes (ms) |

## Queue Management

### Auto-population on startup
The orchestrator populates the scan queue from existing domains with priority based on recency:
- Priority 10: Crawled in last 24 hours
- Priority 30: Crawled in last week
- Priority 50: Crawled in last month
- Priority 100: Older successful crawls
- Priority 200: Never successfully crawled

### Crawler integration
The crawler automatically queues new domains for scanning when discovered.

### Manual queue addition
```sql
INSERT INTO scan_queue (domain, profile, priority)
VALUES ('example.onion', 'standard', 100);
```

Or via the Database class:

```typescript
await database.queueDomainForScan('example.onion', 'standard', 50);
```

## Frontend Integration

The search supports `port:N` syntax:
```
bitcoin port:80       # Bitcoin sites with HTTP
ssh port:22           # Sites with SSH
port:8333             # Bitcoin nodes
```

## Debugging

```bash
# Check scanner logs
tail -f logs/scanner-orchestrator.log
tail -f logs/scanner-worker-1.log

# Queue status
psql onion_search -c "SELECT status, COUNT(*) FROM scan_queue GROUP BY status;"

# Recent scans
psql onion_search -c "SELECT domain, port, state FROM port_scans ORDER BY scanned_at DESC LIMIT 20;"

# Detected services
psql onion_search -c "SELECT domain, service_name, service_version FROM detected_services ORDER BY last_seen DESC LIMIT 20;"
```
