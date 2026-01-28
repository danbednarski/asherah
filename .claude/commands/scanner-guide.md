# Port Scanner Development Guide

## SOCKS5 TCP Connection Pattern

Use the `socks` library for raw TCP through Tor:

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

## Error Types

- `ECONNREFUSED` - Port closed
- `ETIMEDOUT` - Connection timeout (filtered or slow)
- `SOCKS failure` - Tor circuit issue, retry

## Key Files

- `src/scanner/tcp-scanner.ts` - Core SOCKS5 TCP scanning
- `src/scanner/worker.ts` - PortScanWorker class
- `src/scanner/service-detector.ts` - Banner analysis
- `src/scanner/port-profiles.ts` - Port sets
- `src/scanner-orchestrator.ts` - Main orchestrator

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

## Adding Domains to Scan Queue

```sql
INSERT INTO scan_queue (domain, profile, priority)
VALUES ('example.onion', 'standard', 100);
```

Or via the Database class:

```typescript
await database.addToScanQueue('example.onion', 'standard', null, 100);
```
