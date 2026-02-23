/**
 * Mémorisation du dernier email de connexion par tenant.
 * - Un seul email par tenant (pas de liste) : on n’expose jamais les emails d’autres utilisateurs.
 * - Clé = tenant : les utilisateurs du tenant A ne voient jamais les emails du tenant B.
 */

const PREFIX = 'academia_helm_last_email_';

export function getSavedEmailForTenant(tenantKey: string): string | null {
  if (typeof window === 'undefined' || !tenantKey) return null;
  try {
    const raw = localStorage.getItem(PREFIX + tenantKey);
    if (!raw) return null;
    const email = typeof raw === 'string' && raw.includes('@') ? raw.trim().toLowerCase() : null;
    return email;
  } catch {
    return null;
  }
}

export function saveEmailForTenant(email: string, tenantKey: string): void {
  if (!email || !email.includes('@') || !tenantKey) return;
  const trimmed = email.trim().toLowerCase();
  try {
    localStorage.setItem(PREFIX + tenantKey, trimmed);
  } catch {
    // ignore
  }
}
