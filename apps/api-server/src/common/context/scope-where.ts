/**
 * ============================================================================
 * SCOPE WHERE — helpers Prisma d'application de l'AccessScope
 * ============================================================================
 * ⭐ Filtre intelligent Rôles × Pistes × Niveaux (P3 — helper central).
 *
 * Usage dans un service :
 *   const scope = req.user.scope;                     // résolu par JwtStrategy
 *   const where = scopeWhere.studentList(scope, { tenantId, ...filters });
 *   const rows = await prisma.student.findMany({ where });
 *
 * RÈGLES :
 *   - Le filtre client ne peut qu'AFFINER dans le scope, jamais élargir
 *     (les valeurs hors scope sont ignorées, pas injectées).
 *   - Piste d'une classe : Class.language ('FR'/'EN') avec academicTrackId
 *     en source secondaire ; NULL/non marqué = FR (règle historique UI).
 *   - Piste d'un élève : classe courante (ClassStudent → Class).
 * ============================================================================
 */

import { ForbiddenException } from '@nestjs/common';
import { AccessScope } from './access-scope.service';
import { resolveSchoolLevelFilter } from './resolve-school-level';

/** Filtre niveau sur un where Prisma (champ schoolLevelId par défaut) */
export function levelWhere(scope: AccessScope, field = 'schoolLevelId') {
  if (!scope.resolved || scope.allLevels) return undefined;
  return { [field]: { in: scope.levelIds } };
}

/**
 * ⭐ 2026-09-15 — Résout le FILTRE DE NIVEAU EFFECTIF d'une requête liste
 * pédagogie : query param `schoolLevelId` en priorité, sinon le header
 * `x-school-level-id` (envoyé par pedagogyFetch / axios selon le sélecteur
 * de niveau global). Toute valeur passe par resolveSchoolLevelFilter
 * (tolérance UUID school_levels / UUID education_levels / miroirs EN /
 * composites MAT_PRI) → un UUID school_levels prêt pour le where Prisma.
 *
 * @returns undefined si pas de filtre (sentinelles 'ALL'/vides) ou valeur
 *          composite multi-niveaux (on laisse alors le périmètre serveur
 *          s'appliquer via applyLevelScope) ; sinon l'UUID school_levels.
 */
export async function resolveEffectiveLevelFilter(
  prisma: any,
  tenantId: string,
  explicitQuery?: string | null,
  headerValue?: string | null,
): Promise<string | undefined> {
  const query = (explicitQuery || '').trim();
  const header = (headerValue || '').trim();
  const candidate =
    query && query.toUpperCase() !== 'ALL'
      ? query
      : header && header.toUpperCase() !== 'ALL'
        ? header
        : undefined;
  if (!candidate) return undefined;
  try {
    const resolved = await resolveSchoolLevelFilter(prisma, tenantId, candidate);
    if (!resolved || resolved.length === 0) return candidate; // inconnu → comportement historique
    // Multi-niveaux (composite MAT_PRI…) → pas de filtre simple : le scope
    // serveur (applyLevelScope) appliquera le périmètre complet.
    return resolved.length === 1 ? resolved[0] : undefined;
  } catch {
    return candidate;
  }
}

/**
 * ⭐ Filtre niveau PÉDAGOGIE (2026-09-15) — application du périmètre serveur
 * sur un where Prisma EXISTANT (mutation), pour les listes du module pédagogie
 * (matières, enseignants, affectations, emplois du temps, sections).
 *
 * Règles :
 *   - Compte transverse (promoteur, plateforme…) ou scope non résolu → no-op
 *     (le promoteur voit TOUS les niveaux).
 *   - Filtre explicite client déjà présent dans le where → CONSERVÉ tel quel
 *     (le AccessScopeGuard global a déjà validé qu'il est dans le périmètre,
 *     avec la tolérance UUID education_levels / miroirs EN / composites —
 *     cf. resolve-school-level.ts ; le client ne peut pas élargir).
 *   - Aucun filtre (y compris sentinelle 'ALL' non posée dans le where) →
 *     injection du périmètre complet { in: levelIds } : un directeur MAT_PRI
 *     ne voit QUE les matières/enseignants/EDT de ses niveaux, un directeur
 *     SEC uniquement le secondaire.
 */
export function applyLevelScope(
  where: Record<string, any>,
  scope: AccessScope | undefined | null,
  field = 'schoolLevelId',
): void {
  if (!scope || !scope.resolved || scope.allLevels) return;
  if (where[field]) return; // filtre explicite (déjà validé par le guard)
  where[field] = { in: scope.levelIds };
}

/**
 * Filtre piste pour les entités liées à une CLASSE (Class, ou entités avec
 * relation class). Retourne un bloc OR à merger dans le where de la classe.
 * - scope mono-piste FR → classes FR + non marquées (langue null = héritage FR)
 * - scope mono-piste EN → classes EN uniquement
 */
export function classTrackWhere(scope: AccessScope) {
  if (!scope.resolved || scope.allTracks) return undefined;
  const tracks = scope.trackCodes;
  if (tracks.includes('EN') && !tracks.includes('FR')) {
    // Piste EN stricte : marquées EN (language ou trackId)
    return {
      OR: [
        { language: 'EN' },
        ...(scope.trackIds.length > 0 ? [{ academicTrackId: { in: scope.trackIds } }] : []),
      ],
    };
  }
  // Piste FR : marquées FR + non marquées (NULL = héritage FR)
  // ⭐ FIX 2026-09-06 (D6) : `{ language: { in: ['FR', null] } }` est REFUSÉ par
  //    Prisma (null interdit dans une liste `in`) → 400 PrismaClientValidationError
  //    sur TOUTES les listes FR. Forme valide : OR de deux égalités.
  return {
    AND: [
      {
        OR: [
          { language: 'FR' },
          { language: null },
          ...(scope.trackIds.length > 0
            ? [{ academicTrackId: { in: scope.trackIds } }, { academicTrackId: null, language: null }]
            : [{ academicTrackId: null, language: null }]),
        ],
      },
    ],
  };
}

/**
 * Filtre piste pour les ÉLÈVES — bloc Prisma à merger dans le where Student.
 *
 * La piste d'un élève = sa classe courante, résolue par UNION des deux
 * relations historiques (studentEnrollments = 93 rows en prod tenant test,
 * classStudents = 13 rows pour les inscriptions récentes piste EN).
 * Règle héritage : aucune classe EN = piste FR (convention UI existante).
 *
 * - scope mono-piste EN → élève ayant une classe EN (l'une ou l'autre relation)
 * - scope mono-piste FR → élève n'ayant AUCUNE classe EN (FR + non marqués)
 */
export function studentTrackRelation(scope: AccessScope) {
  if (!scope.resolved || scope.allTracks) return undefined;
  const trackIds = scope.trackIds;
  const enClass: any = { language: 'EN' };
  if (trackIds.length > 0) {
    enClass.OR = [{ language: 'EN' }, { academicTrackId: { in: trackIds } }];
  }

  if (scope.trackCodes.includes('EN') && !scope.trackCodes.includes('FR')) {
    // Piste EN stricte
    return {
      OR: [
        { classStudents: { some: { class: enClass } } },
        { studentEnrollments: { some: { class: enClass } } },
      ],
    };
  }
  // Piste FR : exclusion des élèves marqués EN (héritage FR pour les non marqués)
  return {
    AND: [
      { classStudents: { none: { class: enClass } } },
      { studentEnrollments: { none: { class: enClass } } },
    ],
  };
}

/**
 * Fusionne le scope dans un where existant (niveau + piste élèves).
 * Utilisé par les listes d'élèves / classes / entités level-scopées.
 */
export function scopedWhere(scope: AccessScope, base: any): any {
  const out: any = { ...base };
  const lvl = levelWhere(scope);
  if (lvl) {
    if (out.schoolLevelId && out.schoolLevelId !== 'ALL') {
      // Le client a demandé un niveau : accepté seulement s'il est DANS le scope
      if (typeof out.schoolLevelId === 'string' && !scope.levelIds.includes(out.schoolLevelId)) {
        throw new ForbiddenException(
          `Votre périmètre n'inclut pas ce niveau scolaire.`,
        );
      }
    } else {
      Object.assign(out, lvl);
    }
  }
  const stu = studentTrackRelation(scope);
  if (stu) {
    out.AND = [...(out.AND || []), stu];
  }
  return out;
}

/**
 * Filtre piste sur les paiements (Payment.academicTrackId dénormalisé).
 * NULL = piste indéterminée → exonéré du filtre piste (données historiques).
 */
export function paymentTrackWhere(scope: AccessScope) {
  if (!scope.resolved || scope.allTracks) return undefined;
  if (scope.trackCodes.includes('EN') && !scope.trackCodes.includes('FR')) {
    return { OR: [{ academicTrackId: { in: scope.trackIds } }, { academicTrackId: null }] };
  }
  return {
    OR: [
      { academicTrackId: { in: scope.trackIds } },
      { academicTrackId: null },
    ],
  };
}

/**
 * Filtre piste sur les entités possédant une colonne `language` propre
 * (Subject, Exam, ReportCard…) — NULL = héritage FR.
 */
export function languageColumnTrackWhere(scope: AccessScope) {
  if (!scope.resolved || scope.allTracks) return undefined;
  if (scope.trackCodes.includes('EN') && !scope.trackCodes.includes('FR')) {
    return { language: 'EN' };
  }
  // ⭐ FIX 2026-09-06 (D6) : forme OR valide (null interdit dans une liste `in`)
  return { OR: [{ language: 'FR' }, { language: null }] };
}

/**
 * Post-fetch : vérifie qu'un enregistrement chargé par ID est dans le scope
 * niveau de l'utilisateur (anti-IDOR). Renvoie 403 sinon.
 */
export function assertLevelInScope(
  scope: AccessScope,
  record: { schoolLevelId?: string | null } | null | undefined,
  what = 'cette ressource',
): void {
  if (!scope.resolved || scope.allLevels || !record?.schoolLevelId) return;
  if (!scope.levelIds.includes(record.schoolLevelId)) {
    throw new ForbiddenException(`Accès refusé : ${what} n'appartient pas à votre niveau scolaire.`);
  }
}

/**
 * Post-fetch : vérifie qu'un enregistrement lié à une classe est dans le
 * scope piste. La classe doit être incluse dans la requête Prisma.
 */
export function assertClassTrackInScope(
  scope: AccessScope,
  record: { language?: string | null; academicTrackId?: string | null } | null | undefined,
  what = 'cette ressource',
): void {
  if (!scope.resolved || scope.allTracks || !record) return;
  const lang = record.language || null;
  // Détermination de la piste effective : marquage explicite sinon héritage FR
  let isEN: boolean;
  if (lang === 'EN') isEN = true;
  else if (lang === 'FR') isEN = false;
  else if (
    record.academicTrackId != null &&
    scope.trackIds.includes(record.academicTrackId)
  ) isEN = true;
  else isEN = false; // non marqué → héritage FR

  if (scope.trackCodes.includes('EN') && !scope.trackCodes.includes('FR')) {
    if (!isEN) {
      throw new ForbiddenException(`Accès refusé : ${what} n'appartient pas à votre piste linguistique.`);
    }
  } else if (scope.trackCodes.includes('FR') && !scope.trackCodes.includes('EN')) {
    if (isEN) {
      throw new ForbiddenException(`Accès refusé : ${what} n'appartient pas à votre piste linguistique.`);
    }
  }
}
