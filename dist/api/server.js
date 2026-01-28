import express from 'express';
import cors from 'cors';
import { Database } from '../database/database.js';
import { SearchQuerySchema, DomainQuerySchema, } from '../schemas/api.js';
import { getHTMLInterface, getDomainPageHTML, } from './templates.js';
export class OnionSearchAPI {
    app;
    port;
    database;
    server = null;
    constructor(options = {}) {
        this.app = express();
        this.port = options.port ?? 3000;
        this.database = new Database(options.database ?? {});
        this.setupMiddleware();
        this.setupRoutes();
    }
    setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
        this.app.use((req, _res, next) => {
            console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
            next();
        });
    }
    setupRoutes() {
        this.app.get('/', async (req, res) => {
            try {
                const queryParam = req.query['q'];
                const query = typeof queryParam === 'string' ? queryParam : '';
                const parseResult = SearchQuerySchema.safeParse(req.query);
                const limit = parseResult.success ? parseResult.data.limit : 50;
                const offset = parseResult.success ? parseResult.data.offset : 0;
                let searchResults = null;
                let parsedQuery = null;
                if (query) {
                    parsedQuery = this.parseQuery(query);
                    const dbResults = await this.database.searchCombined(parsedQuery.text, parsedQuery.header, parsedQuery.value, parsedQuery.title, limit, offset, parsedQuery.port);
                    searchResults = dbResults;
                }
                const stats = await this.getStats();
                res.send(getHTMLInterface(query, searchResults, parsedQuery, null, stats));
            }
            catch (error) {
                const queryParam = req.query['q'];
                const query = typeof queryParam === 'string' ? queryParam : '';
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                const stats = await this.getStats();
                res.send(getHTMLInterface(query, null, null, errorMessage, stats));
            }
        });
        this.app.get('/search', async (req, res) => {
            try {
                const queryParam = req.query['q'];
                const query = typeof queryParam === 'string' ? queryParam : '';
                if (!query) {
                    res.redirect('/?error=' + encodeURIComponent('Search query is required'));
                    return;
                }
                const limitParam = req.query['limit'];
                const offsetParam = req.query['offset'];
                const limit = typeof limitParam === 'string' ? limitParam : '50';
                const offset = typeof offsetParam === 'string' ? offsetParam : '0';
                res.redirect(`/?q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`);
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                res.redirect('/?error=' + encodeURIComponent(errorMessage));
            }
        });
        this.app.get('/stats', async (_req, res) => {
            try {
                const stats = await this.database.getStatistics();
                res.json(stats);
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                res.status(500).json({ error: errorMessage });
            }
        });
        this.app.get('/domain/:domain', async (req, res) => {
            try {
                const domain = req.params['domain'];
                if (!domain || !domain.endsWith('.onion')) {
                    res.redirect('/?error=' + encodeURIComponent('Valid onion domain required'));
                    return;
                }
                const domainInfo = await this.database.getDomainDetails(domain);
                if (!domainInfo) {
                    res.redirect('/?error=' + encodeURIComponent('Domain not found'));
                    return;
                }
                const queryResult = DomainQuerySchema.safeParse(req.query);
                const incomingPage = queryResult.success ? queryResult.data.incomingPage : 1;
                const outgoingPage = queryResult.success ? queryResult.data.outgoingPage : 1;
                const limit = queryResult.success ? queryResult.data.limit : 10;
                const incomingOffset = (incomingPage - 1) * limit;
                const outgoingOffset = (outgoingPage - 1) * limit;
                const [incomingLinks, outgoingLinks] = await Promise.all([
                    this.database.getIncomingLinks(domain, limit, incomingOffset),
                    this.database.getOutgoingLinks(domain, limit, outgoingOffset),
                ]);
                res.send(getDomainPageHTML(domainInfo, incomingLinks, outgoingLinks, { incomingPage, outgoingPage, limit }));
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                res.redirect('/?error=' + encodeURIComponent(errorMessage));
            }
        });
    }
    parseQuery(query) {
        const result = {
            text: null,
            header: null,
            value: null,
            title: null,
            port: null,
        };
        let remainingQuery = query;
        const titleMatch = remainingQuery.match(/title:\s*"([^"]+)"/i);
        if (titleMatch) {
            result.title = titleMatch[1].trim();
            remainingQuery = remainingQuery.replace(/title:\s*"[^"]+"/i, '').trim();
        }
        const httpMatch = remainingQuery.match(/http:\s*"([^"]+)"/i);
        if (httpMatch) {
            const headerContent = httpMatch[1];
            const colonIndex = headerContent.indexOf(':');
            if (colonIndex > 0) {
                result.header = headerContent.substring(0, colonIndex).trim();
                result.value = headerContent.substring(colonIndex + 1).trim();
            }
            else {
                result.header = headerContent.trim();
            }
            remainingQuery = remainingQuery.replace(/http:\s*"[^"]+"/i, '').trim();
        }
        // Parse port:1337 syntax
        const portMatch = remainingQuery.match(/port:\s*(\d+)/i);
        if (portMatch) {
            const portNum = parseInt(portMatch[1], 10);
            if (portNum > 0 && portNum <= 65535) {
                result.port = portNum;
            }
            remainingQuery = remainingQuery.replace(/port:\s*\d+/i, '').trim();
        }
        if (remainingQuery) {
            result.text = remainingQuery.trim();
        }
        if (!result.text)
            result.text = null;
        if (!result.header)
            result.header = null;
        if (!result.value)
            result.value = null;
        if (!result.title)
            result.title = null;
        return result;
    }
    async getStats() {
        try {
            return await this.database.getStatistics();
        }
        catch {
            return {
                totalDomains: 0,
                totalPages: 0,
                totalLinks: 0,
                queueSize: 0,
                activeCrawlers: 0,
                recentCrawls: 0,
                lockedDomains: 0,
                domainStatus: {},
            };
        }
    }
    async start() {
        return new Promise((resolve) => {
            this.server = this.app.listen(this.port, () => {
                console.log(`🌐 Onion Search API running on http://localhost:${this.port}`);
                console.log('📚 Available endpoints:');
                console.log('  GET / - Web interface (open in browser)');
                console.log('  GET /search?q=query - Search with tag support');
                console.log('  GET /stats - Crawler statistics');
                console.log('');
                console.log('🔍 Search examples:');
                console.log('  "bitcoin" - search text content');
                console.log('  "http:\\"server: nginx\\"" - search HTTP headers');
                console.log('  "marketplace http:\\"content-type: text\\"" - combined search');
                resolve();
            });
        });
    }
    async stop() {
        if (this.server) {
            this.server.close();
        }
        await this.database.close();
    }
}
//# sourceMappingURL=server.js.map