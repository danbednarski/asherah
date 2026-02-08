import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { CrawlerWorker } from './crawler/worker.js';
import { Database } from './database/database.js';
import { WriteBuffer } from './database/write-buffer.js';
import { QueueManager } from './database/queue-manager.js';
import { createLogger } from './utils/logger.js';
import type { CrawlerWorkerOptions, CrawlerStatistics } from './types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface SearchEngineOptions extends CrawlerWorkerOptions {
  workerCount?: number;
  logLevel?: string;
}

class OnionSearchEngine {
  private workers: CrawlerWorker[] = [];
  private readonly workerCount: number;
  private readonly database: Database;
  private readonly writeBuffer: WriteBuffer;
  private readonly queueManager: QueueManager;
  private readonly logger: ReturnType<typeof createLogger>;
  private isRunning = false;
  private statsInterval: ReturnType<typeof setInterval> | null = null;
  private readonly options: SearchEngineOptions;

  constructor(options: SearchEngineOptions = {}) {
    this.workerCount = options.workerCount ?? 10;
    this.database = new Database({ ...(options.database ?? {}), max: 30 });
    this.writeBuffer = new WriteBuffer(this.database, { flushIntervalMs: 2000, maxBufferSize: 50 });
    this.queueManager = new QueueManager(this.database, { fetchIntervalMs: 5000, batchSize: 50, lowWaterMark: 10 });
    this.options = options;

    this.logger = createLogger({
      level: options.logLevel ?? 'info',
      name: 'ORCHESTRATOR',
      logFile: 'logs/orchestrator.log',
    });
  }

  async initialize(): Promise<void> {
    await this.ensureLogsDirectory();
    await this.initializeDatabase();
    this.logger.info('Search engine initialized');
  }

  private async ensureLogsDirectory(): Promise<void> {
    try {
      await fs.mkdir('logs', { recursive: true });
    } catch {
      // Directory already exists
    }
  }

  private async initializeDatabase(): Promise<void> {
    try {
      const result = await this.database.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'domains'
      `);

      if (result.rows.length === 0) {
        const schemaPath = path.join(__dirname, '..', 'schema.sql');
        const schema = await fs.readFile(schemaPath, 'utf8');
        await this.database.query(schema);
        this.logger.info('Database schema initialized');
      } else {
        this.logger.info('Database schema already exists');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to initialize database', { error: errorMessage });
      throw error;
    }
  }

  async addSeedUrls(urls: string | string[]): Promise<void> {
    const urlArray = Array.isArray(urls) ? urls : [urls];
    await this.database.addToCrawlQueue(urlArray, 1);
    this.logger.info(`Added ${urlArray.length} seed URLs to crawl queue`);
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Search engine is already running');
      return;
    }

    this.isRunning = true;

    // Clear stale locks from previous sessions
    const cleared = await this.database.clearAllLocks();
    if (cleared.domain > 0 || cleared.scan > 0 || cleared.dirscan > 0) {
      this.logger.info(`Cleared stale locks: ${cleared.domain} domain, ${cleared.scan} scan, ${cleared.dirscan} dirscan`);
    }

    this.writeBuffer.start();
    this.queueManager.start();

    this.logger.info(`Starting ${this.workerCount} crawler workers`);

    for (let i = 0; i < this.workerCount; i++) {
      const workerId = `worker-${i + 1}`;
      const worker = new CrawlerWorker(workerId, this.options, this.database, this.writeBuffer, this.queueManager);
      this.workers.push(worker);

      worker.start().catch((error) => {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`Worker ${workerId} crashed`, { error: errorMessage });
      });
    }

    this.statsInterval = setInterval(() => {
      this.reportStatistics().catch((error) => {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error('Failed to report statistics', { error: errorMessage });
      });
    }, 120000);

    this.logger.info('Search engine started successfully');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.isRunning = false;
    this.logger.info('Stopping search engine...');

    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }

    await Promise.all(this.workers.map((worker) => worker.stop()));
    this.workers = [];

    this.queueManager.stop();
    await this.writeBuffer.stop();
    await this.database.close();

    this.logger.info('Search engine stopped');
  }

  async reportStatistics(): Promise<CrawlerStatistics | null> {
    try {
      const stats = await this.database.getStatistics();

      console.log('\n📊 === CRAWLER STATISTICS ===');
      console.log(`🌐 Domains discovered: ${stats.totalDomains}`);
      console.log(`📄 Pages crawled: ${stats.totalPages}`);
      console.log(`🔗 Links found: ${stats.totalLinks}`);
      console.log(`⏳ Queue pending: ${stats.queueSize}`);
      console.log(`🤖 Active workers: ${stats.activeCrawlers}`);
      console.log(`🔒 Locked domains: ${stats.lockedDomains}`);
      console.log(`📈 Recent crawls (1h): ${stats.recentCrawls}`);

      if (stats.domainStatus) {
        console.log('\n🏷️  Domain Status:');
        const emojiMap: Record<string, string> = {
          pending: '⏳',
          crawling: '🔄',
          completed: '✅',
          failed: '❌',
        };
        for (const [status, count] of Object.entries(stats.domainStatus)) {
          const emoji = emojiMap[status] ?? '📝';
          console.log(`   ${emoji} ${status}: ${count}`);
        }
      }
      console.log('=============================\n');

      return stats;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to get statistics', { error: errorMessage });
      return null;
    }
  }

}

async function main(): Promise<void> {
  const seedUrls = [
    'http://darkfailenbsdla5mal2mxn2uz66od5vtzd5qozslagrfzachha3f3id.onion/',
    'http://tortaxi2dev6xjwbaydqzla77rrnth7yn2oqzjfmiuwn5h6vsk2a4syd.onion/',
  ];

  const searchEngine = new OnionSearchEngine({
    workerCount: 10,
    timeout: 45000,
    retryAttempts: 2,
    crawlDelay: 2000,
    logLevel: 'info',
    database: {},
  });

  console.log('🧅 Onion Search Engine');
  console.log('======================');
  console.log(`Seed URLs: ${seedUrls.length} URLs`);
  for (const url of seedUrls) {
    console.log(`  - ${url}`);
  }
  console.log('');

  try {
    console.log('Initializing search engine...');
    await searchEngine.initialize();

    console.log('Adding seed URLs to crawl queue...');
    await searchEngine.addSeedUrls(seedUrls);

    console.log('Starting crawler workers...');
    await searchEngine.start();

    console.log('\n✅ Search engine is now running!');
    console.log('🎯 Workers will report real-time activity as they crawl');
    console.log('📊 Summary statistics every 2 minutes');
    console.log('⏹️  Press Ctrl+C to stop\n');

    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down search engine...');
      await searchEngine.stop();
      process.exit(0);
    });

    await new Promise(() => {});
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Error:', errorMessage);

    if (errorMessage.includes('database') || errorMessage.includes('connection')) {
      console.log('\n📋 Setup Requirements:');
      console.log('1. Install and start PostgreSQL');
      console.log('2. Create database: createdb onion_search');
      console.log('3. Update database config in the code if needed');
      console.log('4. Install and start Tor (localhost:9050)');
      console.log('5. Re-run this script');
    } else if (errorMessage.includes('Tor is not running')) {
      console.log('\n🔧 Tor Setup:');
      console.log('1. Install Tor browser or Tor daemon');
      console.log('2. Start Tor (it should run on localhost:9050)');
      console.log('3. Re-run this script');
    }

    process.exit(1);
  }
}

main();

export { OnionSearchEngine, CrawlerWorker, Database };
