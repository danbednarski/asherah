const CrawlerWorker = require('./crawlerWorker');
const Database = require('./database');
const winston = require('winston');
const fs = require('fs').promises;
const path = require('path');

class OnionSearchEngine {
    constructor(options = {}) {
        this.workers = [];
        this.workerCount = options.workerCount || 10;
        this.database = new Database(options.database || {});
        
        this.logger = winston.createLogger({
            level: options.logLevel || 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.printf(({ timestamp, level, message, meta }) => {
                    return `${timestamp} ${level.toUpperCase()} [ORCHESTRATOR] ${message} ${meta ? JSON.stringify(meta) : ''}`;
                })
            ),
            transports: [
                new winston.transports.Console(),
                new winston.transports.File({ 
                    filename: 'logs/orchestrator.log',
                    maxsize: 10485760,
                    maxFiles: 5
                })
            ]
        });
        
        this.isRunning = false;
        this.statsInterval = null;
        this.options = options;
    }

    async initialize() {
        await this.ensureLogsDirectory();
        await this.initializeDatabase();
        this.logger.info('Search engine initialized');
    }

    async ensureLogsDirectory() {
        try {
            await fs.mkdir('logs', { recursive: true });
        } catch (error) {
            // Directory already exists
        }
    }

    async initializeDatabase() {
        try {
            // Check if tables already exist
            const result = await this.database.query(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_name = 'domains'
            `);
            
            if (result.rows.length === 0) {
                const schemaPath = path.join(__dirname, 'schema.sql');
                const schema = await fs.readFile(schemaPath, 'utf8');
                await this.database.query(schema);
                this.logger.info('Database schema initialized');
            } else {
                this.logger.info('Database schema already exists');
            }
        } catch (error) {
            this.logger.error('Failed to initialize database', { error: error.message });
            throw error;
        }
    }

    async addSeedUrls(urls) {
        if (!Array.isArray(urls)) urls = [urls];
        await this.database.addToCrawlQueue(urls, 1); // High priority for seed URLs
        this.logger.info(`Added ${urls.length} seed URLs to crawl queue`);
    }

    async start() {
        if (this.isRunning) {
            this.logger.warn('Search engine is already running');
            return;
        }

        this.isRunning = true;
        this.logger.info(`Starting ${this.workerCount} crawler workers`);

        // Start workers
        for (let i = 0; i < this.workerCount; i++) {
            const workerId = `worker-${i + 1}`;
            const worker = new CrawlerWorker(workerId, this.options);
            this.workers.push(worker);
            
            // Start worker in background
            worker.start().catch(error => {
                this.logger.error(`Worker ${workerId} crashed`, { error: error.message });
            });
        }

        // Start less frequent statistics reporting  
        this.statsInterval = setInterval(() => {
            this.reportStatistics().catch(error => {
                this.logger.error('Failed to report statistics', { error: error.message });
            });
        }, 120000); // Every 2 minutes

        this.logger.info('Search engine started successfully');
    }

    async stop() {
        if (!this.isRunning) return;

        this.isRunning = false;
        this.logger.info('Stopping search engine...');

        // Clear stats interval
        if (this.statsInterval) {
            clearInterval(this.statsInterval);
            this.statsInterval = null;
        }

        // Stop all workers
        await Promise.all(this.workers.map(worker => worker.stop()));
        this.workers = [];

        // Close database
        await this.database.close();
        
        this.logger.info('Search engine stopped');
    }

    async reportStatistics() {
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
            
            // Show domain status breakdown
            if (stats.domainStatus) {
                console.log('\n🏷️  Domain Status:');
                Object.entries(stats.domainStatus).forEach(([status, count]) => {
                    const emoji = {
                        'pending': '⏳',
                        'crawling': '🔄',
                        'completed': '✅',
                        'failed': '❌'
                    };
                    console.log(`   ${emoji[status] || '📝'} ${status}: ${count}`);
                });
            }
            console.log('=============================\n');
            
            return stats;
        } catch (error) {
            this.logger.error('Failed to get statistics', { error: error.message });
            return null;
        }
    }

    async getSearchResults(query, options = {}) {
        const limit = options.limit || 50;
        const offset = options.offset || 0;
        
        const searchQuery = `
            SELECT 
                p.url, p.title, p.content_text, p.meta_description,
                d.domain, p.last_crawled, p.status_code
            FROM pages p
            JOIN domains d ON p.domain_id = d.id
            WHERE 
                p.is_accessible = true
                AND (p.title ILIKE $1 OR p.content_text ILIKE $1 OR p.meta_description ILIKE $1)
            ORDER BY p.last_crawled DESC
            LIMIT $2 OFFSET $3
        `;
        
        const result = await this.database.query(searchQuery, [`%${query}%`, limit, offset]);
        return result.rows;
    }

    async getDomainInfo(domain) {
        const query = `
            SELECT d.*, COUNT(p.id) as page_count
            FROM domains d
            LEFT JOIN pages p ON d.id = p.domain_id
            WHERE d.domain = $1
            GROUP BY d.id
        `;
        
        const result = await this.database.query(query, [domain]);
        return result.rows[0] || null;
    }

    async exportData(format = 'json') {
        const stats = await this.database.getStatistics();
        const timestamp = new Date().toISOString();
        
        switch (format.toLowerCase()) {
            case 'json':
                return JSON.stringify({
                    exportedAt: timestamp,
                    statistics: stats,
                    version: '1.0.0'
                }, null, 2);
            
            default:
                throw new Error('Unsupported export format');
        }
    }
}

async function main() {
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
        database: {
            // Add your PostgreSQL config here
            // host: 'localhost',
            // port: 5432,
            // database: 'onion_search',
            // user: 'postgres',
            // password: 'your_password'
        }
    });

    console.log('🧅 Onion Search Engine');
    console.log('======================');
    console.log(`Seed URLs: ${seedUrls.length} URLs`);
    seedUrls.forEach(url => console.log(`  - ${url}`));
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
        
        // Handle graceful shutdown
        process.on('SIGINT', async () => {
            console.log('\n🛑 Shutting down search engine...');
            await searchEngine.stop();
            process.exit(0);
        });
        
        // Keep the process alive
        await new Promise(() => {});
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        
        if (error.message.includes('database') || error.message.includes('connection')) {
            console.log('\n📋 Setup Requirements:');
            console.log('1. Install and start PostgreSQL');
            console.log('2. Create database: createdb onion_search');
            console.log('3. Update database config in the code if needed');
            console.log('4. Install and start Tor (localhost:9050)');
            console.log('5. Re-run this script');
        } else if (error.message.includes('Tor is not running')) {
            console.log('\n🔧 Tor Setup:');
            console.log('1. Install Tor browser or Tor daemon');
            console.log('2. Start Tor (it should run on localhost:9050)');
            console.log('3. Re-run this script');
        }
        
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { OnionSearchEngine, CrawlerWorker, Database };