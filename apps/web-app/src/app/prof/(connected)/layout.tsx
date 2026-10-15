import { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth';
import { ProfShell } from '@/components/prof/ProfShell';
import type { User, Tenant } from '@/types';

/**
 * Layout de l'espace connecté /prof (groupe de routes (connected)).
 *
 * Double protection (pattern patronat) :
 *   1. middleware-prof.ts — redirige vers /prof/login?redirect=<chemin>
 *   2. ce filet serveur — session absente ou portail ≠ TEACHER → login
 *
 * Le chrome est monté UNE seule fois ici (navigation fluide entre modules),
 * et la pile de providers indispensables aux workspaces pédagogiques est
 * posée par ProfShell (AppSession / AcademicYear / SchoolLevel / Bilingual).
 */
export default async function ProfConnectedLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession();
  if (!session?.user) {
    redirect('/prof/login');
  }

  const user = session.user as User;

  // Le portail prof n'accepte que les sessions enseignant — un promoteur ou
  // un parent connecté ne doit pas accéder à l'espace enseignant autonome.
  const portal = String(
    (session as any).portalType || (user as any).portal || '',
  ).toUpperCase();
  const role = String(user?.role || '').toUpperCase();
  const isTeacherPortal =
    portal === 'TEACHER' ||
    ['TEACHER', 'ENSEIGNANT', 'PROFESSEUR', 'INSTITUTEUR'].includes(role);

  if (!isTeacherPortal) {
    redirect('/prof/login?error=portal');
  }

  const tenant: Tenant = (session.tenant as Tenant) || ({
    id: user.tenantId || '',
    name: 'Mon espace enseignant',
    slug: '',
    subdomain: '',
    status: 'active',
    subscriptionStatus: 'ACTIVE_SUBSCRIBED',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as Tenant);

  return (
    <ProfShell user={user} tenant={tenant}>
      {children}
    </ProfShell>
  );
}
