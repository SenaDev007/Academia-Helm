/**
 * POST /api/admin-auth/forgot-password
 *
 * Envoie un email avec un lien de réinitialisation contenant un token JWT signé.
 *
 * Body : { email: string }
 * Réponse : { success: true }
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  generateResetToken,
  isEmailAdminWhitelisted,
  RESET_TOKEN_VALIDITY,
} from '@/lib/admin/admin-auth-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { email?: string };
  if (!body.email) {
    return NextResponse.json({ error: 'Email requis' }, { status: 400 });
  }

  const email = body.email.trim().toLowerCase();

  // Toujours retourner success (sécurité anti-énumération)
  if (!isEmailAdminWhitelisted(email)) {
    return NextResponse.json({ success: true });
  }

  // Générer le token de réinitialisation
  const token = generateResetToken(email);

  // Construire le lien de réinitialisation
  const adminDomain = process.env.NEXT_PUBLIC_ADMIN_URL || 'https://admin.academiahelm.com';
  const resetLink = `${adminDomain}/admin-login?reset=${token}`;

  // Envoyer l'email via Resend
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    try {
      const resendModule = await import('resend');
      const mod = resendModule as unknown as Record<string, unknown>;
      const ResendCtor = (mod.Resend || mod.default) as
        | (new (apiKey: string) => {
            emails: {
              send: (params: {
                from: string;
                to: string;
                subject: string;
                html: string;
              }) => Promise<{ id?: string; error?: { message?: string } | null }>;
            };
          })
        | undefined;

      if (ResendCtor) {
        const resend = new ResendCtor(resendApiKey);
        const fromEmail =
          process.env.ADMIN_EMAIL_FROM || 'Academia Helm <noreply@academiahelm.com>';

        await resend.emails.send({
          from: fromEmail,
          to: email,
          subject: 'Réinitialisation de mot de passe — Back-office Academia Helm',
          html: `
            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:40px 20px;background:#ffffff;">
              <h2 style="color:#0b2f73;font-size:22px;margin-bottom:20px;">Réinitialisation de mot de passe</h2>
              <p style="color:#475569;font-size:16px;line-height:1.6;">Bonjour,</p>
              <p style="color:#475569;font-size:16px;line-height:1.6;">
                Vous avez demandé à réinitialiser votre mot de passe pour le back-office
                Academia Helm.
              </p>
              <p style="color:#475569;font-size:16px;line-height:1.6;">
                Cliquez sur le bouton ci-dessous pour définir un nouveau mot de passe.
                Ce lien est valable ${RESET_TOKEN_VALIDITY} minutes.
              </p>
              <div style="text-align:center;margin:30px 0;">
                <a href="${resetLink}" style="display:inline-block;background:#0b2f73;color:#ffffff;font-weight:600;font-size:16px;padding:12px 32px;border-radius:12px;text-decoration:none;">
                  Réinitialiser mon mot de passe
                </a>
              </div>
              <p style="color:#64748b;font-size:14px;line-height:1.5;">
                Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email.
                Votre mot de passe restera inchangé.
              </p>
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
              <p style="color:#0b2f73;font-weight:600;font-size:16px;">Bien cordialement,<br>Équipe Academia Helm</p>
              <p style="color:#94a3b8;font-size:12px;text-align:center;margin-top:20px;">
                © ${new Date().getFullYear()} Academia Helm · academiahelm.com
              </p>
            </div>
          `,
        });
      }
    } catch (err) {
      console.error('Failed to send admin forgot-password email:', err);
    }
  } else {
    // Mode dev : logger le lien
    console.log(`\n[ADMIN RESET] Lien de réinitialisation pour ${email}:\n${resetLink}\n`);
  }

  return NextResponse.json({ success: true });
}
