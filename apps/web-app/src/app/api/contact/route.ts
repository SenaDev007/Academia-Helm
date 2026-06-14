import { NextResponse } from 'next/server';
import { Resend } from 'resend';

/* ══════════════════════════════════════════════════════════════════════
   POST /api/contact
   Receives contact form data, sends an HTML email via Resend and
   attempts to forward the message to WhatsApp via Evolution API.
   ══════════════════════════════════════════════════════════════════════ */

const resend = new Resend(process.env.RESEND_API_KEY);

/* ─── Palette ─── */
const NAVY = '#0b2f73';
const BLUE = '#1d4fa5';
const GOLD = '#f5b335';

/* ─── Types ─── */
interface ContactPayload {
  name: string;
  email: string;
  phone?: string;
  establishment?: string;
  subject: string;
  message: string;
}

/* ─── HTML Email Template ─── */
function buildEmailHtml(data: ContactPayload): string {
  const fields = [
    { label: 'Nom', value: data.name },
    { label: 'Email', value: data.email },
    { label: 'Téléphone', value: data.phone || '—' },
    { label: 'Établissement', value: data.establishment || '—' },
    { label: 'Objet', value: data.subject },
  ];

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Nouveau message de contact — Academia Helm</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:'Segoe UI',Arial,Helvetica,sans-serif;">

  <!-- Outer wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- ── Header ── -->
          <tr>
            <td style="background:linear-gradient(135deg,${NAVY},${BLUE});border-radius:12px 12px 0 0;padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:0.5px;">
                Academia<span style="color:${GOLD};">Helm</span>
              </h1>
              <!-- Gold accent bar -->
              <div style="margin:12px auto 0;width:60px;height:4px;border-radius:2px;background-color:${GOLD};"></div>
              <p style="margin:10px 0 0;color:rgba(255,255,255,0.7);font-size:13px;">Nouveau message de contact</p>
            </td>
          </tr>

          <!-- ── Subject banner ── -->
          <tr>
            <td style="background-color:${GOLD};padding:14px 40px;text-align:center;">
              <p style="margin:0;color:${NAVY};font-size:15px;font-weight:700;">
                📩 ${escapeHtml(data.subject)}
              </p>
            </td>
          </tr>

          <!-- ── Fields ── -->
          <tr>
            <td style="background-color:#ffffff;padding:28px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                ${fields
                  .map(
                    (f) => `
                <tr>
                  <td style="padding:10px 12px;font-size:13px;font-weight:600;color:${NAVY};width:140px;vertical-align:top;border-bottom:1px solid #eef0f4;">
                    ${f.label}
                  </td>
                  <td style="padding:10px 12px;font-size:13px;color:#374151;vertical-align:top;border-bottom:1px solid #eef0f4;">
                    ${escapeHtml(f.value)}
                  </td>
                </tr>`,
                  )
                  .join('')}
                <!-- Message row -->
                <tr>
                  <td style="padding:10px 12px;font-size:13px;font-weight:600;color:${NAVY};width:140px;vertical-align:top;border-bottom:none;">
                    Message
                  </td>
                  <td style="padding:10px 12px;font-size:13px;color:#374151;vertical-align:top;border-bottom:none;">
                    <div style="background-color:#f8f9fb;border-left:3px solid ${GOLD};border-radius:4px;padding:14px 16px;margin-top:4px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(data.message)}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── Footer ── -->
          <tr>
            <td style="background:linear-gradient(135deg,${NAVY},${BLUE});border-radius:0 0 12px 12px;padding:24px 40px;text-align:center;">
              <p style="margin:0;color:rgba(255,255,255,0.9);font-size:13px;font-weight:600;">
                Academia<span style="color:${GOLD};">Helm</span>
              </p>
              <p style="margin:4px 0 0;color:rgba(255,255,255,0.55);font-size:11px;">
                Le cockpit digital de votre établissement
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
}

/* ─── Helpers ─── */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ─── WhatsApp forwarding (best-effort) ─── */
async function sendToWhatsApp(data: ContactPayload): Promise<void> {
  const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL;
  const WHATSAPP_API_KEY = process.env.WHATSAPP_API_KEY;

  if (!WHATSAPP_API_URL || !WHATSAPP_API_KEY) {
    console.log(
      '[contact] WhatsApp API not configured — skipping. Message:',
      JSON.stringify({ from: data.name, email: data.email, subject: data.subject }),
    );
    return;
  }

  try {
    const messageText = [
      `*Nouveau message de contact — Academia Helm*`,
      ``,
      `*Nom :* ${data.name}`,
      `*Email :* ${data.email}`,
      data.phone ? `*Tél :* ${data.phone}` : '',
      data.establishment ? `*Étab :* ${data.establishment}` : '',
      `*Objet :* ${data.subject}`,
      ``,
      `${data.message}`,
    ]
      .filter(Boolean)
      .join('\n');

    // Attempt to send via Evolution API (common WhatsApp integration)
    await fetch(`${WHATSAPP_API_URL}/message/sendText/academia-helm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: WHATSAPP_API_KEY,
      },
      body: JSON.stringify({
        number: '2290141360803',
        textMessage: { text: messageText },
      }),
    });

    console.log('[contact] WhatsApp message sent successfully.');
  } catch (err) {
    // Best-effort: don't fail the request if WhatsApp fails
    console.error('[contact] WhatsApp send failed:', err);
  }
}

/* ══════════════════════════  Handler  ══════════════════════════ */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ContactPayload;

    /* ─── Validate ─── */
    const { name, email, subject, message } = body;
    if (!name?.trim() || !email?.trim() || !subject?.trim() || !message?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Tous les champs obligatoires doivent être remplis.' },
        { status: 400 },
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { success: false, error: "L'adresse email n'est pas valide." },
        { status: 400 },
      );
    }

    if (message.trim().length < 20) {
      return NextResponse.json(
        { success: false, error: 'Le message doit contenir au moins 20 caractères.' },
        { status: 400 },
      );
    }

    /* ─── Send email via Resend ─── */
    const emailResult = await resend.emails.send({
      from: 'Academia Helm Contact <noreply@academiahelm.com>',
      to: ['support@academiahelm.com'],
      replyTo: email.trim(),
      subject: `[Contact] ${subject} — ${name}`,
      html: buildEmailHtml(body),
    });

    if (emailResult.error) {
      console.error('[contact] Resend error:', emailResult.error);
      return NextResponse.json(
        { success: false, error: "L'envoi de l'email a échoué. Veuillez réessayer." },
        { status: 502 },
      );
    }

    /* ─── Forward to WhatsApp (best-effort, non-blocking) ─── */
    // Fire and forget — don't await to avoid blocking the response
    sendToWhatsApp(body).catch(() => {});

    return NextResponse.json({ success: true, emailId: emailResult.data?.id });
  } catch (err) {
    console.error('[contact] Unexpected error:', err);
    return NextResponse.json(
      { success: false, error: 'Une erreur interne est survenue.' },
      { status: 500 },
    );
  }
}
