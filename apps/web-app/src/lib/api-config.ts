/**
 * Configuration API centralisée (client + server).
 * NEXT_PUBLIC_API_URL = origine du backend (ex. https://api.academiahelm.com), avec ou sans /api.
 */
import { normalizeToNestApiRoot } from '@/lib/utils/urls';

const FALLBACK_ORIGIN = `http://127.0.0.1:${process.env.API_PORT || '3000'}`;

const raw = process.env.NEXT_PUBLIC_API_URL?.trim();

/** Origine seule (schéma + host + port), sans /api */
export const API_BASE_URL = raw
  ? normalizeToNestApiRoot(raw).replace(/\/api$/, '').replace(/\/+$/, '')
  : FALLBACK_ORIGIN.replace(/\/+$/, '');

/** Racine des routes Nest sous préfixe global /api */
export const API_URL = raw ? normalizeToNestApiRoot(raw) : `${FALLBACK_ORIGIN.replace(/\/+$/, '')}/api`;

export const ENDPOINTS = {
  login: `${API_URL}/auth/login`,
  logout: `${API_URL}/auth/logout`,
  refresh: `${API_URL}/auth/refresh`,

  portal: `${API_URL}/portal`,
  portalLogin: `${API_URL}/portal/login`,

  onboardingDraft: `${API_URL}/onboarding/draft`,
  onboardingSubmit: `${API_URL}/onboarding/submit`,

  /** Liveness Nest (hors préfixe /api) */
  health: `${API_BASE_URL}/health`,
} as const;
