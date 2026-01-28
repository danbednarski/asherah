# Port Scanning Profiles for Onion Services

## Quick Scan (5 ports)
80, 443, 22, 8080, 8333

Best for: Fast discovery, initial reconnaissance

## Standard Scan (25 ports)
**Web:** 80, 443, 8080, 8443, 3000, 5000, 8000
**SSH:** 22, 2222
**Bitcoin:** 8333, 8332, 18333
**Database:** 3306, 5432, 27017, 6379
**Other:** 21, 25, 110, 143, 1080, 9050, 9051, 9150, 9151

Best for: General-purpose scanning, balanced coverage

## Full Scan (100+ ports)
Comprehensive port list including:
- All common web ports
- Mail servers (SMTP, POP3, IMAP)
- Databases (MySQL, PostgreSQL, MongoDB, Redis)
- Cryptocurrency nodes
- VNC, RDP, Docker, Kubernetes
- Tor control ports

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
