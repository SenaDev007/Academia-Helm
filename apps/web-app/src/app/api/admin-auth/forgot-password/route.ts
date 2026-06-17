/**
 * POST /api/admin-auth/forgot-password
 *
 * Envoie un email de réinitialisation de mot de passe à l'admin.
 * Pour l'instant, envoie un email simple via Resend avec un lien
 * vers /admin-login?reset=true&email=xxx (à améliorer plus tard avec
 * un token JWT de réinitialisation).
 *
 * Body : { email: string }
 * Réponse : { success: true }
 */

import { NextRequest, NextResponse } from 'next/server';
import { isEmailAdminWhitelisted } from '@/lib/admin/admin-auth-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { email?: string };
  if (!body.email) {
    return NextResponse.json({ error: 'Email requis' }, { status: 400 });
  }

  const email = body.email.trim().toLowerCase();

  // Vérifier la whitelist admin — mais ne pas révéler si l'email existe
  // Toujours retourner success pour éviter l'énumération d'emails
  if (!isEmailAdminWhitelisted(email)) {
    // Email non whitelisté — retourner success quand même (sécurité)
    return NextResponse.json({ success: true });
  }

  // Envoyer un email de réinitialisation via Resend
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
        const baseUrl =
          process.env.NEXT_PUBLIC_APP_URL || 'https://academiahelm.com';

        await resend.emails.send({
          from: fromEmail,
          to: email,
          subject: 'Réinitialisation de mot de passe — Back-office Academia Helm',
          html: `
            <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:20px;">
              <h2 style="color:#0b2f73;">Réinitialisation de mot de passe</h2>
              <p style="color:#475569;font-size:16px;">Bonjour,</p>
              <p style="color:#475569;font-size:16px;">
                Vous avez demandé à réinitialiser votre mot de passe pour le back-office
                Academia Helm.
              </p>
              <p style="color:#475569;font-size:16px;">
                Pour définir un nouveau mot de passe, contactez l'administrateur technique
                de la plateforme, ou répondez à cet email.
              </p>
              <p style="color:#64748b;font-size:14px;">
                Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email.
              </p>
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;">
              <p style="color:#0b2f73;font-weight:600;">Bien cordialement,<br>Équipe Academia Helm</p>
              <p style="color:#94a3b8;font-size:12px;text-align:center;margin-top:20px;">
                © ${new Date().getFullYear()} Academia Helm · <a href="${baseUrl}" style="color:#94a3b8;">academiahelm.com</a>
              </p>
            </div>
          `,
        });
      }
    } catch (err) {
      console.error('Failed to send admin forgot-password email:', err);
    }
  }

  return NextResponse.json({ success: true });
}
