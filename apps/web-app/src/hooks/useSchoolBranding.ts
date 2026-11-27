/**
 * useSchoolBranding Hook
 *
 * Résout le branding de l'école (logo, nom, couleurs, slogan)
 * depuis le sous-domaine courant, les searchParams URL ou le sessionStorage.
 * Utilisé par les pages publiques (LoginPage, Header, etc.)
 * pour afficher le branding de l'école au lieu du branding Academia Helm générique.
 *
 * Flux de résolution :
 *   1. serverBranding (prop du server component — via BFF)
 *   2. sessionStorage "academia_portal_school" (posé par le portail de sélection)
 *   3. searchParam URL `tenant` (ex: /login?tenant=cspeb) → fetch via BFF
 *   4. Sous-domaine courant (ex: cspeb.academiahelm.com) → fetch via BFF
 */

'use client';

import { useState, useEffect } from 'react';
import { extractTenantSlug } from '@/lib/tenant/constants';
import { fetchPublicBrandColors, readPortalSchoolBrand } from '@/lib/tenant/public-brand';
import type { TenantColors } from '@/lib/tenant/tenant-colors-core';

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
  /** Acronyme de l'école (ex: CSPEB) — affiché à la place du nom complet. */
  schoolAcronym?: string | null;
  /** ⭐ 2026-11-27 — palette de marque du logo (themeId > customColors >
   * logoPalette). Null = aucune palette → rendu Helm par défaut. */
  brandColors?: TenantColors | null;
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
    // Si déjà résolu côté serveur (palette incluse par le server component),
    // ne pas refetch — sauf si le serveur n'avait PAS la palette (fail-open
    // côté serveur ≠ école sans palette : on tente le BFF une fois).
    if (serverBranding) {
      setBranding(serverBranding);
      setResolved(true);
      if (serverBranding.brandColors !== undefined && serverBranding.brandColors !== null) {
        return;
      }
    }

    if (typeof window === 'undefined') return;

    // PRIORITÉ 1 : Vérifier le sessionStorage (école sélectionnée depuis le portail)
    // ⭐ 2026-11-27 — le payload inclut désormais la palette (brandColors)
    //    persistée par le site institutionnel / la page portail.
    const sessionData = readPortalSchoolBrand();
    if (sessionData && sessionData.name) {
      const fromSession: SchoolBrandingData = {
        name: sessionData.name,
        slug: sessionData.slug || '',
        logoUrl: sessionData.logoUrl || null,
        city: sessionData.city || null,
        phone: sessionData.phone || null,
        address: sessionData.address || null,
        primaryColor: null,
        secondaryColor: null,
        slogan: sessionData.slogan || null,
        motto: null,
        schoolAcronym: sessionData.schoolAcronym || null,
        brandColors: sessionData.brandColors || null,
      };
      setBranding(fromSession);
      setResolved(true);
      // Si la palette manque dans le cache, on la résout en arrière-plan
      // (le logo/nom s'affichent déjà — la palette arrive dès que prête).
      if (!fromSession.brandColors && fromSession.slug) {
        fetchPublicBrandColors(fromSession.slug).then((colors) => {
          if (colors) {
            setBranding((prev) => (prev ? { ...prev, brandColors: colors } : prev));
          }
        });
      }
      return;
    }

    // PRIORITÉ 2 : searchParam URL `tenant` (ex: /login?tenant=cspeb&school_name=CSPEB)
    // Permet de résoudre le branding sur le domaine principal quand il n'y a
    // pas de sous-domaine (ex: bouton "Portail École" cliqué depuis
    // /school-portal/portal → redirection vers /login?tenant=xxx).
    let resolvedSlug: string | null = null;
    if (typeof window !== 'undefined') {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const tenantParam = urlParams.get('tenant');
        if (tenantParam && tenantParam.trim()) {
          resolvedSlug = tenantParam.trim();
        }
      } catch {
        // URLSearchParams peut échouer dans certains contextes — ignore.
      }
    }

    // PRIORITÉ 3 : Détecter le sous-domaine et fetch via la route BFF
    if (!resolvedSlug) {
      const host = window.location.host;
      resolvedSlug = extractTenantSlug(host);
    }

    if (!resolvedSlug) {
      setResolved(true);
      return;
    }

    // `slug` est maintenant garanti non-null (const pour la closure fetchBranding).
    const slug: string = resolvedSlug;

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
            schoolAcronym: data.schoolAcronym || null,
            brandColors: serverBranding?.brandColors || null,
          });

          // ⭐ 2026-11-27 — Palette de marque (logo/thème/CMS) : résolue en
          // parallèle du branding, injectée dès qu'elle arrive (le logo et
          // le nom s'affichent immédiatement, les couleurs suivent).
          fetchPublicBrandColors(slug).then((colors) => {
            if (colors) {
              setBranding((prev) => (prev ? { ...prev, brandColors: colors } : prev));
            }
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
