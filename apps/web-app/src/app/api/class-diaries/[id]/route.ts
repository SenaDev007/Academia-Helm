import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const headers = await getProxyAuthHeaders(request);
    const response = await fetch(`${API_URL}/api/class-diaries/${id}`, { headers, cache: 'no-store' });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch class diary' }, { status: response.status });
    }

    return NextResponse.json(await response.json());
  } catch (error) {
    console.error('Error fetching class diary:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const headers = await getProxyAuthHeaders(request);
    const response = await fetch(`${API_URL}/api/class-diaries/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to update class diary' }, { status: response.status });
    }

    return NextResponse.json(await response.json());
  } catch (error) {
    console.error('Error updating class diary:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const headers = await getProxyAuthHeaders(request);
    const response = await fetch(`${API_URL}/api/class-diaries/${id}`, { method: 'DELETE', headers });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to delete class diary' }, { status: response.status });
    }

    return NextResponse.json(await response.json());
  } catch (error) {
    console.error('Error deleting class diary:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
