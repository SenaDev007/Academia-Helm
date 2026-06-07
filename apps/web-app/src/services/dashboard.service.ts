/**
 * ============================================================================
 * DASHBOARD SERVICE - SERVICE POUR LES DONNÉES DES DASHBOARDS
 * ============================================================================
 */

import { offlineFetch } from '@/lib/offline/offline-fetch';

export interface DashboardKpi {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

export interface DashboardData {
  kpis: DashboardKpi[];
  recentActivity?: any[];
  alerts?: any[];
}

function getTenantId(): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(/(?:(?:^|.*;\s*)x-tenant-id\s*\=\s*([^;]*).*$)|^.*$/);
  return match ? decodeURIComponent(match[1]) : '';
}

class DashboardService {
  /**
   * Récupère les KPIs pour le dashboard Promoteur
   */
  async getPromoterKpis(tenantId: string, academicYearId?: string): Promise<DashboardKpi[]> {
    try {
      const params = new URLSearchParams();
      if (academicYearId) params.append('academicYearId', academicYearId);

      return await offlineFetch<DashboardKpi[]>(
        `/api/dashboard/promoter/kpis?${params.toString()}`,
        'dashboard_cache',
        { tenantId: tenantId || getTenantId() }
      );
    } catch (error) {
      console.error('Error fetching promoter KPIs:', error);
      return this.getDefaultPromoterKpis();
    }
  }

  /**
   * Récupère les KPIs pour le dashboard Directeur
   */
  async getDirectorKpis(tenantId: string, academicYearId?: string): Promise<DashboardKpi[]> {
    try {
      const params = new URLSearchParams();
      if (academicYearId) params.append('academicYearId', academicYearId);

      return await offlineFetch<DashboardKpi[]>(
        `/api/dashboard/director/kpis?${params.toString()}`,
        'dashboard_cache',
        { tenantId: tenantId || getTenantId() }
      );
    } catch (error) {
      console.error('Error fetching director KPIs:', error);
      return this.getDefaultDirectorKpis();
    }
  }

  /**
   * Récupère les KPIs pour le dashboard Comptable
   */
  async getAccountantKpis(tenantId: string, academicYearId?: string): Promise<DashboardKpi[]> {
    try {
      const params = new URLSearchParams();
      if (academicYearId) params.append('academicYearId', academicYearId);

      return await offlineFetch<DashboardKpi[]>(
        `/api/dashboard/accountant/kpis?${params.toString()}`,
        'dashboard_cache',
        { tenantId: tenantId || getTenantId() }
      );
    } catch (error) {
      console.error('Error fetching accountant KPIs:', error);
      return this.getDefaultAccountantKpis();
    }
  }

  /**
   * Récupère les données financières du jour
   */
  async getTodayFinancials(tenantId: string): Promise<any> {
    try {
      const today = new Date().toISOString().split('T')[0];
      return await offlineFetch<any>(
        `/api/finance/payments/today?date=${today}`,
        'dashboard_cache',
        { tenantId: tenantId || getTenantId() }
      );
    } catch (error) {
      console.error('Error fetching today financials:', error);
      return {
        totalAmount: 0,
        count: 0,
        payments: [],
      };
    }
  }

  /**
   * Récupère les impayés
   */
  async getUnpaidInvoices(tenantId: string): Promise<any> {
    try {
      return await offlineFetch<any>(
        `/api/finance/invoices/unpaid`,
        'dashboard_cache',
        { tenantId: tenantId || getTenantId() }
      );
    } catch (error) {
      console.error('Error fetching unpaid invoices:', error);
      return {
        totalAmount: 0,
        count: 0,
        invoices: [],
      };
    }
  }

  /**
   * Récupère les effectifs par niveau
   */
  async getEnrollmentByLevel(tenantId: string, academicYearId?: string): Promise<any> {
    try {
      const params = new URLSearchParams();
      if (academicYearId) params.append('academicYearId', academicYearId);

      return await offlineFetch<any>(
        `/api/students/enrollment/by-level?${params.toString()}`,
        'dashboard_cache',
        { tenantId: tenantId || getTenantId() }
      );
    } catch (error) {
      console.error('Error fetching enrollment by level:', error);
      return [];
    }
  }

  /**
   * Récupère les absences critiques
   */
  async getCriticalAbsences(tenantId: string, academicYearId?: string): Promise<any> {
    try {
      const params = new URLSearchParams();
      if (academicYearId) params.append('academicYearId', academicYearId);

      return await offlineFetch<any>(
        `/api/absences/critical?${params.toString()}`,
        'dashboard_cache',
        { tenantId: tenantId || getTenantId() }
      );
    } catch (error) {
      console.error('Error fetching critical absences:', error);
      return {
        count: 0,
        absences: [],
      };
    }
  }

  // Données par défaut en cas d'erreur ou d'offline
  private getDefaultPromoterKpis(): DashboardKpi[] {
    return [
      { title: 'Situation Financière', value: '-', subtitle: 'En attente de données' },
      { title: 'Performance Académique', value: '-', subtitle: 'En attente de données' },
      { title: 'Impayés', value: '-', subtitle: 'En attente de données' },
      { title: 'Conformité', value: '-', subtitle: 'En attente de données' },
    ];
  }

  private getDefaultDirectorKpis(): DashboardKpi[] {
    return [
      { title: 'Effectifs par Niveau', value: '-', subtitle: 'En attente de données' },
      { title: 'Absences Critiques', value: '-', subtitle: 'En attente de données' },
      { title: 'Fiches à Valider', value: '-', subtitle: 'En attente de données' },
      { title: 'État Recouvrement', value: '-', subtitle: 'En attente de données' },
    ];
  }

  private getDefaultAccountantKpis(): DashboardKpi[] {
    return [
      { title: 'Encaissements du Jour', value: '-', subtitle: 'En attente de données' },
      { title: 'Impayés', value: '-', subtitle: 'En attente de données' },
      { title: 'Rappels Envoyés', value: '-', subtitle: 'En attente de données' },
      { title: 'Clôture Quotidienne', value: '-', subtitle: 'En attente de données' },
    ];
  }
}

export const dashboardService = new DashboardService();
