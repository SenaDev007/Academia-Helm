/**
 * Années scolaires — même source que le bootstrap Paramètres quand tenantId est défini.
 */
import type { QueryClient } from '@tanstack/react-query';
import * as settingsService from '@/services/settings.service';
import type { AcademicYear } from '@/types/academic-year';
import { academicYearsKeys } from '@/lib/query/academic-years-keys';
import type { SettingsBootstrapPayload } from '@/lib/query/fetch-settings-bootstrap';

function mapRawToAcademicYear(y: {
  id: string;
  name: string;
  startDate?: string;
  endDate?: string;
  isCurrent?: boolean;
  isActive?: boolean;
}): AcademicYear {
  return {
    id: y.id,
    name: y.name,
    label: y.name,
    startDate: y.startDate ?? '',
    endDate: y.endDate ?? '',
    isCurrent: Boolean(y.isCurrent ?? y.isActive),
  };
}

/** Réponse JSON de GET /api/academic-years (déjà mappée isCurrent). */
function normalizeFromPublicApi(data: unknown): AcademicYear[] {
  if (!Array.isArray(data)) return [];
  return data.map((y: any) => mapRawToAcademicYear(y));
}

export function buildAcademicYearsSnapshot(
  years: unknown[] | null | undefined,
  activeYear: unknown | null,
): AcademicYear[] {
  return mergeYearsAndActive(Array.isArray(years) ? years : [], activeYear);
}

function mergeYearsAndActive(years: unknown[], activeYear: unknown | null): AcademicYear[] {
  const yearList = Array.isArray(years) ? years : [];
  const active = activeYear as { id?: string } | null;
  const hasActiveInList = active?.id && yearList.some((y: any) => y?.id === active.id);
  const merged = hasActiveInList
    ? yearList
    : active && !hasActiveInList
      ? [active, ...yearList]
      : yearList;
  return merged.map((y: any) => mapRawToAcademicYear(y));
}

/**
 * Fetch unique pour le sélecteur d’année (évite doublon avec /api/academic-years si tenant connu).
 *
 * ⭐ V19 — ROBUSTESSE LOGIN (retour utilisateur : « quand on se connecte, les
 *    années scolaires ne chargent pas à temps — aucune année scolaire dans le
 *    header à la place du sélecteur ») :
 *    - les ERREURS sont désormais PROPAGÉES (throw) au lieu d'être avalées en
 *      `[]` — avant, une 401 transitoire (redémarrage Railway), un timeout ou
 *      une micro-coupure réseau produisait une liste VIDE « en succès », sans
 *      AUCUN retry React Query → sélecteur rouge « Aucune année scolaire »
 *      pendant 2 minutes (staleTime). Désormais : retry ×3 + refetch tant que
 *      vide (cf. AcademicYearContext) ;
 *    - SNAPSHOT localStorage : chaque succès persiste la liste (clé par tenant)
 *      → au login suivant, le sélecteur s'affiche INSTANTANÉMENT avec la
 *      dernière liste connue (stale-while-revalidate) pendant que le réseau
 *      rafraîchit — plus jamais d'écran « Aucune année scolaire » au démarrage.
 */
export async function fetchAcademicYearsSnapshot(tenantId: string | undefined): Promise<AcademicYear[]> {
  if (!tenantId) {
    const res = await fetch('/api/academic-years', { credentials: 'include', cache: 'no-store' });
    if (!res.ok) {
      // ⭐ V19 : propager (≠ [] silencieux) → React Query RETRYE
      throw new Error(`Chargement des années scolaires impossible (HTTP ${res.status})`);
    }
    const data = await res.json();
    const years = normalizeFromPublicApi(data);
    persistYearsSnapshot('no-tenant', years);
    return years;
  }

  // ⭐ V19 : Promise.allSettled — une erreur RÉSEAU sur la liste principale ne
  //    doit pas être masquée par le catch(() => []) ; seule l'année ACTIVE
  //    (endpoint secondaire) reste optionnelle.
  const [yearsResult, activeYearResult] = await Promise.allSettled([
    settingsService.getAcademicYears(tenantId),
    settingsService.getActiveAcademicYear(tenantId),
  ]);
  if (yearsResult.status === 'rejected') {
    throw new Error(
      `Chargement des années scolaires impossible: ${
        (yearsResult.reason as Error)?.message ?? 'erreur réseau'
      }`
    );
  }
  const years = yearsResult.value as unknown[];
  const activeYear = activeYearResult.status === 'fulfilled' ? activeYearResult.value : null;

  const merged = mergeYearsAndActive(years, activeYear);
  persistYearsSnapshot(tenantId, merged);
  return merged;
}

// ─── V19 : snapshot localStorage (affichage instantané au login) ───────────

const SNAPSHOT_PREFIX = 'ah_years_snapshot:';
const SNAPSHOT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours

interface YearsSnapshot {
  savedAt: number;
  years: AcademicYear[];
}

/** Persiste le snapshot des années (appelé à chaque succès de fetch). */
function persistYearsSnapshot(tenantKey: string, years: AcademicYear[]): void {
  if (typeof window === 'undefined' || years.length === 0) return;
  try {
    const snapshot: YearsSnapshot = { savedAt: Date.now(), years };
    localStorage.setItem(SNAPSHOT_PREFIX + tenantKey, JSON.stringify(snapshot));
  } catch {
    /* quota — non bloquant */
  }
}

/**
 * Relit le snapshot localStorage des années (affichage INSTANTANÉ au montage
 * du sélecteur, avant la réponse réseau). Null si absent/périmé (> 30 j).
 */
export function readAcademicYearsSnapshot(tenantKey: string | undefined): AcademicYear[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SNAPSHOT_PREFIX + (tenantKey ?? 'no-tenant'));
    if (!raw) return null;
    const snapshot = JSON.parse(raw) as YearsSnapshot;
    if (!snapshot?.years?.length) return null;
    if (Date.now() - (snapshot.savedAt || 0) > SNAPSHOT_MAX_AGE_MS) return null;
    return snapshot.years;
  } catch {
    return null;
  }
}

export function academicYearsListFromBootstrapPayload(
  payload: Pick<SettingsBootstrapPayload, 'academicYearsResult'>,
): AcademicYear[] {
  const { years, activeYear } = payload.academicYearsResult;
  return mergeYearsAndActive(years as unknown[], activeYear);
}

/** Alimente le cache « snapshot » depuis le bundle Paramètres (zéro requête réseau en plus). */
export function hydrateAcademicYearsFromBootstrap(
  queryClient: QueryClient,
  tenantId: string | undefined,
  payload: Pick<SettingsBootstrapPayload, 'academicYearsResult'>,
): void {
  const list = academicYearsListFromBootstrapPayload(payload);
  queryClient.setQueryData(academicYearsKeys.snapshot(tenantId ?? 'no-tenant'), list);
}
