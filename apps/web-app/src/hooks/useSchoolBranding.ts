/**
 * useSchoolBranding Hook
 *
 * Résout le branding de l'école (logo, nom, couleurs, slogan)
 * depuis le sous-domaine courant ou le sessionStorage.
 * Utilisé par les pages publiques (LoginPage, PremiumHeader, etc.)
 * pour afficher le branding de l'école au lieu du branding Academia Helm générique.
 *
 * Priorité de résolution :
 *   1. serverBranding (prop du server component)
 *   2. sessionStorage "academia_portal_school" (posé par le portail de sélection)
 *   3. API fetch via le sous-domaine courant
 */

'use client';

import { useState, useEffect } from 'react';
import { extractTenantSlug } from '@/lib/tenant/constants';
import { getApiBaseUrl } from '@/lib/utils/urls';

export interface SchoolBrandingData {
  name: string;
  slug: string;
  logoUrl: string | null;
  city: string | null;
  phone: string | null;
  address: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  slogan: string | null;
  motto: string | null;
}

/** Clé sessionStorage utilisée par le portail de sélection d'école */
const SESSION_STORAGE_KEY = 'academia_portal_school';

/**
 * Tente de lire les données d'école depuis sessionStorage.
 * Posé par le portail de sélection (portal/page.tsx) avant redirection.
 */
function readFromSessionStorage(): Partial<SchoolBrandingData> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Résout le branding de l'école depuis le sous-domaine courant,
 * le sessionStorage, ou un fallback serveur.
 *
 * @param serverBranding - Branding résolu côté serveur (optionnel)
 * @returns Les données de branding ou null si aucune école détectée
 */
export function useSchoolBranding(serverBranding?: SchoolBrandingData | null): SchoolBrandingData | null {
  const [branding, setBranding] = useState<SchoolBrandingData | null>(serverBranding || null);
  const [resolved, setResolved] = useState(!!serverBranding);

  useEffect(() => {
    // Si déjà résolu côté serveur, ne pas refetch
    if (serverBranding) {
      setBranding(serverBranding);
      setResolved(true);
      return;
    }

    if (typeof window === 'undefined') return;

    // PRIORITÉ 1 : Vérifier le sessionStorage (école sélectionnée depuis le portail)
    const sessionData = readFromSessionStorage();
    if (sessionData && sessionData.name) {
      setBranding({
        name: sessionData.name,
        slug: sessionData.slug || '',
        logoUrl: sessionData.logoUrl || null,
        city: sessionData.city || null,
        phone: sessionData.phone || null,
        address: sessionData.address || null,
        primaryColor: sessionData.primaryColor || null,
        secondaryColor: sessionData.secondaryColor || null,
        slogan: sessionData.slogan || null,
        motto: sessionData.motto || null,
      });
      setResolved(true);
      return;
    }

    // PRIORITÉ 2 : Détecter le sous-domaine et fetch les données
    const host = window.location.host;
    const slug = extractTenantSlug(host);

    if (!slug) {
      setResolved(true);
      return;
    }

    const fetchBranding = async () => {
      try {
        const apiUrl = getApiBaseUrl();
        const response = await fetch(`${apiUrl}/tenants/by-subdomain/${slug}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
        });
        if (response.ok) {
          const data = await response.json();
          const identity = data.identityProfiles?.[0];
          const settings = data.schoolSettings;
          const school = data.schools;

          setBranding({
            name: identity?.schoolName || settings?.schoolName || school?.name || data.name || slug,
            slug: data.slug || slug,
            logoUrl: identity?.logoUrl || settings?.logoUrl || school?.logo || null,
            city: identity?.city || settings?.city || school?.city || null,
            phone: identity?.phonePrimary || settings?.phone || school?.primaryPhone || null,
            address: identity?.address || settings?.address || school?.address || null,
            primaryColor: settings?.primaryColor || school?.primaryColor || null,
            secondaryColor: settings?.secondaryColor || school?.secondaryColor || null,
            slogan: identity?.slogan || settings?.slogan || school?.slogan || school?.motto || null,
            motto: school?.motto || null,
          });
        }
      } catch (error) {
        console.warn('Failed to resolve school branding:', error);
      } finally {
        setResolved(true);
      }
    };

    fetchBranding();
  }, [serverBranding]);

  return branding;
}
