import type { Logger } from 'winston';
import { TorClient } from '../tor/client.js';
import { ResponseClassifier, generateBaselinePath } from './response-classifier.js';
import { getPathsForProfile } from './path-profiles.js';
import { Database } from '../database/database.js';
import { createDirscanWorkerLogger } from '../utils/logger.js';
import { delay, randomDelay } from '../utils/delay.js';
import type {
  DirScanWorkerOptions,
  DirScanQueueItem,
  DirScanResult,
  BaselineResponse,
} from '../types/dirscanner.js';
import type { TorSuccessResult, TorErrorResult } from '../types/tor.js';

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

export class DirScanWorker {
  private readonly workerId: string;
  private readonly torClient: TorClient;
  private readonly classifier: ResponseClassifier;
  private readonly database: Database;
  private readonly ownsDatabase: boolean;
  private readonly logger: Logger;
  private readonly pathDelay: number;
  private readonly timeout: number;
  private readonly scanDelay: number;
  private isRunning: boolean;
  private startTime: number | null;

  constructor(workerId: string, options: DirScanWorkerOptions = {}, sharedDatabase?: Database) {
    this.workerId = workerId;
    this.torClient = new TorClient({
      ...(options.torHost !== undefined ? { torHost: options.torHost } : {}),
      ...(options.torPort !== undefined ? { torPort: options.torPort } : {}),
      timeout: options.timeout ?? 30000,
      retryAttempts: 1,
    });
    this.classifier = new ResponseClassifier();
    this.database = sharedDatabase ?? new Database();
    this.ownsDatabase = !sharedDatabase;
    this.isRunning = false;
    this.pathDelay = options.pathDelay ?? parseInt(process.env['DIRSCAN_PATH_DELAY'] ?? '1000', 10);
    this.timeout = options.timeout ?? 30000;
    this.scanDelay = 2000;
    this.startTime = null;

    this.logger = createDirscanWorkerLogger(workerId);
  }

  async start(): Promise<void> {
    if (this.isRunning) return;

    this.isRunning = true;
    this.startTime = Date.now();
    this.logger.info('Dir scanner worker started');

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

    this.logger.info('Dir scanner worker stopped');
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    if (this.ownsDatabase) {
      await this.database.close();
    }
    this.logger.info('Worker shutdown complete');
  }

  private async processBatch(): Promise<void> {
    const scans = await this.database.getNextDirScans(this.workerId, 1);

    if (scans.length === 0) {
      this.logger.debug('No dir scans to process, waiting...');
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

  private async processScan(scanItem: DirScanQueueItem): Promise<void> {
    const { domain, profile } = scanItem;
    const shortDomain = domain.substring(0, 15) + '...onion';
    let lockAcquired = false;

    const paths = getPathsForProfile(profile);

    console.log(`\n📂 [${this.workerId}] DIR SCAN: ${shortDomain}`);
    console.log(`   📋 Profile: ${profile} | Paths: ${paths.length}`);
    console.log(`   🔢 Priority: ${scanItem.priority} | Attempts: ${scanItem.attempts}`);

    try {
      lockAcquired = await this.database.acquireDirscanLock(domain, this.workerId);

      if (!lockAcquired) {
        console.log(`   ⏭️  Domain locked by another worker, skipping\n`);
        await this.database.returnDirscanToQueue(scanItem.id);
        return;
      }

      console.log(`   🔒 Lock acquired, capturing baseline...`);

      const startTime = Date.now();

      // Capture baseline response from a random nonexistent path
      const baselineResult = await this.captureBaseline(domain);
      if (baselineResult.unreachable) {
        console.log(`   🚫 DOMAIN UNREACHABLE (baseline failed)\n`);
        await this.database.markDirscanFailed(scanItem.id, 'Domain unreachable');
        return;
      }
      if (baselineResult.baseline) {
        this.classifier.setBaseline(baselineResult.baseline);
        console.log(`   📊 Baseline: ${baselineResult.baseline.statusCode} (${baselineResult.baseline.contentLength} bytes)`);
      }

      // Probe each path
      const results: DirScanResult[] = [];
      let interestingCount = 0;
      let consecutiveFailures = 0;
      const MAX_CONSECUTIVE_FAILURES = 3;

      for (let i = 0; i < paths.length; i++) {
        if (!this.isRunning) break;

        const path = paths[i]!;
        const probeResult = await this.probePath(domain, path);

        if (probeResult.unreachable) {
          consecutiveFailures++;
          if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            console.log(`   🚫 DOMAIN UNREACHABLE (${consecutiveFailures} consecutive failures)\n`);
            await this.database.markDirscanFailed(scanItem.id, 'Domain unreachable');
            return;
          }
          continue;
        }

        consecutiveFailures = 0; // Reset on success

        if (probeResult.result) {
          results.push(probeResult.result);

          if (probeResult.result.isInteresting) {
            interestingCount++;
            console.log(`   🔥 FOUND: /${path} → ${probeResult.result.statusCode} [${probeResult.result.interestReason}]`);
          }
        }

        // Progress update every 10 paths
        if ((i + 1) % 10 === 0) {
          console.log(`   📊 Progress: ${i + 1}/${paths.length} paths probed`);
        }

        // Rate limit between path probes
        if (i < paths.length - 1 && this.isRunning) {
          await delay(this.pathDelay);
        }

        // Extend lock periodically (every 20 paths)
        if ((i + 1) % 20 === 0) {
          await this.database.extendDirscanLock(domain, this.workerId);
        }
      }

      const scanDuration = Date.now() - startTime;

      // Store results in database
      await this.storeResults(domain, results);

      // Mark scan as completed
      await this.database.markDirscanCompleted(scanItem.id);

      console.log(`   ✅ DIR SCAN COMPLETE!`);
      console.log(`   🔥 Interesting findings: ${interestingCount}/${results.length}`);
      console.log(`   ⏱️  Duration: ${Math.round(scanDuration / 1000)}s\n`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.log(`   ❌ FAILED: ${errorMessage}`);

      const isConnectionFailure = this.isConnectionFailure(errorMessage);

      if (isConnectionFailure) {
        await this.database.markDirscanFailed(scanItem.id, `Domain unreachable: ${errorMessage}`);
        console.log(`   🚫 DOMAIN UNREACHABLE\n`);
      } else {
        await this.database.markDirscanFailed(scanItem.id, errorMessage);
        console.log(`   🔄 Will retry later\n`);
      }
    } finally {
      if (lockAcquired) {
        await this.database.releaseDirscanLock(domain, this.workerId);
      }
    }
  }

  private async captureBaseline(domain: string): Promise<{ baseline: BaselineResponse | null; unreachable: boolean }> {
    const baselinePath = generateBaselinePath();
    const url = `http://${domain}/${baselinePath}`;

    try {
      const result = await this.torClient.get(url, {
        timeout: this.timeout,
        maxContentLength: 4096,
      });

      if (result.success) {
        const successResult = result as TorSuccessResult;
        return {
          baseline: {
            statusCode: successResult.status,
            contentLength: successResult.data.length,
            bodySnippet: successResult.data.substring(0, 512),
          },
          unreachable: false,
        };
      }

      // Check if it's a connection failure (domain unreachable)
      const errorResult = result as TorErrorResult;
      if (this.isConnectionFailure(errorResult.error)) {
        return { baseline: null, unreachable: true };
      }

      // HTTP error responses can be useful as baseline
      return {
        baseline: {
          statusCode: errorResult.status ?? 0,
          contentLength: 0,
          bodySnippet: '',
        },
        unreachable: false,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (this.isConnectionFailure(errorMessage)) {
        return { baseline: null, unreachable: true };
      }
      return { baseline: null, unreachable: false };
    }
  }

  private async probePath(domain: string, path: string): Promise<{ result: DirScanResult | null; unreachable: boolean }> {
    const url = `http://${domain}/${path}`;

    try {
      const startTime = Date.now();

      // HEAD first to check status
      const headResult = await this.torClient.head(url, { timeout: this.timeout });
      const responseTimeMs = Date.now() - startTime;

      if (!headResult.success) {
        // Check if it's a connection failure
        const errorResult = headResult as TorErrorResult;
        if (this.isConnectionFailure(errorResult.error)) {
          return { result: null, unreachable: true };
        }
        return { result: null, unreachable: false };
      }

      const headSuccess = headResult as TorSuccessResult;
      const statusCode = headSuccess.status;
      const headers = headSuccess.headers ?? {};
      const contentType = (headers['content-type'] ?? null) as string | null;
      const serverHeader = (headers['server'] ?? null) as string | null;
      const contentLengthHeader = headers['content-length'];
      const contentLength = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0;
      const locationHeader = (headers['location'] ?? null) as string | null;

      // For 200 responses, GET the body for classification
      let body: string | null = null;
      if (statusCode === 200) {
        try {
          const getResult = await this.torClient.get(url, {
            timeout: this.timeout,
            maxContentLength: 4096,
          });

          if (getResult.success) {
            body = (getResult as TorSuccessResult).data;
          }
        } catch {
          // If GET fails, classify without body
        }
      }

      return {
        result: this.classifier.classify({
          path,
          statusCode,
          contentLength: body ? body.length : contentLength,
          contentType,
          responseTimeMs,
          serverHeader,
          redirectUrl: locationHeader,
          body,
        }),
        unreachable: false,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (this.isConnectionFailure(errorMessage)) {
        return { result: null, unreachable: true };
      }
      return { result: null, unreachable: false };
    }
  }

  private async storeResults(domain: string, results: DirScanResult[]): Promise<void> {
    // Get or create domain
    const domainResult = await this.database.upsertDomain(domain);
    const domainId = domainResult.id;

    // Store dir scan results
    for (const result of results) {
      await this.database.insertDirscanResult(domainId, domain, result);
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
