/**
 * API Route pour récupérer les identifiants de test Admin depuis .env
 * Côté serveur uniquement - sécurisé
 */

import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Récupérer les identifiants depuis les variables d'environnement
    const credentials = [];

    // Super Admin
    if (process.env.TEST_SUPER_ADMIN_EMAIL && process.env.TEST_SUPER_ADMIN_PASSWORD) {
      credentials.push({
        email: process.env.TEST_SUPER_ADMIN_EMAIL,
        password: process.env.TEST_SUPER_ADMIN_PASSWORD,
        role: 'SUPER_ADMIN',
      });
    }

    // Platform Owner (DEV only)
    if (process.env.PLATFORM_OWNER_EMAIL && process.env.PLATFORM_OWNER_SECRET) {
      credentials.push({
        email: process.env.PLATFORM_OWNER_EMAIL,
        password: process.env.PLATFORM_OWNER_SECRET,
        role: 'PLATFORM_OWNER',
      });
    }

    return NextResponse.json({
      success: true,
      credentials,
    });
  } catch (error: any) {
    console.error('[Test Credentials API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        credentials: [],
        error: error.message || 'Erreur lors de la récupération des identifiants',
      },
      { status: 500 }
    );
  }
}
