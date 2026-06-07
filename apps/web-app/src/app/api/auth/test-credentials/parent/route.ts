/**
 * API Route pour récupérer les identifiants de test Parent depuis .env
 * Côté serveur uniquement - sécurisé
 */

import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Récupérer les identifiants depuis les variables d'environnement
    const credentials = [];

    // Parent 1
    if (
      process.env.TEST_PARENT_PHONE_1 &&
      process.env.TEST_PARENT_EMAIL_1 &&
      process.env.TEST_PARENT_OTP_1
    ) {
      credentials.push({
        phone: process.env.TEST_PARENT_PHONE_1,
        email: process.env.TEST_PARENT_EMAIL_1,
        otp: process.env.TEST_PARENT_OTP_1,
        role: 'PARENT',
      });
    }

    // Parent 2
    if (
      process.env.TEST_PARENT_PHONE_2 &&
      process.env.TEST_PARENT_EMAIL_2 &&
      process.env.TEST_PARENT_OTP_2
    ) {
      credentials.push({
        phone: process.env.TEST_PARENT_PHONE_2,
        email: process.env.TEST_PARENT_EMAIL_2,
        otp: process.env.TEST_PARENT_OTP_2,
        role: 'PARENT',
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
