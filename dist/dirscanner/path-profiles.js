// ~10 highest-signal paths — almost always worth checking
const QUICK_PATHS = [
    '.env',
    '.git/HEAD',
    'robots.txt',
    '.htpasswd',
    'phpinfo.php',
    'wp-config.php',
    'backup.sql',
    'server-status',
    'phpmyadmin/',
    'admin/',
];
// ~25 solid paths — good hit rate without the noise
const STANDARD_PATHS = [
    '.env',
    '.git/HEAD',
    '.git/config',
    '.htpasswd',
    '.htaccess',
    'robots.txt',
    'phpinfo.php',
    'server-status',
    'wp-config.php',
    'wp-config.php.bak',
    'backup.sql',
    'dump.sql',
    'backup.zip',
    'admin/',
    'wp-admin/',
    'phpmyadmin/',
    'adminer.php',
    '.svn/entries',
    '.npmrc',
    '.dockerenv',
    'error.log',
    'wp-content/debug.log',
    'sitemap.xml',
    'swagger.json',
    '.ssh/',
];
// Full: standard + broader coverage
const FULL_EXTRA_PATHS = [
    '.env.backup',
    '.env.local',
    'config.php',
    'web.config',
    'database.sql',
    'backup.tar.gz',
    'administrator/',
    'cpanel/',
    'debug.log',
    'access.log',
    '.well-known/security.txt',
    'xmlrpc.php',
    'wp-login.php',
    'graphql',
    'openapi.json',
    'api-docs/',
    'composer.json',
    '.bash_history',
    '.mysql_history',
    'data.db',
    'app.db',
    'private/',
    'tmp/',
    'cgi-bin/',
];
const PATH_PROFILES = {
    quick: QUICK_PATHS,
    standard: STANDARD_PATHS,
    full: [...STANDARD_PATHS, ...FULL_EXTRA_PATHS],
};
export function getPathsForProfile(profile) {
    return PATH_PROFILES[profile] ?? STANDARD_PATHS;
}
export function isValidDirScanProfile(profile) {
    return profile === 'quick' || profile === 'standard' || profile === 'full';
}
export function getAvailableDirScanProfiles() {
    return ['quick', 'standard', 'full'];
}
export function getProfilePathCount(profile) {
    return getPathsForProfile(profile).length;
}
//# sourceMappingURL=path-profiles.js.map