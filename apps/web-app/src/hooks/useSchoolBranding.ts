/**
 * useSchoolBranding Hook
 *
 * Résout le branding de l'école (logo, nom, couleurs, slogan)
 * depuis le sous-domaine courant. Utilisé par les pages publiques
 * (PremiumHeader, etc.) pour afficher le branding de l'école
 * au lieu du branding Academia Helm générique.
 */

'use client';

import { useState, useEffect } from 'react';
import { extractTenantSlug } from '@/lib/tenant/constants';
import { getApiBaseUrl } from '@/lib/utils/urls';

export interface SchoolBrandingData {
  name: string;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  slogan: string | null;
  city: string | null;
  phone: string | null;
}

/**
 * Résout le branding de l'école depuis le sous-domaine courant.
 * Côté serveur : passez schoolBranding en prop (depuis le server component).
 * Côté client : ce hook détecte le sous-domaine et fetch les données.
 * 
 * @param serverBranding - Branding résolu côté serveur (optionnel)
 * @returns Les données de branding ou null si pas sur un sous-domaine d'école
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

    // Détecter le sous-domaine
    if (typeof window === 'undefined') return;

    const host = window.location.host;
    const slug = extractTenantSlug(host);

    if (!slug) {
      setResolved(true);
      return;
    }

    // Fetch les données du tenant via l'API NestJS
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
            logoUrl: identity?.logoUrl || settings?.logoUrl || school?.logo || null,
            primaryColor: settings?.primaryColor || school?.primaryColor || null,
            secondaryColor: settings?.secondaryColor || school?.secondaryColor || null,
            slogan: identity?.slogan || settings?.slogan || school?.slogan || school?.motto || null,
            city: identity?.city || settings?.city || school?.city || null,
            phone: identity?.phonePrimary || settings?.phone || school?.primaryPhone || null,
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
