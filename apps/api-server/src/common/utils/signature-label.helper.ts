/**
 * ============================================================================
 * SIGNATURE LABEL HELPER — signature des messages par RÔLE de l'émetteur
 * ============================================================================
 * ⭐ 2026-11-26 (retour promoteur) — « Ce n'est pas la direction qui envoie
 * les reçus, c'est la comptabilité […] le secrétaire comptable ou le
 * comptable, en fonction du rôle. Pour les bulletins, on peut parler de la
 * direction. »
 *
 * Une même notification porte désormais la signature du service ÉMETTEUR :
 *   - COMPTABLE / SECRETAIRE_COMPTABLE (et variantes niveau : COMPTABLE_SEC…)
 *     → « Le Comptable » / « Le Secrétaire Comptable » ;
 *   - SECRETAIRE → « Le Secrétariat » ;
 *   - DIRECTEUR / PROMOTEUR → « La Direction » (bulletins, convocations…) ;
 *   - CENSEUR / SURVEILLANT → « La Vie Scolaire » ;
 *   - ENSEIGNANT → « L'Équipe Pédagogique » ;
 *   - inconnu / SYSTEM → le fallback du contexte (« Le Service Comptable »
 *     pour la finance, « L'Administration » sinon).
 *
 * Les libellés sont NEUTRES (nom de fonction/service) : ni masculin ni
 * féminin assumé pour le compte d'une tierce personne.
 * ============================================================================
 */

/** Rôles assimables à la comptabilité (avec variantes niveau _MAT/_PRI/_SEC). */
const ACCOUNTANT_ROLE_RE = /^SECRETAIRE_COMPTABLE|^COMPTABLE/;
/** Rôles assimables à la direction. */
const DIRECTION_ROLE_RE = /^DIRECTEUR|^PROMOTEUR/;
/** Rôles assimables au secrétariat (hors secrétaire-comptable). */
const SECRETARY_ROLE_RE = /^SECRETAIRE/;
/** Rôles assimables à la vie scolaire. */
const SCHOOL_LIFE_ROLE_RE = /^CENSEUR|^SURVEILLANT/;

/**
 * Libellé de signature pour un rôle utilisateur.
 * @param role rôle brut (users.role — ex : 'SECRETAIRE_COMPTABLE_SEC')
 * @param fallback libellé quand le rôle est inconnu/absent (défaut : administration)
 */
export function roleSignatureLabel(role?: string | null, fallback = "L'Administration"): string {
  const r = String(role || '')
    .trim()
    .toUpperCase();
  if (ACCOUNTANT_ROLE_RE.test(r)) {
    // Secrétaire comptable AVANT comptable (préfixe plus long).
    return r.startsWith('SECRETAIRE_COMPTABLE') ? 'Le Secrétaire Comptable' : 'Le Comptable';
  }
  if (DIRECTION_ROLE_RE.test(r)) return 'La Direction';
  if (SECRETARY_ROLE_RE.test(r)) return 'Le Secrétariat';
  if (SCHOOL_LIFE_ROLE_RE.test(r)) return 'La Vie Scolaire';
  if (r.startsWith('ENSEIGNANT')) return "L'Équipe Pédagogique";
  if (r === 'SUPER_ADMIN') return "L'équipe Academia Helm";
  return fallback;
}

/** Fallback standard des messages FINANCE (reçus, encaissements, recouvrements). */
export const ACCOUNTING_FALLBACK_LABEL = 'Le Service Comptable';

/**
 * Résout la signature d'un émetteur : libellé fondé sur son rôle utilisateur.
 * @param prisma  PrismaService
 * @param userId  id de l'utilisateur émetteur (ex : tx.cashierId) — peut être vide
 * @param fallback libellé si l'utilisateur ou son rôle est introuvable
 */
export async function resolveUserSignatureLabel(
  prisma: { user: { findUnique: (args: any) => Promise<{ role: string } | null> } },
  userId?: string | null,
  fallback = "L'Administration",
): Promise<string> {
  if (!userId) return fallback;
  try {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    return roleSignatureLabel(u?.role, fallback);
  } catch {
    return fallback;
  }
}
