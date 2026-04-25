import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ entryId: string }> }
) {
  const { entryId } = await params;
  try {
    const headers = await getProxyAuthHeaders(request);
    const response = await fetch(`${API_URL}/api/timetables/entries/${entryId}`, {
      method: 'DELETE',
      headers,
    });
    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to delete entry' }, { status: response.status });
    }
    return NextResponse.json(await response.json());
  } catch (error) {
    console.error('Error deleting timetable entry:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
