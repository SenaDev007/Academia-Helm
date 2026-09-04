/**
 * ============================================================================
 * APP LAYOUT - LAYOUT PRINCIPAL DE L'APPLICATION ÉCOLE
 * ============================================================================
 *
 * Layout pour toutes les pages de l'application école authentifiée
 * (/app/hr, /app/finance, /app/students, etc.)
 *
 * Le back-office admin /platform est SÉPARÉ et a son propre layout
 * (voir /platform/layout.tsx). Ce layout ne gère QUE les sessions
 * tenant (cookie academia_session).
 *
 * Si pas de session tenant → redirect vers /login (portail école)
 *
 * ⭐ PORTAILS ADMIN DÉDIÉS (un shell par métier — validation utilisateur) :
 *   Le shell est appliqué PAR RÔLE : un directeur voit TOUTES ses routes
 *   /app/* dans SON shell (AdminPortalShell, navigation propre au métier),
 *   y compris les pages métier partagées (pédagogie, examens, finances…).
 *   Les rôles non migrés (censeur, surveillant, …) et le promoteur
 *   (filet de sécurité : UI complète) conservent le PilotageLayout.
 * ============================================================================
 */

import { redirect } from 'next/navigation';
import dynamic from 'next/dynamic';
import { headers } from 'next/headers';
import { getServerSession } from '@/lib/auth/session';
import { isReservedSubdomain } from '@/lib/tenant/constants';
import { getEffectivePortal } from '@/lib/auth/role-portal-map';
import { getAdminShellForRole } from '@/lib/auth/admin-portal-map';
import { ModalProvider } from '@/components/modules/blueprint/modals/ModalProvider';
import AppLayoutClient from './layout-client';
import AdminPortalShell from '@/components/portals/admin/AdminPortalShell';
import type { User, Tenant } from '@/types';

// ✅ Lazy load du layout lourd pour améliorer le temps de chargement initial
const PilotageLayout = dynamic(
  () => import('@/components/pilotage/PilotageLayout'),
  {
    ssr: true, // ✅ Garder SSR pour le SEO
  }
);

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();

  if (!session?.user) {
    // Pas de session tenant → rediriger vers /login (portail école)
    const headersList = await headers();
    const host = headersList.get('host') || headersList.get('x-forwarded-host') || '';
    const parts = host.split('.');
    const hasSubdomain = parts.length >= 3 && !isReservedSubdomain(parts[0]);

    if (hasSubdomain) {
      // Sur admin.academiahelm.com, rediriger vers /admin-login (pas /login)
      if (parts[0] === 'admin') {
        const protocol = headersList.get('x-forwarded-proto') || 'https';
        redirect(`${protocol}://${host}/admin-login`);
      }
      const protocol = headersList.get('x-forwarded-proto') || 'https';
      redirect(`${protocol}://${host}/login`);
    }
    redirect('/login');
  }

  const user = session.user as User;

  // ⭐ Rediriger les utilisateurs des portails TEACHER/PARENT vers leurs portails
  // dédiés AVANT de rendre le PilotageLayout (qui contient la sidebar école).
  //
  // ⚠️ FIX DOUBLE-CASQUETTE : on évalue `getEffectivePortal()` pour TOUS les
  // utilisateurs, pas seulement ceux dont le rôle DB est enseignant/parent.
  // Le portail CHOISI à la connexion (session.portalType / user.portal) prévaut
  // sur le rôle DB : un personnel cumulant un poste administratif (rôle DB
  // DIRECTOR/DIRECTEUR/...) et un poste d'enseignement qui se connecte via le
  // PORTAIL ENSEIGNANT (matricule) doit atterrir sur /app/teacher, même si son
  // user.role en DB est administratif. Inversement, connecté via le portail
  // ÉCOLE (email), il atterrit sur l'UI école.
  const allHeaders = await headers();
  const reqPath = allHeaders.get('x-path') || '';
  const isOnDedicatedPortal = reqPath.includes('/app/teacher') || reqPath.includes('/app/parent');

  if (!isOnDedicatedPortal) {
    // ⭐ Résoudre le portail effectif : portalType de session > user.portal > role-based fallback
    const effectivePortal = getEffectivePortal(
      user.role,
      (session as any)?.portalType || (user as any)?.portal,
    );

    if (effectivePortal === 'PARENT') {
      redirect('/app/parent');
    } else if (effectivePortal === 'TEACHER') {
      redirect('/app/teacher');
    }
    // Si effectivePortal est SCHOOL/PLATFORM/PUBLIC → on rend le shell ci-dessous
    // (portail admin dédié du métier, ou PilotageLayout).
  }

  // Tenant : session.tenant prioritaire ; si id manquant, utiliser user.tenantId (connexion avec école en mode dev)
  const sessionTenant = session.tenant;
  const tenantIdFromUser = (user as any).tenantId || '';
  const effectiveTenantId = sessionTenant?.id || tenantIdFromUser;
  const tenant: Tenant = sessionTenant && effectiveTenantId
    ? { ...sessionTenant, id: sessionTenant.id || effectiveTenantId }
    : {
        id: effectiveTenantId,
        name: effectiveTenantId ? 'Mon École' : '',
        slug: sessionTenant?.slug ?? '',
        subdomain: sessionTenant?.subdomain ?? '',
        status: 'active',
        subscriptionStatus: 'ACTIVE_SUBSCRIBED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        trialEndsAt: undefined,
        nextPaymentDueAt: undefined,
      } as Tenant as Tenant;

  // ⭐ Pour les routes /app/teacher et /app/parent, on rend directement
  // les children SANS le PilotageLayout.
  if (isOnDedicatedPortal) {
    return (
      <ModalProvider>
        <AppLayoutClient user={user} tenant={tenant}>
          {children}
        </AppLayoutClient>
      </ModalProvider>
    );
  }

  // ⭐ PORTAIL ADMIN DÉDIÉ : le shell du MÉTIER remplace le PilotageLayout.
  // La décision est fondée sur le RÔLE (et non le chemin) : toutes les routes
  // /app/* du directeur s'affichent dans le shell directeur — y compris les
  // pages métier partagées (pédagogie, examens, finances, RH…), réutilisées
  // telles quelles avec leurs sous-navigations internes.
  // Doubles casquettes : le portail choisi à la connexion a déjà été résolu
  // ci-dessus (getEffectivePortal) — un directeur connecté en tant
  // qu'enseignant est redirigé vers /app/teacher avant d'arriver ici.
  const adminShell = getAdminShellForRole(user.role);

  if (adminShell) {
    return (
      <ModalProvider>
        <AppLayoutClient user={user} tenant={tenant}>
          <AdminPortalShell portalKey={adminShell.key}>
            {children}
          </AdminPortalShell>
        </AppLayoutClient>
      </ModalProvider>
    );
  }

  // ⭐ Défaut : UI complète partagée (PilotageLayout) — rôles non encore migrés
  // (censeur, surveillant, secrétaire…) et promoteur/admins (filet de sécurité,
  // accès complet à tous les modules).
  return (
    <ModalProvider>
      <AppLayoutClient user={user} tenant={tenant}>
        <PilotageLayout user={user} tenant={tenant}>
          {children}
        </PilotageLayout>
      </AppLayoutClient>
    </ModalProvider>
  );
}
