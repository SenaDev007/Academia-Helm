/**
 * ============================================================================
 * GOV-DATA API — DONNÉES GOUVERNEMENTALES DU BÉNIN EN TEMPS RÉEL
 * ============================================================================
 *
 * Récupère les statistiques éducatives depuis les plateformes gouvernementales :
 *   - emp.educmaster.bj → Primaire (Maternelle + Primaire)
 *   - secondaire.educmaster.bj → Secondaire
 *
 * Stratégie :
 *   1. Vérifie le cache en mémoire (TTL 6h)
 *   2. Si périmé → relance les requêtes vers les APIs gouvernementales
 *   3. Compare generated_at pour détecter les changements
 *   4. Si l'API est indisponible → sert les données en cache (fallback)
 *
 * Endpoints gouvernementaux (publics, sans authentification) :
 *   GET https://emp.educmaster.bj/api/public/indicateurs-accueil
 *   GET https://secondaire.educmaster.bj/api/public/indicateurs-accueil
 *
 * ============================================================================
 */

import { NextResponse } from 'next/server';

/* ── Types pour les réponses gouvernementales ─────────────────────────── */

interface GovKpiNationaux {
  apprenants: number;
  enseignants: number;
  etablissements: number;
  pct_filles: number;
}

interface GovCirconscription {
  id: number;
  nom: string;
  slug: string;
  etablissements: number;
  apprenants: number;
  enseignants: number;
  pct_filles: number;
}

interface GovEtablissements {
  total: number;
  public: number;
  prive: number;
}

interface GovApprenants {
  total: number;
  public: number;
  prive: number;
}

interface GovEnseignants {
  total: number;
  public: number;
  prive: number;
}

interface GovDepartment {
  nom: string;
  code: string;
  dep_id: number;
  etablissements: GovEtablissements;
  apprenants: GovApprenants;
  enseignants: GovEnseignants;
  pct_filles: number;
  circonscriptions?: GovCirconscription[];
}

interface EmpApiResponse {
  status: number;
  data: {
    disponible: boolean;
    annee: string;
    generated_at: string;
    source: string;
    cycle: string;
    cycle_data_available: boolean;
    kpi_nationaux: GovKpiNationaux;
    par_departement: GovDepartment[];
    cache?: string;
  };
}

interface SecondaireMeta {
  year: string;
  academic_year: string;
  generated_at: string;
  version: string;
  source_path: string;
  sous_systeme: string;
  statut: string;
}

interface SecondaireApiResponse {
  status: number;
  data: {
    disponible: boolean;
    meta: SecondaireMeta;
    kpi_nationaux: GovKpiNationaux;
    par_departement: GovDepartment[];
  };
}

/* ── Mapping code département gouvernemental → notre code interne ──── */

const DEPT_CODE_MAP: Record<string, string> = {
  ALIBORI: 'AL',
  ATACORA: 'AT',
  ATLANTIQUE: 'AQ',
  BORGOU: 'BO',
  COLLINES: 'CO',
  DONGA: 'DO',
  COUFFO: 'KO',
  KOUFFO: 'KO', // variant
  LITTORAL: 'LI',
  MONO: 'MO',
  OUÉMÉ: 'OU',
  OUEME: 'OU',
  PLATEAU: 'PL',
  ZOU: 'ZO',
};

/* ── Cache Redis (Upstash) avec fallback in-memory ──────────────────── */
/*
 * ⚠️ PERFORMANCE — Avant : cache in-memory `let cachedData` uniquement.
 * Problème : sur Vercel, chaque cold start de serverless function perdait
 * le cache → le premier visiteur payait 15-30s d'appels aux APIs gov.
 *
 * Maintenant : cache Upstash Redis (persistant, partagé entre instances)
 * + fallback in-memory si Upstash n'est pas configuré.
 *
 * Variables d'env requises (déjà utilisées par /api/leads et rank-tracker) :
 *   - UPSTASH_REDIS_REST_URL
 *   - UPSTASH_REDIS_REST_TOKEN
 */

interface CachedData {
  primaire: EmpApiResponse | null;
  secondaire: SecondaireApiResponse | null;
  fetchedAt: number;
  primaireGeneratedAt: string | null;
  secondaireGeneratedAt: string | null;
}

// Fallback in-memory (si Upstash indisponible)
let cachedData: CachedData | null = null;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 heures
const REDIS_KEY = 'gov-data:cache';
const REDIS_TTL_SECONDS = 6 * 60 * 60; // 6h

// ─── Helpers Upstash Redis (REST API, pas de SDK requis) ────────────────
async function redisGet<T>(): Promise<T | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const res = await fetch(`${url}/get/${REDIS_KEY}`, {
      headers: { Authorization: `Bearer ${token}` },
      // Pas de cache Next.js pour cette requête interne
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json?.result) return null;
    return JSON.parse(json.result) as T;
  } catch {
    return null;
  }
}

async function redisSet<T>(value: T): Promise<void> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return;
  try {
    await fetch(`${url}/set/${REDIS_KEY}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        value: JSON.stringify(value),
        expire: REDIS_TTL_SECONDS,
      }),
      cache: 'no-store',
    });
  } catch {
    // Silencieux — fallback in-memory reste actif
  }
}

/* ── Fonctions utilitaires ──────────────────────────────────────────── */

function normalizeDeptName(nom: string): string {
  const upper = nom.toUpperCase().replace(/[ÉÈÊË]/g, 'E').replace(/[ÀÂÄ]/g, 'A').replace(/[ÎÏ]/g, 'I').replace(/[ÔÖ]/g, 'O').replace(/[ÙÛÜ]/g, 'U');
  return DEPT_CODE_MAP[upper] || nom.slice(0, 2).toUpperCase();
}

/* ── Fetch avec timeout et gestion d'erreur ─────────────────────────── */

async function fetchWithTimeout(url: string, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'AcademiaHelm/1.0',
      },
      next: { revalidate: 21600 }, // 6h cache Next.js
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

/* ─── Construit la réponse JSON à partir d'un CachedData ──────────────── */
function buildCacheResponse(cached: CachedData, source: 'cache' | 'cache-fallback', warning?: string) {
  const body: any = {
    source,
    fetchedAt: new Date(cached.fetchedAt).toISOString(),
    primaireGeneratedAt: cached.primaireGeneratedAt,
    secondaireGeneratedAt: cached.secondaireGeneratedAt,
    primaire: cached.primaire?.data ?? null,
    secondaire: cached.secondaire?.data ?? null,
  };
  if (warning) body.warning = warning;
  return NextResponse.json(body);
}

/* ── Handler GET ────────────────────────────────────────────────────── */

export async function GET() {
  const now = Date.now();

  // 1. Vérifier le cache Upstash Redis (persistant entre cold starts)
  const redisCached = await redisGet<CachedData>();
  if (redisCached && (now - redisCached.fetchedAt) < CACHE_TTL_MS) {
    return buildCacheResponse(redisCached, 'cache');
  }

  // 2. Fallback : vérifier le cache in-memory (en cas d'Upstash indispo)
  if (cachedData && (now - cachedData.fetchedAt) < CACHE_TTL_MS) {
    return buildCacheResponse(cachedData, 'cache');
  }

  // Fetch les deux APIs en parallèle
  const [primaireResult, secondaireResult] = await Promise.allSettled([
    fetchWithTimeout('https://emp.educmaster.bj/api/public/indicateurs-accueil')
      .then(r => r.json() as Promise<EmpApiResponse>),
    fetchWithTimeout('https://secondaire.educmaster.bj/api/public/indicateurs-accueil')
      .then(r => r.json() as Promise<SecondaireApiResponse>),
  ]);

  const primaire = primaireResult.status === 'fulfilled' ? primaireResult.value : null;
  const secondaire = secondaireResult.status === 'fulfilled' ? secondaireResult.value : null;

  // Si les deux ont échoué, servir le cache si disponible (Redis puis in-memory)
  if (!primaire && !secondaire) {
    if (redisCached) {
      return buildCacheResponse(redisCached, 'cache-fallback', 'APIs gouvernementales indisponibles — données en cache');
    }
    if (cachedData) {
      return buildCacheResponse(cachedData, 'cache-fallback', 'APIs gouvernementales indisponibles — données en cache');
    }
  }

  // Mettre à jour les caches (Redis + in-memory)
  const primaireGeneratedAt = primaire?.data?.generated_at ?? null;
  const secondaireGeneratedAt = secondaire?.data?.meta?.generated_at ?? null;

  const newCache: CachedData = {
    primaire,
    secondaire,
    fetchedAt: now,
    primaireGeneratedAt,
    secondaireGeneratedAt,
  };

  // Écrire dans Redis (fire-and-forget) + in-memory
  void redisSet(newCache);
  cachedData = newCache;

  return NextResponse.json({
    source: 'live',
    fetchedAt: new Date(now).toISOString(),
    primaireGeneratedAt,
    secondaireGeneratedAt,
    primaire: primaire?.data ?? null,
    secondaire: secondaire?.data ?? null,
  });
}
