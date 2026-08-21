import { NextRequest, NextResponse } from 'next/server';
import { nestControllerUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ entryId: string }> }
) {
  const { entryId } = await params;
  try {
    const headers = await getProxyAuthHeaders(request);
    const response = await fetch(nestControllerUrl(`timetables/entries/${entryId}`), {
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

/**
 * ⭐ PUT /api/timetables/entries/[entryId]
 *    Met à jour une séance existante (édition inline depuis le formulaire).
 *    Body: { subjectId?, teacherId?, roomId?, dayOfWeek?, startTime?, endTime?, duration?, step? }
 *    Tous les champs sont optionnels — on ne met à jour que ce qui est envoyé.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ entryId: string }> }
) {
  const { entryId } = await params;
  try {
    const body = await request.json();
    const headers = await getProxyAuthHeaders(request);
    const response = await fetch(nestControllerUrl(`timetables/entries/${entryId}`), {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return NextResponse.json(err, { status: response.status });
    }
    return NextResponse.json(await response.json());
  } catch (error) {
    console.error('Error updating timetable entry:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
