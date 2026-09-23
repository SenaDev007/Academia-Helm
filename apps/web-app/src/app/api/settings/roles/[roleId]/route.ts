/**
 * ============================================================================
 * API PROXY - SETTINGS ROLE BY ID
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { cookies } from 'next/headers';

const API_BASE_URL = getApiBaseUrlForRoutes();

async function getAuthHeaders(request: NextRequest) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session_token')?.value;
  const authHeader = request.headers.get('Authorization');
  
  return {
    'Authorization': authHeader || (sessionToken ? `Bearer ${sessionToken}` : ''),
    'Content-Type': 'application/json',
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roleId: string }> }
) {
  const { roleId } = await params;
  try {
    const headers = await getAuthHeaders(request);
    
    const response = await fetchWithTimeout(normalizeApiUrl(`${API_BASE_URL}/settings/roles/${roleId}`), {
      headers,
      cache: 'no-store',
    }, 15000);

    const data = await response.json();
    return NextResponse.json(data, { status: response.status, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Error fetching role:', error);
    return NextResponse.json({ error: 'Failed to fetch role' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ roleId: string }> }
) {
  const { roleId } = await params;
  try {
    const body = await request.json();
    const headers = await getAuthHeaders(request);
    
    const response = await fetchWithTimeout(normalizeApiUrl(`${API_BASE_URL}/settings/roles/${roleId}`), {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
      cache: 'no-store',
    }, 15000);

    const data = await response.json();
    return NextResponse.json(data, { status: response.status, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Error updating role:', error);
    return NextResponse.json({ error: 'Failed to update role' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ roleId: string }> }
) {
  const { roleId } = await params;
  try {
    const headers = await getAuthHeaders(request);
    
    const response = await fetchWithTimeout(normalizeApiUrl(`${API_BASE_URL}/settings/roles/${roleId}`), {
      method: 'DELETE',
      headers,
      cache: 'no-store',
    }, 15000);

    const data = await response.json();
    return NextResponse.json(data, { status: response.status, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Error deleting role:', error);
    return NextResponse.json({ error: 'Failed to delete role' }, { status: 500 });
  }
}
