import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function GET(
  request: NextRequest,
  { params }: { params: { studentId: string } },
) {
  try {
    const { studentId } = params;
    const academicYearId = request.nextUrl.searchParams.get('academicYearId') || '';
    const url = `${API_BASE_URL}/api/students/${studentId}/academic-dossier${academicYearId ? `?academicYearId=${academicYearId}` : ''}`;

    const response = await fetch(url, {
      headers: {
        Authorization: request.headers.get('Authorization') || '',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return NextResponse.json(error, { status: response.status });
    }

    const arrayBuffer = await response.arrayBuffer();
    return new NextResponse(Buffer.from(arrayBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
      },
    });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to generate academic dossier' }, { status: 500 });
  }
}

