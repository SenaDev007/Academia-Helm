/**
 * ============================================================================
 * API PROXY - TRIGGER BY ID
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const response = await fetch(`${API_BASE_URL}/communication/automation/${id}`, {
      headers: {
        'Authorization': request.headers.get('Authorization') || '',
        'X-Tenant-ID': request.headers.get('X-Tenant-ID') || '',
      },
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching trigger:', error);
    return NextResponse.json({ error: 'Failed to fetch trigger' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const response = await fetch(`${API_BASE_URL}/communication/automation/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': request.headers.get('Authorization') || '',
        'X-Tenant-ID': request.headers.get('X-Tenant-ID') || '',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating trigger:', error);
    return NextResponse.json({ error: 'Failed to update trigger' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const response = await fetch(`${API_BASE_URL}/communication/automation/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': request.headers.get('Authorization') || '',
        'X-Tenant-ID': request.headers.get('X-Tenant-ID') || '',
      },
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error deleting trigger:', error);
    return NextResponse.json({ error: 'Failed to delete trigger' }, { status: 500 });
  }
}
