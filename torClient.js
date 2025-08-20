const axios = require('axios');
const TorConfig = require('./torConfig');

class TorClient {
    constructor(options = {}) {
        this.torConfig = new TorConfig(options);
        this.retryAttempts = options.retryAttempts || 3;
        this.retryDelay = options.retryDelay || 2000;
    }

    async makeRequest(url, options = {}) {
        await TorConfig.validateTorConnection();
        
        const config = {
            ...this.torConfig.getRequestConfig(),
            ...options,
            url: url,
            method: options.method || 'GET'
        };

        let lastError;
        for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
            try {
                console.log(`Making request to ${url} (attempt ${attempt}/${this.retryAttempts})`);
                const response = await axios(config);
                
                return {
                    success: true,
                    status: response.status,
                    data: response.data,
                    headers: response.headers,
                    url: url,
                    timestamp: new Date().toISOString()
                };
            } catch (error) {
                lastError = error;
                console.log(`Request failed (attempt ${attempt}): ${error.message}`);
                
                if (attempt < this.retryAttempts) {
                    await this.delay(this.retryDelay * attempt);
                }
            }
        }

        return {
            success: false,
            error: lastError.message,
            status: lastError.response?.status || null,
            url: url,
            timestamp: new Date().toISOString()
        };
    }

    async get(url, options = {}) {
        return this.makeRequest(url, { ...options, method: 'GET' });
    }

    async head(url, options = {}) {
        return this.makeRequest(url, { ...options, method: 'HEAD' });
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
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
                url: url,
                timestamp: result.timestamp,
                error: result.error || null
            };
        } catch (error) {
            return {
                accessible: false,
                status: null,
                url: url,
                timestamp: new Date().toISOString(),
                error: error.message
            };
        }
    }
}

module.exports = TorClient;