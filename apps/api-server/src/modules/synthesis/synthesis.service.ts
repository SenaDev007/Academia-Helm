/**
 * ============================================================================
 * SYNTHESIS SERVICE - SERVICE DE SYNTHÈSE (LECTURE SEULE)
 * ============================================================================
 * 
 * Service qui expose les vues d'agrégation PostgreSQL.
 * Toutes les opérations sont en lecture seule.
 * Aucune modification des données brutes n'est possible.
 * 
 * ============================================================================
 */

import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface FinancesByModuleAndLevel {
  tenant_id: string;
  school_level_id: string;
  school_level_type: string;
  school_level_name: string;
  module_type: string;
  module_name: string;
  total_revenue: number;
  total_expenses: number;
  net_balance: number;
  payment_count: number;
  expense_count: number;
  calculated_at: Date;
}

export interface FinancesByLevel {
  tenant_id: string;
  school_level_id: string;
  school_level_type: string;
  school_level_name: string;
  total_revenue: number;
  total_expenses: number;
  net_balance: number;
  revenue_scolarite: number;
  revenue_cantine: number;
  revenue_boutique: number;
  revenue_other: number;
  payment_count: number;
  expense_count: number;
  calculated_at: Date;
}

export interface EffectifsByLevel {
  tenant_id: string;
  school_level_id: string;
  school_level_type: string;
  school_level_name: string;
  total_students: number;
  active_students: number;
  graduated_students: number;
  transferred_students: number;
  expelled_students: number;
  inactive_students: number;
  total_teachers: number;
  active_teachers: number;
  inactive_teachers: number;
  total_classes: number;
  active_classes: number;
  total_subjects: number;
  student_teacher_ratio: number | null;
  student_class_ratio: number | null;
  calculated_at: Date;
}

export interface KPIGlobalByTenant {
  tenant_id: string;
  tenant_name: string;
  subdomain: string;
  total_students_all_levels: number;
  active_students_all_levels: number;
  total_teachers_all_levels: number;
  active_teachers_all_levels: number;
  total_classes_all_levels: number;
  total_revenue_all_levels: number;
  total_expenses_all_levels: number;
  net_balance_all_levels: number;
  active_school_levels_count: number;
  active_school_levels_types: string;
  active_modules_count: number;
  calculated_at: Date;
}

export interface DashboardSynthesis {
  tenant_id: string;
  school_level_id: string;
  school_level_type: string;
  school_level_name: string;
  total_students: number;
  active_students: number;
  total_teachers: number;
  active_teachers: number;
  total_classes: number;
  student_teacher_ratio: number | null;
  student_class_ratio: number | null;
  total_revenue: number;
  total_expenses: number;
  net_balance: number;
  revenue_scolarite: number;
  revenue_cantine: number;
  revenue_boutique: number;
  revenue_other: number;
  payment_count: number;
  expense_count: number;
  revenue_per_student: number | null;
  expenses_per_teacher: number | null;
  revenue_per_class: number | null;
  calculated_at: Date;
}

@Injectable()
export class SynthesisService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Récupère les finances par module et par niveau
   */
  async getFinancesByModuleAndLevel(
    tenantId: string,
    schoolLevelId?: string,
  ): Promise<FinancesByModuleAndLevel[]> {
    const query = this.dataSource
      .createQueryBuilder()
      .select('*')
      .from('v_finances_by_module_and_level', 'v')
      .where('v.tenant_id = :tenantId', { tenantId });

    if (schoolLevelId && schoolLevelId !== 'ALL') {
      query.andWhere('v.school_level_id = :schoolLevelId', { schoolLevelId });
    }

    return query.getRawMany();
  }

  /**
   * Récupère les finances par niveau
   */
  async getFinancesByLevel(
    tenantId: string,
    schoolLevelId?: string,
  ): Promise<FinancesByLevel[]> {
    const query = this.dataSource
      .createQueryBuilder()
      .select('*')
      .from('v_finances_by_level', 'v')
      .where('v.tenant_id = :tenantId', { tenantId });

    if (schoolLevelId && schoolLevelId !== 'ALL') {
      query.andWhere('v.school_level_id = :schoolLevelId', { schoolLevelId });
    }

    return query.getRawMany();
  }

  /**
   * Récupère les effectifs par niveau
   */
  async getEffectifsByLevel(
    tenantId: string,
    schoolLevelId?: string,
  ): Promise<EffectifsByLevel[]> {
    const query = this.dataSource
      .createQueryBuilder()
      .select('*')
      .from('v_effectifs_by_level', 'v')
      .where('v.tenant_id = :tenantId', { tenantId });

    if (schoolLevelId && schoolLevelId !== 'ALL') {
      query.andWhere('v.school_level_id = :schoolLevelId', { schoolLevelId });
    }

    return query.getRawMany();
  }

  /**
   * Récupère les KPI globaux par tenant
   */
  async getKPIGlobalByTenant(tenantId: string): Promise<KPIGlobalByTenant | null> {
    const result = await this.dataSource
      .createQueryBuilder()
      .select('*')
      .from('v_kpi_global_by_tenant', 'v')
      .where('v.tenant_id = :tenantId', { tenantId })
      .getRawOne();

    return result || null;
  }

  /**
   * Récupère le tableau de bord synthèse
   */
  async getDashboardSynthesis(
    tenantId: string,
    schoolLevelId?: string,
  ): Promise<DashboardSynthesis[]> {
    const query = this.dataSource
      .createQueryBuilder()
      .select('*')
      .from('v_dashboard_synthesis', 'v')
      .where('v.tenant_id = :tenantId', { tenantId });

    if (schoolLevelId && schoolLevelId !== 'ALL') {
      query.andWhere('v.school_level_id = :schoolLevelId', { schoolLevelId });
    }

    return query.getRawMany();
  }

  /**
   * Récupère la synthèse complète avec KPI calculés
   */
  async getSynthesisWithKPI(
    tenantId: string,
    schoolLevelId?: string,
  ): Promise<any[]> {
    const query = this.dataSource
      .createQueryBuilder()
      .select('*')
      .from('v_synthesis_with_kpi', 'v')
      .where('v.tenant_id = :tenantId', { tenantId });

    if (schoolLevelId && schoolLevelId !== 'ALL') {
      query.andWhere('v.school_level_id = :schoolLevelId', { schoolLevelId });
    }

    return query.getRawMany();
  }

  /**
   * Calcule le taux de croissance des revenus
   */
  async calculateRevenueGrowthRate(
    tenantId: string,
    schoolLevelId: string,
    periodStart: Date,
    periodEnd: Date,
    previousPeriodStart: Date,
    previousPeriodEnd: Date,
  ): Promise<number | null> {
    const result = await this.dataSource.query(
      `SELECT calculate_revenue_growth_rate($1, $2, $3, $4, $5, $6) AS growth_rate`,
      [
        tenantId,
        schoolLevelId,
        periodStart,
        periodEnd,
        previousPeriodStart,
        previousPeriodEnd,
      ],
    );

    return result[0]?.growth_rate || null;
  }

  /**
   * Calcule le taux de remplissage des classes
   */
  async calculateClassOccupancyRate(
    tenantId: string,
    schoolLevelId: string,
  ): Promise<number | null> {
    const result = await this.dataSource.query(
      `SELECT calculate_class_occupancy_rate($1, $2) AS occupancy_rate`,
      [tenantId, schoolLevelId],
    );

    return result[0]?.occupancy_rate || null;
  }
}

