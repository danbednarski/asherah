import { SocksClient } from 'socks';
// Error patterns that indicate port is closed vs filtered
const CLOSED_PATTERNS = [
    'ECONNREFUSED',
    'Connection refused',
];
const FILTERED_PATTERNS = [
    'General SOCKS server failure',
    'Host unreachable',
    'Network unreachable',
    'TTL expired',
];
export class TcpScanner {
    torHost;
    torPort;
    timeout;
    bannerTimeout;
    constructor(options = {}) {
        this.torHost = options.torHost ?? process.env['TOR_HOST'] ?? '127.0.0.1';
        this.torPort = options.torPort ?? parseInt(process.env['TOR_PORT'] ?? '9050', 10);
        this.timeout = options.timeout ?? 30000;
        this.bannerTimeout = options.bannerTimeout ?? 5000;
    }
    async scanPort(domain, port, probeString) {
        const startTime = Date.now();
        try {
            const options = {
                proxy: {
                    host: this.torHost,
                    port: this.torPort,
                    type: 5,
                },
                command: 'connect',
                destination: {
                    host: domain,
                    port,
                },
                timeout: this.timeout,
            };
            const { socket } = await SocksClient.createConnection(options);
            const responseTime = Date.now() - startTime;
            try {
                // Port is open, try to grab banner
                const banner = await this.grabBanner(socket, probeString);
                return {
                    port,
                    state: 'open',
                    responseTimeMs: responseTime,
                    banner,
                    error: null,
                };
            }
            finally {
                socket.destroy();
            }
        }
        catch (error) {
            const responseTime = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            // Determine port state based on error
            const state = this.classifyError(errorMessage);
            return {
                port,
                state,
                responseTimeMs: responseTime,
                banner: null,
                error: errorMessage,
            };
        }
    }
    async grabBanner(socket, probeString) {
        return new Promise((resolve) => {
            const chunks = [];
            let totalLength = 0;
            const maxBannerSize = 4096;
            const timer = setTimeout(() => {
                cleanup();
                const banner = Buffer.concat(chunks).toString('utf8').trim();
                resolve(banner.length > 0 ? banner : null);
            }, this.bannerTimeout);
            const cleanup = () => {
                clearTimeout(timer);
                socket.removeAllListeners('data');
                socket.removeAllListeners('error');
                socket.removeAllListeners('close');
            };
            socket.on('data', (chunk) => {
                chunks.push(chunk);
                totalLength += chunk.length;
                // Stop if we have enough data
                if (totalLength >= maxBannerSize) {
                    cleanup();
                    const banner = Buffer.concat(chunks).toString('utf8').slice(0, maxBannerSize).trim();
                    resolve(banner.length > 0 ? banner : null);
                }
            });
            socket.on('error', () => {
                cleanup();
                const banner = Buffer.concat(chunks).toString('utf8').trim();
                resolve(banner.length > 0 ? banner : null);
            });
            socket.on('close', () => {
                cleanup();
                const banner = Buffer.concat(chunks).toString('utf8').trim();
                resolve(banner.length > 0 ? banner : null);
            });
            // Send probe if provided
            if (probeString) {
                socket.write(probeString);
            }
        });
    }
    classifyError(errorMessage) {
        const lowerError = errorMessage.toLowerCase();
        // Check for closed indicators
        for (const pattern of CLOSED_PATTERNS) {
            if (lowerError.includes(pattern.toLowerCase())) {
                return 'closed';
            }
        }
        // Check for filtered indicators
        for (const pattern of FILTERED_PATTERNS) {
            if (lowerError.includes(pattern.toLowerCase())) {
                return 'filtered';
            }
        }
        // Timeout
        if (lowerError.includes('timeout') || lowerError.includes('etimedout')) {
            return 'timeout';
        }
        // Default to filtered for unknown errors
        return 'filtered';
    }
    async scanPorts(domain, ports, options = {}) {
        const { maxConcurrent = 5, minDelay = 200, onProgress, getProbeString, } = options;
        const results = [];
        const queue = [...ports];
        let completed = 0;
        const total = ports.length;
        const worker = async () => {
            while (queue.length > 0) {
                const port = queue.shift();
                if (port === undefined)
                    break;
                const probe = getProbeString?.(port) ?? null;
                const result = await this.scanPort(domain, port, probe ?? undefined);
                results.push(result);
                completed++;
                onProgress?.(result, completed, total);
                // Rate limiting
                if (queue.length > 0) {
                    await this.delay(minDelay);
                }
            }
        };
        // Start workers
        const workers = [];
        const workerCount = Math.min(maxConcurrent, ports.length);
        for (let i = 0; i < workerCount; i++) {
            workers.push(worker());
        }
        await Promise.all(workers);
        // Sort results by port number
        return results.sort((a, b) => a.port - b.port);
    }
    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
//# sourceMappingURL=tcp-scanner.js.map