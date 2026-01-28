import type { DetectedService, ServiceSignature } from '../types/scanner.js';

// Service signatures for banner analysis
const SERVICE_SIGNATURES: ServiceSignature[] = [
  // SSH
  {
    name: 'ssh',
    patterns: [/^SSH-[\d.]+/i, /^SSH-2\.0-/i, /^SSH-1\./i],
    ports: [22, 2222],
    versionExtractor: /SSH-[\d.]+-(.+?)(?:\s|$)/,
  },
  // HTTP Server
  {
    name: 'http',
    patterns: [/^HTTP\/[\d.]+/i, /Server:/i, /<!DOCTYPE/i, /<html/i],
    ports: [80, 8080, 8000, 3000, 5000, 8443, 443],
    versionExtractor: /Server:\s*([^\r\n]+)/i,
  },
  // nginx
  {
    name: 'nginx',
    patterns: [/nginx/i, /Server:\s*nginx/i],
    ports: [80, 443, 8080],
    versionExtractor: /nginx\/([\d.]+)/i,
  },
  // Apache
  {
    name: 'apache',
    patterns: [/Apache/i, /Server:\s*Apache/i],
    ports: [80, 443, 8080],
    versionExtractor: /Apache\/([\d.]+)/i,
  },
  // MySQL
  {
    name: 'mysql',
    patterns: [/mysql/i, /MariaDB/i, /^\x00/],
    ports: [3306, 33060],
    versionExtractor: /([\d.]+)-MariaDB|([\d.]+)-mysql/i,
  },
  // PostgreSQL
  {
    name: 'postgresql',
    patterns: [/PostgreSQL/i, /FATAL:\s+password/i, /pg_hba\.conf/i],
    ports: [5432],
    versionExtractor: /PostgreSQL\s+([\d.]+)/i,
  },
  // Redis
  {
    name: 'redis',
    patterns: [/\+PONG/i, /-ERR unknown command/i, /redis_version/i],
    ports: [6379, 6380],
    versionExtractor: /redis_version:([\d.]+)/i,
  },
  // MongoDB
  {
    name: 'mongodb',
    patterns: [/MongoDB/i, /ismaster/i, /\{"ismaster"/i],
    ports: [27017, 27018, 27019],
    versionExtractor: /version":\s*"([\d.]+)"/i,
  },
  // FTP
  {
    name: 'ftp',
    patterns: [/^220[\s-]/i, /FTP/i, /vsftpd/i, /ProFTPD/i],
    ports: [21, 20],
    versionExtractor: /vsftpd\s+([\d.]+)|ProFTPD\s+([\d.]+)/i,
  },
  // SMTP
  {
    name: 'smtp',
    patterns: [/^220[\s-].*SMTP/i, /^220[\s-].*ESMTP/i, /Postfix/i, /Sendmail/i],
    ports: [25, 465, 587],
    versionExtractor: /Postfix|Sendmail|ESMTP\s+(\S+)/i,
  },
  // IRC
  {
    name: 'irc',
    patterns: [
      /^:.*NOTICE/i,
      /^NOTICE AUTH/i,
      /Welcome to.*IRC/i,
      /Looking up your hostname/i,
      /UnrealIRCd/i,
      /InspIRCd/i,
      /ircd/i,
      /ngircd/i,
    ],
    ports: [6666, 6667, 6668, 6669, 6697, 7000],
    versionExtractor: /UnrealIRCd[- ]([\d.]+)|InspIRCd[- ]([\d.]+)|ircd[- ]([\d.]+)/i,
  },
  // Bitcoin
  {
    name: 'bitcoin',
    patterns: [/\xf9\xbe\xb4\xd9/], // Bitcoin mainnet magic bytes
    ports: [8333, 8332, 18333, 18332],
  },
  // Tor Control
  {
    name: 'tor-control',
    patterns: [/250[\s-]OK/i, /Tor/i, /514 Authentication required/i],
    ports: [9051, 9151],
    versionExtractor: /Tor\s+([\d.]+)/i,
  },
  // SOCKS Proxy
  {
    name: 'socks',
    patterns: [/\x05\x00/, /\x05\xff/], // SOCKS5 responses
    ports: [1080, 9050, 9150],
  },
  // Elasticsearch
  {
    name: 'elasticsearch',
    patterns: [/elasticsearch/i, /"cluster_name"/i, /lucene_version/i],
    ports: [9200, 9300],
    versionExtractor: /"number"\s*:\s*"([\d.]+)"/i,
  },
  // Ethereum JSON-RPC
  {
    name: 'ethereum',
    patterns: [/eth_/i, /web3_/i, /jsonrpc/i, /geth/i],
    ports: [8545, 8546, 30303],
    versionExtractor: /Geth\/(v[\d.]+)/i,
  },
  // Monero
  {
    name: 'monero',
    patterns: [/monerod/i, /get_info/i],
    ports: [18080, 18081, 18082, 18083],
    versionExtractor: /version":\s*"([\d.]+)"/i,
  },
  // VNC
  {
    name: 'vnc',
    patterns: [/^RFB\s+[\d.]+/i],
    ports: [5900, 5901],
    versionExtractor: /RFB\s+([\d.]+)/i,
  },
  // Telnet
  {
    name: 'telnet',
    patterns: [/\xff\xfd/, /\xff\xfb/, /login:/i, /username:/i],
    ports: [23],
  },
  // IMAP
  {
    name: 'imap',
    patterns: [/^\*\s+OK.*IMAP/i, /CAPABILITY\s+IMAP/i],
    ports: [143, 993],
    versionExtractor: /IMAP4rev1|Dovecot|Cyrus\s+([\d.]+)/i,
  },
  // POP3
  {
    name: 'pop3',
    patterns: [/^\+OK\s+/i, /POP3/i],
    ports: [110, 995],
    versionExtractor: /Dovecot|POP3\s+([\d.]+)/i,
  },
];

export class ServiceDetector {
  private signatures: ServiceSignature[];

  constructor(customSignatures?: ServiceSignature[]) {
    this.signatures = customSignatures ?? SERVICE_SIGNATURES;
  }

  detect(port: number, banner: string | null): DetectedService | null {
    if (!banner || banner.trim().length === 0) {
      return null;
    }

    let bestMatch: DetectedService | null = null;
    let bestConfidence = 0;

    for (const sig of this.signatures) {
      const confidence = this.calculateConfidence(port, banner, sig);

      if (confidence > bestConfidence) {
        bestConfidence = confidence;
        bestMatch = {
          port,
          serviceName: sig.name,
          serviceVersion: this.extractVersion(banner, sig),
          confidence,
          rawBanner: banner.substring(0, 1024),
        };
      }
    }

    // Only return if confidence is above threshold
    if (bestMatch && bestConfidence >= 30) {
      return bestMatch;
    }

    return null;
  }

  private calculateConfidence(port: number, banner: string, sig: ServiceSignature): number {
    let confidence = 0;

    // Check if port matches known ports for this service
    if (sig.ports.includes(port)) {
      confidence += 30;
    }

    // Check banner patterns
    for (const pattern of sig.patterns) {
      if (pattern.test(banner)) {
        confidence += 40;
        break;
      }
    }

    // Bonus if version can be extracted
    if (sig.versionExtractor && sig.versionExtractor.test(banner)) {
      confidence += 20;
    }

    return Math.min(confidence, 100);
  }

  private extractVersion(banner: string, sig: ServiceSignature): string | null {
    if (!sig.versionExtractor) {
      return null;
    }

    const match = banner.match(sig.versionExtractor);
    if (match) {
      // Return first non-null capture group
      for (let i = 1; i < match.length; i++) {
        if (match[i]) {
          return match[i];
        }
      }
    }

    return null;
  }

  detectAll(results: Array<{ port: number; banner: string | null }>): DetectedService[] {
    const services: DetectedService[] = [];

    for (const result of results) {
      const service = this.detect(result.port, result.banner);
      if (service) {
        services.push(service);
      }
    }

    return services;
  }

  getProbeString(port: number): string | null {
    for (const sig of this.signatures) {
      if (sig.ports.includes(port) && sig.probeString) {
        return sig.probeString;
      }
    }

    // Default probes for common ports
    if ([80, 8080, 8000, 3000, 5000, 443, 8443].includes(port)) {
      return 'GET / HTTP/1.0\r\n\r\n';
    }

    if ([6379, 6380].includes(port)) {
      return 'PING\r\n';
    }

    return null;
  }
}
