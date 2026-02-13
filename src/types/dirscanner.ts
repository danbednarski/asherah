// Directory scanner types

export type DirScanProfile = 'quick' | 'standard' | 'full';

export type DirScanQueueStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type InterestCategory =
  | 'credentials_file'
  | 'backup_file'
  | 'source_control'
  | 'admin_panel'
  | 'server_info'
  | 'sensitive_directory'
  | 'configuration_file'
  | 'log_file'
  | 'database_file'
  | 'robots_sitemap'
  | 'other';

export interface DirScanResult {
  path: string;
  statusCode: number;
  contentLength: number | null;
  contentType: string | null;
  responseTimeMs: number;
  serverHeader: string | null;
  redirectUrl: string | null;
  bodySnippet: string | null;
  isInteresting: boolean;
  interestReason: InterestCategory | null;
}

export interface DirScanQueueItem {
  id: number;
  domainId: number | null;
  domain: string;
  profile: DirScanProfile;
  priority: number;
  attempts: number;
}

export interface DirScanWorkerOptions {
  torHost?: string | undefined;
  torPort?: number | undefined;
  timeout?: number | undefined;
  pathDelay?: number | undefined;
}

export interface BaselineResponse {
  statusCode: number;
  contentLength: number;
  bodySnippet: string;
}

export interface DirScannerStatistics {
  totalScans: number;
  activeWorkers: number;
  queueSize: number;
  interestingFindings: number;
  recentScans: number;
}
