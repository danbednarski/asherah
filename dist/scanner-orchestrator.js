import { PortScanWorker } from './scanner/index.js';
import { Database } from './database/database.js';
import { createLogger } from './utils/logger.js';
import { delay } from './utils/delay.js';
const logger = createLogger({
    name: 'scanner-orchestrator',
    logFile: 'logs/scanner-orchestrator.log',
});
export class ScannerOrchestrator {
    workers;
    database;
    workerCount;
    options;
    isRunning;
    constructor(options = {}) {
        this.workerCount = options.workerCount ?? parseInt(process.env['SCANNER_WORKERS'] ?? '3', 10);
        this.options = options;
        this.workers = [];
        this.database = new Database();
        this.isRunning = false;
    }
    async start() {
        if (this.isRunning) {
            logger.warn('Scanner orchestrator already running');
            return;
        }
        this.isRunning = true;
        logger.info(`Starting scanner orchestrator with ${this.workerCount} workers`);
        console.log('\n========================================');
        console.log('   ASHERAH PORT SCANNER');
        console.log('========================================');
        console.log(`Workers: ${this.workerCount}`);
        console.log(`Tor: ${this.options.torHost ?? '127.0.0.1'}:${this.options.torPort ?? 9050}`);
        console.log('========================================\n');
        // Populate scan queue from existing domains
        const queuedCount = await this.database.populateScanQueueFromDomains(5000, 'standard');
        if (queuedCount > 0) {
            console.log(`Queued ${queuedCount} existing domains for scanning\n`);
        }
        // Create and start workers
        for (let i = 1; i <= this.workerCount; i++) {
            const workerId = `scanner-worker-${i}`;
            const worker = new PortScanWorker(workerId, {
                torHost: this.options.torHost,
                torPort: this.options.torPort,
                timeout: this.options.timeout,
                maxConcurrent: this.options.maxConcurrent,
                minProbeDelay: this.options.minProbeDelay,
            });
            this.workers.push(worker);
        }
        // Start all workers
        const workerPromises = this.workers.map((worker) => worker.start());
        // Start statistics reporter
        this.startStatsReporter();
        // Wait for all workers (they run indefinitely)
        await Promise.all(workerPromises);
    }
    async stop() {
        if (!this.isRunning) {
            return;
        }
        logger.info('Stopping scanner orchestrator');
        this.isRunning = false;
        // Stop all workers
        await Promise.all(this.workers.map((worker) => worker.stop()));
        // Close database
        await this.database.close();
        logger.info('Scanner orchestrator stopped');
    }
    async startStatsReporter() {
        while (this.isRunning) {
            await delay(60000); // Report every minute
            if (!this.isRunning)
                break;
            try {
                const stats = await this.database.getScannerStatistics();
                const workerStats = this.workers.map((w) => w.getStats());
                const activeWorkers = workerStats.filter((s) => s.isRunning).length;
                console.log('\n--- Scanner Statistics ---');
                console.log(`Active Workers: ${activeWorkers}/${this.workerCount}`);
                console.log(`Queue Size: ${stats.queueSize}`);
                console.log(`Completed Scans: ${stats.totalScans}`);
                console.log(`Open Ports Found: ${stats.openPorts}`);
                console.log(`Services Detected: ${stats.servicesDetected}`);
                console.log(`Scans (last hour): ${stats.recentScans}`);
                console.log('--------------------------\n');
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                logger.error('Failed to get statistics', { error: errorMessage });
            }
        }
    }
    getStats() {
        return {
            isRunning: this.isRunning,
            workerCount: this.workerCount,
            workers: this.workers.map((w) => w.getStats()),
        };
    }
}
// CLI entry point
async function main() {
    const orchestrator = new ScannerOrchestrator({
        workerCount: parseInt(process.env['SCANNER_WORKERS'] ?? '3', 10),
        torHost: process.env['TOR_HOST'] ?? '127.0.0.1',
        torPort: parseInt(process.env['TOR_PORT'] ?? '9050', 10),
        timeout: parseInt(process.env['SCANNER_TIMEOUT'] ?? '30000', 10),
        maxConcurrent: parseInt(process.env['SCANNER_MAX_CONCURRENT'] ?? '5', 10),
        minProbeDelay: parseInt(process.env['SCANNER_PROBE_DELAY'] ?? '200', 10),
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
//# sourceMappingURL=scanner-orchestrator.js.map