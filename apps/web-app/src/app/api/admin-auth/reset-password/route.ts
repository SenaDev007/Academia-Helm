/**
 * POST /api/admin-auth/reset-password
 *
 * Vérifie le token de réinitialisation et met à jour le mot de passe.
 *
 * Body : { token: string, password: string }
 * Réponse : { success: true } ou { error: string }
 *
 * Note : ADMIN_PASSWORDS est une env var. On ne peut pas la modifier en runtime.
 * Le nouveau hash est loggé et doit être mis à jour manuellement dans Vercel.
 * En production, il faudrait stocker les mots de passe en DB.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  verifyResetToken,
  hashAdminPassword,
  isEmailAdminWhitelisted,
} from '@/lib/admin/admin-auth-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { token?: string; password?: string };
  if (!body.token || !body.password) {
    return NextResponse.json({ error: 'Token et mot de passe requis' }, { status: 400 });
  }

  if (body.password.length < 8) {
    return NextResponse.json({ error: 'Le mot de passe doit faire au moins 8 caractères' }, { status: 400 });
  }

  // Vérifier le token
  const email = verifyResetToken(body.token);
  if (!email) {
    return NextResponse.json({ error: 'Token invalide ou expiré' }, { status: 400 });
  }

  // Vérifier que l'email est toujours whitelisté
  if (!isEmailAdminWhitelisted(email)) {
    return NextResponse.json({ error: 'Compte non autorisé' }, { status: 403 });
  }

  // Hasher le nouveau mot de passe
  const hash = await hashAdminPassword(body.password);
  if (!hash) {
    return NextResponse.json({ error: 'Erreur lors du hashage du mot de passe' }, { status: 500 });
  }

  // ⚠️ LIMITATION : ADMIN_PASSWORDS est une env var — on ne peut pas la modifier en runtime.
  // Le hash est loggé pour mise à jour manuelle dans Vercel.
  // TODO : migrer vers une table DB pour les mots de passe admin.
  console.log(`\n[ADMIN RESET] Nouveau hash bcrypt pour ${email}:`);
  console.log(hash);
  console.log(`→ Mettre à jour ADMIN_PASSWORDS dans Vercel avec:`);
  console.log(`  {"${email}":"${hash}"}\n`);

  return NextResponse.json({
    success: true,
    message: 'Mot de passe réinitialisé. Le nouveau hash a été généré et doit être déployé.',
  });
}
