/**
 * Page Épreuves et documents - Federis
 *
 * ⭐ REFONTE (2026-09-29) — module scindé en deux onglets :
 *    1. « Épreuves » : création d'épreuves avec les champs enrichis
 *       d'Academia Helm (RichTextEditor : images, figures, maths, tableaux,
 *       calligraphie…) + en-tête réutilisable du patronat + PDF backend ;
 *    2. « Catalogue » : épreuves classées par année scolaire puis par
 *       examen (CEP / BEPC / Baccalauréat / CAP).
 */

import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession, getServerToken } from '@/lib/auth';
import { loadFederisProfile } from '@/lib/federis/server-api';
import { getFederisBasePath } from '@/lib/federis/useFederisPath';
import FederisLayout from '@/components/federis/FederisLayout';
import FederisEpreuvesPage from '@/components/federis/FederisEpreuvesPage';
import type { User, Tenant } from '@/types';

export const metadata: Metadata = {
  title: 'Épreuves et documents - Federis',
};

export default async function DocumentsPage() {
  const session = await getServerSession();
  if (!session?.user) {
    redirect(`${getFederisBasePath()}/login?redirect=/federis/documents`);
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
      {/* userRole = User.role de la session — normalisé côté composant */}
      <FederisEpreuvesPage userRole={user.role} />
    </FederisLayout>
  );
}
