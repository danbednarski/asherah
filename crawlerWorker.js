const TorClient = require('./torClient');
const LinkExtractor = require('./linkExtractor');
const Database = require('./database');
const winston = require('winston');

class CrawlerWorker {
    constructor(workerId, options = {}) {
        this.workerId = workerId;
        this.torClient = new TorClient({
            timeout: options.timeout || 45000,
            retryAttempts: options.retryAttempts || 2,
            retryDelay: options.retryDelay || 3000
        });
        this.linkExtractor = new LinkExtractor();
        this.database = new Database(options.database || {});
        this.isRunning = false;
        this.crawlDelay = options.crawlDelay || 2000;
        this.maxContentSize = options.maxContentSize || 1024 * 1024; // 1MB
        
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.printf(({ timestamp, level, message, workerId, url, error }) => {
                    const workerTag = workerId ? `[${workerId}]` : '';
                    const urlTag = url ? `[${url}]` : '';
                    const errorTag = error ? `ERROR: ${error}` : '';
                    return `${timestamp} ${level.toUpperCase()} ${workerTag} ${urlTag} ${message} ${errorTag}`.trim();
                })
            ),
            defaultMeta: { workerId: this.workerId },
            transports: [
                new winston.transports.Console(),
                new winston.transports.File({ 
                    filename: `logs/crawler-${workerId}.log`,
                    maxsize: 10485760, // 10MB
                    maxFiles: 5
                })
            ]
        });
    }

    async start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.logger.info('Worker started');
        
        while (this.isRunning) {
            try {
                await this.crawlBatch();
                await this.delay(this.crawlDelay);
            } catch (error) {
                this.logger.error('Worker batch error', { error: error.message });
                await this.delay(this.crawlDelay * 2);
            }
        }
        
        this.logger.info('Worker stopped');
    }

    async stop() {
        this.isRunning = false;
        await this.database.close();
        this.logger.info('Worker shutdown complete');
    }

    async crawlBatch() {
        const urls = await this.database.getNextUrls(this.workerId, 3); // Reduced batch size for better domain distribution
        
        if (urls.length === 0) {
            this.logger.debug('No URLs to crawl, waiting...');
            return;
        }

        for (const urlData of urls) {
            if (!this.isRunning) break;
            
            const domain = urlData.domain;
            const shortDomain = domain.substring(0, 15) + '...onion';
            let lockAcquired = false;
            
            // 🎯 SNAGGED URL REPORT
            console.log(`\n🎯 [${this.workerId}] SNAGGED: ${shortDomain}`);
            console.log(`   📄 URL: ${urlData.url}`);
            console.log(`   🔢 Priority: ${urlData.priority} | Attempts: ${urlData.attempts}`);
            
            try {
                // Try to acquire domain lock
                lockAcquired = await this.database.acquireDomainLock(domain, this.workerId);
                
                if (!lockAcquired) {
                    console.log(`   ⏭️  Domain locked by another worker, returning to queue\n`);
                    // Don't mark as failed, just put back in queue for later
                    await this.database.query(
                        'UPDATE crawl_queue SET status = \'pending\', worker_id = NULL WHERE url = $1', 
                        [urlData.url]
                    );
                    continue;
                }

                console.log(`   🔒 Lock acquired, starting crawl...`);
                
                // Update domain status
                await this.database.updateDomainStatus(domain, 'crawling', this.workerId);
                
                const crawlResult = await this.crawlUrl(urlData.url);
                await this.database.markUrlCompleted(urlData.url, true);
                
                
                // 🎉 SUCCESS REPORT
                console.log(`   ✅ SUCCESS!`);
                console.log(`   🔗 Found ${crawlResult.newLinksCount || 0} new links`);
                console.log(`   📊 Content: ${crawlResult.contentLength || 0} chars`);
                console.log(`   ⏱️  Time: ${crawlResult.responseTime || 0}ms\n`);
                
            } catch (error) {
                // ❌ FAILURE REPORT
                console.log(`   ❌ FAILED: ${error.message}`);
                console.log(`   🔄 Will retry later\n`);
                
                
                await this.database.markUrlCompleted(urlData.url, false, error.message);
                await this.database.logCrawl(
                    urlData.url, 'error', null, null, null, error.message, this.workerId
                );
            } finally {
                // Always release the domain lock
                if (lockAcquired) {
                    await this.database.releaseDomainLock(domain, this.workerId);
                    await this.database.updateDomainStatus(domain, 'completed', null);
                }
            }
            
            if (this.isRunning) {
                await this.delay(Math.random() * 1000 + 500);
            }
        }
    }

    async crawlUrl(url) {
        const startTime = Date.now();

        const result = await this.torClient.get(url, {
            maxContentLength: this.maxContentSize,
            responseType: 'text'
        });

        const responseTime = Date.now() - startTime;

        if (!result.success) {
            throw new Error(result.error);
        }

        const contentType = result.headers['content-type'] || '';
        const isHtml = contentType.includes('text/html');
        const isSuccessStatus = result.status >= 200 && result.status < 400;

        // Log the crawl result - all HTTP responses are considered successful crawls
        await this.database.logCrawl(
            url, 'success', result.status, responseTime, 
            result.data?.length || 0, null, this.workerId
        );

        const domain = this.linkExtractor.extractOnionDomain(url);
        if (!domain) {
            throw new Error('Invalid onion domain');
        }

        let extractedData = { links: [], onionLinks: [] };
        let metadata = {};
        let newLinksCount = 0;

        // Only do HTML processing for successful HTML responses
        if (isSuccessStatus && isHtml) {
            extractedData = this.linkExtractor.extractFromHtml(result.data, url);
            metadata = this.linkExtractor.extractPageMetadata(result.data, url);
        } else {
            // For error responses or non-HTML, create basic metadata
            metadata = {
                title: isSuccessStatus ? `${contentType} - ${url}` : `HTTP ${result.status} - ${url}`,
                contentText: result.data ? result.data.substring(0, 1000) : `HTTP ${result.status} response`,
                metaDescription: `Status: ${result.status}, Content-Type: ${contentType}`,
                language: null,
                h1Tags: [],
                path: new URL(url).pathname
            };
        }

        await this.database.transaction(async (client) => {
            const domainResult = await this.database.upsertDomain(
                domain, metadata.title, metadata.metaDescription
            );

            const pageData = {
                title: metadata.title,
                contentText: metadata.contentText,
                contentHtml: result.data && result.data.length < 100000 ? result.data : null,
                statusCode: result.status,
                contentLength: result.data ? result.data.length : 0,
                contentType: contentType,
                language: metadata.language,
                metaDescription: metadata.metaDescription,
                h1Tags: metadata.h1Tags,
                path: metadata.path
            };

            const pageResult = await this.database.upsertPage(
                domainResult.id, url, pageData
            );

            // Save links only for successful HTML responses
            if (extractedData.links.length > 0) {
                await this.database.insertLinks(pageResult.id, extractedData.links);
            }

            // Always save headers (valuable for all response types)
            if (result.headers) {
                await this.database.insertHeaders(pageResult.id, result.headers);
            }

            // Only add new URLs to crawl queue for successful HTML responses
            if (isSuccessStatus && isHtml) {
                const { newUrls } = this.linkExtractor.findNewUrls(extractedData.onionLinks);
                if (newUrls.length > 0) {
                    const prioritizedUrls = this.linkExtractor.prioritizeUrls(newUrls);
                    await this.database.addToCrawlQueue(prioritizedUrls, 100);
                    newLinksCount = newUrls.length;
                }
            }
        });

        // Return data for success reporting
        return {
            responseTime,
            contentLength: result.data ? result.data.length : 0,
            newLinksCount,
            totalLinksFound: extractedData.links.length,
            onionLinksFound: extractedData.onionLinks.length
        };
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async getStats() {
        return {
            workerId: this.workerId,
            isRunning: this.isRunning,
            uptime: this.startTime ? Date.now() - this.startTime : 0
        };
    }
}

module.exports = CrawlerWorker;