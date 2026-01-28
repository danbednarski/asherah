import axios from 'axios';
import { TorConfig } from './config.js';
import { delay } from '../utils/delay.js';
export class TorClient {
    torConfig;
    retryAttempts;
    retryDelay;
    constructor(options = {}) {
        this.torConfig = new TorConfig(options);
        this.retryAttempts = options.retryAttempts ?? 3;
        this.retryDelay = options.retryDelay ?? 2000;
    }
    /**
     * Read a stream up to maxBytes, then stop. Returns the content read and whether it was truncated.
     */
    async readStreamWithLimit(stream, maxBytes) {
        return new Promise((resolve, reject) => {
            const chunks = [];
            let totalBytes = 0;
            let truncated = false;
            stream.on('data', (chunk) => {
                const remaining = maxBytes - totalBytes;
                if (remaining <= 0) {
                    truncated = true;
                    stream.destroy();
                    return;
                }
                if (chunk.length > remaining) {
                    chunks.push(chunk.subarray(0, remaining));
                    totalBytes = maxBytes;
                    truncated = true;
                    stream.destroy();
                }
                else {
                    chunks.push(chunk);
                    totalBytes += chunk.length;
                }
            });
            stream.on('end', () => {
                const data = Buffer.concat(chunks).toString('utf8');
                resolve({ data, truncated });
            });
            stream.on('close', () => {
                // Stream was destroyed (truncated case)
                const data = Buffer.concat(chunks).toString('utf8');
                resolve({ data, truncated });
            });
            stream.on('error', (err) => {
                reject(err);
            });
        });
    }
    async makeRequest(url, options = {}) {
        await TorConfig.validateTorConnection();
        const maxContentLength = options.maxContentLength;
        const useStreaming = maxContentLength !== undefined && maxContentLength > 0;
        // Build config - use streaming if maxContentLength is set
        const config = {
            ...this.torConfig.getRequestConfig(),
            ...options,
            url,
            method: options.method ?? 'GET',
            // Use stream for controlled reading when maxContentLength is set
            responseType: useStreaming ? 'stream' : (options.responseType ?? 'text'),
            // Accept all HTTP status codes - we want to capture 4xx/5xx responses too
            // Network errors will still throw, but HTTP errors won't
            validateStatus: () => true,
        };
        // Remove maxContentLength from axios config when using streaming since we handle it manually
        if (useStreaming) {
            delete config.maxContentLength;
        }
        let lastError = null;
        for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
            try {
                console.log(`Making request to ${url} (attempt ${attempt}/${this.retryAttempts})`);
                const response = await axios(config);
                let data;
                let truncated = false;
                if (useStreaming) {
                    const streamResult = await this.readStreamWithLimit(response.data, maxContentLength);
                    data = streamResult.data;
                    truncated = streamResult.truncated;
                    if (truncated) {
                        console.log(`Content truncated at ${maxContentLength} bytes for ${url}`);
                    }
                }
                else {
                    data = response.data;
                }
                const result = {
                    success: true,
                    status: response.status,
                    data,
                    headers: response.headers,
                    url,
                    timestamp: new Date().toISOString(),
                    truncated,
                };
                return result;
            }
            catch (error) {
                lastError = error;
                console.log(`Request failed (attempt ${attempt}): ${lastError.message}`);
                if (attempt < this.retryAttempts) {
                    await delay(this.retryDelay * attempt);
                }
            }
        }
        const axiosError = lastError;
        const result = {
            success: false,
            error: lastError?.message ?? 'Unknown error',
            status: axiosError?.response?.status ?? null,
            url,
            timestamp: new Date().toISOString(),
        };
        return result;
    }
    async get(url, options = {}) {
        return this.makeRequest(url, { ...options, method: 'GET' });
    }
    async head(url, options = {}) {
        return this.makeRequest(url, { ...options, method: 'HEAD' });
    }
    async checkOnionService(url) {
        if (!url.includes('.onion')) {
            throw new Error('URL must be an onion service (.onion domain)');
        }
        try {
            const result = await this.head(url);
            return {
                accessible: result.success,
                status: result.status,
                url,
                timestamp: result.timestamp,
                error: result.success ? null : result.error,
            };
        }
        catch (error) {
            return {
                accessible: false,
                status: null,
                url,
                timestamp: new Date().toISOString(),
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }
}
//# sourceMappingURL=client.js.map