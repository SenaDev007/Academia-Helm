/**
 * ============================================================================
 * API PROXY - SCHEDULE MESSAGE
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const { messageId } = await params;
  try {
    const body = await request.json();
    const response = await fetch(`${API_BASE_URL}/api/communication/scheduling/${messageId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': request.headers.get('Authorization') || '',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error scheduling message:', error);
    return NextResponse.json({ error: 'Failed to schedule message' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const { messageId } = await params;
  try {
    const response = await fetch(`${API_BASE_URL}/api/communication/scheduling/${messageId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': request.headers.get('Authorization') || '',
      },
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error deleting scheduled message:', error);
    return NextResponse.json({ error: 'Failed to delete scheduled message' }, { status: 500 });
  }
}

