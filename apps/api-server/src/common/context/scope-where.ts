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

/** Filtre niveau sur un where Prisma (champ schoolLevelId par défaut) */
export function levelWhere(scope: AccessScope, field = 'schoolLevelId') {
  if (!scope.resolved || scope.allLevels) return undefined;
  return { [field]: { in: scope.levelIds } };
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
