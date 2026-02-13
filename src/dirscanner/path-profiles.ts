import type { DirScanProfile } from '../types/dirscanner.js';

// ~10 highest-signal paths — almost always worth checking
const QUICK_PATHS: string[] = [
  '.env',
  '.git/HEAD',
  'robots.txt',
  '.DS_Store',
  'phpinfo.php',
  'server-status',
  'admin/',
  'backup.sql',
  'package.json',
  'wp-config.php',
];

// ~30 solid paths — good hit rate without the noise
const STANDARD_PATHS: string[] = [
  // Source control & IDE leaks
  '.git/HEAD',
  '.git/config',
  '.git/logs/HEAD',
  '.DS_Store',
  '.svn/entries',

  // Env & config files
  '.env',
  '.env.production',
  '.env.local',
  '.htpasswd',
  'wp-config.php',
  'wp-config.php.bak',
  'config.json',
  'config.yml',

  // Dependency manifests (leak stack + versions)
  'package.json',
  'composer.json',
  'requirements.txt',

  // Backups & dumps
  'backup.sql',
  'dump.sql',
  'backup.zip',

  // Server info & debug
  'phpinfo.php',
  'server-status',
  'robots.txt',
  'swagger.json',

  // Admin & management
  'admin/',
  'adminer.php',
  'phpmyadmin/',

  // API / health endpoints (leak stack info)
  'actuator/env',
  'metrics',
  'graphql',

  // Logs
  'error.log',
  'wp-content/debug.log',
];

// Full: standard + broader coverage
const FULL_EXTRA_PATHS: string[] = [
  '.env.backup',
  '.env.dev',
  'config.php',
  'settings.json',
  'web.config',
  'database.sql',
  'backup.tar.gz',
  'Dockerfile',
  'docker-compose.yml',
  '.vscode/settings.json',
  '.idea/workspace.xml',
  'wp-json/wp/v2/users',
  'debug.log',
  'access.log',
  '.well-known/security.txt',
  '.well-known/openid-configuration',
  'xmlrpc.php',
  'wp-login.php',
  'wp-admin/',
  'openapi.json',
  'api-docs/',
  '.bash_history',
  '.mysql_history',
  'data.db',
  'app.db',
  'console/',
  'elmah.axd',
  'trace.axd',
  'Gemfile',
];

const PATH_PROFILES: Record<DirScanProfile, string[]> = {
  quick: QUICK_PATHS,
  standard: STANDARD_PATHS,
  full: [...STANDARD_PATHS, ...FULL_EXTRA_PATHS],
};

export function getPathsForProfile(profile: DirScanProfile): string[] {
  return PATH_PROFILES[profile] ?? STANDARD_PATHS;
}

export function isValidDirScanProfile(profile: string): profile is DirScanProfile {
  return profile === 'quick' || profile === 'standard' || profile === 'full';
}

export function getAvailableDirScanProfiles(): DirScanProfile[] {
  return ['quick', 'standard', 'full'];
}

export function getProfilePathCount(profile: DirScanProfile): number {
  return getPathsForProfile(profile).length;
}
