import net from 'net';
import { SocksProxyAgent } from 'socks-proxy-agent';
import type { TorConfigOptions, TorRequestConfig } from '../types/index.js';

export class TorConfig {
  private readonly torHost: string;
  private readonly torPort: number;
  private readonly timeout: number;
  private readonly userAgent: string;

  constructor(options: TorConfigOptions = {}) {
    this.torHost = options.torHost ?? '127.0.0.1';
    this.torPort = options.torPort ?? 9050;
    this.timeout = options.timeout ?? 30000;
    this.userAgent = options.userAgent ?? 'Mozilla/5.0 (Windows NT 10.0; rv:91.0) Gecko/20100101 Firefox/91.0';
  }

  createProxyAgent(): SocksProxyAgent {
    const proxyUrl = `socks5h://${this.torHost}:${this.torPort}`;
    return new SocksProxyAgent(proxyUrl);
  }

  getRequestConfig(): TorRequestConfig {
    return {
      httpsAgent: this.createProxyAgent(),
      httpAgent: this.createProxyAgent(),
      timeout: this.timeout,
      responseType: 'text',
      responseEncoding: 'utf8',
      headers: {
        'User-Agent': this.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Accept-Charset': 'utf-8',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
    };
  }

  static validateTorConnection(host = '127.0.0.1', port = 9050): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();

      socket.setTimeout(5000);

      socket.connect(port, host, () => {
        socket.destroy();
        resolve(true);
      });

      socket.on('error', () => {
        socket.destroy();
        reject(new Error('Tor is not running on localhost:9050. Please start Tor first.'));
      });

      socket.on('timeout', () => {
        socket.destroy();
        reject(new Error('Connection to Tor timed out'));
      });
    });
  }
}
