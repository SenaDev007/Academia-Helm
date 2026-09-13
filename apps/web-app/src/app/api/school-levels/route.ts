/**
 * Niveaux scolaires pour le header = niveaux ACTIVÉS dans Paramètres > Structure.
 * Données provenant de la structure pédagogique (education/structure).
 *
 * IMPORTANT: On enrichit chaque niveau avec schoolLevelId (UUID de school_levels)
 * en le récupérant depuis /api/all-classes. Ceci permet au frontend d'utiliser
 * le bon UUID pour filtrer les classes et créer des fee_structures.
 *
 * ⭐ FIX 2026-09-07 « périmètres restreints » (secrétaires, comptables…) :
 *   L'enrichissement envoyait x-school-level-id=ALL sur toutes ses sources.
 *   Le AccessScopeGuard global (backend) réserve la sentinelle ALL aux profils
 *   transverses (promoteur…) → 403 « Accès refusé » pour tout compte à
 *   périmètre restreint (Staff/StaffAdminAssignment) → schoolLevelMap vide →
 *   niveaux SANS schoolLevelId → sélecteurs vides dans l'inscription
 *   (StudentEnrollmentForm filtre sl.schoolLevelId) + 403 à la finalisation.
 *   → Pour ces comptes, on résout le scope via /context/bootstrap et on
 *   construit la map DIRECTEMENT depuis levelCodes/levelIds (alignés), SANS
 *   jamais envoyer la sentinelle ALL. Les comptes transverses gardent le
 *   comportement historique (sources A/B/C/D avec ALL).
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

/** Miroirs EN → code FR canonique (le scope serveur parle en codes FR). */
const EN_MIRROR_TO_FR: Record<string, string> = {
  NURSERY: 'MATERNELLE',
  PRIMARY: 'PRIMAIRE',
  SECONDARY: 'SECONDAIRE',
};

export async function GET(request: NextRequest) {
  try {
    const headers = await getProxyAuthHeaders(request);

    const fromQuery = request.nextUrl?.searchParams?.get('tenant_id');

    // 1. Récupérer les niveaux depuis education/structure (timeout 15s)
    //    + le scope serveur de l'utilisateur via /context/bootstrap (EN PARALLÈLE).
    //    Le scope est indispensable pour les comptes à périmètre restreint :
    //    la sentinelle x-school-level-id=ALL leur est interdite (AccessScopeGuard).
    const url = new URL(normalizeApiUrl(`${API_BASE_URL}/settings/education/structure`));
    if (fromQuery) url.searchParams.set('tenant_id', fromQuery);

    const bootstrapUrl = new URL(normalizeApiUrl(`${API_BASE_URL}/context/bootstrap`));
    if (fromQuery) bootstrapUrl.searchParams.set('tenant_id', fromQuery);

    const [structureRes, bootstrapRes] = await Promise.allSettled([
      fetchWithTimeout(url.toString(), { headers }, 15000),
      fetchWithTimeout(bootstrapUrl.toString(), { headers }, 15000),
    ]);

    // ⭐ FIX 2026-09-14 « sélecteurs header bloqués » : ne JAMAIS masquer un
    //    échec backend en liste vide « en succès ». Avant : un 401 (JWT expiré
    //    dans academia_session), un 5xx ou un timeout étaient avalés en []
    //    200 → le client croyait à un vide CONFIRMÉ → warning rouge trompeur
    //    « Activez un niveau dans Paramètres » au lieu d'un retry.
    //    → on propage le statut (401/403/5xx) ; les composants legacy font
    //    `Array.isArray(d) ? d : []` donc leur comportement est inchangé,
    //    et le hook du header (fetchSchoolLevels) voit !res.ok → retry.
    if (structureRes.status === 'rejected') {
      return NextResponse.json(
        { error: 'upstream_unavailable', message: 'Structure pédagogique injoignable' },
        { status: 502 },
      );
    }
    if (!structureRes.value.ok) {
      return NextResponse.json(
        { error: 'upstream_error', message: `Structure pédagogique: HTTP ${structureRes.value.status}` },
        { status: structureRes.value.status },
      );
    }

    const response = structureRes.value;
    const data = await response.json().catch(() => ({}));
    let levels = (data?.levels ?? []) as { id: string; name: string; isEnabled?: boolean }[];

    // Scope serveur (Rôles × Pistes × Niveaux) — cf. context.service bootstrap.
    // levelCodes/levelIds sont index-alignés par construction (AccessScopeService).
    let scope: { levelCodes?: string[]; levelIds?: string[]; allLevels?: boolean } | null = null;
    if (bootstrapRes.status === 'fulfilled') {
      try {
        const bootstrapData = await bootstrapRes.value.json().catch(() => ({}));
        scope = bootstrapData?.scope ?? null;
      } catch {
        scope = null;
      }
    }
    const isRestrictedScope =
      !!scope &&
      scope.allLevels === false &&
      Array.isArray(scope.levelIds) &&
      scope.levelIds.length > 0;

    let schoolLevelMap: Record<string, string> = {};

    if (isRestrictedScope && scope?.levelCodes && scope?.levelIds) {
      // ─── Compte à périmètre restreint (secrétaire, comptable…) ───
      // La map code→UUID est connue DIRECTEMENT depuis le scope : aucune
      // source externe nécessaire, aucun header ALL envoyé (aucun 403).
      const scopeCodes: string[] = scope.levelCodes;
      const scopeIds: string[] = scope.levelIds;
      for (let i = 0; i < scopeCodes.length; i++) {
        const uuid = scopeIds[i];
        if (uuid) schoolLevelMap[scopeCodes[i]] = uuid;
      }

      // Restreindre la liste aux niveaux du périmètre (défense en profondeur :
      // le wizard d'inscription ne proposera alors QUE des niveaux autorisés,
      // et la finalisation preRegister/admit passera le contrôle de scope).
      // Les miroirs EN (NURSERY/PRIMARY/SECONDARY) sont rattachés à leur code FR
      // (le scope serveur parle en codes FR — cf. EN_MIRROR_TO_FR).
      const inScope = (name: string) =>
        !!name &&
        (scopeCodes.includes(name) ||
          (!!EN_MIRROR_TO_FR[name] && scopeCodes.includes(EN_MIRROR_TO_FR[name])));
      levels = levels.filter((l) => inScope(l.name));

      const enabledLevels = levels.filter((l) => l.isEnabled !== false);
      return buildScopedLevelsResponse(enabledLevels, schoolLevelMap);
    }

    const enabledLevels = levels.filter((l) => l.isEnabled !== false);

    // 2. Récupérer les school_levels UUIDs depuis 3 sources EN PARALLÈLE
    // ⭐ V10c — CORRECTIF CRITIQUE « schoolLevelId: null » :
    // /api/classes exige désormais un niveau scolaire (« School Level ID is
    // required ») → les 3 sources renvoyaient 400 et l'enrichissement
    // échouait silencieusement → les pages examen filtraient avec l'UUID
    // education_levels (mauvaise table) → plus aucune donnée ne s'affichait.
    // On envoie x-school-level-id=ALL, exactement comme /api/all-classes.
    const allLevelsHeaders = { ...headers, 'x-school-level-id': 'ALL' };

    const [classesRes, acRes, studentsRes] = await Promise.allSettled([
      // Source A: physical classes
      fetchWithTimeout(normalizeApiUrl(`${API_BASE_URL}/classes?limit=200`), { headers: allLevelsHeaders }, 15000),
      // Source B: academic classes
      fetchWithTimeout(normalizeApiUrl(`${API_BASE_URL}/academic-classes?isActive=true`), { headers: allLevelsHeaders }, 15000),
      // Source C: students
      fetchWithTimeout(normalizeApiUrl(`${API_BASE_URL}/students?limit=100`), { headers: allLevelsHeaders }, 15000),
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
    // ⭐ V10c — Miroirs EN : NURSERY/PRIMARY partagent le schoolLevelId de leur
    //    miroir FR (MATERNELLE/PRIMAIRE — cf. bilingual-structure.service).
    //    Sans ce mapping, les vues EN tombent sur l'UUID education_levels
    //    (mauvaise table) → aucune classe/matière/évaluation ne correspond.
    if (!schoolLevelMap['NURSERY'] && schoolLevelMap['MATERNELLE']) {
      schoolLevelMap['NURSERY'] = schoolLevelMap['MATERNELLE'];
    }
    if (!schoolLevelMap['PRIMARY'] && schoolLevelMap['PRIMAIRE']) {
      schoolLevelMap['PRIMARY'] = schoolLevelMap['PRIMAIRE'];
    }

    // ⭐ V10c — Source D (dernier recours) : si une source a échoué pour un
    //    niveau, on interroge school_levels directement (endpoint léger).
    //    Ça garantit que schoolLevelId n'est JAMAIS null quand le niveau
    //    existe côté backend (les miroirs EN partagent le UUID FR).
    //    ⭐ FIX 2026-09-07 : cette source n'est appelée que sur le chemin
    //    « non restreint » (transverse/ouvert) — le header ALL y est autorisé.
    //    ⭐ FIX 2026-09-14 : PARALLÉLISÉE (avant : `for … await` séquentiel —
    //    jusqu'à 10 s PAR niveau manquant → le BFF dépassait le timeout
    //    client/SW de 12 s → « Chargement... » prolongé des sélecteurs).
    const missingLevels = enabledLevels.filter((level) => !schoolLevelMap[level.name]);
    await Promise.all(
      missingLevels.map(async (level) => {
        try {
          const slRes = await fetchWithTimeout(
            normalizeApiUrl(`${API_BASE_URL}/school-levels?code=${encodeURIComponent(level.name)}`),
            { headers: allLevelsHeaders },
            10000,
          );
          if (slRes.ok) {
            const slData = await slRes.json().catch(() => ({}));
            const slList = Array.isArray(slData) ? slData : (slData?.data ?? []);
            const match = slList.find((sl: any) =>
              (sl.code || '').toUpperCase() === (level.name || '').toUpperCase()
            );
            if (match?.id) schoolLevelMap[level.name] = match.id;
          }
        } catch {}
      }),
    );

    return buildScopedLevelsResponse(enabledLevels, schoolLevelMap);
  } catch (error) {
    console.error('Error fetching school levels from structure:', error);
    // ⭐ FIX 2026-09-14 : 502 explicite (plus de [] 200 silencieux — cf. commentaire
    //    en tête de GET). Le hook du header retrye ; les composants legacy
    //    (Array.isArray ? : []) gardent leur comportement liste vide.
    return NextResponse.json(
      { error: 'internal_error', message: 'Chargement des niveaux scolaires impossible' },
      { status: 502 },
    );
  }
}

/**
 * Construit la réponse standard [{ id, code, label, isActive, schoolLevelId }]
 * avec les miroirs EN (NURSERY/PRIMARY ← MATERNELLE/PRIMAIRE) et le cache 60s.
 * Partagé par le chemin restreint (scope) et le chemin historique (ALL).
 */
function buildScopedLevelsResponse(
  enabledLevels: { id: string; name: string; isEnabled?: boolean }[],
  schoolLevelMap: Record<string, string>,
) {
  // Miroirs EN (idem V10c) — faits sur une copie pour ne pas muter la map reçue
  const map: Record<string, string> = { ...schoolLevelMap };
  if (!map['NURSERY'] && map['MATERNELLE']) {
    map['NURSERY'] = map['MATERNELLE'];
  }
  if (!map['PRIMARY'] && map['PRIMAIRE']) {
    map['PRIMARY'] = map['PRIMAIRE'];
  }

  const result = enabledLevels.map((l) => ({
    id: l.id,
    code: l.name,
    label: LEVEL_LABELS[l.name] || l.name,
    isActive: true,
    schoolLevelId: map[l.name] || null,
  }));

  // ⭐ FIX 2026-09-14 : cache NAVIGATEUR uniquement (private) — cette réponse
  //    dépend du COMPTE (périmètre restreint) et du tenant : l'ancien
  //    `public, s-maxage=60` permettait au CDN de servir la réponse d'un AUTRE
  //    utilisateur du même tenant (scope différent) pendant 60 s → sélecteur
  //    incomplet/incohérent par intermittence.
  return NextResponse.json(result, {
    headers: {
      'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
    },
  });
}
