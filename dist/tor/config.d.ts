import { SocksProxyAgent } from 'socks-proxy-agent';
import type { TorConfigOptions, TorRequestConfig } from '../types/index.js';
export declare class TorConfig {
    private readonly torHost;
    private readonly torPort;
    private readonly timeout;
    private readonly userAgent;
    constructor(options?: TorConfigOptions);
    createProxyAgent(): SocksProxyAgent;
    getRequestConfig(): TorRequestConfig;
    static validateTorConnection(host?: string, port?: number): Promise<boolean>;
}
//# sourceMappingURL=config.d.ts.map