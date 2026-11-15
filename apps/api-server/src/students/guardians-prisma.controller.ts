/**
 * ============================================================================
 * GUARDIANS PRISMA CONTROLLER
 * ============================================================================
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { GuardiansPrismaService } from './guardians-prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SkipAcademicYear } from '../common/decorators/skip-academic-year.decorator';
import { CreateGuardianDto, UpdateGuardianDto, UpdateGuardianRelationDto, ProvisionParentAccountDto, BulkProvisionParentAccountDto } from './dto';

/**
 * ⭐ P2.3 — RBAC renforcé sur GuardiansPrismaController.
 *    Avant : `JwtAuthGuard` uniquement → tout user authentifié pouvait CRUD guardians.
 *    Maintenant : `TenantGuard` + `RolesGuard` + `@Roles` par endpoint.
 *
 * ⭐ 2026-09-19 (retour promoteur « parents sans compte utilisateur ») :
 *    la liste était plus RESTRICTIVE que celle du cycle de vie élèves
 *    (students-lifecycle.controller.ts). Le secrétaire comptable qui inscrit
 *    un élève (pre-register/admit autorisés) voyait l'ajout des parents
 *    rejeté en 403 — avalé silencieusement par le frontend (console.warn)
 *    → inscription « réussie » mais SANS guardian, donc sans compte parent.
 *    Alignement sur la liste du cycle de vie (mêmes métiers que l'inscription).
 */
const MANAGEMENT_ROLES = [
  'ADMIN', 'DIRECTOR', 'SCHOOL_ADMIN', 'DIRECTEUR',
  'DIRECTEUR_GENERAL', 'DIRECTEUR_ETABLISSEMENT', 'SUPER_DIRECTOR',
  'PROMOTER', 'SCHOOL_OWNER', 'BOARD_PRESIDENT', 'SECRETARY', 'TEACHER',
  // ⭐ 2026-09-19 : secrétaires et comptables finalisent les inscriptions —
  //    usage métier légitime, aligné sur students-lifecycle.controller.ts.
  'SECRETAIRE', 'SECRETAIRE_COMPTABLE', 'COMPTABLE', 'ACCOUNTANT',
  'RESP_SCOLARITE', 'CENSEUR', 'ECONOME', 'SCHOOL_DIRECTOR', 'DEPUTY_DIRECTOR',
];

@Controller('students/:studentId/guardians')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@SkipAcademicYear() // ⭐ Les guardians ne sont pas liés à une année scolaire.
//    Sans ce décorateur, l'AcademicYearEnforcementInterceptor injecte
//    academicYearId dans request.body → le ValidationPipe rejette avec
//    "property academicYearId should not exist" (CreateGuardianDto
//    n'a pas de champ academicYearId, et forbidNonWhitelisted=true).
export class GuardiansPrismaController {
  constructor(private readonly guardiansService: GuardiansPrismaService) {}

  @Post()
  @Roles(...MANAGEMENT_ROLES)
  async create(
    @Param('studentId') studentId: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() createDto: CreateGuardianDto,
  ) {
    return this.guardiansService.createGuardianForStudent({
      ...createDto,
      tenantId,
      studentId,
      // ⭐ Expéditeur du message Helm Connect d'envoi des identifiants
      //    (l'utilisateur qui inscrit l'élève — ex : la secrétaire).
      senderUserId: user?.id,
    });
  }

  /**
   * ⭐ nov. 2026 (demande promoteur) — Onglet Famille → sous-onglet
   * « Création de compte » : crée le compte parent d'un responsable qui
   * n'en avait pas (wizard avec étape skippée) et lui envoie ses
   * informations de connexion par SMS + email (⭐ 16/11/2026 fix 1.0.8 :
   * Helm Connect retiré des identifiants — le message chat suppose déjà un
   * compte connecté). Idempotent : renvoyer les identifiants d'un compte
   * existant est possible à volonté.
   */
  @Post(':guardianId/account')
  @Roles(...MANAGEMENT_ROLES)
  async provisionAccount(
    @Param('studentId') studentId: string,
    @Param('guardianId') guardianId: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() dto: ProvisionParentAccountDto,
  ) {
    return this.guardiansService.provisionParentAccount({
      tenantId,
      studentId,
      guardianId,
      createAccount: dto.createAccount,
      sendCredentials: dto.sendCredentials,
      channels: dto.channels,
      senderUserId: user?.id, // expéditeur du message Helm Connect (repli : directeur)
    });
  }

  @Get()
  async findAll(
    @Param('studentId') studentId: string,
    @TenantId() tenantId: string,
  ) {
    return this.guardiansService.getStudentGuardians(studentId, tenantId);
  }

  @Put(':guardianId')
  @Roles(...MANAGEMENT_ROLES)
  async update(
    @Param('guardianId') guardianId: string,
    @TenantId() tenantId: string,
    @Body() updateDto: UpdateGuardianDto,
  ) {
    return this.guardiansService.updateGuardian(guardianId, tenantId, updateDto);
  }

  @Put('relation/:studentGuardianId')
  @Roles(...MANAGEMENT_ROLES)
  async updateRelation(
    @Param('studentGuardianId') studentGuardianId: string,
    @TenantId() tenantId: string,
    @Body() updateDto: UpdateGuardianRelationDto,
  ) {
    return this.guardiansService.updateStudentGuardian(
      studentGuardianId,
      tenantId,
      updateDto,
    );
  }

  @Delete(':studentGuardianId')
  @Roles(...MANAGEMENT_ROLES)
  async remove(
    @Param('studentGuardianId') studentGuardianId: string,
    @TenantId() tenantId: string,
  ) {
    return this.guardiansService.removeStudentGuardian(studentGuardianId, tenantId);
  }
}

/**
 * ⭐ nov. 2026 (demande promoteur — « une vingtaine de parents sans compte,
 * faire tout ça un à un est ingérable ») — GÉNÉRATION MULTIPLE des comptes
 * parents : POST /students/guardians/account/bulk.
 *
 * Contrôleur SÉPARÉ de GuardiansPrismaController (base « students/:studentId/
 * guardians ») car la génération multiple couvre PLUSIEURS élèves d'un coup —
 * pas de :studentId dans le chemin. 4 segments (students/guardians/account/
 * bulk) : aucune collision avec les routes existantes (5 segments pour
 * students/:id/guardians/:guardianId/account).
 */
@Controller('students/guardians/account')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@SkipAcademicYear() // cf. GuardiansPrismaController — évite l'injection academicYearId
export class ParentAccountsBulkController {
  constructor(private readonly guardiansService: GuardiansPrismaService) {}

  /**
   * Génération multiple des comptes parents + envoi multiple des
   * identifiants (mot de passe simple régénéré à chaque envoi).
   *   - action='create' (défaut) : responsables SANS compte → création + envoi
   *   - action='resend'           : responsables AVEC compte → renvoi
   * Réponse : { results: [...par responsable], summary: { total, created,
   * sent, failed, skipped } } — timeout frontend porté à 5 min (20 parents
   * × SMS+email (pool de concurrence 3 côté service).
   */
  @Post('bulk')
  @Roles(...MANAGEMENT_ROLES)
  async bulkProvision(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() dto: BulkProvisionParentAccountDto,
  ) {
    return this.guardiansService.bulkProvisionParentAccounts({
      tenantId,
      guardianIds: dto.guardianIds,
      action: dto.action || 'create',
      senderUserId: user?.id, // expéditeur des messages Helm Connect (repli : directeur)
    });
  }
}
