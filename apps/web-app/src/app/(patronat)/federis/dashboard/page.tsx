/**
 * Page Tableau de bord — Cockpit institutionnel Academia Federis
 *
 * Cahier des charges §7.1 / §8.1 : vue synthétique du périmètre du patronat,
 * orientée décision, sans saisie opérationnelle. Vue consolidée des patronats
 * territoriaux pour le niveau national.
 */

import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession, getServerToken } from '@/lib/auth';
import { loadFederisProfile } from '@/lib/federis/server-api';
import { getFederisBasePath } from '@/lib/federis/useFederisPath';
import FederisLayout from '@/components/federis/FederisLayout';
import FederisDashboardView from '@/components/federis/FederisDashboardPage';
import type { User, Tenant } from '@/types';

export const metadata: Metadata = {
  title: 'Tableau de bord - Academia Federis',
};

export default async function FederisDashboardPage() {
  const session = await getServerSession();
  if (!session?.user) redirect(`${getFederisBasePath()}/login?redirect=/federis/dashboard`);

  const user = session.user as User;
  const token = await getServerToken();

  // Profil patronat réel (nom, niveau, pays, abonnement) pour l'en-tête institutionnel.
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
      <FederisDashboardView />
    </FederisLayout>
  );
}
