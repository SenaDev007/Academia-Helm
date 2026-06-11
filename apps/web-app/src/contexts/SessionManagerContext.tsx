/**
 * ============================================================================
 * SESSION MANAGER CONTEXT
 * ============================================================================
 *
 * Gestion professionnelle de la session utilisateur :
 *
 * Timeline :
 *   0 – 15 min   → Session active (tokens rafraîchis proactivement)
 *   15 min        → Modal d'avertissement avec compte à rebours de 30 secondes
 *   15 min + 30s  → Verrouillage de session (écran de verrouillage)
 *   45 min total  → Déconnexion complète → redirection vers le portail
 *
 * Le verrouillage conserve l'état de l'application. L'utilisateur saisit
 * ses identifiants pour déverrouiller et reprendre son travail.
 * ============================================================================
 */

'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import {
  tryRefreshAccessToken,
  clearClientSessionSync,
  persistClientAccessToken,
  persistClientSession,
} from '@/lib/auth/client-access-token';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Délai d'inactivité avant affichage du modal d'avertissement (15 minutes) */
const IDLE_TIMEOUT_MS = 15 * 60 * 1000;

/** Durée du compte à rebours du modal d'avertissement (30 secondes) */
const WARNING_COUNTDOWN_S = 30;

/** Délai avant déconnexion automatique après verrouillage (30 minutes) */
const LOCK_EXPIRY_MS = 30 * 60 * 1000;

/** Intervalle de vérification de l'inactivité (15 secondes) */
const IDLE_CHECK_INTERVAL_MS = 15 * 1000;

/** Intervalle de rafraîchissement proactif du token (4 minutes) */
const TOKEN_REFRESH_INTERVAL_MS = 4 * 60 * 1000;

/** Seuil : rafraîchir si le token expire dans moins de 5 minutes */
const TOKEN_EXPIRY_THRESHOLD_MS = 5 * 60 * 1000;

/** Clé localStorage pour le timestamp de dernière activité */
const LAST_ACTIVITY_KEY = 'academia_helm_last_activity';

/** Événements DOM indiquant une activité utilisateur */
const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'mousedown',
  'mousemove',
  'keydown',
  'scroll',
  'touchstart',
  'click',
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SessionState = 'active' | 'warning' | 'locked' | 'expired';

interface SessionManagerContextValue {
  /** État actuel de la session */
  sessionState: SessionState;
  /** Secondes restantes dans le compte à rebours du modal d'avertissement */
  countdownSeconds: number;
  /** L'utilisateur clique « Rester connecté(e) » dans le modal */
  handleStayConnected: () => Promise<void>;
  /** Déverrouiller la session après saisie des identifiants */
  handleUnlock: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  /** Déconnexion manuelle (bouton dans la barre) */
  handleLogout: () => Promise<void>;
  /** Déconnexion depuis l'écran de verrouillage */
  handleLogoutFromLock: () => Promise<void>;
}

const SessionManagerContext = createContext<SessionManagerContextValue | null>(null);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Décode la date d'expiration d'un JWT (en ms) ou null si illisible */
function getTokenExpiryMs(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function SessionManagerProvider({ children }: { children: React.ReactNode }) {
  const [sessionState, setSessionState] = useState<SessionState>('active');
  const [countdownSeconds, setCountdownSeconds] = useState(WARNING_COUNTDOWN_S);

  // Refs pour les timers (éviter les fuites et les fermetures périmées)
  const idleCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lockExpiryRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tokenRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lockedAtRef = useRef<number | null>(null);
  const isTransitioningRef = useRef(false);

  // ---------------------------------------------------------------------------
  // Activity tracking
  // ---------------------------------------------------------------------------

  const recordActivity = useCallback(() => {
    try {
      localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
    } catch {
      // localStorage indisponible
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Proactive token refresh
  // ---------------------------------------------------------------------------

  const refreshTokenProactively = useCallback(async () => {
    // Ne pas rafraîchir si la session n'est pas active
    if (sessionState !== 'active') return;
    try {
      const token = localStorage.getItem('accessToken')?.trim();
      if (!token) return;

      const expiry = getTokenExpiryMs(token);
      if (expiry === null) {
        // Impossible de décoder → rafraîchir par précaution
        await tryRefreshAccessToken();
        return;
      }

      const timeUntilExpiry = expiry - Date.now();
      if (timeUntilExpiry < TOKEN_EXPIRY_THRESHOLD_MS) {
        await tryRefreshAccessToken();
      }
    } catch {
      // Échec non critique — le prochain cycle réessaiera
    }
  }, [sessionState]);

  // ---------------------------------------------------------------------------
  // Full logout (destroys everything and redirects to landing page)
  // ---------------------------------------------------------------------------

  const performFullLogout = useCallback(async (reason?: string) => {
    // Nettoyer tous les timers
    if (idleCheckRef.current) clearInterval(idleCheckRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (lockExpiryRef.current) clearInterval(lockExpiryRef.current);
    if (tokenRefreshRef.current) clearInterval(tokenRefreshRef.current);

    try {
      // Révoquer le token côté backend (best-effort)
      await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    } catch {
      // Non critique
    }

    // Nettoyer le client
    clearClientSessionSync();

    // Rediriger vers le portail (landing page)
    const url = reason ? `/?reason=${reason}` : '/';
    window.location.href = url;
  }, []);

  // ---------------------------------------------------------------------------
  // State transitions
  // ---------------------------------------------------------------------------

  /** Passer à l'état « warning » : afficher le modal avec compte à rebours */
  const enterWarning = useCallback(() => {
    if (isTransitioningRef.current) return;
    isTransitioningRef.current = true;
    setSessionState('warning');
    setCountdownSeconds(WARNING_COUNTDOWN_S);

    let remaining = WARNING_COUNTDOWN_S;
    countdownRef.current = setInterval(() => {
      remaining -= 1;
      setCountdownSeconds(remaining);
      if (remaining <= 0) {
        if (countdownRef.current) clearInterval(countdownRef.current);
        // Verrouiller la session
        setSessionState('locked');
        lockedAtRef.current = Date.now();
        isTransitioningRef.current = false;
      }
    }, 1000);
  }, []);

  // ---------------------------------------------------------------------------
  // User actions
  // ---------------------------------------------------------------------------

  /** L'utilisateur clique « Rester connecté(e) » */
  const handleStayConnected = useCallback(async () => {
    // Annuler le compte à rebours
    if (countdownRef.current) clearInterval(countdownRef.current);
    isTransitioningRef.current = false;

    // Rafraîchir le token et réinitialiser le timer d'activité
    recordActivity();
    setSessionState('active');

    await tryRefreshAccessToken().catch(() => {
      // Si le rafraîchissement échoue, on reste actif — le prochain cycle réessaiera
    });
  }, [recordActivity]);

  /** Déverrouiller la session après saisie des identifiants */
  const handleUnlock = useCallback(
    async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
      try {
        // Récupérer le tenant_id pour le passer au login
        let tenantId: string | undefined;
        try {
          const raw = localStorage.getItem('session');
          if (raw) {
            const parsed = JSON.parse(raw);
            tenantId = parsed.tenantId || parsed.tenant?.id;
          }
        } catch {}

        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            password,
            ...(tenantId ? { tenant_id: tenantId } : {}),
          }),
        });

        const data = await response.json();

        if (!response.ok || !data.accessToken) {
          return {
            success: false,
            error: data.message || 'Identifiants incorrects. Veuillez réessayer.',
          };
        }

        // Mettre à jour les tokens côté client
        persistClientAccessToken({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
        });

        // Mettre à jour le cookie client
        try {
          const { setClientToken } = await import('@/lib/auth/session-client');
          setClientToken(data.accessToken);
        } catch {}

        // Mettre à jour la session complète dans localStorage
        persistClientSession({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          serverSessionId: data.serverSessionId,
          user: data.user,
          tenant: data.tenant,
          expiresAt: data.expiresAt,
        });

        // Réinitialiser l'état
        recordActivity();
        lockedAtRef.current = null;
        setSessionState('active');

        return { success: true };
      } catch (err: any) {
        return {
          success: false,
          error: err.message || 'Erreur de connexion. Veuillez réessayer.',
        };
      }
    },
    [recordActivity],
  );

  /** Déconnexion manuelle (depuis la barre de navigation) */
  const handleLogout = useCallback(async () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (idleCheckRef.current) clearInterval(idleCheckRef.current);
    if (lockExpiryRef.current) clearInterval(lockExpiryRef.current);
    if (tokenRefreshRef.current) clearInterval(tokenRefreshRef.current);
    isTransitioningRef.current = false;

    await performFullLogout('manual');
  }, [performFullLogout]);

  /** Déconnexion depuis l'écran de verrouillage */
  const handleLogoutFromLock = useCallback(async () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (lockExpiryRef.current) clearInterval(lockExpiryRef.current);
    isTransitioningRef.current = false;

    await performFullLogout('session_locked');
  }, [performFullLogout]);

  // ---------------------------------------------------------------------------
  // Periodic checks
  // ---------------------------------------------------------------------------

  /** Vérifier si le délai d'inactivité est atteint */
  const checkInactivity = useCallback(() => {
    if (sessionState !== 'active' || isTransitioningRef.current) return;
    try {
      const lastActivityStr = localStorage.getItem(LAST_ACTIVITY_KEY);
      const lastActivity = lastActivityStr ? parseInt(lastActivityStr, 10) : Date.now();
      const elapsed = Date.now() - lastActivity;

      if (elapsed >= IDLE_TIMEOUT_MS) {
        enterWarning();
      }
    } catch {}
  }, [sessionState, enterWarning]);

  /** Vérifier si le délai de verrouillage est atteint (30 min → déconnexion) */
  const checkLockExpiry = useCallback(() => {
    if (sessionState !== 'locked' || !lockedAtRef.current) return;
    const elapsed = Date.now() - lockedAtRef.current;
    if (elapsed >= LOCK_EXPIRY_MS) {
      // Déconnexion complète
      setSessionState('expired');
      performFullLogout('session_expired');
    }
  }, [sessionState, performFullLogout]);

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  useEffect(() => {
    // Enregistrer l'activité initiale
    recordActivity();

    // Écouter les événements d'activité
    const handleActivity = () => recordActivity();
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, handleActivity, { passive: true });
    }

    // Écouter l'activité cross-tab (localStorage events)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === LAST_ACTIVITY_KEY && e.newValue) {
        recordActivity();
      }
    };
    window.addEventListener('storage', handleStorage);

    // Lancer les vérifications périodiques
    idleCheckRef.current = setInterval(checkInactivity, IDLE_CHECK_INTERVAL_MS);
    lockExpiryRef.current = setInterval(checkLockExpiry, IDLE_CHECK_INTERVAL_MS);
    tokenRefreshRef.current = setInterval(refreshTokenProactively, TOKEN_REFRESH_INTERVAL_MS);

    // Rafraîchir le token immédiatement si nécessaire (au montage)
    refreshTokenProactively();

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, handleActivity);
      }
      window.removeEventListener('storage', handleStorage);

      if (idleCheckRef.current) clearInterval(idleCheckRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (lockExpiryRef.current) clearInterval(lockExpiryRef.current);
      if (tokenRefreshRef.current) clearInterval(tokenRefreshRef.current);
    };
  }, [recordActivity, checkInactivity, checkLockExpiry, refreshTokenProactively]);

  // ---------------------------------------------------------------------------
  // Check on mount if already idle (user came back to a long-idle tab)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    try {
      const lastActivityStr = localStorage.getItem(LAST_ACTIVITY_KEY);
      if (lastActivityStr) {
        const lastActivity = parseInt(lastActivityStr, 10);
        const elapsed = Date.now() - lastActivity;
        if (elapsed >= IDLE_TIMEOUT_MS + WARNING_COUNTDOWN_S * 1000) {
          // Déjà au-delà du délai de warning → verrouiller directement
          setSessionState('locked');
          lockedAtRef.current = lastActivity + IDLE_TIMEOUT_MS + WARNING_COUNTDOWN_S * 1000;
        } else if (elapsed >= IDLE_TIMEOUT_MS) {
          // Dans la période de warning → afficher le modal
          enterWarning();
        }
      }
    } catch {}
    // Uniquement au montage
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // Context value
  // ---------------------------------------------------------------------------

  const value = useMemo<SessionManagerContextValue>(
    () => ({
      sessionState,
      countdownSeconds,
      handleStayConnected,
      handleUnlock,
      handleLogout,
      handleLogoutFromLock,
    }),
    [sessionState, countdownSeconds, handleStayConnected, handleUnlock, handleLogout, handleLogoutFromLock],
  );

  return (
    <SessionManagerContext.Provider value={value}>
      {children}
    </SessionManagerContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSessionManager(): SessionManagerContextValue {
  const ctx = useContext(SessionManagerContext);
  if (!ctx) {
    throw new Error('useSessionManager must be used within <SessionManagerProvider>');
  }
  return ctx;
}

export function useSessionManagerOptional(): SessionManagerContextValue | null {
  return useContext(SessionManagerContext);
}
