/**
 * Niveaux scolaires pour le header = niveaux ACTIVÉS dans Paramètres > Structure.
 * Données provenant de la structure pédagogique (education/structure).
 *
 * IMPORTANT: On enrichit chaque niveau avec schoolLevelId (UUID de school_levels)
 * en le récupérant depuis /api/all-classes. Ceci permet au frontend d'utiliser
 * le bon UUID pour filtrer les classes et créer des fee_structures.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

export const revalidate = 120;

const API_BASE_URL = getApiBaseUrlForRoutes();

const LEVEL_LABELS: Record<string, string> = {
  MATERNELLE: 'Maternelle',
  PRIMAIRE: 'Primaire',
  SECONDAIRE: 'Secondaire',
};

export async function GET(request: NextRequest) {
  try {
    const headers = await getProxyAuthHeaders(request);

    // 1. Récupérer les niveaux depuis education/structure
    const url = new URL(normalizeApiUrl(`${API_BASE_URL}/settings/education/structure`));
    const fromQuery = request.nextUrl?.searchParams?.get('tenant_id');
    if (fromQuery) url.searchParams.set('tenant_id', fromQuery);
    const response = await fetch(url.toString(), { headers });
    const data = await response.json().catch(() => ({}));
    const levels = (data?.levels ?? []) as { id: string; name: string; isEnabled?: boolean }[];
    const enabledLevels = levels.filter((l) => l.isEnabled !== false);

    // 2. Récupérer les classes pour obtenir les schoolLevelId (school_levels UUIDs)
    let schoolLevelMap: Record<string, string> = {}; // code → schoolLevelId
    try {
      const classesUrl = normalizeApiUrl(`${API_BASE_URL}/classes?limit=200`);
      const classesResponse = await fetch(classesUrl, { headers });
      const classesData = await classesResponse.json().catch(() => ({}));
      const classes = Array.isArray(classesData) ? classesData : (classesData?.data ?? []);
      for (const c of classes) {
        if (c.schoolLevel?.code && c.schoolLevelId) {
          schoolLevelMap[c.schoolLevel.code] = c.schoolLevelId;
        }
      }
    } catch {
      // Non bloquant — si les classes ne chargent pas, on continue sans schoolLevelId
    }

    // 3. Construire le résultat avec schoolLevelId
    const result = enabledLevels.map((l) => ({
      id: l.id,                           // education_levels UUID (pour le header)
      code: l.name,                        // MATERNELLE / PRIMAIRE / SECONDAIRE
      label: LEVEL_LABELS[l.name] || l.name,
      isActive: true,
      schoolLevelId: schoolLevelMap[l.name] || null,  // school_levels UUID (pour fee_structures)
    }));
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching school levels from structure:', error);
    return NextResponse.json([], { status: 200 });
  }
}
