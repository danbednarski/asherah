import { z } from 'zod';
export const DatabaseConfigSchema = z.object({
    host: z.string().default('localhost'),
    port: z.number().default(5432),
    database: z.string().default('onion_search'),
    user: z.string().optional(),
    password: z.string().default(''),
    max: z.number().default(20),
    idleTimeoutMillis: z.number().default(30000),
    connectionTimeoutMillis: z.number().default(10000),
});
export const TorConfigSchema = z.object({
    torHost: z.string().default('127.0.0.1'),
    torPort: z.number().default(9050),
    timeout: z.number().default(30000),
    userAgent: z.string().default('Mozilla/5.0 (Windows NT 10.0; rv:91.0) Gecko/20100101 Firefox/91.0'),
});
export const TorClientConfigSchema = TorConfigSchema.extend({
    retryAttempts: z.number().default(3),
    retryDelay: z.number().default(2000),
});
export const CrawlerWorkerConfigSchema = z.object({
    timeout: z.number().default(45000),
    retryAttempts: z.number().default(2),
    retryDelay: z.number().default(3000),
    crawlDelay: z.number().default(2000),
    maxContentSize: z.number().default(1024 * 1024), // 1MB
    database: DatabaseConfigSchema.optional(),
});
export const SearchEngineConfigSchema = z.object({
    workerCount: z.number().default(10),
    timeout: z.number().default(45000),
    retryAttempts: z.number().default(2),
    crawlDelay: z.number().default(2000),
    logLevel: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
    database: DatabaseConfigSchema.optional(),
});
export const ApiConfigSchema = z.object({
    port: z.number().default(3000),
    database: DatabaseConfigSchema.optional(),
});
//# sourceMappingURL=config.js.map