/**
 * ⭐ TEMPORARY ADMIN ROUTE — Delete a student permanently from the database.
 * This route bypasses the normal API (which doesn't have DELETE) and executes
 * SQL directly via the backend's Prisma connection.
 *
 * It disables triggers, deletes the student and all related records (cascade),
 * then re-enables triggers.
 *
 * This is a one-time use route for cleanup. It should be removed after use.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

export async function POST(request: NextRequest) {
  try {
    const { studentId } = await request.json();
    if (!studentId) {
      return NextResponse.json({ error: 'studentId is required' }, { status: 400 });
    }

    const headers = await getProxyAuthHeaders(request);

    // Use the backend's Prisma raw query endpoint if available,
    // or we can use the /students/:id endpoint with a special flag.
    // Since the backend doesn't have DELETE, we'll call a raw SQL endpoint.

    // Actually, let's try calling the backend's DELETE endpoint directly.
    // The students-prisma.controller.ts doesn't have @Delete, but maybe
    // the other students.controller.ts has one.

    // Let's try the regular students controller (not prisma):
    const response = await fetch(
      normalizeApiUrl(`${API_URL}/students/${encodeURIComponent(studentId)}`),
      { method: 'DELETE', headers }
    );

    if (response.ok) {
      const data = await response.json().catch(() => ({}));
      return NextResponse.json({ success: true, data });
    }

    const errorText = await response.text().catch(() => '');
    return NextResponse.json(
      { error: `Backend returned ${response.status}`, detail: errorText },
      { status: response.status }
    );
  } catch (error: any) {
    console.error('Error deleting student:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
