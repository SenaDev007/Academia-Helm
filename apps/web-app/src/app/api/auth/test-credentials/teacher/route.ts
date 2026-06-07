/**
 * API Route pour récupérer les identifiants de test Enseignant depuis .env
 * Côté serveur uniquement - sécurisé
 */

import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Récupérer les identifiants depuis les variables d'environnement
    const credentials = [];

    // Enseignant 1
    if (
      process.env.TEST_ENSEIGNANT_MATRICULE_1 &&
      process.env.TEST_ENSEIGNANT_EMAIL_1 &&
      process.env.TEST_ENSEIGNANT_PASSWORD_1
    ) {
      credentials.push({
        matricule: process.env.TEST_ENSEIGNANT_MATRICULE_1,
        email: process.env.TEST_ENSEIGNANT_EMAIL_1,
        password: process.env.TEST_ENSEIGNANT_PASSWORD_1,
        role: 'TEACHER',
      });
    }

    // Enseignant 2
    if (
      process.env.TEST_ENSEIGNANT_MATRICULE_2 &&
      process.env.TEST_ENSEIGNANT_EMAIL_2 &&
      process.env.TEST_ENSEIGNANT_PASSWORD_2
    ) {
      credentials.push({
        matricule: process.env.TEST_ENSEIGNANT_MATRICULE_2,
        email: process.env.TEST_ENSEIGNANT_EMAIL_2,
        password: process.env.TEST_ENSEIGNANT_PASSWORD_2,
        role: 'TEACHER',
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
