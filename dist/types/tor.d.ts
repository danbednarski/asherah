import type { AxiosRequestConfig } from 'axios';
import type { SocksProxyAgent } from 'socks-proxy-agent';
export interface TorConfigOptions {
    torHost?: string;
    torPort?: number;
    timeout?: number;
    userAgent?: string;
}
export interface TorClientOptions extends TorConfigOptions {
    retryAttempts?: number;
    retryDelay?: number;
}
export interface TorRequestConfig extends AxiosRequestConfig {
    httpsAgent: SocksProxyAgent;
    httpAgent: SocksProxyAgent;
    timeout: number;
    responseType: 'text';
    responseEncoding: 'utf8';
    headers: Record<string, string>;
}
export type TorResult = TorSuccessResult | TorErrorResult;
export interface TorSuccessResult {
    success: true;
    status: number;
    data: string;
    headers: Record<string, string>;
    url: string;
    timestamp: string;
    /** True if the content was truncated due to exceeding maxContentLength */
    truncated?: boolean;
}
export interface TorErrorResult {
    success: false;
    error: string;
    status: number | null;
    url: string;
    timestamp: string;
}
export interface OnionServiceCheckResult {
    accessible: boolean;
    status: number | null;
    url: string;
    timestamp: string;
    error: string | null;
}
//# sourceMappingURL=tor.d.ts.map