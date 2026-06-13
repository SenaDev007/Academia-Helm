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

/* ── Cache en mémoire avec TTL ──────────────────────────────────────── */

interface CachedData {
  primaire: EmpApiResponse | null;
  secondaire: SecondaireApiResponse | null;
  fetchedAt: number;
  primaireGeneratedAt: string | null;
  secondaireGeneratedAt: string | null;
}

let cachedData: CachedData | null = null;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 heures

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

/* ── Handler GET ────────────────────────────────────────────────────── */

export async function GET() {
  const now = Date.now();

  // Vérifier le cache
  if (cachedData && (now - cachedData.fetchedAt) < CACHE_TTL_MS) {
    return NextResponse.json({
      source: 'cache',
      fetchedAt: new Date(cachedData.fetchedAt).toISOString(),
      primaireGeneratedAt: cachedData.primaireGeneratedAt,
      secondaireGeneratedAt: cachedData.secondaireGeneratedAt,
      primaire: cachedData.primaire?.data ?? null,
      secondaire: cachedData.secondaire?.data ?? null,
    });
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

  // Si les deux ont échoué, servir le cache si disponible
  if (!primaire && !secondaire && cachedData) {
    return NextResponse.json({
      source: 'cache-fallback',
      warning: 'APIs gouvernementales indisponibles — données en cache',
      fetchedAt: new Date(cachedData.fetchedAt).toISOString(),
      primaireGeneratedAt: cachedData.primaireGeneratedAt,
      secondaireGeneratedAt: cachedData.secondaireGeneratedAt,
      primaire: cachedData.primaire?.data ?? null,
      secondaire: cachedData.secondaire?.data ?? null,
    });
  }

  // Mettre à jour le cache
  const primaireGeneratedAt = primaire?.data?.generated_at ?? null;
  const secondaireGeneratedAt = secondaire?.data?.meta?.generated_at ?? null;

  cachedData = {
    primaire,
    secondaire,
    fetchedAt: now,
    primaireGeneratedAt,
    secondaireGeneratedAt,
  };

  return NextResponse.json({
    source: 'live',
    fetchedAt: new Date(now).toISOString(),
    primaireGeneratedAt,
    secondaireGeneratedAt,
    primaire: primaire?.data ?? null,
    secondaire: secondaire?.data ?? null,
  });
}
