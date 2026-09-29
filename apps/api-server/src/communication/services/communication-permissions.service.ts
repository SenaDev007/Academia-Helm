/**
 * ============================================================================
 * COMMUNICATION PERMISSIONS SERVICE — Matrice « qui contacte qui » (V5, chantier 2)
 * ============================================================================
 *
 * ⭐ Spéc école #7/#16 : un STUDENT ne peut INITIER un DM qu'avec :
 *      - ses enseignants (lien classe/élève/enseignant) ;
 *      - les ADMIN de son établissement ;
 *      - les parents liés à lui.
 *    Un PARENT ne peut contacter que les enseignants de ses enfants + admin.
 *    TEACHER/ADMIN/DIRECTOR : libres dans le tenant.
 *
 * ⭐ IMPORTANT : la règle s'applique UNIQUEMENT à la CRÉATION d'un DM
 *    (conversation DIRECT) — jamais aux conversations existantes ni aux
 *    groupes/canaux (une conversation déjà ouverte reste utilisable).
 *
 * Config par tenant (table chat_contact_policy, JSONB) :
 *    {
 *      allowStudentToTeacher: boolean (défaut true),
 *      allowStudentToParent:  boolean (défaut true),
 *      allowParentToTeacher:  boolean (défaut true),
 *      restrictStudents:      boolean (défaut true — false = élèves libres)
 *    }
 *
 * Rôles : users.role contient des valeurs françaises et anglaises
 * (ENSEIGNANT, TEACHER, DIRECTOR, DIRECTEUR, ADMIN, PARENT, STUDENT/ELEVE…)
 * — on normalise en majuscules et on teste plusieurs variantes, comme le
 * font auto-group.service / chat.service.
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../database/prisma.service';

/** Rôles admin/direction — libres de contacter n'importe qui dans le tenant. */
const ADMIN_ROLES = new Set([
  'ADMIN',
  'SUPER_ADMIN',
  'PLATFORM_OWNER',
  'PROMOTER',
  'PROMOTEUR',
  'DIRECTOR',
  'DIRECTEUR',
  'DIRECTOR_GENERAL',
  'DIRECTEUR_GENERAL',
  'SCHOOL_DIRECTOR',
  'DIRECTEUR_ETABLISSEMENT',
  'DEPUTY_DIRECTOR',
  'PEDAGOGIC_DIRECTOR',
  'DIRECTEUR_PEDAGOGIQUE',
  'PEDAGOGIC_COORDINATOR',
  'CENSEUR',
  'SURVEILLANT_GENERAL',
  'SECRETARY_GENERAL',
  'ACCOUNTANT',
  'COMPTABLE',
]);

/** Rôles enseignant. */
const TEACHER_ROLES = new Set([
  'TEACHER',
  'ENSEIGNANT',
  'TEACHER_RESP',
  'PROFESSEUR',
  'RESP_PRIMAIRE',
  'RESP_MATERNELLE',
  'RESP_SECONDAIRE',
]);

/** Rôles parent. */
const PARENT_ROLES = new Set(['PARENT', 'PARENT_ELEVE', 'TUTOR', 'TUTEUR']);

/** Rôles élève (les élèves ont rarement un compte, mais le portail élève existe). */
const STUDENT_ROLES = new Set(['STUDENT', 'ELEVE', 'ELEVEVE', 'LEARNER', 'APPRENANT']);

export interface ContactPolicy {
  allowStudentToTeacher: boolean;
  allowStudentToParent: boolean;
  allowParentToTeacher: boolean;
  restrictStudents: boolean;
}

export interface ContactDecision {
  allowed: boolean;
  reason?: string;
}

export interface PolicyUser {
  id: string;
  role?: string | null;
}

/** Défauts sûrs : échanges école↔famille ouverts, élèves restreints à leur cercle. */
export const DEFAULT_CONTACT_POLICY: ContactPolicy = {
  allowStudentToTeacher: true,
  allowStudentToParent: true,
  allowParentToTeacher: true,
  restrictStudents: true,
};

@Injectable()
export class CommunicationPermissionsService {
  private readonly logger = new Logger(CommunicationPermissionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ═════════════════════════════════════════════════════════════════
  //  POLITIQUE PAR TENANT (lecture/écriture)
  // ═════════════════════════════════════════════════════════════════

  /** Lit la politique du tenant (défauts sûrs si absente/partielle). */
  async getPolicy(tenantId: string): Promise<ContactPolicy> {
    try {
      const rows: any[] = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT "policy" FROM "chat_contact_policy" WHERE "tenantId" = $1`,
        tenantId,
      );
      const stored = (rows[0]?.policy as Partial<ContactPolicy>) || {};
      return { ...DEFAULT_CONTACT_POLICY, ...stored };
    } catch (e: any) {
      // Table absente (migration non appliquée) → défauts sûrs
      this.logger.warn(`getPolicy: lecture impossible (${e.message}) — défauts appliqués`);
      return { ...DEFAULT_CONTACT_POLICY };
    }
  }

  /** Écrit (upsert) la politique du tenant — fusion avec les valeurs existantes. */
  async setPolicy(tenantId: string, patch: Partial<ContactPolicy>): Promise<ContactPolicy> {
    const current = await this.getPolicy(tenantId);
    const merged: ContactPolicy = { ...current, ...patch };
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "chat_contact_policy" ("id", "tenantId", "policy", "updatedAt")
       VALUES ($1, $2, $3::jsonb, NOW())
       ON CONFLICT ("tenantId") DO UPDATE SET "policy" = $3::jsonb, "updatedAt" = NOW()`,
      randomUUID(),
      tenantId,
      JSON.stringify(merged),
    );
    this.logger.log(`setPolicy: politique de contact mise à jour (tenant ${tenantId})`);
    return merged;
  }

  // ═════════════════════════════════════════════════════════════════
  //  MATRICE « QUI CONTACTE QUI »
  // ═════════════════════════════════════════════════════════════════

  /**
   * ⭐ Peut `user` INITIER un DM avec `targetUser` ?
   *    S'applique uniquement à la CRÉATION de DM — jamais aux conversations
   *    existantes ni aux groupes/canaux.
   *
   * @param user      utilisateur qui veut initier (id + role)
   * @param targetUser utilisateur ciblé (id + role)
   * @param tenantId  tenant courant
   */
  async canContact(
    user: PolicyUser,
    targetUser: PolicyUser,
    tenantId: string,
  ): Promise<ContactDecision> {
    const userRole = (user.role || '').toUpperCase().trim();
    const targetRole = (targetUser.role || '').toUpperCase().trim();

    // 1. Admin/direction/enseignant : libres dans le tenant
    if (ADMIN_ROLES.has(userRole) || TEACHER_ROLES.has(userRole)) {
      return { allowed: true };
    }

    // 2. Admin/direction ciblé : toujours joignable (administration)
    if (ADMIN_ROLES.has(targetRole)) {
      return { allowed: true, reason: 'administration' };
    }

    const policy = await this.getPolicy(tenantId);

    // 3. PARENT → uniquement les enseignants de ses enfants (allowParentToTeacher)
    if (PARENT_ROLES.has(userRole)) {
      if (TEACHER_ROLES.has(targetRole)) {
        if (!policy.allowParentToTeacher) {
          return {
            allowed: false,
            reason:
              "Les parents ne peuvent pas contacter les enseignants (politique de l'établissement)",
          };
        }
        const isTeacherOfMyChildren = await this.isTeacherOfParentsChildren(
          tenantId,
          user.id,
          targetUser.id,
        );
        if (!isTeacherOfMyChildren) {
          return {
            allowed: false,
            reason: 'Vous ne pouvez contacter que les enseignants de vos enfants',
          };
        }
        return { allowed: true };
      }
      return {
        allowed: false,
        reason:
          "Un parent ne peut contacter que les enseignants de ses enfants ou l'administration",
      };
    }

    // 4. STUDENT → enseignants (lien classe), admin (déjà autorisé), parents liés
    if (STUDENT_ROLES.has(userRole)) {
      if (!policy.restrictStudents) {
        return { allowed: true }; // restriction désactivée par l'établissement
      }
      if (TEACHER_ROLES.has(targetRole)) {
        if (!policy.allowStudentToTeacher) {
          return {
            allowed: false,
            reason:
              "Les élèves ne peuvent pas contacter les enseignants (politique de l'établissement)",
          };
        }
        const isMyTeacher = await this.isTeacherOfStudent(tenantId, user.id, targetUser.id);
        if (!isMyTeacher) {
          return { allowed: false, reason: 'Vous ne pouvez contacter que vos enseignants' };
        }
        return { allowed: true };
      }
      if (PARENT_ROLES.has(targetRole)) {
        if (!policy.allowStudentToParent) {
          return {
            allowed: false,
            reason:
              "Les élèves ne peuvent pas contacter les parents (politique de l'établissement)",
          };
        }
        const isMyParent = await this.isParentOfStudent(tenantId, user.id, targetUser.id);
        if (!isMyParent) {
          return { allowed: false, reason: 'Vous ne pouvez contacter que vos parents liés' };
        }
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: "Un élève ne peut contacter que ses enseignants, ses parents ou l'administration",
      };
    }

    // 5. Rôle inconnu/non listé → prudent : on autorise (comportement historique
    //    inchangé pour ne pas casser les rôles métier non couverts)
    return { allowed: true, reason: 'rôle non restreint' };
  }

  // ═════════════════════════════════════════════════════════════════
  //  LIAISONS PÉDAGOGIQUES (users ← students/guardians ← classes ← teachers)
  // ═════════════════════════════════════════════════════════════════

  /**
   * L'enseignant `teacherUserId` enseigne-t-il à un élève du parent `parentUserId` ?
   * Chaîne : parent user → guardians.userId → student_guardians →
   * student_enrollments.classId → teacher_class_assignments → teachers
   * (les enseignants n'ont PAS de userId : rapprochement par EMAIL, comme
   * auto-group.service.ts).
   */
  private async isTeacherOfParentsChildren(
    tenantId: string,
    parentUserId: string,
    teacherUserId: string,
  ): Promise<boolean> {
    try {
      const rows: any[] = await this.prisma.$queryRawUnsafe<any[]>(
        `
        SELECT 1
        FROM "guardians" g
        JOIN "student_guardians" sg ON sg."guardianId" = g.id
        JOIN "student_enrollments" se ON se."studentId" = sg."studentId" AND se."classId" IS NOT NULL
        JOIN "teacher_class_assignments" tca ON tca."classId" = se."classId"
        JOIN "teachers" t ON t.id = tca."teacherId"
        JOIN "users" tu ON tu."email" = t."email" AND tu."tenantId" = $3
        WHERE g."userId" = $1 AND tu."id" = $2
        LIMIT 1
      `,
        parentUserId,
        teacherUserId,
        tenantId,
      );
      if (rows.length > 0) return true;
    } catch (e: any) {
      this.logger.warn(`isTeacherOfParentsChildren: ${e.message}`);
    }
    // Repli : rapprochement par les groupes partagés (auto-groups de classe)
    return this.shareAnyGroup(tenantId, parentUserId, teacherUserId);
  }

  /**
   * L'enseignant `teacherUserId` enseigne-t-il à l'élève `studentUserId` ?
   * ⭐ Les élèves n'ont PAS de colonne students.userId (les comptes parents
   *    portent la relation) : on s'appuie sur les groupes de classe partagés
   *    (auto-groups CLASS/SUBJECT) — si l'élève et l'enseignant partagent un
   *    groupe pédagogique, le lien est établi.
   */
  private async isTeacherOfStudent(
    tenantId: string,
    studentUserId: string,
    teacherUserId: string,
  ): Promise<boolean> {
    return this.shareAnyGroup(tenantId, studentUserId, teacherUserId);
  }

  /** Le parent `parentUserId` est-il lié à l'élève `studentUserId` ? */
  private async isParentOfStudent(
    tenantId: string,
    studentUserId: string,
    parentUserId: string,
  ): Promise<boolean> {
    // Pas de lien direct students↔users — les groupes partagés (classe) font foi
    return this.shareAnyGroup(tenantId, studentUserId, parentUserId);
  }

  /**
   * Repli pragmatique : les deux utilisateurs partagent-ils au moins une
   * conversation de groupe (ex: auto-group de classe) ? Si oui, on considère
   * le lien pédagogique établi (évite les faux négatifs si le schéma
   * students/guardians est incomplet sur un tenant).
   */
  private async shareAnyGroup(tenantId: string, userA: string, userB: string): Promise<boolean> {
    try {
      const rows: any[] = await this.prisma.$queryRawUnsafe<any[]>(
        `
        SELECT 1
        FROM "chat_participants" p1
        JOIN "chat_participants" p2
          ON p2."conversationId" = p1."conversationId"
         AND p2."userId" = $2
        JOIN "chat_conversations" c ON c.id = p1."conversationId"
        WHERE p1."userId" = $1
          AND c."tenantId" = $3
          AND c."type" = 'GROUP'
        LIMIT 1
      `,
        userA,
        userB,
        tenantId,
      );
      return rows.length > 0;
    } catch (e: any) {
      this.logger.warn(`shareAnyGroup: ${e.message}`);
      return false;
    }
  }

  /**
   * Résout les infos d'un utilisateur (role) pour la matrice.
   */
  async getUserRoleInfo(tenantId: string, userId: string): Promise<PolicyUser> {
    try {
      const rows: any[] = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT id, role FROM "users" WHERE "id" = $1`,
        userId,
      );
      return { id: userId, role: rows[0]?.role || null };
    } catch (e: any) {
      this.logger.warn(`getUserRoleInfo: ${e.message}`);
      return { id: userId, role: null };
    }
  }

  /**
   * Vérifie la permission de contact pour la CRÉATION d'un DM et renvoie la
   * décision (le contrôleur/service convertit en ForbiddenException si refus).
   */
  async assertCanContact(
    tenantId: string,
    currentUserId: string,
    targetUserId: string,
  ): Promise<ContactDecision> {
    const [currentUser, targetUser] = await Promise.all([
      this.getUserRoleInfo(tenantId, currentUserId),
      this.getUserRoleInfo(tenantId, targetUserId),
    ]);
    return this.canContact(currentUser, targetUser, tenantId);
  }
}
