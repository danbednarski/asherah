// Port scanner types

export type PortState = 'open' | 'closed' | 'filtered' | 'timeout';

export type ScanProfile = 'quick' | 'standard' | 'full' | 'crypto';

export type ScanQueueStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface PortScanResult {
  port: number;
  state: PortState;
  responseTimeMs: number;
  banner: string | null;
  error: string | null;
}

export interface ScanResult {
  domain: string;
  ports: PortScanResult[];
  startedAt: Date;
  completedAt: Date;
  totalPorts: number;
  openPorts: number;
  profile: ScanProfile;
}

export interface DetectedService {
  port: number;
  serviceName: string;
  serviceVersion: string | null;
  confidence: number;
  rawBanner: string | null;
}

export interface ScanQueueItem {
  id: number;
  domainId: number | null;
  domain: string;
  profile: ScanProfile;
  ports: number[] | null;
  priority: number;
  attempts: number;
}

export interface PortScanWorkerOptions {
  torHost?: string | undefined;
  torPort?: number | undefined;
  timeout?: number | undefined;
  maxConcurrent?: number | undefined;
  minProbeDelay?: number | undefined;
  maxConnectionsPerSecond?: number | undefined;
}

export interface TcpScannerOptions {
  torHost?: string | undefined;
  torPort?: number | undefined;
  timeout?: number | undefined;
  bannerTimeout?: number | undefined;
}

export interface ServiceSignature {
  name: string;
  patterns: RegExp[];
  ports: number[];
  versionExtractor?: RegExp;
  probeString?: string;
}

export interface ScannerStatistics {
  totalScans: number;
  activeWorkers: number;
  queueSize: number;
  openPorts: number;
  servicesDetected: number;
  recentScans: number;
}
