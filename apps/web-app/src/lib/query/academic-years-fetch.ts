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
 */
export async function fetchAcademicYearsSnapshot(tenantId: string | undefined): Promise<AcademicYear[]> {
  if (!tenantId) {
    const res = await fetch('/api/academic-years', { credentials: 'include', cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return normalizeFromPublicApi(data);
  }

  const [years, activeYear] = await Promise.all([
    settingsService.getAcademicYears(tenantId).catch(() => []),
    settingsService.getActiveAcademicYear(tenantId).catch(() => null),
  ]);
  return mergeYearsAndActive(years as unknown[], activeYear);
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
