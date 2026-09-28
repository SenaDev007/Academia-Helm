/**
 * Page Paramètres - Federis
 *
 * ⭐ VRAIES DONNÉES (2026-09-28) : le profil patronat réel (nom, niveau,
 *    abonnement) remplace le libellé codé en dur « Federis des Écoles
 *    Privées » — pattern dashboard.
 */

import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession, getServerToken } from '@/lib/auth';
import { loadFederisProfile } from '@/lib/federis/server-api';
import { getFederisBasePath } from '@/lib/federis/useFederisPath';
import FederisLayout from '@/components/federis/FederisLayout';
import FederisSettingsPage from '@/components/federis/FederisSettingsPage';
import type { User, Tenant } from '@/types';

export const metadata: Metadata = {
  title: 'Paramètres - Federis & Examens',
};

export default async function SettingsPage() {
  const session = await getServerSession();
  if (!session?.user) {
    redirect(`${getFederisBasePath()}/login?redirect=/federis/settings`);
  }

  const user = session.user as User;
  const token = await getServerToken();

  // Profil patronat réel (nom, niveau, pays, abonnement) pour l'en-tête.
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
      <FederisSettingsPage tenantId={federis.id} user={user} />
    </FederisLayout>
  );
}
