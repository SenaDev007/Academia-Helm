import { NextRequest, NextResponse } from 'next/server';
import { nestControllerUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const headers = await getProxyAuthHeaders(request);
    const response = await fetch(nestControllerUrl(`daily-logs/${id}`), { headers, cache: 'no-store' });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch daily log' }, { status: response.status });
    }

    return NextResponse.json(await response.json());
  } catch (error) {
    console.error('Error fetching daily log:', error);
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
    const response = await fetch(nestControllerUrl(`daily-logs/${id}`), {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to update daily log' }, { status: response.status });
    }

    return NextResponse.json(await response.json());
  } catch (error) {
    console.error('Error updating daily log:', error);
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
    const response = await fetch(nestControllerUrl(`daily-logs/${id}`), { method: 'DELETE', headers });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to delete daily log' }, { status: response.status });
    }

    return NextResponse.json(await response.json());
  } catch (error) {
    console.error('Error deleting daily log:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
