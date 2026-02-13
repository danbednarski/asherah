# Port Scanning Profiles for Onion Services

## Quick Scan (5 ports)
80, 443, 22, 8080, 8333

Best for: Fast discovery, initial reconnaissance

## Standard Scan (default, ~30 ports)
**Web:** 80, 443, 8080, 8443, 3000, 5000, 8000
**SSH:** 22, 2222
**IRC:** 6667, 6697
**Bitcoin:** 8333, 8332, 18333
**Database:** 3306, 5432, 27017, 6379
**Other:** 21, 25, 110, 143, 1080, 9050, 9051, 9150, 9151

Best for: General-purpose scanning, balanced coverage (this is the default)

## Full Scan (80+ ports)
Comprehensive port list including:
- All common web ports (80, 443, 8080, 8443, 8000, 8008, 8888, 3000, 3001, 4000, 5000, 5001, 9000)
- Mail servers (SMTP 25/465/587, POP3 110/995, IMAP 143/993)
- Databases (MySQL 3306/33060, PostgreSQL 5432, MongoDB 27017-27019, Redis 6379/6380)
- IRC (6666, 6667, 6668, 6669, 6697, 7000)
- Cryptocurrency nodes (Bitcoin, Ethereum, Monero)
- VNC 5900/5901, RDP 3389
- Docker 2375/2376, Kubernetes 6443/10250
- Tor control ports (9050, 9051, 9150, 9151)
- Elasticsearch 9200/9300, Memcached 11211

Best for: Thorough enumeration, security assessment

## Crypto-Focused Scan
**Bitcoin:** 8332, 8333, 18332, 18333, 18443, 18444
**Ethereum:** 8545, 8546, 30303, 30304
**Monero:** 18080, 18081, 18082, 18083
**Litecoin:** 9332, 9333, 19332, 19333
**Zcash:** 8232, 8233, 18232, 18233
**Dash:** 9998, 9999, 19998, 19999
**Electrum:** 50001, 50002
**Lightning:** 9735, 9736, 10009
**IPFS:** 4001, 5001, 8080
**Common web:** 80, 443, 3000, 8000 (for web wallets)

Best for: Cryptocurrency node discovery

## Usage

```typescript
import { getPortsForProfile, PORT_PROFILES } from './scanner/port-profiles.js';

// Get ports for a profile
const ports = getPortsForProfile('standard');

// Custom ports
await database.addToScanQueue('example.onion', 'quick', [80, 443, 8080], 100);
```

## Adding Custom Profiles

Edit `src/scanner/port-profiles.ts`:

```typescript
export const PORT_PROFILES: Record<ScanProfile, number[]> = {
  // ... existing profiles
  custom: [80, 443, 8080, 9000],
};
```
