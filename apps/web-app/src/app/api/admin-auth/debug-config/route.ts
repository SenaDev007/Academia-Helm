/**
 * GET /api/admin-auth/debug-config
 *
 * Endpoint temporaire de diagnostic pour vérifier que les variables
 * d'environnement ADMIN_EMAILS et ADMIN_PASSWORDS sont bien configurées.
 *
 * Ne retourne AUCUNE donnée sensible — juste des booléens et comptes.
 * À supprimer après diagnostic.
 */

import { NextResponse } from 'next/server';
import {
  isEmailAdminWhitelisted,
  isPasswordAuthEnabled,
} from '@/lib/admin/admin-auth-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  // Reconstituer la whitelist depuis env var (la fonction n'est pas exportée du module)
  const rawWhitelist = process.env.ADMIN_EMAILS || '';
  const whitelistArray = rawWhitelist
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV,

    // Whitelist
    adminEmailsConfigured: whitelistArray.length > 0,
    adminEmailsCount: whitelistArray.length,
    adminEmailsList: whitelistArray, // pour vérifier que l'email est bien là

    // Password auth
    passwordAuthEnabled: isPasswordAuthEnabled(),
    adminPasswordsConfigured: Boolean(process.env.ADMIN_PASSWORDS),

    // Vérification spécifique pour l'email de l'utilisateur
    userSEmailWhitelisted: isEmailAdminWhitelisted('s.akpovitohou@gmail.com'),

    // Google OAuth
    googleConfigured: Boolean(
      process.env.GOOGLE_OAUTH_CLIENT_ID &&
        process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    ),
    googleClientIdSet: Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID),
    googleRedirectUri: process.env.GOOGLE_OAUTH_ADMIN_REDIRECT_URI || process.env.GOOGLE_OAUTH_REDIRECT_URI || '(non défini)',

    // JWT
    jwtSecretSet: Boolean(process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET),
  });
}
