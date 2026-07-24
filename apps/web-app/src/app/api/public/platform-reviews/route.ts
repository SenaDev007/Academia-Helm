import { NextResponse } from 'next/server';
import { bffFetchJson, buildCacheHeaders } from '@/lib/api/bff-fetch';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await bffFetchJson<any>('/public/platform-reviews');
    const reviews = Array.isArray(data?.reviews) ? data : { reviews: [] };
    return NextResponse.json(reviews, {
      headers: buildCacheHeaders(reviews),
    });
  } catch {
    return NextResponse.json({ reviews: [] }, { status: 200 });
  }
}
