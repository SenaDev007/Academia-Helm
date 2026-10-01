/**
 * Page Rapports et statistiques — Academia Federis
 *
 * ⭐ T50 (2026-10-01) — FIX BRANCHEMENT : cette route affichait encore le
 *    placeholder « Page en cours de développement » alors que le composant
 *    réel (FederisReportsPage — onglets Procès-verbal · Statistiques ·
 *    Bilan de session · Bilan financier · Réseau & logistique, T46) existait
 *    déjà. La route rend désormais le composant, avec le profil patronat
 *    réel (pattern des autres pages : session + loadFederisProfile).
 */

import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession, getServerToken } from '@/lib/auth';
import { loadFederisProfile } from '@/lib/federis/server-api';
import { getFederisBasePath } from '@/lib/federis/useFederisPath';
import FederisLayout from '@/components/federis/FederisLayout';
import FederisReportsPage from '@/components/federis/FederisReportsPage';
import type { User, Tenant } from '@/types';

export const metadata: Metadata = {
  title: 'Rapports et statistiques - Academia Federis',
};

export default async function ReportsPage() {
  const session = await getServerSession();
  if (!session?.user) {
    redirect(`${getFederisBasePath()}/login?redirect=/federis/reports`);
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
      <FederisReportsPage />
    </FederisLayout>
  );
}
