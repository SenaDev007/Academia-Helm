/**
 * ============================================================================
 * ADMINISTRATIVE SEAL USAGE HISTORY API ROUTES
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';
import { getServerSession } from '@/lib/auth/session';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const documentType = searchParams.get('documentType');

    const urlParams = new URLSearchParams();
    if (startDate) urlParams.append('startDate', startDate);
    if (endDate) urlParams.append('endDate', endDate);
    if (documentType) urlParams.append('documentType', documentType);

    const response = await fetch(
      `${API_BASE_URL}/settings/administrative-seals/${params.id}/usage?${urlParams.toString()}`,
      {
        headers: {
          'Authorization': `Bearer ${session.token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching seal usage history:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
