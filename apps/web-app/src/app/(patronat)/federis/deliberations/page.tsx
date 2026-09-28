/**
 * Page Délibérations — Academia Federis
 *
 * Workflow délibération → publication → notifications (cahier des charges §9).
 * ⭐ FIX NAVIGATION (2026-09-28) : l'ancienne page était un composant client
 *    isolé SANS FederisLayout ni vérification de session — le clic dans la
 *    sidebar « sortait » de l'application. Pattern des autres pages : composant
 *    serveur + session + layout institutionnel.
 */

import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession, getServerToken } from '@/lib/auth';
import { loadFederisProfile } from '@/lib/federis/server-api';
import { getFederisBasePath } from '@/lib/federis/useFederisPath';
import FederisLayout from '@/components/federis/FederisLayout';
import FederisDeliberationsPage from '@/components/federis/FederisDeliberationsPage';
import type { User, Tenant } from '@/types';

export const metadata: Metadata = {
  title: 'Délibérations - Academia Federis',
};

export default async function DeliberationsPage() {
  const session = await getServerSession();
  if (!session?.user) {
    redirect(`${getFederisBasePath()}/login?redirect=/federis/deliberations`);
  }

  const user = session.user as User;
  const token = await getServerToken();

  // Profil patronat réel (nom, niveau, abonnement) pour l'en-tête institutionnel.
  const profile = await loadFederisProfile(token);

  const federis: Tenant = {
    id: profile?.tenantId || user.tenantId || '',
    name: profile?.name ?? 'Espace Patronat',
    slug: 'federis',
    subdomain: '',
    status: 'active',
    subscriptionStatus: profile?.subscription?.status ?? 'ACTIVE_SUBSCRIBED',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    trialEndsAt: undefined,
    nextPaymentDueAt: profile?.subscription?.expiresAt ?? undefined,
  } as Tenant;

  return (
    <FederisLayout user={user} federis={federis} currentAcademicYear={undefined}>
      <FederisDeliberationsPage />
    </FederisLayout>
  );
}
