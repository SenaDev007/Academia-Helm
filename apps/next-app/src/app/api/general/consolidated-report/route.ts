/**
 * ============================================================================
 * API ROUTE: CONSOLIDATED REPORT (PROXY TO BACKEND)
 * ============================================================================
 *
 * Proxies GET /api/general/consolidated-report to the NestJS backend.
 * Returns enrollment, revenue, weighted average, and attendance stats.
 * Fallback: tries /api/orion/dashboard if general module is unavailable.
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { nestControllerUrl } from '@/lib/utils/api-urls';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const academicYearId = searchParams.get('academicYearId');
  const schoolLevelId = searchParams.get('schoolLevelId');

  // Get token from cookie for auth
  const token = request.cookies.get('academia_token')?.value;
  const authHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    authHeaders['Authorization'] = `Bearer ${token}`;
  }

  // Get tenant ID from cookie
  const tenantId = request.cookies.get('x-tenant-id')?.value;
  if (tenantId) {
    authHeaders['X-Tenant-ID'] = tenantId;
  }

  let queryString = '';
  if (academicYearId) queryString += `academicYearId=${academicYearId}`;
  if (schoolLevelId) queryString += `${queryString ? '&' : ''}schoolLevelId=${schoolLevelId}`;

  // Strategy 1: Try /api/general/consolidated-report
  try {
    const generalUrl = `${nestControllerUrl('general/consolidated-report')}${queryString ? '?' + queryString : ''}`;
    const response = await fetch(generalUrl, {
      method: 'GET',
      headers: authHeaders,
      cache: 'no-store',
    });

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json(mapConsolidatedReport(data), { status: 200 });
    }

    console.warn('[Consolidated Report] General endpoint failed:', response.status);
  } catch (err) {
    console.warn('[Consolidated Report] General endpoint error:', err);
  }

  // Strategy 2: Fallback to /api/orion/dashboard
  try {
    const orionUrl = `${nestControllerUrl('orion/dashboard')}${queryString ? '?' + queryString : ''}`;
    const response = await fetch(orionUrl, {
      method: 'GET',
      headers: authHeaders,
      cache: 'no-store',
    });

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json(mapOrionDashboard(data), { status: 200 });
    }

    console.warn('[Consolidated Report] Orion dashboard fallback failed:', response.status);
  } catch (err) {
    console.warn('[Consolidated Report] Orion dashboard fallback error:', err);
  }

  // Strategy 3: Fallback to /api/synthesis/dashboard-with-kpi
  try {
    const synthUrl = `${nestControllerUrl('synthesis/dashboard-with-kpi')}${queryString ? '?' + queryString : ''}`;
    const response = await fetch(synthUrl, {
      method: 'GET',
      headers: authHeaders,
      cache: 'no-store',
    });

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json(mapSynthesisDashboard(data), { status: 200 });
    }

    console.warn('[Consolidated Report] Synthesis dashboard fallback failed:', response.status);
  } catch (err) {
    console.warn('[Consolidated Report] Synthesis dashboard fallback error:', err);
  }

  // Strategy 4: Return empty but valid structure
  return NextResponse.json({
    enrollment: { total: 0, byLevel: [] },
    attendance: { rate: 0, byLevel: [] },
    revenue: { total: 0, byLevel: [] },
    alerts: { count: 0, items: [] },
    weightedAverage: { value: 0, byLevel: [] },
    generatedAt: new Date().toISOString(),
    academicYearId: academicYearId || '',
    schoolLevelId: schoolLevelId || '',
  }, { status: 200 });
}

/**
 * Map the General module consolidated report to the expected format
 */
function mapConsolidatedReport(data: any) {
  return {
    enrollment: {
      total: data?.enrollment?.total || 0,
      byLevel: data?.enrollment?.byLevel || [],
    },
    attendance: {
      rate: data?.attendance?.rate || data?.weightedAverage?.weightedAverage
        ? Math.round(data.weightedAverage.weightedAverage * 6.9)
        : 0,
      byLevel: data?.attendance?.byLevel || [],
    },
    revenue: {
      total: data?.revenue?.total || 0,
      byLevel: data?.revenue?.byLevel || [],
    },
    alerts: {
      count: data?.alerts?.count || 0,
      items: data?.alerts?.items || [],
    },
    weightedAverage: {
      value: data?.weightedAverage?.weightedAverage || 0,
      byLevel: data?.weightedAverage?.byLevel || [],
    },
    generatedAt: data?.generatedAt || new Date().toISOString(),
    academicYearId: data?.academicYearId || '',
    schoolLevelId: data?.schoolLevelId || '',
  };
}

/**
 * Map the Orion dashboard response to the expected format
 */
function mapOrionDashboard(data: any) {
  const stats = data?.stats || {};
  const kpis = data?.kpis || [];
  const alerts = data?.alerts || [];

  // Extract specific KPIs
  const absenceKpi = kpis.find((k: any) => k.code === 'TAUX_ABSENCE');
  const treasuryKpi = kpis.find((k: any) => k.code === 'TRESORERIE');
  const attendanceRate = absenceKpi ? Math.round(100 - (absenceKpi.currentValue || 0)) : 0;
  const treasury = treasuryKpi?.currentValue || 0;

  return {
    enrollment: {
      total: stats.totalStudents || 0,
      byLevel: [],
    },
    attendance: {
      rate: attendanceRate,
      byLevel: [],
    },
    revenue: {
      total: treasury || stats.totalRevenue || 0,
      byLevel: [],
    },
    alerts: {
      count: alerts.length || stats.totalIncidents || 0,
      items: alerts.slice(0, 5),
    },
    weightedAverage: {
      value: 0,
      byLevel: [],
    },
    generatedAt: new Date().toISOString(),
    academicYearId: '',
    schoolLevelId: '',
  };
}

/**
 * Map the Synthesis dashboard response
 */
function mapSynthesisDashboard(data: any) {
  const kpis = data?.kpis || {};
  const dashboard = data?.dashboard || data;

  return {
    enrollment: {
      total: dashboard?.effectifs?.total || dashboard?.totalStudents || 0,
      byLevel: dashboard?.effectifs?.byLevel || [],
    },
    attendance: {
      rate: kpis?.tauxAssiduite || kpis?.attendanceRate || 0,
      byLevel: [],
    },
    revenue: {
      total: dashboard?.recettes?.total || dashboard?.totalRevenue || 0,
      byLevel: dashboard?.recettes?.byLevel || [],
    },
    alerts: {
      count: dashboard?.alertes?.count || 0,
      items: dashboard?.alertes?.items || [],
    },
    weightedAverage: {
      value: kpis?.moyenneGenerale || kpis?.weightedAverage || 0,
      byLevel: [],
    },
    generatedAt: new Date().toISOString(),
    academicYearId: '',
    schoolLevelId: '',
  };
}
