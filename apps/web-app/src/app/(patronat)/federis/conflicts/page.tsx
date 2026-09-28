/**
 * Page Gestion des Conflits — Academia Federis
 *
 * Section 12 du cahier technique : résolution manuelle des conflits de
 * synchronisation (SQLite local ↔ PostgreSQL).
 * ⭐ FIX NAVIGATION (2026-09-28) : composant serveur + session + FederisLayout
 *    (pattern des autres pages — l'ancienne page client isolée « sortait »
 *    de l'application).
 */

import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession, getServerToken } from '@/lib/auth';
import { loadFederisProfile } from '@/lib/federis/server-api';
import { getFederisBasePath } from '@/lib/federis/useFederisPath';
import FederisLayout from '@/components/federis/FederisLayout';
import FederisConflictsPage from '@/components/federis/FederisConflictsPage';
import type { User, Tenant } from '@/types';

export const metadata: Metadata = {
  title: 'Gestion des conflits - Academia Federis',
};

export default async function ConflictsPage() {
  const session = await getServerSession();
  if (!session?.user) {
    redirect(`${getFederisBasePath()}/login?redirect=/federis/conflicts`);
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
      <FederisConflictsPage />
    </FederisLayout>
  );
}
