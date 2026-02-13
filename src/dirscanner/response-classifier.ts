import type { InterestCategory, BaselineResponse, DirScanResult } from '../types/dirscanner.js';

interface ProbeResponse {
  path: string;
  statusCode: number;
  contentLength: number;
  contentType: string | null;
  responseTimeMs: number;
  serverHeader: string | null;
  redirectUrl: string | null;
  body: string | null;
}

// Content signatures: what we expect to find in legitimate files
const CONTENT_SIGNATURES: Array<{ pathPattern: RegExp; bodyPattern: RegExp; category: InterestCategory }> = [
  { pathPattern: /\.env/, bodyPattern: /[A-Z_]+=.+/m, category: 'credentials_file' },
  { pathPattern: /\.git\/HEAD/, bodyPattern: /ref: refs\//, category: 'source_control' },
  { pathPattern: /\.git\/config/, bodyPattern: /\[core\]/, category: 'source_control' },
  { pathPattern: /phpinfo\.php/, bodyPattern: /PHP Version/, category: 'server_info' },
  { pathPattern: /info\.php/, bodyPattern: /PHP Version/, category: 'server_info' },
  { pathPattern: /server-status/, bodyPattern: /Apache Server Status|Server Version|requests currently being processed/i, category: 'server_info' },
  { pathPattern: /server-info/, bodyPattern: /Apache Server Information|Module Name/i, category: 'server_info' },
  { pathPattern: /robots\.txt/, bodyPattern: /(User-agent|Disallow|Allow|Sitemap)/i, category: 'robots_sitemap' },
  { pathPattern: /sitemap.*\.xml/, bodyPattern: /<(urlset|sitemapindex)/, category: 'robots_sitemap' },
  { pathPattern: /\.htpasswd/, bodyPattern: /^[^:]+:\$?[a-zA-Z0-9$.\/]+$/m, category: 'credentials_file' },
  { pathPattern: /wp-config\.php/, bodyPattern: /(DB_NAME|DB_USER|DB_PASSWORD)/, category: 'configuration_file' },
  { pathPattern: /config\.php/, bodyPattern: /(database|password|host|user)/i, category: 'configuration_file' },
  { pathPattern: /composer\.json/, bodyPattern: /"require"/, category: 'configuration_file' },
  { pathPattern: /package\.json/, bodyPattern: /"(name|version|dependencies)"/, category: 'configuration_file' },
  { pathPattern: /swagger\.json/, bodyPattern: /"swagger"|"openapi"/, category: 'server_info' },
  { pathPattern: /openapi\.json/, bodyPattern: /"openapi"/, category: 'server_info' },
  { pathPattern: /\.svn\/entries/, bodyPattern: /^\d+/, category: 'source_control' },
  { pathPattern: /\.npmrc/, bodyPattern: /(registry|token|auth)/i, category: 'credentials_file' },
  { pathPattern: /backup\.sql|dump\.sql|database\.sql|db\.sql/, bodyPattern: /(CREATE TABLE|INSERT INTO|DROP TABLE)/i, category: 'database_file' },
  { pathPattern: /error\.log|access\.log|debug\.log/, bodyPattern: /(\d{4}[-/]\d{2}[-/]\d{2}|PHP|Warning|Error|Notice)/i, category: 'log_file' },
  { pathPattern: /security\.txt/, bodyPattern: /(Contact|Expires|Encryption|Policy)/i, category: 'server_info' },
];

// Soft-404 body indicators — responses containing these are likely custom error pages
const SOFT_404_INDICATORS = [
  'not found',
  '404',
  'page not found',
  'does not exist',
  'no longer available',
  'couldn\'t find',
  'could not find',
  'nothing here',
  'page is missing',
  'error 404',
  'the page you',
  'we can\'t find',
  'this page doesn\'t',
  'resource not found',
  'file not found',
];

// Path-to-category mapping for non-200 interesting results (like 403s)
const PATH_CATEGORY_MAP: Array<{ pathPattern: RegExp; category: InterestCategory }> = [
  { pathPattern: /\.env/, category: 'credentials_file' },
  { pathPattern: /\.htpasswd/, category: 'credentials_file' },
  { pathPattern: /\.npmrc/, category: 'credentials_file' },
  { pathPattern: /\.git/, category: 'source_control' },
  { pathPattern: /\.svn/, category: 'source_control' },
  { pathPattern: /\.hg/, category: 'source_control' },
  { pathPattern: /admin|cpanel|phpmyadmin|adminer|dashboard|console|panel|manager/, category: 'admin_panel' },
  { pathPattern: /wp-admin|wp-login/, category: 'admin_panel' },
  { pathPattern: /login|signin/, category: 'admin_panel' },
  { pathPattern: /phpinfo|info\.php|server-status|server-info/, category: 'server_info' },
  { pathPattern: /\.well-known|security\.txt|humans\.txt/, category: 'server_info' },
  { pathPattern: /swagger|openapi|api-docs/, category: 'server_info' },
  { pathPattern: /backup|\.bak|\.old|archive|dump/, category: 'backup_file' },
  { pathPattern: /config|configuration|settings|web\.config/, category: 'configuration_file' },
  { pathPattern: /\.log|error_log|debug\.log/, category: 'log_file' },
  { pathPattern: /\.sql|\.sqlite|\.db|database/, category: 'database_file' },
  { pathPattern: /robots\.txt|sitemap/, category: 'robots_sitemap' },
  { pathPattern: /uploads|files|documents|media/, category: 'sensitive_directory' },
  { pathPattern: /private|tmp|temp|cgi-bin|includes/, category: 'sensitive_directory' },
  { pathPattern: /vendor|node_modules/, category: 'sensitive_directory' },
];

export class ResponseClassifier {
  private baseline: BaselineResponse | null = null;

  setBaseline(baseline: BaselineResponse): void {
    this.baseline = baseline;
  }

  classify(response: ProbeResponse): DirScanResult {
    const { path, statusCode, contentLength, contentType, responseTimeMs, serverHeader, redirectUrl, body } = response;

    // Start with a base result
    const result: DirScanResult = {
      path,
      statusCode,
      contentLength: contentLength || null,
      contentType: contentType || null,
      responseTimeMs,
      serverHeader: serverHeader || null,
      redirectUrl: redirectUrl || null,
      bodySnippet: null,
      isInteresting: false,
      interestReason: null,
    };

    // 404/410/5xx — not interesting
    if (statusCode === 404 || statusCode === 410 || statusCode >= 500) {
      return result;
    }

    // 403 — usually not interesting
    // nginx returns 403 for ANY dotfile (even nonexistent ones), so we can't trust 403 on dotfiles
    // Only mark 403 as interesting for non-dotfile admin panels
    if (statusCode === 403) {
      const isDotfile = /^\./.test(path) || /\/\./.test(path);
      if (!isDotfile) {
        const category = this.getCategoryForPath(path);
        if (category === 'admin_panel') {
          result.isInteresting = true;
          result.interestReason = category;
        }
      }
      return result;
    }

    // 401 — authentication required, path exists
    if (statusCode === 401) {
      const category = this.getCategoryForPath(path) ?? 'other';
      result.isInteresting = true;
      result.interestReason = category;
      return result;
    }

    // 301/302 redirects from admin paths → interesting (redirecting to login)
    if ((statusCode === 301 || statusCode === 302) && redirectUrl) {
      const isAdminPath = /admin|login|signin|dashboard|panel|cpanel|manager/i.test(path);
      const redirectsToLogin = /login|signin|auth/i.test(redirectUrl);
      if (isAdminPath && redirectsToLogin) {
        result.isInteresting = true;
        result.interestReason = 'admin_panel';
        return result;
      }
      // Other redirects are not interesting
      return result;
    }

    // 200 responses — run full classification
    if (statusCode === 200) {
      // Save body snippet for 200s
      if (body) {
        result.bodySnippet = body.substring(0, 512);
      }

      // Check for soft-404 via baseline comparison
      if (this.isSoft404(contentLength, body)) {
        return result;
      }

      // Check for soft-404 body indicators
      if (body && this.hasSoft404Indicators(body)) {
        return result;
      }

      // Check content signatures
      if (body) {
        for (const sig of CONTENT_SIGNATURES) {
          if (sig.pathPattern.test(path) && sig.bodyPattern.test(body)) {
            result.isInteresting = true;
            result.interestReason = sig.category;
            return result;
          }
        }
      }

      // If we got a 200 and it's not a soft-404, it might still be interesting
      // if the path is sensitive (e.g., directory listing)
      const category = this.getCategoryForPath(path);
      if (category && body && !this.looksLikeGenericPage(body)) {
        result.isInteresting = true;
        result.interestReason = category;
      }

      return result;
    }

    return result;
  }

  private isSoft404(contentLength: number, body: string | null): boolean {
    if (!this.baseline) return false;

    // Compare content length with 10% tolerance
    const tolerance = this.baseline.contentLength * 0.1;
    const lengthDiff = Math.abs(contentLength - this.baseline.contentLength);

    if (lengthDiff <= tolerance && this.baseline.contentLength > 0) {
      return true;
    }

    // If baseline body is substantial and matches closely, it's a soft-404
    if (body && this.baseline.bodySnippet.length > 50) {
      const similarity = this.calculateSimilarity(body.substring(0, 512), this.baseline.bodySnippet);
      if (similarity > 0.85) {
        return true;
      }
    }

    return false;
  }

  private hasSoft404Indicators(body: string): boolean {
    const lowerBody = body.toLowerCase();
    return SOFT_404_INDICATORS.some((indicator) => lowerBody.includes(indicator));
  }

  private looksLikeGenericPage(body: string): boolean {
    // Generic HTML pages often have full HTML structure with navigation
    const lowerBody = body.toLowerCase();
    const hasFullHtml = lowerBody.includes('<!doctype html') || lowerBody.includes('<html');
    const hasNav = lowerBody.includes('<nav') || lowerBody.includes('navbar');
    return hasFullHtml && hasNav;
  }

  private getCategoryForPath(path: string): InterestCategory | null {
    const lowerPath = path.toLowerCase();
    for (const mapping of PATH_CATEGORY_MAP) {
      if (mapping.pathPattern.test(lowerPath)) {
        return mapping.category;
      }
    }
    return null;
  }

  private calculateSimilarity(a: string, b: string): number {
    if (a === b) return 1;
    if (a.length === 0 || b.length === 0) return 0;

    // Simple character-level Jaccard similarity
    const setA = new Set(a.split(''));
    const setB = new Set(b.split(''));
    let intersection = 0;
    for (const ch of setA) {
      if (setB.has(ch)) intersection++;
    }
    const union = setA.size + setB.size - intersection;
    return union === 0 ? 0 : intersection / union;
  }
}

// Utility to generate a random nonexistent path for baseline probing
export function generateBaselinePath(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let path = '';
  for (let i = 0; i < 16; i++) {
    path += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${path}-definitely-not-a-real-path-${Date.now()}`;
}
