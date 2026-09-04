/**
 * Niveaux scolaires pour le header = niveaux ACTIVÉS dans Paramètres > Structure.
 * Données provenant de la structure pédagogique (education/structure).
 *
 * IMPORTANT: On enrichit chaque niveau avec schoolLevelId (UUID de school_levels)
 * en le récupérant depuis /api/all-classes. Ceci permet au frontend d'utiliser
 * le bon UUID pour filtrer les classes et créer des fee_structures.
 *
 * ⚠️ Pattern standardisé : timeout 15s + cache: 'no-store' + Cache-Control HTTP
 * Voir docs/CACHE_PERFORMANCE_PATTERN.md
 */
import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';

export const dynamic = 'force-dynamic';

const API_BASE_URL = getApiBaseUrlForRoutes();

const LEVEL_LABELS: Record<string, string> = {
  MATERNELLE: 'Maternelle',
  PRIMAIRE: 'Primaire',
  SECONDAIRE: 'Secondaire',
  // ⭐ V10 — miroirs anglophones (structure EN créée via Paramètres > Bilingue)
  NURSERY: 'Nursery',
  PRIMARY: 'Primary',
};

export async function GET(request: NextRequest) {
  try {
    const headers = await getProxyAuthHeaders(request);

    // 1. Récupérer les niveaux depuis education/structure (timeout 15s)
    const url = new URL(normalizeApiUrl(`${API_BASE_URL}/settings/education/structure`));
    const fromQuery = request.nextUrl?.searchParams?.get('tenant_id');
    if (fromQuery) url.searchParams.set('tenant_id', fromQuery);
    const response = await fetchWithTimeout(url.toString(), { headers }, 15000);
    const data = await response.json().catch(() => ({}));
    const levels = (data?.levels ?? []) as { id: string; name: string; isEnabled?: boolean }[];
    const enabledLevels = levels.filter((l) => l.isEnabled !== false);

    // 2. Récupérer les school_levels UUIDs depuis 3 sources EN PARALLÈLE
    let schoolLevelMap: Record<string, string> = {};

    const [classesRes, acRes, studentsRes] = await Promise.allSettled([
      // Source A: physical classes
      fetchWithTimeout(normalizeApiUrl(`${API_BASE_URL}/classes?limit=200`), { headers }, 15000),
      // Source B: academic classes
      fetchWithTimeout(normalizeApiUrl(`${API_BASE_URL}/academic-classes?isActive=true`), { headers }, 15000),
      // Source C: students
      fetchWithTimeout(normalizeApiUrl(`${API_BASE_URL}/students?limit=100`), { headers }, 15000),
    ]);

    // Source A
    if (classesRes.status === 'fulfilled') {
      try {
        const classesData = await classesRes.value.json().catch(() => ({}));
        const classes = Array.isArray(classesData) ? classesData : (classesData?.data ?? []);
        for (const c of classes) {
          if (c.schoolLevel?.code && c.schoolLevelId) {
            schoolLevelMap[c.schoolLevel.code] = c.schoolLevelId;
          }
        }
      } catch {}
    }

    // Source B
    if (acRes.status === 'fulfilled') {
      try {
        const acData = await acRes.value.json().catch(() => ({}));
        const acClasses = Array.isArray(acData) ? acData : (acData?.data ?? []);
        for (const c of acClasses) {
          if (c.schoolLevel?.code && c.schoolLevelId && !schoolLevelMap[c.schoolLevel.code]) {
            schoolLevelMap[c.schoolLevel.code] = c.schoolLevelId;
          }
        }
      } catch {}
    }

    // Source C
    if (studentsRes.status === 'fulfilled') {
      try {
        const studentsData = await studentsRes.value.json().catch(() => ({}));
        const students = Array.isArray(studentsData) ? studentsData : (studentsData?.data ?? []);
        for (const s of students) {
          if (s.schoolLevel?.code && s.schoolLevelId && !schoolLevelMap[s.schoolLevel.code]) {
            schoolLevelMap[s.schoolLevel.code] = s.schoolLevelId;
          }
        }
      } catch {}
    }

    // 3. Construire le résultat avec schoolLevelId
    const result = enabledLevels.map((l) => ({
      id: l.id,
      code: l.name,
      label: LEVEL_LABELS[l.name] || l.name,
      isActive: true,
      schoolLevelId: schoolLevelMap[l.name] || null,
    }));

    // Cache 60s (les niveaux scolaires changent rarement)
    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    console.error('Error fetching school levels from structure:', error);
    return NextResponse.json([], { status: 200 });
  }
}
