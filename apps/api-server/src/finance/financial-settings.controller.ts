/**
 * SOUS-MODULE 8 — Paramétrage financier — API
 *
 * SÉCURITÉ RBAC :
 * - GET : accessible à tout utilisateur authentifié (lecture)
 * - PATCH : réservé aux rôles DIRECTOR / SUPER_DIRECTOR / ADMIN / PLATFORM_OWNER / SUPER_ADMIN
 *   (conformément à la spec MODULE FINANCE.txt — "Accès Promoteur uniquement")
 *
 * ORION SURVEILLANCE :
 * - Toute modification critique (seuil blocage, clôture auto, budget) est détectée
 *   et remontée comme anomalie dans financial_anomalies pour ORION.
 */
import { Controller, Get, Patch, Post, Body, UseGuards } from '@nestjs/common';
import { FinancialSettingsService } from './financial-settings.service';
import { AutoRecoveryService } from './auto-recovery.service';
import { ComptaAutoExportService } from './compta-auto-export.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UpdateFinancialSettingsDto } from './dto';

@Controller('finance/settings')
@UseGuards(JwtAuthGuard)
export class FinancialSettingsController {
  constructor(
    private readonly service: FinancialSettingsService,
    private readonly autoRecoveryService: AutoRecoveryService,
    private readonly comptaAutoExportService: ComptaAutoExportService,
  ) {}

  /**
   * Lecture des paramètres — accessible à tout utilisateur authentifié.
   */
  @Get()
  async get(@TenantId() tenantId: string) {
    return this.service.getOrCreate(tenantId);
  }

  /**
   * Modification des paramètres — réservé aux rôles directeurs/admin.
   * Rôles autorisés : SUPER_DIRECTOR, DIRECTOR, ADMIN, SUPER_ADMIN, PLATFORM_OWNER
   */
  @Patch()
  @UseGuards(RolesGuard)
  @Roles(
    'SUPER_DIRECTOR', 'DIRECTOR', 'ADMIN', 'SUPER_ADMIN',
    'PLATFORM_OWNER', 'PLATFORM_SUPER_ADMIN',
    'PROMOTEUR', 'PROMOTER', 'SCHOOL_OWNER', 'SCHOOL_ADMIN',
    'DIRECTOR_GENERAL', 'DIRECTEUR', 'DIRECTEUR_GENERAL',
  )
  async update(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body()
    body: UpdateFinancialSettingsDto,
  ) {
    return this.service.update(tenantId, body, user?.id);
  }

  /**
   * Historique des modifications — pour affichage dans l'onglet Paramètres.
   * Lit les entrées financial_audit_logs où entityType = 'FinancialSettings'.
   */
  @Get('history')
  async getHistory(@TenantId() tenantId: string) {
    return this.service.getHistory(tenantId);
  }

  /**
   * Alertes ORION — surveillance des changements critiques des 30 derniers jours.
   * Retourne le statut global (GREEN/ORANGE/RED) + liste des alertes.
   */
  @Get('orion-alerts')
  async getOrionAlerts(@TenantId() tenantId: string) {
    return this.service.getOrionAlerts(tenantId);
  }

  /**
   * POST /finance/settings/run-auto-recovery
   * Lance manuellement la relance automatique pour le tenant courant.
   * Parcourt tous les FeeArrear ouverts et envoie les relances selon les
   * paramètres configurés (canaux, niveaux, jours).
   */
  @Post('run-auto-recovery')
  @UseGuards(RolesGuard)
  @Roles(
    'SUPER_DIRECTOR', 'DIRECTOR', 'ADMIN', 'SUPER_ADMIN',
    'PLATFORM_OWNER', 'PLATFORM_SUPER_ADMIN',
    'PROMOTEUR', 'PROMOTER', 'SCHOOL_OWNER', 'SCHOOL_ADMIN',
    'DIRECTOR_GENERAL', 'DIRECTEUR', 'DIRECTEUR_GENERAL',
    'ACCOUNTANT',
  )
  async runAutoRecovery(@TenantId() tenantId: string) {
    return this.autoRecoveryService.runManualRecovery(tenantId);
  }

  /**
   * POST /finance/settings/send-compta-export
   * Déclenche manuellement l'envoi de l'export comptable mensuel au comptable.
   * Utile pour tester la configuration sans attendre le jour du mois prévu.
   */
  @Post('send-compta-export')
  @UseGuards(RolesGuard)
  @Roles(
    'SUPER_DIRECTOR', 'DIRECTOR', 'ADMIN', 'SUPER_ADMIN',
    'PLATFORM_OWNER', 'PLATFORM_SUPER_ADMIN',
    'PROMOTEUR', 'PROMOTER', 'SCHOOL_OWNER', 'SCHOOL_ADMIN',
    'DIRECTOR_GENERAL', 'DIRECTEUR', 'DIRECTEUR_GENERAL',
    'ACCOUNTANT',
  )
  async sendComptaExport(@TenantId() tenantId: string) {
    const settings = await this.service.getForTenant(tenantId);
    if (!settings) {
      return { success: false, message: 'Paramètres financiers introuvables' };
    }
    if (!settings.comptaAutoExportEnabled) {
      return { success: false, message: 'Export comptable automatique non activé. Activez-le dans les paramètres.' };
    }
    if (!settings.comptaAutoExportEmail) {
      return { success: false, message: 'Aucun email de comptable configuré' };
    }
    return this.comptaAutoExportService.sendAutoExportForTenant(tenantId, {
      comptaAutoExportEmail: settings.comptaAutoExportEmail,
      comptaAutoExportFormat: settings.comptaAutoExportFormat,
      comptaAutoExportDay: settings.comptaAutoExportDay,
      comptaAutoExportLastSent: settings.comptaAutoExportLastSent,
    });
  }
}
