/**
 * ============================================================================
 * ACCESS SCOPE SERVICE — « Never trust the client scope »
 * ============================================================================
 * ⭐ Filtre intelligent Rôles × Pistes × Niveaux (P1 — noyau).
 *
 * PRINCIPE :
 *   Le périmètre d'un utilisateur (niveaux scolaires autorisés, pistes
 *   linguistiques autorisées, classes pour un enseignant) est DÉRIVÉ SERVEUR
 *   depuis les tables métier (Teacher, Staff, StaffAssignment,
 *   StaffAdminAssignment), résolu UNE fois par requête, mis en cache 2 min,
 *   puis IMPOSÉ aux requêtes Prisma via les guards et le helper applyScope().
 *   Le client peut affiner DANS son scope, jamais élargir.
 *
 * SOURCES (union, cumuls gérés) :
 *   1. Rôles transverses (promoteur, plateforme…) → tout voir (décision D2)
 *   2. Teacher (lien email) → schoolLevelId + assignedLanguages
 *   3. Staff (lien email) → schoolLevelId + assignedLanguages
 *   4. StaffAdminAssignment (toutes actives) → schoolLevelCode (MAT/PRI/SEC/
 *      MAT_PRI/ALL) + academicTrackId (null = les deux pistes — décision D1)
 *   5. StaffAssignment (affectations pédagogiques) → schoolLevelId + classId
 *   6. TeacherClassAssignment → classIds de l'enseignant
 *   7. Suffixe du User.role (défense en profondeur : DIRECTEUR_MAT_PRI…)
 *
 * CONVENTIONS :
 *   - Niveaux : codes LONGS de SchoolLevel ('MATERNELLE','PRIMAIRE','SECONDAIRE').
 *     Les codes courts (MAT/PRI/SEC/MAT_PRI) de StaffAdminAssignment sont mappés.
 *   - Pistes : codes 'FR'/'EN' (AcademicTrack.code + Class.language).
 *   - La piste d'un élève = classe courante (ClassStudent → Class.language /
 *     academicTrackId). NULL/absent = non marqué → traité FR (règle historique).
 *
 * RÉTRO-COMPATIBILITÉ :
 *   - Compte sans profil métier identifiable → scope ouvert (comportement
 *     antérieur inchangé) + log de traçabilité.
 *   - Teacher.assignedLanguages null → pas de restriction piste.
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../services/cache.service';

export interface AccessScope {
  /** false = compte sans profil métier identifiable → pas d'enforcement (rétro-compat) */
  resolved: boolean;
  /** Compte transverse (plateforme / promoteur / DG) → tous niveaux + toutes pistes */
  transverse: boolean;

  staffId?: string;
  teacherId?: string;
  isTeacher: boolean;
  isAdmin: boolean;

  /** Niveaux autorisés (codes SchoolLevel longs) — vide + !allLevels = RIEN */
  levelCodes: string[];
  /** UUIDs des SchoolLevel autorisés (prêts pour where schoolLevelId IN) */
  levelIds: string[];
  allLevels: boolean;

  /** Pistes autorisées ('FR' / 'EN') */
  trackCodes: string[];
  /** UUIDs des AcademicTrack autorisés (prêts pour where academicTrackId IN) */
  trackIds: string[];
  allTracks: boolean;

  /** Classes de l'enseignant (TeacherClassAssignment + StaffAssignment) — scoping fin */
  classIds?: string[];

  /** Locale UI recommandée (mono-piste FR → 'fr', EN → 'en', sinon 'fr') */
  locale: 'fr' | 'en';
}

/** Rôles transverses : non filtrés par niveau ni piste (décisions D2/D3) */
const TRANSVERSE_ROLES = new Set([
  'SUPER_ADMIN', 'PLATFORM_OWNER', 'PLATFORM_SUPER_ADMIN', 'PLATFORM_ADMIN',
  'PLATFORM_SUPPORT', 'PLATFORM_BILLING', 'PLATFORM_MODERATOR',
  'PROMOTER', 'PROMOTEUR', 'SCHOOL_OWNER', 'BOARD_PRESIDENT',
  'DIRECTOR_GENERAL', 'DIRECTEUR_GENERAL', 'SCHOOL_ADMIN', 'SUPER_DIRECTOR',
  'admin',
]);

/** Mapping code court (StaffAdminAssignment) → codes longs (SchoolLevel) */
const SHORT_TO_LONG: Record<string, string[]> = {
  MAT: ['MATERNELLE'],
  MATERNELLE: ['MATERNELLE'],
  PRI: ['PRIMAIRE'],
  PRIMAIRE: ['PRIMAIRE'],
  SEC: ['SECONDAIRE'],
  SECONDAIRE: ['SECONDAIRE'],
  MAT_PRI: ['MATERNELLE', 'PRIMAIRE'],
  ALL: ['MATERNELLE', 'PRIMAIRE', 'SECONDAIRE'],
};

const ALL_LEVEL_CODES = ['MATERNELLE', 'PRIMAIRE', 'SECONDAIRE'];

@Injectable()
export class AccessScopeService {
  private readonly logger = new Logger(AccessScopeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  /**
   * Résout le scope d'un utilisateur (cache 2 min par user+tenant).
   * @param user objet request.user du JwtStrategy (id, email, tenantId, role, isSuperAdmin)
   */
  async resolveUserScope(user: {
    id: string;
    email: string;
    tenantId?: string | null;
    role?: string | null;
    isSuperAdmin?: boolean;
  }): Promise<AccessScope> {
    const tenantId = user.tenantId || null;
    if (!tenantId || !user.id) {
      return this.openScope(false);
    }

    const cacheKey = `scope:${user.id}:${tenantId}`;
    const cached = await this.cache.get<AccessScope>(cacheKey);
    if (cached) return cached;

    const scope = await this.computeScope(user, tenantId);
    await this.cache.set(cacheKey, scope, 2 * 60 * 1000);
    return scope;
  }

  /** Invalide le cache de scope d'un utilisateur (appelé après changement d'affectation) */
  async invalidateScope(userId: string, tenantId: string): Promise<void> {
    await this.cache.invalidate(`scope:${userId}:${tenantId}`);
  }

  private async computeScope(
    user: { id: string; email: string; role?: string | null; isSuperAdmin?: boolean },
    tenantId: string,
  ): Promise<AccessScope> {
    // 1. Transverse (plateforme, promoteur, DG…) — décision D2 : non filtré
    const role = (user.role || '').toUpperCase();
    if (user.isSuperAdmin || TRANSVERSE_ROLES.has(role)) {
      const full = await this.loadTenantLevelsAndTracks(tenantId);
      return {
        resolved: true,
        transverse: true,
        isTeacher: false,
        isAdmin: true,
        levelCodes: ALL_LEVEL_CODES,
        levelIds: full.levelIds,
        allLevels: true,
        trackCodes: full.trackCodes,
        trackIds: full.trackIds,
        allTracks: true,
        locale: 'fr',
      };
    }

    const email = (user.email || '').trim().toLowerCase();

    // 2. Profils métier (lien par email — convention existante du code)
    const [staff, teacher] = await Promise.all([
      this.prisma.staff.findFirst({
        where: { tenantId, email: { equals: email, mode: 'insensitive' } },
        select: {
          id: true, schoolLevelId: true, assignedLanguages: true, roleType: true,
        },
      }),
      this.prisma.teacher.findFirst({
        where: { tenantId, email: { equals: email, mode: 'insensitive' } },
        select: {
          id: true, schoolLevelId: true, assignedLanguages: true,
        },
      }),
    ]);

    if (!staff && !teacher) {
      // Compte sans profil métier (ex: compte historique) → scope ouvert + traçabilité
      this.logger.warn(
        `AccessScope: no staff/teacher profile for ${email} (role=${role}) — open scope (retro-compat)`,
      );
      const full = await this.loadTenantLevelsAndTracks(tenantId);
      return {
        resolved: false,
        transverse: false,
        isTeacher: false,
        isAdmin: false,
        levelCodes: ALL_LEVEL_CODES,
        levelIds: full.levelIds,
        allLevels: true,
        trackCodes: full.trackCodes,
        trackIds: full.trackIds,
        allTracks: true,
        locale: 'fr',
      };
    }

    const levelSet = new Set<string>();
    const trackSet = new Set<string>();
    let allLevels = false;
    let allTracks = false;
    let hasTrackInfo = false;
    const classIdSet = new Set<string>();
    let isAdmin = false;

    // Table id→code des niveaux du tenant (locale à la requête — pas de champ d'instance)
    const levels = await this.prisma.schoolLevel.findMany({
      where: { tenantId },
      select: { id: true, code: true },
    });
    const levelIdToCode = new Map(levels.map((l) => [l.id, l.code]));
    const levelCodeToId = new Map(levels.map((l) => [l.code, l.id]));

    const addLevelById = (schoolLevelId?: string | null) => {
      if (!schoolLevelId) return;
      const code = levelIdToCode.get(schoolLevelId);
      if (code) levelSet.add(code);
    };

    const addLevelsFromCodes = (codes: string[]) => {
      for (const c of codes) {
        if (c === 'ALL' || (SHORT_TO_LONG[c] || []).length === 3) allLevels = true;
        (SHORT_TO_LONG[c] || []).forEach((long) => levelSet.add(long));
      }
    };

    const addLanguages = (langs: unknown) => {
      if (Array.isArray(langs) && langs.length > 0) {
        hasTrackInfo = true;
        for (const l of langs) {
          if (l === 'FR' || l === 'EN') trackSet.add(l);
        }
      }
    };

    // 3. Profil Teacher (niveau + langues + classes)
    if (teacher) {
      addLevelById(teacher.schoolLevelId);
      addLanguages(teacher.assignedLanguages);

      // ⭐ FIX 2026-10-16 (portail Helm Enseignant) : pour un enseignant
      //    AUTONOME (tenant type TEACHER), le périmètre n'est pas le seul
      //    niveau principal du profil Teacher — c'est l'ensemble des niveaux
      //    ACTIVÉS de son espace (ex : Maternelle + Primaire). Sans ce fix,
      //    le scope se réduisait à Teacher.schoolLevelId (= 1er niveau) →
      //    /api/school-levels ne renvoyait qu'UN niveau → l'en-tête de
      //    l'espace enseignant affichait « 2026-2027 Maternelle » FIGÉ, sans
      //    possibilité de basculer vers Primaire.
      if (!staff) {
        const tenantRow = await this.prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { type: true },
        });
        if ((tenantRow as any)?.type === 'TEACHER') {
          const activeLevels = await this.prisma.schoolLevel.findMany({
            where: { tenantId, isActive: true },
            select: { code: true },
          });
          for (const l of activeLevels) levelSet.add(l.code);
        }
      }
    }

    // 4. Profil Staff (niveau + langues)
    if (staff) {
      addLevelById(staff.schoolLevelId);
      if (!hasTrackInfo) addLanguages(staff.assignedLanguages);
    }

    // 5. Affectations administratives (toutes actives — cumuls gérés)
    if (staff) {
      const adminAssignments = await this.prisma.staffAdminAssignment.findMany({
        where: { staffId: staff.id, tenantId, isActive: true },
        select: { schoolLevelCode: true, academicTrackId: true, adminRole: true },
      });
      if (adminAssignments.length > 0) {
        isAdmin = true;
        const trackIdSet = new Set<string>();
        for (const a of adminAssignments) {
          addLevelsFromCodes([a.schoolLevelCode]);
          if (a.academicTrackId) {
            trackIdSet.add(a.academicTrackId);
          } else {
            // Décision D1 : piste NULL sur affectation admin = les deux pistes
            allTracks = true;
          }
        }
        // Résoudre les trackIds en codes
        if (trackIdSet.size > 0) {
          const tracks = await this.prisma.academicTrack.findMany({
            where: { tenantId, id: { in: Array.from(trackIdSet) } },
            select: { code: true },
          });
          tracks.forEach((t) => trackSet.add(t.code));
        }
      }

      // 6. Affectations pédagogiques (StaffAssignment) — niveaux + classes
      const staffAssignments = await this.prisma.staffAssignment.findMany({
        where: { staffId: staff.id, tenantId, status: 'ACTIVE' },
        select: { schoolLevelId: true, classId: true, role: true },
      });
      for (const a of staffAssignments) {
        addLevelById(a.schoolLevelId);
        if (a.classId) classIdSet.add(a.classId);
      }
    }

    // 7. Classes de l'enseignant (TeacherClassAssignment)
    if (teacher) {
      const tca = await this.prisma.teacherClassAssignment.findMany({
        where: { tenantId, teacherId: teacher.id },
        select: { classId: true, classSubjectId: true },
      });
      for (const t of tca) {
        if (t.classId) classIdSet.add(t.classId);
      }
    }

    // 8. Défense en profondeur : suffixe du User.role (ex: DIRECTEUR_MAT_PRI)
    const suffixMatch = role.match(/_(MAT|PRI|SEC|MAT_PRI|MATERNELLE|PRIMAIRE|SECONDAIRE)$/);
    if (suffixMatch) {
      addLevelsFromCodes([suffixMatch[1]]);
    }

    // ── Décisions finales ──
    const tenantTracks = await this.prisma.academicTrack.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, code: true },
    });

    if (!hasTrackInfo && !allTracks) {
      // Aucune info de piste → pas de restriction (rétro-compat)
      allTracks = true;
    }
    if (trackSet.has('FR') && trackSet.has('EN')) allTracks = true;
    // École mono-piste : la seule piste existante
    if (tenantTracks.length <= 1) allTracks = true;

    if (levelSet.size === 0) {
      // Aucune info de niveau → pas de restriction (rétro-compat)
      allLevels = true;
    }
    if (levelSet.size === 3) allLevels = true;

    const finalLevelCodes = allLevels ? ALL_LEVEL_CODES : Array.from(levelSet);
    const finalLevelIds = allLevels
      ? levels.map((l) => l.id)
      : finalLevelCodes.map((c) => levelCodeToId.get(c)).filter((x): x is string => !!x);

    const finalTrackCodes = allTracks
      ? tenantTracks.map((t) => t.code)
      : Array.from(trackSet);
    const finalTrackIds = allTracks
      ? tenantTracks.map((t) => t.id)
      : tenantTracks.filter((t) => trackSet.has(t.code)).map((t) => t.id);

    // Locale UI recommandée : mono-piste EN → 'en', sinon 'fr' (défaut historique)
    const locale: 'fr' | 'en' =
      !allTracks && finalTrackCodes.length === 1 && finalTrackCodes[0] === 'EN' ? 'en' : 'fr';

    return {
      resolved: true,
      transverse: false,
      staffId: staff?.id,
      teacherId: teacher?.id,
      isTeacher: !!teacher,
      isAdmin,
      levelCodes: finalLevelCodes,
      levelIds: finalLevelIds,
      allLevels,
      trackCodes: finalTrackCodes,
      trackIds: finalTrackIds,
      allTracks,
      classIds: classIdSet.size > 0 ? Array.from(classIdSet) : undefined,
      locale,
    };
  }

  private async loadTenantLevelsAndTracks(tenantId: string) {
    const [levels, tracks] = await Promise.all([
      this.prisma.schoolLevel.findMany({ where: { tenantId }, select: { id: true } }),
      this.prisma.academicTrack.findMany({ where: { tenantId, isActive: true }, select: { id: true, code: true } }),
    ]);
    return { levelIds: levels.map((l) => l.id), trackIds: tracks.map((t) => t.id), trackCodes: tracks.map((t) => t.code) };
  }

  private openScope(resolved: boolean): AccessScope {
    return {
      resolved,
      transverse: false,
      isTeacher: false,
      isAdmin: false,
      levelCodes: ALL_LEVEL_CODES,
      levelIds: [],
      allLevels: true,
      trackCodes: ['FR', 'EN'],
      trackIds: [],
      allTracks: true,
      locale: 'fr',
    };
  }
}
