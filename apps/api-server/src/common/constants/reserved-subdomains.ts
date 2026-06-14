/**
 * Reserved Subdomains — API Server
 *
 * Sous-domaines réservés qui ne doivent JAMAIS être utilisés comme slugs de tenant.
 * Cette liste DOIT être maintenue en synchronisation avec la liste canonique
 * côté frontend : apps/web-app/src/lib/tenant/constants.ts
 *
 * Categories:
 * - Web routing : www, app, portal
 * - Satellite applications : academiafederis
 * - Infrastructure : api, cdn, mail, smtp, ftp, docs
 * - Environments : dev, test, staging, preview, localhost
 * - Admin : admin
 */

export const RESERVED_SUBDOMAINS = new Set([
  // Web routing
  'www',
  'app',
  'portal',
  // Satellite applications
  'academiafederis',
  // Infrastructure
  'api',
  'cdn',
  'mail',
  'smtp',
  'ftp',
  'docs',
  // Environments
  'dev',
  'test',
  'staging',
  'preview',
  'localhost',
  // Admin
  'admin',
]);

/**
 * Vérifie si un sous-domaine est réservé au système.
 * Retourne true si le sous-domaine ne peut pas être utilisé comme slug de tenant.
 */
export function isReservedSubdomain(subdomain: string | null | undefined): boolean {
  if (!subdomain) return true;
  return RESERVED_SUBDOMAINS.has(subdomain);
}
