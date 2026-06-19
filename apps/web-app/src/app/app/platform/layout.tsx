/**
 * ============================================================================
 * PLATFORM LAYOUT — Layout dédié au back-office /app/platform
 * ============================================================================
 *
 * CE LAYOUT COURT-CIRCUITE le layout /app/layout.tsx standard qui contient
 * toute la logique tenant école (session `academia_session`, redirect vers
 * /login portail école, PilotageLayout avec sidebar école, etc.).
 *
 * Le back-office /app/platform est RÉSERVÉ aux admins plateforme authentifiés
 * via /admin-login (cookie `academia_admin_session`). Il ne doit JAMAIS :
 *   - Rediriger vers /login (portail école)
 *   - Exiger une session tenant (cookie academia_session)
 *   - Afficher le PilotageLayout avec sidebar école
 *
 * Si l'utilisateur n'a pas de session admin valide → redirect vers /admin-login
 * (JAMAIS vers /login).
 * ============================================================================
 */

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getAdminServerSession } from '@/lib/admin/admin-auth-server';
import PlatformLayoutClient from './layout-client';

export const dynamic = 'force-dynamic';

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Vérifier la session admin (cookie academia_admin_session)
  const adminSession = await getAdminServerSession();

  if (!adminSession) {
    // Pas de session admin → rediriger vers /admin-login
    // (JAMAIS vers /login qui est le portail école)
    const headersList = await headers();
    const host = headersList.get('host') || headersList.get('x-forwarded-host') || '';
    const protocol = headersList.get('x-forwarded-proto') || 'https';

    // Si on est déjà sur admin.academiahelm.com, rediriger en relatif
    if (host.startsWith('admin.')) {
      redirect(`${protocol}://${host}/admin-login?redirect=/app/platform`);
    }
    // Sinon (par sécurité), rediriger vers admin.academiahelm.com/admin-login
    redirect(`${protocol}://admin.academiahelm.com/admin-login?redirect=/app/platform`);
  }

  // Session admin valide → afficher le layout platform dédié
  return <PlatformLayoutClient admin={adminSession}>{children}</PlatformLayoutClient>;
}
