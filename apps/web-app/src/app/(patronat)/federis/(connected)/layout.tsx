import { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getServerSession, getServerToken } from '@/lib/auth';
import { loadFederisProfile } from '@/lib/federis/server-api';
import { getFederisBasePath } from '@/lib/federis/useFederisPath';
import FederisLayout from '@/components/federis/FederisLayout';
import type { User, Tenant } from '@/types';

/**
 * Layout PARTAGÉ de l'espace connecté /federis (groupe de routes (connected)).
 *
 * ⭐ OPTIMISATION NAVIGATION (2026-10-01) — corrige les deux irritants remontés
 *    par le promoteur : « les modules prennent du temps à charger » et « la
 *    sidebar fait un jeu de défilement avant de se stabiliser ».
 *
 * AVANT : chaque page (dashboard, examens, candidats…) embarquait son PROPRE
 *   FederisLayout (header + sidebar complets). À chaque changement de module :
 *   1. le loading.tsx affichait un CLONE complet du chrome (sidebar factice),
 *   2. la page serveur résolvait session + profil patronat (appel API bloquant),
 *   3. le VRAI chrome se remontait — la sidebar était donc détruite et
 *      recréée 2 à 3 fois par clic : position de défilement perdue, clignotement,
 *      « jeu de défilement » avant stabilisation.
 *
 * MAINTENANT : le chrome (header + sidebar) est monté UNE SEULE fois par ce
 *   layout. Naviguer entre les modules ne remonte QUE la zone de contenu :
 *   - la sidebar ne bouge plus (scroll préservé, aucun clignotement) ;
 *   - le profil patronat n'est rechargé qu'à l'entrée dans l'espace (1 appel)
 *     au lieu de 2 appels (serveur + client) PAR navigation ;
 *   - les pages serveur sont minces (lecture de cookie locale) → navigation
 *     quasi instantanée, le prefetch Next.js peut même précharger les modules.
 *
 * La protection d'accès reste double : middleware-patronat.ts (redirige vers
 * /federis/login?redirect=<chemin> avec le chemin complet) + ce filet de
 * sécurité serveur (session absente → login).
 */
export default async function FederisConnectedLayout({ children }: { children: ReactNode }) {
  const [session, token] = await Promise.all([getServerSession(), getServerToken()]);
  if (!session?.user) {
    redirect(`${getFederisBasePath()}/login`);
  }

  const user = session.user as User;

  // Profil patronat (nom, niveau NATIONAL/TERRITORIAL, abonnement) — chargé
  // UNE fois à l'entrée de l'espace ; le layout persiste ensuite entre modules.
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
    <FederisLayout
      user={user}
      federis={federis}
      initialProfile={
        profile
          ? {
              orgLevel: profile.orgLevel ?? null,
              userRole: profile.userRole ?? profile.userFunction ?? null,
              logo: profile.logo ?? null,
              name: profile.name,
              subscription: profile.subscription
                ? {
                    status: profile.subscription.status,
                    plan: profile.subscription.plan,
                    expiresAt: profile.subscription.expiresAt ?? null,
                  }
                : null,
            }
          : null
      }
    >
      {children}
    </FederisLayout>
  );
}
