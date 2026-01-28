const ONION_REGEX = /([a-z2-7]{56}\.onion)/i;

export function extractOnionDomain(url: string): string | null {
  const match = url.match(ONION_REGEX);
  return match ? match[1].toLowerCase() : null;
}

export function isBaseDomain(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname;
    return path === '/' || path === '';
  } catch {
    return false;
  }
}

export function validateOnionDomain(domain: string): boolean {
  if (!domain || typeof domain !== 'string') return false;

  const parts = domain.split('.');
  if (parts.length !== 2 || parts[1] !== 'onion') return false;

  const address = parts[0];
  if (!address || address.length !== 56) return false;

  return /^[a-z2-7]+$/.test(address);
}
