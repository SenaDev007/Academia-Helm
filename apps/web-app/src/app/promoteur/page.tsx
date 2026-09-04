/**
 * ============================================================================
 * PAGE PROMOTEUR — VUE STRATÉGIQUE DU GROUPE SCOLAIRE
 * ============================================================================
 *
 * Home du promoteur multi-écoles. Route SÉPARÉE de /app/* : elle vit au-dessus
 * du contexte d'une école particulière (pattern identique au back-office
 * /platform) — PilotageLayout n'est PAS appliqué ici.
 *
 * Deux niveaux de lecture :
 *   1. Le GROUPE : KPIs consolidés (effectifs, recettes, impayés, recouvrement)
 *   2. CHAQUE école : carte avec ses propres KPIs (données isolées par tenant)
 *      + action « Entrer dans l'établissement » → /auth/select-tenant → /app
 *      (l'UI complète de l'école reste le filet de sécurité du promoteur).
 *
 * Garde serveur : session obligatoire + rôle stratégique (promoteur /
 * plateforme). Les autres rôles sont redirigés vers /app.
 * ============================================================================
 */

import { getServerSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import type { User } from '@/types';
import PromoterStrategicView from './PromoterStrategicView';

export const dynamic = 'force-dynamic';

/** Rôles autorisés à consulter la vue stratégique (miroir du backend). */
const STRATEGIC_ROLES = [
  'PROMOTER',
  'PROMOTEUR',
  'SCHOOL_OWNER',
  'SUPER_DIRECTOR',
  'PLATFORM_OWNER',
  'SUPER_ADMIN',
];

export default async function PromoterPage() {
  const session = await getServerSession();

  if (!session?.user) {
    redirect('/login');
  }

  const user = session.user as User;

  if (!STRATEGIC_ROLES.includes(user.role || '')) {
    // La vue stratégique ne concerne pas ce rôle → retour à l'app standard.
    redirect('/app');
  }

  return (
    <PromoterStrategicView
      user={{
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        role: user.role || '',
        tenantId: (user as { tenantId?: string }).tenantId || '',
      }}
    />
  );
}
