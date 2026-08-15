import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

/**
 * ⭐ GET /api/academic-classes
 * Proxy vers GET /pedagogy/academic-structure/classes du backend.
 * Retourne la liste des classes OFFICIELLES (AcademicClass) — distinctes des
 * classes PHYSIQUES (Class) retournées par /api/all-classes.
 *
 * ⚠️ Le backend /pedagogy/academic-structure/classes exige `academicYearId`.
 * Si absent, il retourne `[]`. Cette route BFF résout automatiquement l'année
 * scolaire active du tenant via GET /settings/academic-years/active.
 *
 * Query params optionnels :
 *   - levelId        : filtrer par niveau pédagogique
 *   - cycleId        : filtrer par cycle
 *   - isActive       : 'true' pour ne retourner que les classes actives
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const headers = await getProxyAuthHeaders(request);

    // ⭐ Résoudre academicYearId si non fourni par l'appelant
    let academicYearId = request.nextUrl.searchParams.get('academicYearId');
    if (!academicYearId) {
      try {
        const yearRes = await fetch(normalizeApiUrl(`${API_URL}/settings/academic-years/active`), {
          headers,
          cache: 'no-store',
        });
        if (yearRes.ok) {
          const yearData = await yearRes.json();
          // L'endpoint peut retourner { id, ... } ou { data: { id, ... } }
          const yearObj = yearData?.data || yearData;
          if (yearObj?.id) {
            academicYearId = yearObj.id;
          } else if (yearObj?.academicYearId) {
            academicYearId = yearObj.academicYearId;
          }
        }
      } catch (e) {
        console.warn('[BFF academic-classes] Failed to resolve active academic year:', e);
      }
    }

    // Si on n'a toujours pas d'academicYearId, retourner un tableau vide
    // (le backend retournerait [] de toute façon)
    if (!academicYearId) {
      console.warn('[BFF academic-classes] No academicYearId available — returning empty array');
      return NextResponse.json([]);
    }

    // Construire l'URL vers le backend avec academicYearId + autres filtres
    const url = new URL(`${API_URL}/pedagogy/academic-structure/classes`);
    url.searchParams.append('academicYearId', academicYearId);
    // Transmettre les autres paramètres reçus (levelId, cycleId, isActive)
    request.nextUrl.searchParams.forEach((value, key) => {
      if (key !== 'academicYearId') { // déjà ajouté
        url.searchParams.append(key, value);
      }
    });

    const response = await fetch(normalizeApiUrl(url.toString()), { headers, cache: 'no-store' });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.warn('[BFF academic-classes] Backend returned', response.status, JSON.stringify(data));
      return NextResponse.json([], { status: 200 }); // fallback vide plutôt qu'erreur
    }

    // La réponse est un tableau d'AcademicClass
    const classes = Array.isArray(data) ? data : (data?.data || data?.classes || []);

    // ⭐ Defense-in-depth : filtrer côté BFF les AcademicClass inactives.
    //    Une AcademicClass est inactive quand son EducationGrade.isEnabled=false
    //    (propagé par syncAcademicClassesFromEducationSettings).
    //    Le backend fait déjà ce filtre par défaut (isActive=true), mais on
    //    l'ajoute ici pour être 100% sûr.
    const filteredClasses = classes.filter((c: any) => c.isActive !== false);

    return NextResponse.json(filteredClasses);
  } catch (error) {
    console.error('Error fetching academic classes:', error);
    return NextResponse.json([], { status: 200 }); // fallback vide
  }
}
