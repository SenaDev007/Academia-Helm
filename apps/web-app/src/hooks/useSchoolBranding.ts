/**
 * useSchoolBranding Hook
 *
 * Résout le branding de l'école (logo, nom, couleurs, slogan)
 * depuis le sous-domaine courant ou le sessionStorage.
 * Utilisé par les pages publiques (LoginPage, Header, etc.)
 * pour afficher le branding de l'école au lieu du branding Academia Helm générique.
 *
 * Flux de résolution :
 *   1. serverBranding (prop du server component — via BFF)
 *   2. sessionStorage "academia_portal_school" (posé par le portail de sélection)
 *   3. API fetch via la route BFF /api/public/schools/by-subdomain/:slug
 */

'use client';

import { useState, useEffect } from 'react';
import { extractTenantSlug } from '@/lib/tenant/constants';

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
 * @param serverBranding - Branding résolu côté serveur (via BFF)
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

    // PRIORITÉ 2 : Détecter le sous-domaine et fetch via la route BFF
    const host = window.location.host;
    const slug = extractTenantSlug(host);

    if (!slug) {
      setResolved(true);
      return;
    }

    const fetchBranding = async () => {
      try {
        // Appeler la route BFF qui proxy vers le backend et extrait le branding
        const response = await fetch(`/api/public/schools/by-subdomain/${slug}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
        });
        if (response.ok) {
          const data = await response.json();
          // La BFF retourne déjà les données de branding extraites (flat object)

          // ⚠️ Si le nom retourné est identique au slug, c'est que le tenant
          // n'a pas de TenantIdentityProfile configuré. On tente un fallback
          // via /api/public/schools/list qui retourne des données pré-résolues
          // avec le vrai nom de l'école (depuis School ou TenantIdentityProfile).
          let resolvedName = data.name || slug;
          let resolvedLogo = data.logoUrl || null;
          let resolvedAddress = data.address || null;
          let resolvedPhone = data.phone || null;
          let resolvedCity = data.city || null;
          let resolvedSlogan = data.slogan || null;
          let resolvedMotto = data.motto || null;

          if (!resolvedLogo || resolvedName === slug) {
            try {
              const listResp = await fetch('/api/public/schools/list', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                cache: 'no-store',
              });
              if (listResp.ok) {
                const schools = await listResp.json();
                const match = (Array.isArray(schools) ? schools : []).find(
                  (s: any) => s.slug === slug || s.subdomain === slug,
                );
                if (match) {
                  // Ne remplacer que les champs manquants
                  if (resolvedName === slug) {
                    resolvedName = match.schoolName || match.name || resolvedName;
                  }
                  if (!resolvedLogo) {
                    resolvedLogo = match.logoUrl || null;
                  }
                  if (!resolvedAddress) {
                    resolvedAddress = match.address || null;
                  }
                  if (!resolvedPhone) {
                    resolvedPhone = match.phonePrimary || match.phone || null;
                  }
                  if (!resolvedCity) {
                    resolvedCity = match.city || null;
                  }
                  if (!resolvedSlogan) {
                    resolvedSlogan = match.slogan || null;
                  }
                  if (!resolvedMotto) {
                    resolvedMotto = match.motto || null;
                  }
                }
              }
            } catch {
              // Fallback list failed — ignore
            }
          }

          // Capitaliser le nom si c'est toujours le slug brut (ex: "cspeb" → "CSPEB")
          if (resolvedName === slug && slug.length <= 10) {
            resolvedName = slug.toUpperCase();
          }

          setBranding({
            name: resolvedName,
            slug: data.slug || slug,
            logoUrl: resolvedLogo,
            city: resolvedCity,
            phone: resolvedPhone,
            address: resolvedAddress,
            primaryColor: data.primaryColor || null,
            secondaryColor: data.secondaryColor || null,
            slogan: resolvedSlogan,
            motto: resolvedMotto,
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
