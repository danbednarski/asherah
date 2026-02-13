# Service Detection Signatures

## SSH
**Ports:** 22, 2222
**Banner:** `SSH-2.0-` or `SSH-1.`
**Extract version:** `/SSH-[\d.]+-(.+)/`

Example banner:
```
SSH-2.0-OpenSSH_8.9p1 Ubuntu-3ubuntu0.1
```

## HTTP
**Ports:** 80, 8080, 8000, 3000
**Banner:** `HTTP/1.` or no banner (send GET)
**Probe:** `GET / HTTP/1.0\r\n\r\n`

Example response:
```
HTTP/1.1 200 OK
Server: nginx/1.18.0
```

## nginx
**Ports:** 80, 443, 8080
**Pattern:** `Server:\s*nginx`
**Version:** `/nginx\/([\d.]+)/i`

## Apache
**Ports:** 80, 443, 8080
**Pattern:** `Server:\s*Apache`
**Version:** `/Apache\/([\d.]+)/i`

## MySQL
**Ports:** 3306, 33060
**Banner:** Starts with protocol version byte
**Look for:** `mysql` or version string

## PostgreSQL
**Ports:** 5432
**No banner** - requires startup message
**Look for:** authentication request

## Redis
**Ports:** 6379, 6380
**Probe:** `PING\r\n`
**Response:** `+PONG`

## MongoDB
**Ports:** 27017, 27018, 27019
**Pattern:** `MongoDB`, `ismaster`

## Bitcoin
**Ports:** 8333, 18333
**No banner** - use protocol handshake
**Magic bytes:** `0xf9beb4d9` (mainnet)

## Tor Control
**Ports:** 9051, 9151
**Pattern:** `250[\s-]OK`, `514 Authentication required`

## FTP
**Ports:** 21, 20
**Banner:** `220[\s-]` followed by server info
**Pattern:** `vsftpd`, `ProFTPD`

## SMTP
**Ports:** 25, 465, 587
**Banner:** `220[\s-].*SMTP` or `ESMTP`
**Pattern:** `Postfix`, `Sendmail`

## IRC
**Ports:** 6666, 6667, 6668, 6669, 6697, 7000
**Patterns:**
- `:.*NOTICE` (server notices)
- `NOTICE AUTH` (auth check)
- `Welcome to.*IRC`
- `Looking up your hostname`
- `UnrealIRCd`, `InspIRCd`, `ngircd`
**Version:** `/UnrealIRCd[- ]([\d.]+)|InspIRCd[- ]([\d.]+)/i`

Example banner:
```
:server NOTICE AUTH :*** Looking up your hostname...
```

## IMAP
**Ports:** 143, 993
**Banner:** `* OK.*IMAP`
**Pattern:** `CAPABILITY IMAP`, `Dovecot`, `Cyrus`

## POP3
**Ports:** 110, 995
**Banner:** `+OK`
**Pattern:** `POP3`, `Dovecot`

## VNC
**Ports:** 5900, 5901
**Banner:** `RFB` (Remote Framebuffer)
**Version:** `/RFB\s+([\d.]+)/i`

## Telnet
**Ports:** 23
**Patterns:** `\xff\xfd`, `\xff\xfb` (telnet negotiation), `login:`, `username:`

## Elasticsearch
**Ports:** 9200, 9300
**Patterns:** `elasticsearch`, `cluster_name`, `lucene_version`
**Version:** `/"number"\s*:\s*"([\d.]+)"/i`

## Adding Custom Signatures

Edit `src/scanner/service-detector.ts`:

```typescript
const SERVICE_SIGNATURES: ServiceSignature[] = [
  {
    name: 'custom-service',
    patterns: [/custom-pattern/i],
    ports: [1234, 5678],
    versionExtractor: /version[:\s]+([\d.]+)/i,
    probeString: 'HELLO\r\n',
  },
  // ... other signatures
];
```

## Confidence Scoring

- **+30** if port matches known ports for service
- **+40** if banner matches a pattern
- **+20** if version can be extracted
- Minimum **30** confidence required for detection
