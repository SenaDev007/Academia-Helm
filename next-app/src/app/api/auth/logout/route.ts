/**
 * Logout API Route
 */

import { NextResponse } from 'next/server';
import { clearServerSession } from '@/lib/auth/session';

export async function POST() {
  await clearServerSession();
  return NextResponse.json({ success: true });
}

