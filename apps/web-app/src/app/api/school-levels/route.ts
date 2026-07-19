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

export const revalidate = 0; // ⭐ Force dynamic — ne pas cacher (schoolLevelId peut changer)

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

    // 2. Récupérer les school_levels UUIDs depuis plusieurs sources
    let schoolLevelMap: Record<string, string> = {}; // code → schoolLevelId

    // Source A: physical classes (Class table)
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
    } catch {}

    // Source B: academic classes (AcademicClass table) — fallback si pas de
    // classes physiques. AcademicClass.levelId est un FK vers education_levels,
    // PAS vers school_levels. Mais AcademicClass peut avoir une relation
    // schoolLevel si elle existe.
    try {
      const acUrl = normalizeApiUrl(`${API_BASE_URL}/academic-classes?isActive=true`);
      const acResponse = await fetch(acUrl, { headers });
      const acData = await acResponse.json().catch(() => ({}));
      const acClasses = Array.isArray(acData) ? acData : (acData?.data ?? []);
      for (const c of acClasses) {
        if (c.schoolLevel?.code && c.schoolLevelId && !schoolLevelMap[c.schoolLevel.code]) {
          schoolLevelMap[c.schoolLevel.code] = c.schoolLevelId;
        }
      }
    } catch {}

    // Source C: /api/students (list) — extrait schoolLevelId depuis les
    // élèves existants. C'est le fallback le plus fiable car les élèves
    // ont toujours un schoolLevelId valide (FK vers school_levels).
    // On l'exécute TOUJOURS (pas seulement si A et B sont vides) pour
    // remplir les manquants.
    try {
      const studentsUrl = normalizeApiUrl(`${API_BASE_URL}/students?limit=100`);
      const studentsResponse = await fetch(studentsUrl, { headers });
      const studentsData = await studentsResponse.json().catch(() => ({}));
      const students = Array.isArray(studentsData) ? studentsData : (studentsData?.data ?? []);
      for (const s of students) {
        if (s.schoolLevel?.code && s.schoolLevelId && !schoolLevelMap[s.schoolLevel.code]) {
          schoolLevelMap[s.schoolLevel.code] = s.schoolLevelId;
        }
      }
    } catch {}

    // 3. Construire le résultat avec schoolLevelId
    const result = enabledLevels.map((l) => ({
      id: l.id,                           // education_levels UUID (pour le header)
      code: l.name,                        // MATERNELLE / PRIMAIRE / SECONDAIRE
      label: LEVEL_LABELS[l.name] || l.name,
      isActive: true,
      schoolLevelId: schoolLevelMap[l.name] || null,  // school_levels UUID
    }));
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching school levels from structure:', error);
    return NextResponse.json([], { status: 200 });
  }
}
