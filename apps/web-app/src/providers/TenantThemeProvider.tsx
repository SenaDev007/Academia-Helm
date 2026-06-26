'use client';

/**
 * ============================================================================
 * TenantThemeProvider — Applique le thème du tenant à toute l'application
 * ============================================================================
 *
 * Composant client qui :
 *   1. Charge le thème du tenant courant via tenantThemeService.getSettings()
 *   2. Applique les CSS variables sur <html> via useThemeApplier
 *   3. Se met à jour si le thème change (re-fetch sur focus)
 *
 * À placer en haut du layout applicatif (AppLayoutClient) pour que tout
 * l'admin/back-office hérite des couleurs du thème choisi par le directeur.
 *
 * Non-bloquant : si l'API thème échoue, on garde le thème par défaut
 * (Academia Helm Navy/Blue/Gold).
 * ============================================================================
 */

import { useState, useEffect, useCallback } from 'react';
import { useThemeApplier } from '@/lib/themes/theme-applier';
import { tenantThemeService } from '@/services/tenant-theme.service';
import type { ThemeMode } from '@/lib/themes/themes.config';

interface Props {
  children: React.ReactNode;
}

export function TenantThemeProvider({ children }: Props) {
  const [themeId, setThemeId] = useState<string | null>(null);
  const [mode, setMode] = useState<ThemeMode>('auto');

  // Applique le thème sur <html> dès que themeId/mode changent
  useThemeApplier({ themeId, mode });

  // Charge le thème du tenant courant au montage
  const loadTheme = useCallback(async () => {
    try {
      const settings = await tenantThemeService.getSettings();
      if (settings?.themeId) setThemeId(settings.themeId);
      if (settings?.mode) setMode(settings.mode as ThemeMode);
    } catch {
      // Silencieux : on garde le thème par défaut
    }
  }, []);

  useEffect(() => {
    loadTheme();
  }, [loadTheme]);

  // Re-fetch quand l'utilisateur revient sur l'onglet (pour capter un changement de thème)
  useEffect(() => {
    const handler = () => loadTheme();
    window.addEventListener('focus', handler);
    return () => window.removeEventListener('focus', handler);
  }, [loadTheme]);

  return <>{children}</>;
}
