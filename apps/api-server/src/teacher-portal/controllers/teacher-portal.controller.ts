/**
 * ============================================================================
 * HELM ENSEIGNANT — CONTRÔLEUR DU PORTAIL ENSEIGNANT AUTONOME
 * ============================================================================
 *
 * Routes publiques  : POST /teacher-portal/register, POST /teacher-portal/login
 * Routes protégées  : GET  /teacher-portal/profile
 *                     POST /teacher-portal/levels
 *                     POST /teacher-portal/invite-promoter
 *
 * ⭐ Le sélecteur de niveaux est la porte d'entrée « intelligente » :
 *    l'enseignant active Maternelle / Primaire / Secondaire et reçoit
 *    automatiquement toutes les classes et matières du niveau.
 */

import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  Req,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { Public } from '@/auth/decorators/public.decorator';
import { TeacherPortalAuthService } from '../services/teacher-portal-auth.service';
import { TeacherProvisioningService } from '../services/teacher-provisioning.service';
import {
  RegisterTeacherDto,
  TeacherStandaloneLoginDto,
  SetTeacherLevelsDto,
  InvitePromoterDto,
} from '../dto/teacher-portal.dto';
import { IsString, IsNotEmpty, IsOptional, MinLength, MaxLength, IsIn } from 'class-validator';

class AddStudentDto {
  @IsString()
  @IsNotEmpty()
  classId!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(60)
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(60)
  lastName!: string;

  @IsOptional()
  @IsIn(['M', 'F', 'MASCULIN', 'FEMININ'])
  gender?: string;
}

@Controller('teacher-portal')
export class TeacherPortalController {
  constructor(
    private readonly authService: TeacherPortalAuthService,
    private readonly provisioningService: TeacherProvisioningService,
  ) {}

  /** Inscription autonome — provisionne tout l'espace puis connecte. */
  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterTeacherDto, @Req() req: any) {
    return this.authService.register(
      dto,
      req?.ip || req?.headers?.['x-forwarded-for'],
      req?.headers?.['user-agent'],
    );
  }

  /** Connexion Helm Enseignant — email + mot de passe (sans établissement). */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: TeacherStandaloneLoginDto, @Req() req: any) {
    return this.authService.login(
      dto,
      req?.ip || req?.headers?.['x-forwarded-for'],
      req?.headers?.['user-agent'],
    );
  }

  /** Profil de l'espace : niveaux activés, année, identité, abonnement, stats. */
  @Get('profile')
  async getProfile(@Req() req: any) {
    return this.authService.getProfile(req.user?.sub ?? req.user?.id);
  }

  /** Active / désactive des niveaux → provisionne classes + matières. */
  @Post('levels')
  async setLevels(@Body() dto: SetTeacherLevelsDto, @Req() req: any) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant non résolu');
    }
    return this.provisioningService.setTeacherLevels(tenantId, dto.levels);
  }

  /** Invite le promoteur de son école à découvrir Academia Helm. */
  @Post('invite-promoter')
  @HttpCode(HttpStatus.OK)
  async invitePromoter(@Body() dto: InvitePromoterDto, @Req() req: any) {
    return this.authService.invitePromoter(req.user?.sub ?? req.user?.id, dto);
  }

  // ─────────────────────────────────────────────────────────────────────
  //  ÉLÈVES — constitution des classes pour les notes et bulletins
  // ─────────────────────────────────────────────────────────────────────

  /** Liste les élèves d'une classe de l'espace enseignant. */
  @Get('students')
  async listStudents(@Query('classId') classId: string, @Req() req: any) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant non résolu');
    if (!classId) throw new BadRequestException('classId requis');
    return this.provisioningService.listStudents(tenantId, classId);
  }

  /** Ajoute un élève à une classe. */
  @Post('students')
  @HttpCode(HttpStatus.CREATED)
  async addStudent(@Body() dto: AddStudentDto, @Req() req: any) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant non résolu');
    return this.provisioningService.addStudent(tenantId, dto.classId, {
      firstName: dto.firstName,
      lastName: dto.lastName,
      gender: dto.gender,
    });
  }

  /** Retire un élève de l'espace. */
  @Delete('students/:id')
  async removeStudent(@Param('id') id: string, @Req() req: any) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant non résolu');
    return this.provisioningService.removeStudent(tenantId, id);
  }

  // ─────────────────────────────────────────────────────────────────────
  //  EXAMENS — référentiel (types d'évaluation + périodes) de l'espace
  // ─────────────────────────────────────────────────────────────────────

  /** Types d'évaluation + périodes disponibles (formulaire d'évaluation). */
  @Get('evaluation-types')
  async listEvaluationTypes(@Req() req: any) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant non résolu');
    return this.provisioningService.listEvaluationTypes(tenantId);
  }
}
