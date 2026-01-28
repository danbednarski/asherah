import type { ScanProfile } from '../types/scanner.js';

// Port profiles for different scan types
export const PORT_PROFILES: Record<ScanProfile, number[]> = {
  // Quick scan - 5 most common ports
  quick: [80, 443, 22, 8080, 8333],

  // Standard scan - common ports for onion services
  standard: [
    // Web services
    80, 443, 8080, 8443, 3000, 5000, 8000,
    // SSH
    22, 2222,
    // IRC
    6667, 6697,
    // Bitcoin/Crypto
    8333, 8332, 18333,
    // Databases
    3306, 5432, 27017, 6379,
    // Other common
    21, 25, 110, 143, 1080, 9050, 9051, 9150, 9151,
  ],

  // Full scan - comprehensive port list
  full: [
    // FTP
    20, 21,
    // SSH
    22, 2222,
    // Telnet
    23,
    // SMTP
    25, 465, 587,
    // DNS
    53,
    // HTTP/HTTPS
    80, 443, 8080, 8443, 8000, 8008, 8888, 3000, 3001, 4000, 5000, 5001, 9000,
    // POP3
    110, 995,
    // IMAP
    143, 993,
    // LDAP
    389, 636,
    // SMB
    445,
    // SOCKS
    1080, 1081,
    // IRC
    6666, 6667, 6668, 6669, 6697, 7000,
    // MySQL
    3306, 33060,
    // PostgreSQL
    5432,
    // MongoDB
    27017, 27018, 27019,
    // Redis
    6379, 6380,
    // Memcached
    11211,
    // Elasticsearch
    9200, 9300,
    // Bitcoin
    8332, 8333, 18332, 18333, 18443, 18444,
    // Ethereum
    8545, 8546, 30303,
    // Monero
    18080, 18081, 18082, 18083,
    // Tor
    9050, 9051, 9150, 9151,
    // VNC
    5900, 5901,
    // RDP
    3389,
    // Docker
    2375, 2376,
    // Kubernetes
    6443, 10250,
    // Other
    1433, 1521, 4444, 5555, 7000, 7001, 8001, 9001,
  ],

  // Crypto-focused scan
  crypto: [
    // Bitcoin
    8332, 8333, 18332, 18333, 18443, 18444,
    // Ethereum
    8545, 8546, 30303, 30304,
    // Monero
    18080, 18081, 18082, 18083,
    // Litecoin
    9332, 9333, 19332, 19333,
    // Zcash
    8232, 8233, 18232, 18233,
    // Dash
    9998, 9999, 19998, 19999,
    // Electrum
    50001, 50002,
    // Lightning Network
    9735, 9736, 10009,
    // IPFS
    4001, 5001, 8080,
    // Common web (for web wallets)
    80, 443, 3000, 8000,
  ],
};

// Get ports for a profile
export function getPortsForProfile(profile: ScanProfile): number[] {
  return PORT_PROFILES[profile] ?? PORT_PROFILES.standard;
}

// Validate profile name
export function isValidProfile(profile: string): profile is ScanProfile {
  return profile in PORT_PROFILES;
}

// Get all available profiles
export function getAvailableProfiles(): ScanProfile[] {
  return Object.keys(PORT_PROFILES) as ScanProfile[];
}

// Get profile port count
export function getProfilePortCount(profile: ScanProfile): number {
  return PORT_PROFILES[profile]?.length ?? 0;
}
