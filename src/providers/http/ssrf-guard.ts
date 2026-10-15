import { SSRFProtectionError } from '../../core/errors.js';

const DEFAULT_ALLOWED_HOSTS = new Set([
  'registry.npmjs.org',
  'registry.yarnpkg.com',
  'api.github.com',
  'github.com',
  'api.osv.dev',
]);

const FORBIDDEN_HOSTNAMES = new Set([
  'localhost',
  '0.0.0.0',
  '127.0.0.1',
  '::1',
  '[::1]',
  '0:0:0:0:0:0:0:1',
  '::ffff:127.0.0.1',
  '169.254.169.254', // AWS/GCP/Azure link-local metadata service
  'metadata.google.internal',
  'instance-data',
]);

function isPrivateOrLoopback(hostname: string): boolean {
  const clean = hostname.replace(/^\[|\]$/g, '').toLowerCase();

  if (FORBIDDEN_HOSTNAMES.has(clean) || FORBIDDEN_HOSTNAMES.has(hostname.toLowerCase())) {
    return true;
  }

  // IPv6 loopback or link-local checks
  if (clean.startsWith('fe80:') || clean.startsWith('fc00:') || clean.startsWith('fd00:')) {
    return true;
  }

  // IPv4 dot-decimal regex checks
  const ipv4Match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(clean);
  if (ipv4Match && ipv4Match[1] && ipv4Match[2] && ipv4Match[3] && ipv4Match[4]) {
    const octet1 = Number(ipv4Match[1]);
    const octet2 = Number(ipv4Match[2]);
    const octet3 = Number(ipv4Match[3]);
    const octet4 = Number(ipv4Match[4]);

    if (octet1 > 255 || octet2 > 255 || octet3 > 255 || octet4 > 255) {
      return true; // invalid/bypassed IP
    }

    if (octet1 === 10) return true; // 10.0.0.0/8
    if (octet1 === 127) return true; // 127.0.0.0/8 (loopback)
    if (octet1 === 169 && octet2 === 254) return true; // 169.254.0.0/16 (link-local / cloud metadata)
    if (octet1 === 172 && octet2 >= 16 && octet2 <= 31) return true; // 172.16.0.0/12
    if (octet1 === 192 && octet2 === 168) return true; // 192.168.0.0/16
    if (octet1 === 0) return true; // 0.0.0.0/8
  }

  // Single-number integer IP representation (e.g. 2130706433 -> 127.0.0.1)
  if (/^\d+$/.test(clean) || /^0x[0-9a-f]+$/i.test(clean)) {
    return true;
  }

  return false;
}

/**
 * Sanitizes URLs to mask any embedded credentials before logging or inclusion in error details.
 */
export function sanitizeUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.username || parsed.password) {
      parsed.username = '***';
      parsed.password = '***';
    }
    return parsed.href;
  } catch {
    return rawUrl.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
  }
}

/**
 * Validates target URLs to protect against Server-Side Request Forgery (SSRF).
 * Enforces HTTPS, blocks private/loopback/link-local/metadata IPs, and verifies hostname allowlists.
 */
export function validateSafeUrl(
  rawUrl: string,
  customAllowedHosts: readonly string[] = [],
): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch (err) {
    throw new SSRFProtectionError(
      `Malformed target URL: ${sanitizeUrl(rawUrl)}`,
      'Ensure the registry or repository URL is a valid absolute URL.',
      { url: sanitizeUrl(rawUrl) },
      { cause: err },
    );
  }

  if (parsed.protocol !== 'https:') {
    throw new SSRFProtectionError(
      `Insecure protocol ${parsed.protocol} for destination ${sanitizeUrl(rawUrl)}. Only https: is allowed.`,
      'Configure dependencies and registries using secure https:// URLs.',
      { url: sanitizeUrl(rawUrl), protocol: parsed.protocol },
    );
  }

  const hostname = parsed.hostname.toLowerCase();

  if (isPrivateOrLoopback(hostname)) {
    throw new SSRFProtectionError(
      `Blocked connection to private or loopback host: ${hostname}`,
      'Public package registries cannot point to private network addresses.',
      { hostname, url: sanitizeUrl(rawUrl) },
    );
  }

  const customHostnames = customAllowedHosts.map(h => {
    try {
      return new URL(h).hostname.toLowerCase();
    } catch {
      return h.toLowerCase();
    }
  });

  const allowedSet = new Set([...DEFAULT_ALLOWED_HOSTS, ...customHostnames]);
  if (!allowedSet.has(hostname)) {
    throw new SSRFProtectionError(
      `Unrecognized target hostname ${hostname} is not in allowedRegistries.`,
      `Add "${parsed.origin}" to allowedRegistries in deppulse.config.json if this is a trusted private registry.`,
      { hostname, url: sanitizeUrl(rawUrl) },
    );
  }

  return parsed;
}
