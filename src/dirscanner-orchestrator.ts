import { DirScanWorker } from './dirscanner/index.js';
import { Database } from './database/database.js';
import { createLogger } from './utils/logger.js';
import { delay } from './utils/delay.js';

interface DirScannerOrchestratorOptions {
  workerCount?: number;
  torHost?: string;
  torPort?: number;
  timeout?: number;
  pathDelay?: number;
}

const logger = createLogger({
  name: 'dirscanner-orchestrator',
  logFile: 'logs/dirscanner-orchestrator.log',
});

export class DirScannerOrchestrator {
  private readonly workers: DirScanWorker[];
  private readonly database: Database;
  private readonly workerCount: number;
  private readonly options: DirScannerOrchestratorOptions;
  private isRunning: boolean;

  constructor(options: DirScannerOrchestratorOptions = {}) {
    this.workerCount = options.workerCount ?? parseInt(process.env['DIRSCAN_WORKERS'] ?? '6', 10);
    this.options = options;
    this.workers = [];
    this.database = new Database();
    this.isRunning = false;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Dir scanner orchestrator already running');
      return;
    }

    this.isRunning = true;
    logger.info(`Starting dir scanner orchestrator with ${this.workerCount} workers`);

    // Clear stale locks from previous sessions
    const cleared = await this.database.clearAllLocks();
    if (cleared.domain > 0 || cleared.scan > 0 || cleared.dirscan > 0) {
      console.log(`Cleared stale locks: ${cleared.domain} domain, ${cleared.scan} scan, ${cleared.dirscan} dirscan`);
    }

    console.log('\n========================================');
    console.log('   ASHERAH DIRECTORY SCANNER');
    console.log('========================================');
    console.log(`Workers: ${this.workerCount}`);
    console.log(`Tor: ${this.options.torHost ?? '127.0.0.1'}:${this.options.torPort ?? 9050}`);
    console.log('========================================\n');

    // Populate dirscan queue from domains with confirmed HTTP
    const queuedCount = await this.database.populateDirscanQueueFromDomains(5000, 'standard');
    if (queuedCount > 0) {
      console.log(`Queued ${queuedCount} domains for directory scanning\n`);
    }

    // Create and start workers
    for (let i = 1; i <= this.workerCount; i++) {
      const workerId = `dirscan-worker-${i}`;
      const worker = new DirScanWorker(workerId, {
        torHost: this.options.torHost,
        torPort: this.options.torPort,
        timeout: this.options.timeout,
        pathDelay: this.options.pathDelay,
      }, this.database);
      this.workers.push(worker);
    }

    // Start all workers
    const workerPromises = this.workers.map((worker) => worker.start());

    // Start statistics reporter
    this.startStatsReporter();

    // Wait for all workers (they run indefinitely)
    await Promise.all(workerPromises);
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping dir scanner orchestrator');
    this.isRunning = false;

    // Stop all workers
    await Promise.all(this.workers.map((worker) => worker.stop()));

    // Close database
    await this.database.close();

    logger.info('Dir scanner orchestrator stopped');
  }

  private async startStatsReporter(): Promise<void> {
    while (this.isRunning) {
      await delay(60000); // Report every minute

      if (!this.isRunning) break;

      try {
        const stats = await this.database.getDirscannerStatistics();
        const workerStats = this.workers.map((w) => w.getStats());
        const activeWorkers = workerStats.filter((s) => s.isRunning).length;

        console.log('\n--- Dir Scanner Statistics ---');
        console.log(`Active Workers: ${activeWorkers}/${this.workerCount}`);
        console.log(`Queue Size: ${stats.queueSize}`);
        console.log(`Completed Scans: ${stats.totalScans}`);
        console.log(`Interesting Findings: ${stats.interestingFindings}`);
        console.log(`Scans (last hour): ${stats.recentScans}`);
        console.log('------------------------------\n');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Failed to get statistics', { error: errorMessage });
      }
    }
  }

  getStats(): {
    isRunning: boolean;
    workerCount: number;
    workers: Array<{ workerId: string; isRunning: boolean; uptime: number }>;
  } {
    return {
      isRunning: this.isRunning,
      workerCount: this.workerCount,
      workers: this.workers.map((w) => w.getStats()),
    };
  }
}

// CLI entry point
async function main(): Promise<void> {
  const orchestrator = new DirScannerOrchestrator({
    workerCount: parseInt(process.env['DIRSCAN_WORKERS'] ?? '3', 10),
    torHost: process.env['TOR_HOST'] ?? '127.0.0.1',
    torPort: parseInt(process.env['TOR_PORT'] ?? '9050', 10),
    timeout: parseInt(process.env['DIRSCAN_TIMEOUT'] ?? '30000', 10),
    pathDelay: parseInt(process.env['DIRSCAN_PATH_DELAY'] ?? '1000', 10),
  });

  // Handle shutdown signals
  process.on('SIGINT', async () => {
    console.log('\nReceived SIGINT, shutting down...');
    await orchestrator.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\nReceived SIGTERM, shutting down...');
    await orchestrator.stop();
    process.exit(0);
  });

  await orchestrator.start();
}

// Run if this is the main module
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
