/**
 * API Route pour récupérer les identifiants de test Élève depuis .env
 * Côté serveur uniquement - sécurisé
 */

import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Récupérer les identifiants depuis les variables d'environnement
    const credentials = [];

    // Élève 1
    if (
      process.env.TEST_ELEVE_CODE_1 &&
      process.env.TEST_ELEVE_EMAIL_1 &&
      process.env.TEST_ELEVE_PASSWORD_1
    ) {
      credentials.push({
        code: process.env.TEST_ELEVE_CODE_1,
        email: process.env.TEST_ELEVE_EMAIL_1,
        password: process.env.TEST_ELEVE_PASSWORD_1,
        role: 'STUDENT',
      });
    }

    // Élève 2
    if (
      process.env.TEST_ELEVE_CODE_2 &&
      process.env.TEST_ELEVE_EMAIL_2 &&
      process.env.TEST_ELEVE_PASSWORD_2
    ) {
      credentials.push({
        code: process.env.TEST_ELEVE_CODE_2,
        email: process.env.TEST_ELEVE_EMAIL_2,
        password: process.env.TEST_ELEVE_PASSWORD_2,
        role: 'STUDENT',
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
