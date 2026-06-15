/**
 * API Route pour récupérer les identifiants de test École depuis .env
 * Côté serveur uniquement - sécurisé
 */

import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Récupérer les identifiants depuis les variables d'environnement
    const credentials = [];

    // Promoteur
    if (process.env.TEST_PROMOTEUR_EMAIL && process.env.TEST_PROMOTEUR_PASSWORD) {
      credentials.push({
        email: process.env.TEST_PROMOTEUR_EMAIL,
        password: process.env.TEST_PROMOTEUR_PASSWORD,
        role: 'PROMOTEUR',
      });
    }

    // Directeur
    if (process.env.TEST_DIRECTEUR_EMAIL && process.env.TEST_DIRECTEUR_PASSWORD) {
      credentials.push({
        email: process.env.TEST_DIRECTEUR_EMAIL,
        password: process.env.TEST_DIRECTEUR_PASSWORD,
        role: 'DIRECTOR',
      });
    }

    // Secrétaire
    if (process.env.TEST_SECRETAIRE_EMAIL && process.env.TEST_SECRETAIRE_PASSWORD) {
      credentials.push({
        email: process.env.TEST_SECRETAIRE_EMAIL,
        password: process.env.TEST_SECRETAIRE_PASSWORD,
        role: 'SECRETARY',
      });
    }

    // Comptable
    if (process.env.TEST_COMPTABLE_EMAIL && process.env.TEST_COMPTABLE_PASSWORD) {
      credentials.push({
        email: process.env.TEST_COMPTABLE_EMAIL,
        password: process.env.TEST_COMPTABLE_PASSWORD,
        role: 'ACCOUNTANT',
      });
    }

    // Secrétaire-Comptable
    if (process.env.TEST_SECRETAIRE_COMPTABLE_EMAIL && process.env.TEST_SECRETAIRE_COMPTABLE_PASSWORD) {
      credentials.push({
        email: process.env.TEST_SECRETAIRE_COMPTABLE_EMAIL,
        password: process.env.TEST_SECRETAIRE_COMPTABLE_PASSWORD,
        role: 'SECRETARY_ACCOUNTANT',
      });
    }

    // Censeur
    if (process.env.TEST_CENSEUR_EMAIL && process.env.TEST_CENSEUR_PASSWORD) {
      credentials.push({
        email: process.env.TEST_CENSEUR_EMAIL,
        password: process.env.TEST_CENSEUR_PASSWORD,
        role: 'CENSEUR',
      });
    }

    // Surveillant
    if (process.env.TEST_SURVEILLANT_EMAIL && process.env.TEST_SURVEILLANT_PASSWORD) {
      credentials.push({
        email: process.env.TEST_SURVEILLANT_EMAIL,
        password: process.env.TEST_SURVEILLANT_PASSWORD,
        role: 'SURVEILLANT',
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
