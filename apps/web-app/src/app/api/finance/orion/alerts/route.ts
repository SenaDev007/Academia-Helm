import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

export async function GET(request: NextRequest) {
  try {
    const academicYearId = request.nextUrl.searchParams.get('academicYearId') ?? '';
    const headers = await getProxyAuthHeaders(request);
    const [receiptRes, arrearsRes, reductionsRes] = await Promise.allSettled([
      fetchWithTimeout(normalizeApiUrl(`${API_URL}/finance/orion/receipt-notifications/alerts?academicYearId=${academicYearId}`), { headers , cache: 'no-store' }, 15000),
      fetchWithTimeout(normalizeApiUrl(`${API_URL}/finance/orion/arrears/alerts?academicYearId=${academicYearId}`), { headers , cache: 'no-store' }, 15000),
      fetchWithTimeout(normalizeApiUrl(`${API_URL}/finance/orion/reductions/alerts?academicYearId=${academicYearId}`), { headers , cache: 'no-store' }, 15000),
    ]);
    const receiptAlerts = receiptRes.status === 'fulfilled' && receiptRes.value.ok ? await receiptRes.value.json() : [];
    const arrearsAlerts = arrearsRes.status === 'fulfilled' && arrearsRes.value.ok ? await arrearsRes.value.json() : [];
    const reductionsAlerts = reductionsRes.status === 'fulfilled' && reductionsRes.value.ok ? await reductionsRes.value.json() : [];
    const order: Record<string, number> = { CRITICAL: 0, WARNING: 1, INFO: 2 };
    const alerts = [
      ...(Array.isArray(receiptAlerts) ? receiptAlerts : []),
      ...(Array.isArray(arrearsAlerts) ? arrearsAlerts : []),
      ...(Array.isArray(reductionsAlerts) ? reductionsAlerts : []),
    ].sort((a, b) => (order[a?.level] ?? 2) - (order[b?.level] ?? 2));
    return NextResponse.json(alerts);
  } catch (e) {
    return NextResponse.json([], { status: 200 });
  }
}
