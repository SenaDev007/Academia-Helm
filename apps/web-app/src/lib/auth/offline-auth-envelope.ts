/**
 * ============================================================================
 * OFFLINE AUTH ENVELOPE — re-connexion hors ligne après un login réussi
 * ============================================================================
 *
 * ⭐ PROBLÈME (retour terrain, sept. 2026 — Task 56) : un utilisateur s'étant
 *    déjà connecté avec succès, puis déconnecté, ne pouvait PLUS se
 *    reconnecter hors ligne (« Vous êtes hors ligne. Vérifiez votre
 *    connexion ») — le login est un POST /api/auth/login réseau, sans
 *    fallback local.
 *
 * ⭐ SOLUTION : au dernier login RÉUSSI (en ligne), on sauvegarde une
 *    « enveloppe » locale :
 *      - l'école (slug/id) + l'identifiant saisi + un hash SHA-256(sel +
 *        mot de passe) — le mot de passe n'est JAMAIS stocké en clair ;
 *      - le snapshot de session (tokens, user, tenant) exactement tel que
 *        passé à persistClientSession.
 *    Hors ligne, une tentative de login avec la MÊME école + MÊME
 *    identifiant + MÊME mot de passe restaure le snapshot dans
 *    localStorage et entre dans l'app :
 *      - pages /app/* : servies par le SW (caches HTML/RSC v3.4.0) ;
 *      - données : cache API identitaire du SW (le token restauré est le
 *        MÊME → la même clé de cache → les réponses précédemment cachées
 *        pendant la session en ligne restent servables hors ligne).
 *
 * ⭐ SÉCURITÉ :
 *    - Le hash salé vérifie que l'utilisateur CONNAÎT le mot de passe (un
 *      mot de passe erroné est refusé, même hors ligne).
 *    - Les tokens de l'enveloppe vivaient déjà dans localStorage avant le
 *      logout : le risque marginal ajouté est faible (données de toute
 *      façon présentes dans les caches du navigateur).
 *    - À la reconnexion, le serveur invalide la session restaurée si elle
 *      a été révoquée au logout → 401 → refresh → re-login en ligne normal.
 *    - TTL 7 jours (au-delà, re-login en ligne obligatoire).
 *    - L'enveloppe est mono-tenant : une école différente de celle de
 *      l'enveloppe est refusée (aucune fuite cross-tenant).
 *    - clearOfflineAuthEnvelope() permet de la purger (hygiène/dépannage).
 * ============================================================================
 */

import { persistClientSession, type PersistClientSessionInput } from './client-access-token';

const ENVELOPE_KEY = 'ah_offline_auth_envelope';
const ENVELOPE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours

/** Snapshot de session tel que persisté au login (persistClientSession). */
export type OfflineSessionSnapshot = PersistClientSessionInput;

export interface OfflineAuthEnvelope {
  v: 1;
  /** Identifiant saisi au login (email enseignant/direction, matricule, téléphone parent…). */
  identifier: string;
  /** Portail du login (SCHOOL, TEACHER, PARENT, PLATFORM…). */
  portalType: string;
  /** École du login (slug et/ou id) — l'enveloppe est mono-tenant. */
  tenantSlug: string | null;
  tenantId: string | null;
  /** Sel aléatoire hex + hash SHA-256(sel:motdepasse) — jamais le mot de passe. */
  salt: string;
  pwHash: string;
  savedAt: number;
  snapshot: OfflineSessionSnapshot;
}

/** Résultat d'une restauration hors ligne réussie. */
export interface OfflineLoginResult {
  portalType: string;
  tenant: { id?: string; slug?: string; subdomain?: string } | null;
  snapshot: OfflineSessionSnapshot;
}

// ─── Hash SHA-256 salé (crypto.subtle — HTTPS requis, toujours vrai en prod) ──

function randomHex(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(input: string): Promise<string | null> {
  try {
    if (typeof crypto === 'undefined' || !crypto.subtle?.digest) return null;
    const data = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
}

// ─── Persistance ─────────────────────────────────────────────────────────

function readEnvelope(): OfflineAuthEnvelope | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(ENVELOPE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OfflineAuthEnvelope;
    if (parsed?.v !== 1 || !parsed.pwHash || !parsed.snapshot) return null;
    // TTL — une enveloppe de plus de 7 jours est périmée (session certainement
    // expirée côté serveur) → purge silencieuse.
    if (!parsed.savedAt || Date.now() - parsed.savedAt > ENVELOPE_TTL_MS) {
      localStorage.removeItem(ENVELOPE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Sauvegarde l'enveloppe après un login RÉUSSI (appelé côté LoginPage juste
 * après persistClientSession). Best-effort : un échec (crypto indisponible,
 * localStorage plein) ne doit JAMAIS casser le login en ligne.
 */
export async function saveOfflineAuthEnvelope(input: {
  identifier: string;
  password: string;
  portalType: string;
  tenantSlug?: string | null;
  tenantId?: string | null;
  snapshot: OfflineSessionSnapshot;
}): Promise<void> {
  if (typeof window === 'undefined') return;
  const identifier = input.identifier?.trim();
  const password = input.password;
  if (!identifier || !password) return; // sans mot de passe vérifiable → pas d'enveloppe
  try {
    const salt = randomHex(16);
    const pwHash = await sha256Hex(`${salt}:${password}`);
    if (!pwHash) return; // crypto.subtle indisponible → pas d'enveloppe
    const envelope: OfflineAuthEnvelope = {
      v: 1,
      identifier: identifier.toLowerCase(),
      portalType: input.portalType,
      tenantSlug: input.tenantSlug?.trim() || null,
      tenantId: input.tenantId?.trim() || null,
      salt,
      pwHash,
      savedAt: Date.now(),
      snapshot: input.snapshot,
    };
    localStorage.setItem(ENVELOPE_KEY, JSON.stringify(envelope));
  } catch {
    /* non-bloquant */
  }
}

/**
 * Tente un login HORS LIGNE : l'identifiant, le mot de passe (hash) et
 * l'école doivent correspondre à l'enveloppe du dernier login réussi.
 * En cas de succès : restaure la session (localStorage + miroir Cache API
 * pour le SW) et retourne le résultat pour la redirection.
 * Retourne null si pas d'enveloppe / périmée / identifiants différents.
 */
export async function tryOfflineLogin(input: {
  identifier: string;
  password: string;
  portalType?: string | null;
  tenantSlug?: string | null;
  tenantId?: string | null;
}): Promise<OfflineLoginResult | null> {
  if (typeof window === 'undefined') return null;
  const identifier = input.identifier?.trim().toLowerCase();
  const password = input.password;
  if (!identifier || !password) return null;

  const envelope = readEnvelope();
  if (!envelope) return null;

  // Identifiant identique (insensible à la casse)
  if (envelope.identifier !== identifier) return null;

  // Cohérence de portail (une enveloppe TEACHER ne doit pas ouvrir SCHOOL)
  if (input.portalType && envelope.portalType.toUpperCase() !== input.portalType.toUpperCase()) {
    return null;
  }

  // Cohérence tenant (mono-tenant strict — aucune bascule d'école offline)
  const requestedSlug = input.tenantSlug?.trim() || null;
  const requestedId = input.tenantId?.trim() || null;
  if (requestedSlug && envelope.tenantSlug && requestedSlug !== envelope.tenantSlug) return null;
  if (requestedId && envelope.tenantId && requestedId !== envelope.tenantId) return null;

  // Vérification du mot de passe (hash salé)
  const pwHash = await sha256Hex(`${envelope.salt}:${password}`);
  if (!pwHash || pwHash !== envelope.pwHash) return null;

  // ✅ Tout correspond → restaurer la session locale
  persistClientSession(envelope.snapshot);

  const snapshotTenant = (envelope.snapshot as { tenant?: { id?: string; slug?: string; subdomain?: string } })
    .tenant;

  return {
    portalType: envelope.portalType,
    tenant: snapshotTenant ?? null,
    snapshot: envelope.snapshot,
  };
}

/** Purge l'enveloppe (hygiène / dépannage explicite — PAS appelée au logout :
 *  toute la finalité est de permettre la reconnexion hors ligne APRÈS un
 *  logout sur un appareil personnel). */
export function clearOfflineAuthEnvelope(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(ENVELOPE_KEY);
  } catch {
    /* noop */
  }
}

/** Indique si une enveloppe hors ligne existe (debug/UI). */
export function hasOfflineAuthEnvelope(): boolean {
  return readEnvelope() !== null;
}
