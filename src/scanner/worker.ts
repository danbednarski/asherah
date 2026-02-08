import type { Logger } from 'winston';
import { TcpScanner } from './tcp-scanner.js';
import { ServiceDetector } from './service-detector.js';
import { getPortsForProfile } from './port-profiles.js';
import { Database } from '../database/database.js';
import { createScannerWorkerLogger } from '../utils/logger.js';
import { delay, randomDelay } from '../utils/delay.js';
import type {
  PortScanWorkerOptions,
  ScanQueueItem,
  PortScanResult,
  DetectedService,
  ScanProfile,
} from '../types/scanner.js';

// Error patterns that indicate the domain itself is unreachable
const CONNECTION_FAILURE_PATTERNS = [
  'ECONNREFUSED',
  'ENOTFOUND',
  'ETIMEDOUT',
  'ECONNRESET',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'socket hang up',
  'Socks5 proxy rejected connection',
  'General SOCKS server failure',
  'Host unreachable',
  'Network is unreachable',
];

export class PortScanWorker {
  private readonly workerId: string;
  private readonly scanner: TcpScanner;
  private readonly serviceDetector: ServiceDetector;
  private readonly database: Database;
  private readonly ownsDatabase: boolean;
  private readonly logger: Logger;
  private readonly maxConcurrent: number;
  private readonly minProbeDelay: number;
  private readonly scanDelay: number;
  private isRunning: boolean;
  private startTime: number | null;

  constructor(workerId: string, options: PortScanWorkerOptions = {}, sharedDatabase?: Database) {
    this.workerId = workerId;
    this.scanner = new TcpScanner({
      torHost: options.torHost,
      torPort: options.torPort,
      timeout: options.timeout ?? 30000,
    });
    this.serviceDetector = new ServiceDetector();
    this.database = sharedDatabase ?? new Database();
    this.ownsDatabase = !sharedDatabase;
    this.isRunning = false;
    this.maxConcurrent = options.maxConcurrent ?? 5;
    this.minProbeDelay = options.minProbeDelay ?? 200;
    this.scanDelay = 2000;
    this.startTime = null;

    this.logger = createScannerWorkerLogger(workerId);
  }

  async start(): Promise<void> {
    if (this.isRunning) return;

    this.isRunning = true;
    this.startTime = Date.now();
    this.logger.info('Scanner worker started');

    while (this.isRunning) {
      try {
        await this.processBatch();
        await delay(this.scanDelay);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error('Worker batch error', { error: errorMessage });
        await delay(this.scanDelay * 2);
      }
    }

    this.logger.info('Scanner worker stopped');
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    if (this.ownsDatabase) {
      await this.database.close();
    }
    this.logger.info('Worker shutdown complete');
  }

  private async processBatch(): Promise<void> {
    const scans = await this.database.getNextScans(this.workerId, 1);

    if (scans.length === 0) {
      this.logger.debug('No scans to process, waiting...');
      return;
    }

    for (const scanItem of scans) {
      if (!this.isRunning) break;

      await this.processScan(scanItem);

      if (this.isRunning) {
        await randomDelay(500, 1500);
      }
    }
  }

  private async processScan(scanItem: ScanQueueItem): Promise<void> {
    const { domain, profile, ports: customPorts } = scanItem;
    const shortDomain = domain.substring(0, 15) + '...onion';
    let lockAcquired = false;

    const portsToScan = customPorts ?? getPortsForProfile(profile);

    console.log(`\n🔍 [${this.workerId}] SCANNING: ${shortDomain}`);
    console.log(`   📋 Profile: ${profile} | Ports: ${portsToScan.length}`);
    console.log(`   🔢 Priority: ${scanItem.priority} | Attempts: ${scanItem.attempts}`);

    try {
      lockAcquired = await this.database.acquireScanLock(domain, this.workerId);

      if (!lockAcquired) {
        console.log(`   ⏭️  Domain locked by another worker, skipping\n`);
        await this.database.returnScanToQueue(scanItem.id);
        return;
      }

      console.log(`   🔒 Lock acquired, starting scan...`);

      const startTime = Date.now();
      let openCount = 0;
      let failedProbes = 0;

      const results = await this.scanner.scanPorts(domain, portsToScan, {
        maxConcurrent: this.maxConcurrent,
        minDelay: this.minProbeDelay,
        getProbeString: (port) => this.serviceDetector.getProbeString(port),
        onProgress: (result, completed, total) => {
          if (result.state === 'open') {
            openCount++;
            console.log(`   ✅ Port ${result.port} OPEN (${result.responseTimeMs}ms)`);
            if (result.banner) {
              const shortBanner = result.banner.substring(0, 50).replace(/\n/g, ' ');
              console.log(`      📝 Banner: ${shortBanner}...`);
            }
          }
          // Track consecutive failures for early abort
          if (result.state === 'timeout' || result.state === 'filtered') {
            failedProbes++;
          } else {
            failedProbes = 0;
          }

          // Progress update every 10 ports
          if (completed % 10 === 0) {
            console.log(`   📊 Progress: ${completed}/${total} ports scanned`);
          }
        },
      });

      const scanDuration = Date.now() - startTime;

      // Detect services from banners
      const openPorts = results.filter((r) => r.state === 'open');
      const services = this.serviceDetector.detectAll(
        openPorts.map((r) => ({ port: r.port, banner: r.banner }))
      );

      // Store results in database
      await this.storeResults(domain, results, services, profile);

      // Mark scan as completed
      await this.database.markScanCompleted(scanItem.id);

      console.log(`   ✅ SCAN COMPLETE!`);
      console.log(`   🔓 Open ports: ${openCount}/${portsToScan.length}`);
      console.log(`   🔧 Services detected: ${services.length}`);
      console.log(`   ⏱️  Duration: ${Math.round(scanDuration / 1000)}s\n`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.log(`   ❌ FAILED: ${errorMessage}`);

      const isConnectionFailure = this.isConnectionFailure(errorMessage);

      if (isConnectionFailure) {
        await this.database.markScanFailed(scanItem.id, `Domain unreachable: ${errorMessage}`);
        console.log(`   🚫 DOMAIN UNREACHABLE\n`);
      } else {
        await this.database.markScanFailed(scanItem.id, errorMessage);
        console.log(`   🔄 Will retry later\n`);
      }
    } finally {
      if (lockAcquired) {
        await this.database.releaseScanLock(domain, this.workerId);
      }
    }
  }

  private async storeResults(
    domain: string,
    results: PortScanResult[],
    services: DetectedService[],
    _profile: ScanProfile
  ): Promise<void> {
    // Get or create domain
    const domainResult = await this.database.upsertDomain(domain);
    const domainId = domainResult.id;

    // Store port scan results
    for (const result of results) {
      await this.database.insertPortScan(
        domainId,
        domain,
        result.port,
        result.state,
        result.responseTimeMs,
        result.banner
      );
    }

    // Store detected services
    for (const service of services) {
      // Find the port scan ID for this service
      const portScanId = await this.database.getPortScanId(domain, service.port);
      if (portScanId) {
        await this.database.insertDetectedService(
          portScanId,
          domain,
          service.port,
          service.serviceName,
          service.serviceVersion,
          service.confidence,
          service.rawBanner
        );
      }
    }
  }

  private isConnectionFailure(errorMessage: string): boolean {
    const lowerError = errorMessage.toLowerCase();
    return CONNECTION_FAILURE_PATTERNS.some((pattern) =>
      lowerError.includes(pattern.toLowerCase())
    );
  }

  getStats(): { workerId: string; isRunning: boolean; uptime: number } {
    return {
      workerId: this.workerId,
      isRunning: this.isRunning,
      uptime: this.startTime ? Date.now() - this.startTime : 0,
    };
  }
}
