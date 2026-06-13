/**
 * Reserved subdomains that should NOT be treated as school/tenant slugs.
 * These are system-level subdomains for the Academia Helm platform.
 * 
 * IMPORTANT: This is the SINGLE SOURCE OF TRUTH. All files that check
 * subdomains MUST import from here instead of maintaining their own lists.
 */
export const RESERVED_SUBDOMAINS = [
  'www',
  'dev',
  'test',
  'staging',
  'preview',
  'admin',
  'api',
  'portal',
  'app',
  'localhost',
] as const;

/**
 * Check if a subdomain is a reserved/system subdomain.
 * Returns true if the subdomain should NOT be treated as a tenant slug.
 */
export function isReservedSubdomain(subdomain: string | null | undefined): boolean {
  if (!subdomain) return true; // no subdomain = main domain, not a tenant
  return RESERVED_SUBDOMAINS.includes(subdomain as any);
}

/**
 * Extract the tenant slug from a hostname.
 * Returns null if the hostname is the main domain or a reserved subdomain.
 */
export function extractTenantSlug(hostname: string): string | null {
  const parts = hostname.split(':')[0].split('.'); // Remove port, split by dot
  if (parts.length < 3) return null; // e.g. localhost or academiahelm.com
  const subdomain = parts[0];
  if (isReservedSubdomain(subdomain)) return null;
  return subdomain;
}
