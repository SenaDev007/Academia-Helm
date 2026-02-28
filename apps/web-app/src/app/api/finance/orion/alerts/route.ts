/**
 * Agrège les alertes ORION Finance (recouvrement, arriérés, réductions, notifications)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const academicYearId = searchParams.get('academicYearId') ?? '';
    const auth = request.headers.get('Authorization') || '';

    const [receiptRes, arrearsRes, reductionsRes] = await Promise.allSettled([
      fetch(
        `${API_BASE_URL}/api/finance/orion/receipt-notifications/alerts?academicYearId=${academicYearId}`,
        { headers: { Authorization: auth } }
      ),
      fetch(
        `${API_BASE_URL}/api/finance/orion/arrears/alerts?academicYearId=${academicYearId}`,
        { headers: { Authorization: auth } }
      ),
      fetch(
        `${API_BASE_URL}/api/finance/orion/reductions/alerts?academicYearId=${academicYearId}`,
        { headers: { Authorization: auth } }
      ),
    ]);

    const receiptAlerts = receiptRes.status === 'fulfilled' && receiptRes.value.ok ? await receiptRes.value.json() : [];
    const arrearsAlerts = arrearsRes.status === 'fulfilled' && arrearsRes.value.ok ? await arrearsRes.value.json() : [];
    const reductionsAlerts = reductionsRes.status === 'fulfilled' && reductionsRes.value.ok ? await reductionsRes.value.json() : [];

    const alerts = [
      ...(Array.isArray(receiptAlerts) ? receiptAlerts : []),
      ...(Array.isArray(arrearsAlerts) ? arrearsAlerts : []),
      ...(Array.isArray(reductionsAlerts) ? reductionsAlerts : []),
    ].sort((a, b) => {
      const order = { CRITICAL: 0, WARNING: 1, INFO: 2 };
      return (order[a?.level] ?? 2) - (order[b?.level] ?? 2);
    });

    return NextResponse.json(alerts);
  } catch (error) {
    console.error('Error fetching finance ORION alerts:', error);
    return NextResponse.json([], { status: 200 });
  }
}
