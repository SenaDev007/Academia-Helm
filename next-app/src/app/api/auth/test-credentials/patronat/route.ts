/**
 * API Route pour récupérer les identifiants de test Patronat depuis .env
 * Côté serveur uniquement - sécurisé
 */

import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Récupérer les identifiants depuis les variables d'environnement
    const credentials = [];

    // Patronat Admin
    if (process.env.TEST_PATRONAT_ADMIN_EMAIL && process.env.TEST_PATRONAT_ADMIN_PASSWORD) {
      credentials.push({
        email: process.env.TEST_PATRONAT_ADMIN_EMAIL,
        password: process.env.TEST_PATRONAT_ADMIN_PASSWORD,
        role: 'PATRONAT_ADMIN',
      });
    }

    // Patronat Operator
    if (process.env.TEST_PATRONAT_OPERATOR_EMAIL && process.env.TEST_PATRONAT_OPERATOR_PASSWORD) {
      credentials.push({
        email: process.env.TEST_PATRONAT_OPERATOR_EMAIL,
        password: process.env.TEST_PATRONAT_OPERATOR_PASSWORD,
        role: 'PATRONAT_OPERATOR',
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
