import { z } from 'zod';
export declare const DatabaseConfigSchema: z.ZodObject<{
    host: z.ZodDefault<z.ZodString>;
    port: z.ZodDefault<z.ZodNumber>;
    database: z.ZodDefault<z.ZodString>;
    user: z.ZodOptional<z.ZodString>;
    password: z.ZodDefault<z.ZodString>;
    max: z.ZodDefault<z.ZodNumber>;
    idleTimeoutMillis: z.ZodDefault<z.ZodNumber>;
    connectionTimeoutMillis: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    host: string;
    port: number;
    database: string;
    password: string;
    max: number;
    idleTimeoutMillis: number;
    connectionTimeoutMillis: number;
    user?: string | undefined;
}, {
    host?: string | undefined;
    port?: number | undefined;
    database?: string | undefined;
    user?: string | undefined;
    password?: string | undefined;
    max?: number | undefined;
    idleTimeoutMillis?: number | undefined;
    connectionTimeoutMillis?: number | undefined;
}>;
export declare const TorConfigSchema: z.ZodObject<{
    torHost: z.ZodDefault<z.ZodString>;
    torPort: z.ZodDefault<z.ZodNumber>;
    timeout: z.ZodDefault<z.ZodNumber>;
    userAgent: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    torHost: string;
    torPort: number;
    timeout: number;
    userAgent: string;
}, {
    torHost?: string | undefined;
    torPort?: number | undefined;
    timeout?: number | undefined;
    userAgent?: string | undefined;
}>;
export declare const TorClientConfigSchema: z.ZodObject<{
    torHost: z.ZodDefault<z.ZodString>;
    torPort: z.ZodDefault<z.ZodNumber>;
    timeout: z.ZodDefault<z.ZodNumber>;
    userAgent: z.ZodDefault<z.ZodString>;
} & {
    retryAttempts: z.ZodDefault<z.ZodNumber>;
    retryDelay: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    torHost: string;
    torPort: number;
    timeout: number;
    userAgent: string;
    retryAttempts: number;
    retryDelay: number;
}, {
    torHost?: string | undefined;
    torPort?: number | undefined;
    timeout?: number | undefined;
    userAgent?: string | undefined;
    retryAttempts?: number | undefined;
    retryDelay?: number | undefined;
}>;
export declare const CrawlerWorkerConfigSchema: z.ZodObject<{
    timeout: z.ZodDefault<z.ZodNumber>;
    retryAttempts: z.ZodDefault<z.ZodNumber>;
    retryDelay: z.ZodDefault<z.ZodNumber>;
    crawlDelay: z.ZodDefault<z.ZodNumber>;
    maxContentSize: z.ZodDefault<z.ZodNumber>;
    database: z.ZodOptional<z.ZodObject<{
        host: z.ZodDefault<z.ZodString>;
        port: z.ZodDefault<z.ZodNumber>;
        database: z.ZodDefault<z.ZodString>;
        user: z.ZodOptional<z.ZodString>;
        password: z.ZodDefault<z.ZodString>;
        max: z.ZodDefault<z.ZodNumber>;
        idleTimeoutMillis: z.ZodDefault<z.ZodNumber>;
        connectionTimeoutMillis: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        host: string;
        port: number;
        database: string;
        password: string;
        max: number;
        idleTimeoutMillis: number;
        connectionTimeoutMillis: number;
        user?: string | undefined;
    }, {
        host?: string | undefined;
        port?: number | undefined;
        database?: string | undefined;
        user?: string | undefined;
        password?: string | undefined;
        max?: number | undefined;
        idleTimeoutMillis?: number | undefined;
        connectionTimeoutMillis?: number | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    timeout: number;
    retryAttempts: number;
    retryDelay: number;
    crawlDelay: number;
    maxContentSize: number;
    database?: {
        host: string;
        port: number;
        database: string;
        password: string;
        max: number;
        idleTimeoutMillis: number;
        connectionTimeoutMillis: number;
        user?: string | undefined;
    } | undefined;
}, {
    database?: {
        host?: string | undefined;
        port?: number | undefined;
        database?: string | undefined;
        user?: string | undefined;
        password?: string | undefined;
        max?: number | undefined;
        idleTimeoutMillis?: number | undefined;
        connectionTimeoutMillis?: number | undefined;
    } | undefined;
    timeout?: number | undefined;
    retryAttempts?: number | undefined;
    retryDelay?: number | undefined;
    crawlDelay?: number | undefined;
    maxContentSize?: number | undefined;
}>;
export declare const SearchEngineConfigSchema: z.ZodObject<{
    workerCount: z.ZodDefault<z.ZodNumber>;
    timeout: z.ZodDefault<z.ZodNumber>;
    retryAttempts: z.ZodDefault<z.ZodNumber>;
    crawlDelay: z.ZodDefault<z.ZodNumber>;
    logLevel: z.ZodDefault<z.ZodEnum<["error", "warn", "info", "debug"]>>;
    database: z.ZodOptional<z.ZodObject<{
        host: z.ZodDefault<z.ZodString>;
        port: z.ZodDefault<z.ZodNumber>;
        database: z.ZodDefault<z.ZodString>;
        user: z.ZodOptional<z.ZodString>;
        password: z.ZodDefault<z.ZodString>;
        max: z.ZodDefault<z.ZodNumber>;
        idleTimeoutMillis: z.ZodDefault<z.ZodNumber>;
        connectionTimeoutMillis: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        host: string;
        port: number;
        database: string;
        password: string;
        max: number;
        idleTimeoutMillis: number;
        connectionTimeoutMillis: number;
        user?: string | undefined;
    }, {
        host?: string | undefined;
        port?: number | undefined;
        database?: string | undefined;
        user?: string | undefined;
        password?: string | undefined;
        max?: number | undefined;
        idleTimeoutMillis?: number | undefined;
        connectionTimeoutMillis?: number | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    timeout: number;
    retryAttempts: number;
    crawlDelay: number;
    workerCount: number;
    logLevel: "error" | "warn" | "info" | "debug";
    database?: {
        host: string;
        port: number;
        database: string;
        password: string;
        max: number;
        idleTimeoutMillis: number;
        connectionTimeoutMillis: number;
        user?: string | undefined;
    } | undefined;
}, {
    database?: {
        host?: string | undefined;
        port?: number | undefined;
        database?: string | undefined;
        user?: string | undefined;
        password?: string | undefined;
        max?: number | undefined;
        idleTimeoutMillis?: number | undefined;
        connectionTimeoutMillis?: number | undefined;
    } | undefined;
    timeout?: number | undefined;
    retryAttempts?: number | undefined;
    crawlDelay?: number | undefined;
    workerCount?: number | undefined;
    logLevel?: "error" | "warn" | "info" | "debug" | undefined;
}>;
export declare const ApiConfigSchema: z.ZodObject<{
    port: z.ZodDefault<z.ZodNumber>;
    database: z.ZodOptional<z.ZodObject<{
        host: z.ZodDefault<z.ZodString>;
        port: z.ZodDefault<z.ZodNumber>;
        database: z.ZodDefault<z.ZodString>;
        user: z.ZodOptional<z.ZodString>;
        password: z.ZodDefault<z.ZodString>;
        max: z.ZodDefault<z.ZodNumber>;
        idleTimeoutMillis: z.ZodDefault<z.ZodNumber>;
        connectionTimeoutMillis: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        host: string;
        port: number;
        database: string;
        password: string;
        max: number;
        idleTimeoutMillis: number;
        connectionTimeoutMillis: number;
        user?: string | undefined;
    }, {
        host?: string | undefined;
        port?: number | undefined;
        database?: string | undefined;
        user?: string | undefined;
        password?: string | undefined;
        max?: number | undefined;
        idleTimeoutMillis?: number | undefined;
        connectionTimeoutMillis?: number | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    port: number;
    database?: {
        host: string;
        port: number;
        database: string;
        password: string;
        max: number;
        idleTimeoutMillis: number;
        connectionTimeoutMillis: number;
        user?: string | undefined;
    } | undefined;
}, {
    port?: number | undefined;
    database?: {
        host?: string | undefined;
        port?: number | undefined;
        database?: string | undefined;
        user?: string | undefined;
        password?: string | undefined;
        max?: number | undefined;
        idleTimeoutMillis?: number | undefined;
        connectionTimeoutMillis?: number | undefined;
    } | undefined;
}>;
export type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>;
export type TorConfig = z.infer<typeof TorConfigSchema>;
export type TorClientConfig = z.infer<typeof TorClientConfigSchema>;
export type CrawlerWorkerConfig = z.infer<typeof CrawlerWorkerConfigSchema>;
export type SearchEngineConfig = z.infer<typeof SearchEngineConfigSchema>;
export type ApiConfig = z.infer<typeof ApiConfigSchema>;
//# sourceMappingURL=config.d.ts.map