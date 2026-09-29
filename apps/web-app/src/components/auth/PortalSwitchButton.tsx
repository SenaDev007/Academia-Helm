'use client';

/**
 * ============================================================================
 * PORTAL SWITCH BUTTON — BASCULE DE PORTAIL (DOUBLE CASQUETTE)
 * ============================================================================
 *
 * Bouton partagé permettant au personnel à double casquette (ex : un
 * secrétaire qui est aussi enseignant) de basculer INSTANTANÉMENT entre
 * l'UI École et l'UI Enseignant — sans se déconnecter, sans ressaisir
 * ses identifiants.
 *
 * Fonctionnement :
 *   1. Au montage, interroge /api/portal/auth/switch-options (cache
 *      module-level : une seule requête par page quel que soit le nombre
 *      d'instances). Le bouton ne s'affiche QUE si la casquette cible
 *      existe (profil Teacher actif ↔ poste administratif actif).
 *   2. Au clic : POST /api/portal/auth/switch → la BFF remplace le cookie
 *      de session (portalType) et renvoie le nouveau JWT ; on synchronise
 *      localStorage (persistClientSession) puis on redirige vers /app ou
 *      /app/teacher.
 *
 * Variantes :
 *   - 'sidebar'  : pied de sidebar (TeacherLayout, AdminPortalShell)
 *   - 'dropdown' : item de menu du dropdown profil (PilotageTopBar)
 * ============================================================================
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Building2, GraduationCap, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { persistClientSession } from '@/lib/auth/client-access-token';
import { getTenantRedirectUrl } from '@/lib/utils/tenant-redirect';
// ⭐ P4-final : bouton bilingue (piste EN → anglais)
import { useL } from '@/lib/i18n/bilingual';

type TargetPortal = 'SCHOOL' | 'TEACHER';

interface SwitchOptionsResponse {
  success: boolean;
  current: TargetPortal | 'PARENT' | null;
  available: TargetPortal[];
  teacher: { id: string; matricule: string } | null;
}

/** Cache module-level : une seule requête options par chargement de page. */
let optionsPromise: Promise<SwitchOptionsResponse> | null = null;

function fetchSwitchOptions(): Promise<SwitchOptionsResponse> {
  if (!optionsPromise) {
    optionsPromise = fetch('/api/portal/auth/switch-options', {
      credentials: 'include',
      cache: 'no-store',
    })
      .then((r) => r.json())
      .catch(() => ({ success: false, current: null, available: [], teacher: null }))
      .finally(() => {
        // Réutilisable pendant 60 s (l'éligibilité change rarement)
        setTimeout(() => { optionsPromise = null; }, 60_000);
      });
  }
  return optionsPromise;
}

interface PortalSwitchButtonProps {
  /** Portail vers lequel basculer */
  target: TargetPortal;
  /** Rendu : pied de sidebar ou item de dropdown */
  variant?: 'sidebar' | 'dropdown';
  /** Classes additionnelles (thème du shell hôte) */
  className?: string;
  /** slug du tenant courant (fallback si la réponse ne le fournit pas) */
  tenantSlugFallback?: string | null;
}

export default function PortalSwitchButton({
  target,
  variant = 'sidebar',
  className,
  tenantSlugFallback,
}: PortalSwitchButtonProps) {
  const [eligible, setEligible] = useState<boolean | null>(null);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  // ⭐ P4-final : libellés dans la langue du profil (piste EN → anglais)
  const L = useL();

  useEffect(() => {
    mounted.current = true;
    fetchSwitchOptions().then((opts) => {
      if (mounted.current) {
        setEligible(Array.isArray(opts.available) && opts.available.includes(target));
      }
    });
    return () => { mounted.current = false; };
  }, [target]);

  const handleSwitch = useCallback(async () => {
    if (switching) return;
    setSwitching(true);
    setError(null);
    try {
      const res = await fetch('/api/portal/auth/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ targetPortal: target }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        if (mounted.current) {
          setError(data.message || 'Bascule impossible pour le moment.');
          setSwitching(false);
          // Invalider le cache d'options (l'éligibilité a pu changer)
          optionsPromise = null;
        }
        return;
      }

      // ⭐ Synchroniser localStorage (token, session, portalSessionId) —
      //    même mécanisme que les handlers de login des portails.
      persistClientSession({
        accessToken: data.accessToken,
        portalSessionId: data.portalSessionId,
        user: data.user,
        tenant: data.tenant,
        portalType: data.portalType,
        expiresAt: data.expiresAt,
      });

      // Redirection vers l'UI du portail cible (tenant conservé)
      const tenantSlug =
        data.tenant?.slug ||
        data.tenant?.subdomain ||
        tenantSlugFallback ||
        (typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('tenant')
          : null) ||
        data.tenant?.id ||
        '';
      const redirectUrl = getTenantRedirectUrl({
        tenantSlug,
        tenantId: data.tenant?.id,
        path: target === 'TEACHER' ? '/app/teacher' : '/app',
        portalType: target,
      });
      window.location.href = redirectUrl;
      // Pas de setSwitching(false) : navigation en cours
    } catch {
      if (mounted.current) {
        setError('Erreur réseau lors de la bascule.');
        setSwitching(false);
      }
    }
  }, [switching, target, tenantSlugFallback]);

  // Options pas encore résolues → rien (pas de flash de bouton)
  if (eligible !== true) return null;

  const isTeacherTarget = target === 'TEACHER';
  const Icon = isTeacherTarget ? GraduationCap : Building2;
  const label = isTeacherTarget
    ? L("Basculer vers l'UI Enseignant", 'Switch to Teacher UI')
    : L("Basculer vers l'UI École", 'Switch to School UI');

  if (variant === 'dropdown') {
    return (
      <>
        <button
          onClick={handleSwitch}
          disabled={switching}
          className={cn(
            'w-full flex items-center space-x-3 px-4 py-2.5 text-sm text-blue-700 hover:bg-blue-50 transition-colors disabled:opacity-60',
            className,
          )}
        >
          {switching ? (
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
          ) : (
            <Icon className="w-4 h-4 text-blue-600" />
          )}
          <span>{label}</span>
        </button>
        {error && (
          <p className="px-4 py-1.5 text-xs text-red-600">{error}</p>
        )}
      </>
    );
  }

  // Variante sidebar (pied, au-dessus de « Se déconnecter »)
  return (
    <div className="w-full">
      <button
        onClick={handleSwitch}
        disabled={switching}
        title={L("Changer de portail sans se déconnecter (double casquette)", "Switch portal without logging out (dual role)")}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-blue-700 hover:bg-blue-50 hover:text-blue-800 transition-colors disabled:opacity-60',
          className,
        )}
      >
        {switching ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Icon className="h-4 w-4" />
        )}
        <span>{label}</span>
      </button>
      {error && (
        <p className="px-3 pt-1 text-[10px] leading-tight text-red-600">{error}</p>
      )}
    </div>
  );
}
