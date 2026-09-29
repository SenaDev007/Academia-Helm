/**
 * Page Équipe & Comptes — Academia Federis
 *
 * Réservée au COORDONNATEUR du patronat (middleware-patronat + garde API) :
 * création des comptes membres (secrétaire, trésorier, organisateur,
 * chargé de mission), changement de fonction, activation / désactivation
 * et réinitialisation des mots de passe.
 */

import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession, getServerToken } from '@/lib/auth';
import { loadFederisProfile } from '@/lib/federis/server-api';
import { getFederisBasePath } from '@/lib/federis/useFederisPath';
import FederisLayout from '@/components/federis/FederisLayout';
import FederisTeamPage from '@/components/federis/FederisTeamPage';
import type { User, Tenant } from '@/types';

export const metadata: Metadata = {
  title: 'Équipe & Comptes - Academia Federis',
};

export default async function TeamPage() {
  const session = await getServerSession();
  if (!session?.user) redirect(`${getFederisBasePath()}/login?redirect=/federis/team`);

  const user = session.user as User;
  const token = await getServerToken();
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
  } as unknown as Tenant;

  return (
    <FederisLayout user={user} federis={federis}>
      <FederisTeamPage />
    </FederisLayout>
  );
}
