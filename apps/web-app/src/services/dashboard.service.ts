/**
 * ============================================================================
 * DASHBOARD SERVICE - SERVICE POUR LES DONNÉES DES DASHBOARDS
 * ============================================================================
 */

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

class DashboardService {
  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('accessToken');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Récupère les KPIs pour le dashboard Promoteur
   */
  async getPromoterKpis(tenantId: string, academicYearId?: string): Promise<DashboardKpi[]> {
    try {
      const params = new URLSearchParams();
      if (academicYearId) params.append('academicYearId', academicYearId);

      const response = await fetch(
        `/api/dashboard/promoter/kpis?${params.toString()}`,
        { headers: this.getAuthHeaders() }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch promoter KPIs');
      }

      return response.json();
    } catch (error) {
      console.error('Error fetching promoter KPIs:', error);
      // Retourner des données par défaut en cas d'erreur
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

      const response = await fetch(
        `/api/dashboard/director/kpis?${params.toString()}`,
        { headers: this.getAuthHeaders() }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch director KPIs');
      }

      return response.json();
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

      const response = await fetch(
        `/api/dashboard/accountant/kpis?${params.toString()}`,
        { headers: this.getAuthHeaders() }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch accountant KPIs');
      }

      return response.json();
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
      const response = await fetch(
        `/api/finance/payments/today?date=${today}`,
        { headers: this.getAuthHeaders() }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch today financials');
      }

      return response.json();
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
      const response = await fetch(
        `/api/finance/invoices/unpaid`,
        { headers: this.getAuthHeaders() }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch unpaid invoices');
      }

      return response.json();
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

      const response = await fetch(
        `/api/students/enrollment/by-level?${params.toString()}`,
        { headers: this.getAuthHeaders() }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch enrollment by level');
      }

      return response.json();
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

      const response = await fetch(
        `/api/absences/critical?${params.toString()}`,
        { headers: this.getAuthHeaders() }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch critical absences');
      }

      return response.json();
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
