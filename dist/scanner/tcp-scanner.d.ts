import type { PortScanResult, TcpScannerOptions } from '../types/scanner.js';
export declare class TcpScanner {
    private readonly torHost;
    private readonly torPort;
    private readonly timeout;
    private readonly bannerTimeout;
    constructor(options?: TcpScannerOptions);
    scanPort(domain: string, port: number, probeString?: string): Promise<PortScanResult>;
    private grabBanner;
    private classifyError;
    scanPorts(domain: string, ports: number[], options?: {
        maxConcurrent?: number;
        minDelay?: number;
        onProgress?: (result: PortScanResult, index: number, total: number) => void;
        getProbeString?: (port: number) => string | null;
    }): Promise<PortScanResult[]>;
    private delay;
}
//# sourceMappingURL=tcp-scanner.d.ts.map