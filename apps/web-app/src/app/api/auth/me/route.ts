/**
 * Auth Me API Route
 *
 * Retourne l'utilisateur et le tenant actuels depuis la session.
 * Utilisé par checkAuth() pour le flow post-login.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/session';

export async function GET() {
  try {
    const session = await getServerSession();

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      );
    }

    const user = session.user;
    const tenant = session.tenant ?? {
      id: user.tenantId || '',
      name: 'Mon École',
      slug: '',
      subdomain: '',
      status: 'active' as const,
      subscriptionStatus: 'ACTIVE_SUBSCRIBED' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      trialEndsAt: undefined,
      nextPaymentDueAt: undefined,
    };

    return NextResponse.json({ user, tenant });
  } catch (error) {
    console.error('[Auth Me API] Error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de la session' },
      { status: 500 }
    );
  }
}
