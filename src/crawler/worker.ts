import type { Logger } from 'winston';
import { TorClient } from '../tor/client.js';
import { LinkExtractor } from '../extraction/linkExtractor.js';
import { Database } from '../database/database.js';
import { createWorkerLogger } from '../utils/logger.js';
import { delay, randomDelay } from '../utils/delay.js';
import { extractOnionDomain } from '../utils/domain.js';
import type {
  CrawlerWorkerOptions,
  CrawlResult,
  QueueItem,
  TorSuccessResult,
  PageMetadata,
} from '../types/index.js';

// Error patterns that indicate the domain itself is unreachable (not just a specific URL)
const CONNECTION_FAILURE_PATTERNS = [
  'ECONNREFUSED',
  'ENOTFOUND',
  'ETIMEDOUT',
  'ECONNRESET',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'socket hang up',
  'connect ETIMEDOUT',
  'Socks5 proxy rejected connection',
  'General SOCKS server failure',
  'Host unreachable',
  'Connection refused',
  'Network is unreachable',
];

export class CrawlerWorker {
  private readonly workerId: string;
  private readonly torClient: TorClient;
  private readonly linkExtractor: LinkExtractor;
  private readonly database: Database;
  private readonly logger: Logger;
  private readonly crawlDelay: number;
  private readonly maxContentSize: number;
  private isRunning: boolean;
  private startTime: number | null;

  constructor(workerId: string, options: CrawlerWorkerOptions = {}) {
    this.workerId = workerId;
    this.torClient = new TorClient({
      timeout: options.timeout ?? 45000,
      retryAttempts: options.retryAttempts ?? 2,
      retryDelay: options.retryDelay ?? 3000,
    });
    this.linkExtractor = new LinkExtractor();
    this.database = new Database(options.database ?? {});
    this.isRunning = false;
    this.crawlDelay = options.crawlDelay ?? 2000;
    this.maxContentSize = options.maxContentSize ?? 1024 * 1024; // 1MB
    this.startTime = null;

    this.logger = createWorkerLogger(workerId);
  }

  async start(): Promise<void> {
    if (this.isRunning) return;

    this.isRunning = true;
    this.startTime = Date.now();
    this.logger.info('Worker started');

    while (this.isRunning) {
      try {
        await this.crawlBatch();
        await delay(this.crawlDelay);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error('Worker batch error', { error: errorMessage });
        await delay(this.crawlDelay * 2);
      }
    }

    this.logger.info('Worker stopped');
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    await this.database.close();
    this.logger.info('Worker shutdown complete');
  }

  private async crawlBatch(): Promise<void> {
    const urls = await this.database.getNextUrls(this.workerId, 3);

    if (urls.length === 0) {
      this.logger.debug('No URLs to crawl, waiting...');
      return;
    }

    for (const urlData of urls) {
      if (!this.isRunning) break;

      await this.processUrl(urlData);

      if (this.isRunning) {
        await randomDelay(500, 1500);
      }
    }
  }

  private async processUrl(urlData: QueueItem): Promise<void> {
    const { domain } = urlData;
    const shortDomain = domain.substring(0, 15) + '...onion';
    let lockAcquired = false;

    console.log(`\n🎯 [${this.workerId}] SNAGGED: ${shortDomain}`);
    console.log(`   📄 URL: ${urlData.url}`);
    console.log(`   🔢 Priority: ${urlData.priority} | Attempts: ${urlData.attempts}`);

    try {
      lockAcquired = await this.database.acquireDomainLock(domain, this.workerId);

      if (!lockAcquired) {
        console.log(`   ⏭️  Domain locked by another worker, returning to queue\n`);
        await this.database.query(
          "UPDATE crawl_queue SET status = 'pending', worker_id = NULL WHERE url = $1",
          [urlData.url]
        );
        return;
      }

      console.log(`   🔒 Lock acquired, starting crawl...`);

      await this.database.updateDomainStatus(domain, 'crawling', this.workerId);

      const crawlResult = await this.crawlUrl(urlData.url);
      await this.database.markUrlCompleted(urlData.url, true);

      const isHttpError = crawlResult.statusCode >= 400;
      if (isHttpError) {
        console.log(`   ⚠️  HTTP ${crawlResult.statusCode} (saved content anyway)`);
      } else {
        console.log(`   ✅ SUCCESS! (${crawlResult.statusCode})`);
      }
      console.log(`   🔗 Found ${crawlResult.newLinksCount} new links from elements`);
      if (crawlResult.textExtractedCount > 0) {
        console.log(`   📝 Found ${crawlResult.textExtractedCount} domains in text`);
      }
      const truncatedNote = crawlResult.truncated ? ' (truncated)' : '';
      console.log(`   📊 Content: ${crawlResult.contentLength} chars${truncatedNote}`);
      console.log(`   ⏱️  Time: ${crawlResult.responseTime}ms\n`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.log(`   ❌ FAILED: ${errorMessage}`);

      // Check if this is a connection failure (domain unreachable) vs HTTP error
      const isConnectionFailure = this.isConnectionFailure(errorMessage);

      if (isConnectionFailure) {
        // Mark ALL pending URLs for this domain as failed
        const markedCount = await this.database.markDomainConnectionFailed(domain, errorMessage);
        console.log(`   🚫 DOMAIN UNREACHABLE - marked ${markedCount} URLs for ${shortDomain} as failed\n`);
        await this.database.logCrawl(urlData.url, 'error', null, null, null, `Domain connection failure: ${errorMessage}`, this.workerId);
      } else {
        // Regular HTTP error (404, 500, etc.) - just mark this URL
        console.log(`   🔄 Will retry later\n`);
        await this.database.markUrlCompleted(urlData.url, false, errorMessage);
        await this.database.logCrawl(urlData.url, 'error', null, null, null, errorMessage, this.workerId);
      }
    } finally {
      if (lockAcquired) {
        await this.database.releaseDomainLock(domain, this.workerId);
        await this.database.updateDomainStatus(domain, 'completed', null);
      }
    }
  }

  private async crawlUrl(url: string): Promise<CrawlResult> {
    const startTime = Date.now();

    const result = await this.torClient.get(url, {
      maxContentLength: this.maxContentSize,
      responseType: 'text',
    });

    const responseTime = Date.now() - startTime;

    if (!result.success) {
      throw new Error(result.error);
    }

    const successResult = result as TorSuccessResult;
    const contentType = successResult.headers['content-type'] ?? '';
    const isHtml = contentType.includes('text/html');
    const isSuccessStatus = successResult.status >= 200 && successResult.status < 400;

    await this.database.logCrawl(
      url,
      'success',
      successResult.status,
      responseTime,
      successResult.data?.length ?? 0,
      null,
      this.workerId
    );

    const domain = extractOnionDomain(url);
    if (!domain) {
      throw new Error('Invalid onion domain');
    }

    let extractedData = {
      links: [] as ReturnType<LinkExtractor['extractFromHtml']>['links'],
      onionLinks: [] as ReturnType<LinkExtractor['extractFromHtml']>['onionLinks'],
      onionDomains: [] as string[],
    };
    let metadata: PageMetadata;
    let newLinksCount = 0;
    let textExtractedCount = 0;

    if (isHtml) {
      // Extract links and metadata from any HTML response, even error pages (404s often have nav links)
      extractedData = this.linkExtractor.extractFromHtml(successResult.data, url);
      metadata = this.linkExtractor.extractPageMetadata(successResult.data, url);
      // Prefix title with status code for error responses
      if (!isSuccessStatus) {
        metadata.title = `[${successResult.status}] ${metadata.title}`;
      }
    } else {
      metadata = {
        title: isSuccessStatus ? `${contentType} - ${url}` : `HTTP ${successResult.status} - ${url}`,
        contentText: successResult.data ? successResult.data.substring(0, 1000) : `HTTP ${successResult.status} response`,
        metaDescription: `Status: ${successResult.status}, Content-Type: ${contentType}`,
        language: '',
        h1Tags: [],
        path: new URL(url).pathname,
      };
    }

    await this.database.transaction(async () => {
      const domainResult = await this.database.upsertDomain(domain, metadata.title, metadata.metaDescription);

      const pageData = {
        title: metadata.title,
        contentText: metadata.contentText,
        contentHtml: successResult.data && successResult.data.length < 100000 ? successResult.data : null,
        statusCode: successResult.status,
        contentLength: successResult.data ? successResult.data.length : 0,
        contentType,
        language: metadata.language,
        metaDescription: metadata.metaDescription,
        h1Tags: metadata.h1Tags,
        path: metadata.path,
      };

      const pageResult = await this.database.upsertPage(domainResult.id, url, pageData);

      if (extractedData.links.length > 0) {
        await this.database.insertLinks(pageResult.id, extractedData.links);
      }

      if (successResult.headers) {
        await this.database.insertHeaders(pageResult.id, successResult.headers);
      }

      if (isHtml) {
        // Queue URLs found in HTML elements (a, img, script, etc.)
        // We do this for error pages too - 404s often have navigation links
        const { newUrls } = this.linkExtractor.findNewUrls(extractedData.onionLinks);
        if (newUrls.length > 0) {
          const prioritizedUrls = this.linkExtractor.prioritizeUrls(newUrls);
          // Lower priority for links from error pages
          const priority = isSuccessStatus ? 100 : 150;
          await this.database.addToCrawlQueue(prioritizedUrls, priority);
          newLinksCount = newUrls.length;
        }

        // Queue base URLs for domains found only in raw text (not in HTML elements)
        // These are potentially valuable discoveries mentioned in content/comments
        const domainsFromElements = new Set(extractedData.onionLinks.map((link) => link.targetDomain).filter(Boolean));
        const textOnlyDomains = extractedData.onionDomains.filter((d) => !domainsFromElements.has(d));

        if (textOnlyDomains.length > 0) {
          // Convert domains to base URLs and queue with higher priority (lower number = higher priority)
          const textExtractedUrls = textOnlyDomains.map((d) => `http://${d}/`);
          await this.database.addToCrawlQueue(textExtractedUrls, 50);
          textExtractedCount = textOnlyDomains.length;
        }

        // Queue all discovered domains for port scanning
        const allDiscoveredDomains = new Set([
          ...Array.from(domainsFromElements).filter((d): d is string => d !== null),
          ...textOnlyDomains,
        ]);
        for (const discoveredDomain of allDiscoveredDomains) {
          await this.database.queueDomainForScan(discoveredDomain, 100);
        }
      }
    });

    const crawlResult: CrawlResult = {
      responseTime,
      contentLength: successResult.data ? successResult.data.length : 0,
      newLinksCount,
      textExtractedCount,
      totalLinksFound: extractedData.links.length,
      onionLinksFound: extractedData.onionLinks.length,
      statusCode: successResult.status,
    };

    if (successResult.truncated) {
      crawlResult.truncated = true;
    }

    return crawlResult;
  }

  getStats(): { workerId: string; isRunning: boolean; uptime: number } {
    return {
      workerId: this.workerId,
      isRunning: this.isRunning,
      uptime: this.startTime ? Date.now() - this.startTime : 0,
    };
  }

  private isConnectionFailure(errorMessage: string): boolean {
    const lowerError = errorMessage.toLowerCase();
    return CONNECTION_FAILURE_PATTERNS.some((pattern) =>
      lowerError.includes(pattern.toLowerCase())
    );
  }
}
