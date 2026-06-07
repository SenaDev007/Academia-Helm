/**
 * API Route - QHSE Incidents
 * Proxy vers l'API backend NestJS
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const academicYearId = searchParams.get('academicYearId');
    const schoolLevelId = searchParams.get('schoolLevelId');
    const type = searchParams.get('type');
    const gravity = searchParams.get('gravity');
    const status = searchParams.get('status');

    const params = new URLSearchParams();
    if (academicYearId) params.append('academicYearId', academicYearId);
    if (schoolLevelId) params.append('schoolLevelId', schoolLevelId);
    if (type) params.append('type', type);
    if (gravity) params.append('gravity', gravity);
    if (status) params.append('status', status);

    // TODO: Récupérer le token d'authentification depuis la session
    const token = request.headers.get('authorization') || '';

    const response = await fetch(`${API_BASE_URL}/qhs/incidents?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: token }),
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching QHSE incidents:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch incidents' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // TODO: Récupérer le token d'authentification depuis la session
    const token = request.headers.get('authorization') || '';

    const response = await fetch(`${API_BASE_URL}/qhs/incidents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: token }),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error creating QHSE incident:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create incident' },
      { status: 500 }
    );
  }
}

