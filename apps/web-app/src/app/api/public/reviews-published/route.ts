import { NextRequest, NextResponse } from 'next/server';
import { bffFetch } from '@/lib/api/bff-fetch';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const search = request.nextUrl.search;
  const path = `/reviews/published${search}`;

  try {
    const response = await bffFetch(path, { timeoutMs: 10_000 });
    const body = await response.text();
    return new NextResponse(body, {
      status: response.status,
      headers: {
        'Content-Type':
          response.headers.get('Content-Type') || 'application/json',
        'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=30',
      },
    });
  } catch {
    return NextResponse.json(
      { message: 'Service indisponible' },
      { status: 502 },
    );
  }
}
