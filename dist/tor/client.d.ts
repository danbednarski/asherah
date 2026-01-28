import { type AxiosRequestConfig } from 'axios';
import type { TorClientOptions, TorResult, OnionServiceCheckResult } from '../types/index.js';
export declare class TorClient {
    private readonly torConfig;
    private readonly retryAttempts;
    private readonly retryDelay;
    constructor(options?: TorClientOptions);
    /**
     * Read a stream up to maxBytes, then stop. Returns the content read and whether it was truncated.
     */
    private readStreamWithLimit;
    makeRequest(url: string, options?: AxiosRequestConfig): Promise<TorResult>;
    get(url: string, options?: AxiosRequestConfig): Promise<TorResult>;
    head(url: string, options?: AxiosRequestConfig): Promise<TorResult>;
    checkOnionService(url: string): Promise<OnionServiceCheckResult>;
}
//# sourceMappingURL=client.d.ts.map