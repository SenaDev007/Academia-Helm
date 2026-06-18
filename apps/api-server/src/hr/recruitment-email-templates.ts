/**
 * ============================================================================
 * RECRUITMENT EMAIL TEMPLATES — Branded for tenant school + Academia Helm footer
 * ============================================================================
 *
 * Templates HTML pour les 8 notifications du cycle de recrutement.
 *
 * Structure commune :
 *   ┌──────────────────────────────────────┐
 *   │  HEADER : Logo + Nom école tenante   │  ← personnalisé par tenant
 *   ├──────────────────────────────────────┤
 *   │  CORPS : Contenu spécifique          │  ← variable selon événement
 *   │         (poste, date, score, etc.)   │
 *   ├──────────────────────────────────────┤
 *   │  FOOTER : Signature Academia Helm    │  ← commun à tous
 *   └──────────────────────────────────────┘
 *
 * Tous les templates retournent `{ subject, html }`.
 * ============================================================================
 */

function escHtml(s: string | number | undefined | null): string {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDateFR(date: Date | string | undefined | null): string {
  if (!date) return 'Date à confirmer';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return 'Date invalide';
    return d.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return 'Date invalide';
  }
}

function formatTimeFR(time: string | undefined | null): string {
  if (!time) return '';
  // Time can be "HH:mm" or "HH:mm:ss" or full ISO
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(time)) return time.substring(0, 5);
  try {
    const d = new Date(time);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }
  } catch {
    /* ignore */
  }
  return time;
}

export interface TenantBranding {
  schoolName: string;
  schoolLogo?: string | null; // base64 data URL or https URL
  schoolAddress?: string | null;
  schoolPhone?: string | null;
  schoolEmail?: string | null;
  // RecruiterProfile fields (optional — used to personalize from + signature)
  recruiterName?: string | null;
  recruiterEmail?: string | null;
  recruiterFunction?: string | null;
  recruiterPhone?: string | null;
  signatureText?: string | null;
  signatureLogoUrl?: string | null;
}

export interface RecruitmentEmailData {
  /** Branding du tenant (école) */
  branding: TenantBranding;
  /** Nom complet du candidat */
  candidateName: string;
  /** Prénom du candidat (pour salutation) */
  candidateFirstName: string;
  /** Titre du poste visé */
  jobTitle: string;
  /** Nom de l'école (alias branding.schoolName — gardé pour clarté) */
  tenantName?: string;
}

/**
 * Construit l'en-tête HTML avec logo + nom de l'école.
 * Si logoUrl est fourni → image, sinon fallback sur les initiales.
 */
function renderHeader(branding: TenantBranding): string {
  const schoolName = escHtml(branding.schoolName || 'Établissement');
  // Logo de l'école :
  // - Si URL http(s) → img directe
  // - Si base64 (data:image) → img directe (le logo est compressé par logo-compressor.ts)
  // - Si null → fallback initiales
  const logoBlock = branding.schoolLogo
    ? `<img src="${escHtml(branding.schoolLogo)}" alt="${schoolName}" style="max-height:48px;max-width:160px;object-fit:contain;" />`
    : `<div style="width:48px;height:48px;border:2px solid #F5A623;border-radius:10px;text-align:center;vertical-align:middle;background:rgba(245,166,35,0.12);line-height:44px;">
         <span style="font-size:18px;font-weight:bold;color:#F2C94C;letter-spacing:1px;">${escHtml((branding.schoolName || 'EC').substring(0, 2).toUpperCase())}</span>
       </div>`;

  const contactInfo = [
    branding.schoolAddress,
    branding.schoolPhone ? `Tél : ${branding.schoolPhone}` : null,
    branding.schoolEmail ? `Email : ${branding.schoolEmail}` : null,
  ]
    .filter(Boolean)
    .map((s) => `<div style="font-size:11px;color:#c7d2fe;margin-top:2px;">${escHtml(s)}</div>`)
    .join('');

  return `
    <!-- Header bleu navy Academia Helm + accent doré -->
    <tr>
      <td style="background:linear-gradient(160deg,#0D1F6E 0%,#0D3B85 100%);padding:28px 24px 22px;text-align:center;border-bottom:3px solid #F5A623;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 16px;">
          <tr>
            <td style="vertical-align:middle;padding-right:14px;text-align:left;">
              ${logoBlock}
            </td>
            <td style="padding-left:14px;text-align:left;vertical-align:middle;">
              <div style="font-size:22px;font-weight:bold;color:#ffffff;letter-spacing:0.5px;">${schoolName}</div>
              <div style="font-size:13px;color:#F5A623;margin-top:4px;">Recrutement</div>
            </td>
          </tr>
        </table>
        <div style="height:2px;width:72px;background:#F5A623;margin:0 auto;border-radius:1px;"></div>
        ${contactInfo ? `<div style="margin-top:12px;">${contactInfo}</div>` : ''}
      </td>
    </tr>`;
}

/**
 * Footer commun à tous les emails — signature Academia Helm.
 * Si un RecruiterProfile est configuré avec une signature personnalisée,
 * elle est affichée en plus de la signature AH par défaut.
 */
function renderFooter(branding: TenantBranding): string {
  // Signature personnalisée du recruteur (optionnelle)
  // Le functionLabel est déjà inclus dans la signature la plupart du temps,
  // on ne l'affiche séparément que s'il n'est PAS déjà dans la signature
  const showFunctionLabel = branding.signatureText &&
    branding.recruiterFunction &&
    !branding.signatureText.includes(branding.recruiterFunction);

  const recruiterSignatureBlock = branding.signatureText
    ? `
    <!-- Signature personnalisée du recruteur -->
    <tr>
      <td style="background:#f8fafc;padding:20px 28px;border-bottom:1px solid #e2e8f0;">
        <div style="font-size:13px;color:#0f172a;line-height:1.6;">
          ${escHtml(branding.signatureText).replace(/\n/g, '<br />')}
        </div>
        ${showFunctionLabel ? `<div style="font-size:11px;color:#64748b;margin-top:6px;">${escHtml(branding.recruiterFunction)}</div>` : ''}
      </td>
    </tr>`
    : '';

  return `${recruiterSignatureBlock}
    <!-- Footer Academia Helm -->
    <tr>
      <td style="background:#0D1F6E;padding:24px 28px;text-align:center;border-top:3px solid #F5A623;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 12px;">
          <tr>
            <td style="vertical-align:middle;padding-right:12px;text-align:left;">
              <img src="https://www.academiahelm.com/images/logo-Academia%20Hub.png" alt="Academia Helm" style="height:36px;width:auto;max-width:120px;object-fit:contain;" />
            </td>
            <td style="padding-left:4px;text-align:left;vertical-align:middle;">
              <div style="font-size:15px;font-weight:bold;color:#ffffff;">Academia Helm</div>
              <div style="font-size:11px;color:#F5A623;margin-top:2px;">Plateforme de pilotage éducatif</div>
            </td>
          </tr>
        </table>
        <div style="font-size:11px;color:#94a3b8;line-height:1.6;">
          Cet email a été envoyé automatiquement par la plateforme Academia Helm.<br />
          Merci de ne pas répondre directement à ce message.
        </div>
      </td>
    </tr>`;
}

/**
 * Wrapper commun — construit l'email complet avec header + corps + footer.
 */
function renderEmail(
  branding: TenantBranding,
  bodyContent: string,
): string {
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#eef2f7;font-family:Arial,Helvetica,sans-serif;">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(12,26,51,0.08);">
        ${renderHeader(branding)}
        <!-- Corps -->
        <tr>
          <td style="padding:32px 28px 28px;background:#f8fafc;">
            ${bodyContent}
          </td>
        </tr>
        ${renderFooter(branding)}
      </table>
    </td>
  </tr>
</table>`;
}

/**
 * Badge coloré (vert/rouge/orange/bleu) pour statut.
 */
function renderBadge(color: 'green' | 'red' | 'orange' | 'blue', text: string): string {
  const colors = {
    green: { bg: '#ecfdf5', border: '#6ee7b7', text: '#047857' },
    red: { bg: '#fef2f2', border: '#fca5a5', text: '#b91c1c' },
    orange: { bg: '#fffbeb', border: '#fcd34d', text: '#92400e' },
    blue: { bg: '#eff6ff', border: '#93c5fd', text: '#1e40af' },
  };
  const c = colors[color];
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
    <tr>
      <td style="padding:8px 14px;border-radius:999px;background:${c.bg};border:1px solid ${c.border};color:${c.text};font-size:13px;font-weight:bold;">${escHtml(text)}</td>
    </tr>
  </table>`;
}

// ============================================================================
// 1. CANDIDATURE REÇUE — récap pour le candidat
// ============================================================================
export function renderApplicationReceived(
  data: RecruitmentEmailData & {
    experiences: Array<{ title?: string; company?: string; years?: string; description?: string }>;
    education: Array<{ degree?: string; school?: string; year?: string }>;
    skills: string[];
    pitch?: string;
    documentsSubmitted: Array<{ type: string; fileName: string }>;
  },
): { subject: string; html: string } {
  const subject = `✅ Candidature reçue — ${data.jobTitle} chez ${data.branding.schoolName}`;

  const experiencesHtml = data.experiences.length
    ? data.experiences
        .map(
          (e) =>
            `<li style="margin-bottom:8px;"><strong>${escHtml(e.title || 'Poste')}</strong> — ${escHtml(e.company || '')} <span style="color:#64748b;">(${escHtml(e.years || '')})</span>${e.description ? `<br /><span style="font-size:12px;color:#475569;">${escHtml(e.description)}</span>` : ''}</li>`,
        )
        .join('')
    : '<li style="color:#94a3b8;">Aucune expérience saisie</li>';

  const educationHtml = data.education.length
    ? data.education
        .map(
          (e) =>
            `<li style="margin-bottom:6px;"><strong>${escHtml(e.degree || 'Diplôme')}</strong> — ${escHtml(e.school || '')} <span style="color:#64748b;">(${escHtml(e.year || '')})</span></li>`,
        )
        .join('')
    : '<li style="color:#94a3b8;">Aucune formation saisie</li>';

  const skillsHtml = data.skills.length
    ? data.skills.map((s) => `<span style="display:inline-block;background:#eff6ff;border:1px solid #93c5fd;color:#1e40af;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:600;margin:2px;">${escHtml(s)}</span>`).join('')
    : '<span style="color:#94a3b8;font-size:12px;">Aucune compétence saisie</span>';

  const docsHtml = data.documentsSubmitted.length
    ? data.documentsSubmitted.map((d) => `<li style="margin-bottom:4px;">📎 ${escHtml(d.fileName)} <span style="color:#64748b;font-size:11px;">(${escHtml(d.type)})</span></li>`).join('')
    : '<li style="color:#94a3b8;">Aucun document joint</li>';

  const body = `
    ${renderBadge('green', '✅ Candidature reçue')}
    <h2 style="margin:0 0 8px;color:#0f172a;font-size:20px;">Bonjour ${escHtml(data.candidateFirstName)},</h2>
    <p style="margin:0 0 16px;color:#475569;line-height:1.6;">Nous avons bien reçu votre candidature pour le poste de <strong style="color:#0D1F6E;">${escHtml(data.jobTitle)}</strong>. Sarah, notre Assistante RH, analyse automatiquement votre dossier. Voici le récapitulatif des informations transmises :</p>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:20px;">
      <tr><td style="padding:16px 20px;">
        <h3 style="margin:0 0 12px;color:#0D1F6E;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">📋 Récapitulatif</h3>
        <p style="margin:0 0 12px;font-size:13px;color:#334155;"><strong>Poste visé :</strong> ${escHtml(data.jobTitle)}</p>
        <p style="margin:0 0 12px;font-size:13px;color:#334155;"><strong>Établissement :</strong> ${escHtml(data.branding.schoolName)}</p>
        <p style="margin:0 0 16px;font-size:13px;color:#334155;"><strong>Candidat :</strong> ${escHtml(data.candidateName)}</p>

        ${data.experiences.length > 0 ? `
        <h4 style="margin:0 0 8px;color:#0D1F6E;font-size:12px;text-transform:uppercase;">💼 Expériences professionnelles</h4>
        <ul style="margin:0 0 16px;padding-left:20px;font-size:13px;color:#334155;">${experiencesHtml}</ul>
        ` : ''}

        ${data.education.length > 0 ? `
        <h4 style="margin:0 0 8px;color:#0D1F6E;font-size:12px;text-transform:uppercase;">🎓 Formations</h4>
        <ul style="margin:0 0 16px;padding-left:20px;font-size:13px;color:#334155;">${educationHtml}</ul>
        ` : ''}

        ${data.skills.length > 0 ? `
        <h4 style="margin:0 0 8px;color:#0D1F6E;font-size:12px;text-transform:uppercase;">⭐ Compétences</h4>
        <div style="margin:0 0 16px;">${skillsHtml}</div>
        ` : ''}

        ${data.pitch ? `<h4 style="margin:0 0 8px;color:#0D1F6E;font-size:12px;text-transform:uppercase;">💭 Motivation</h4><p style="margin:0 0 16px;font-size:13px;color:#334155;background:#f8fafc;border-left:3px solid #0D1F6E;padding:10px 14px;border-radius:4px;font-style:italic;white-space:pre-line;">${escHtml(data.pitch)}</p>` : ''}

        ${data.documentsSubmitted.length > 0 ? `
        <h4 style="margin:0 0 8px;color:#0D1F6E;font-size:12px;text-transform:uppercase;">📎 Documents soumis</h4>
        <ul style="margin:0 0 0;padding-left:20px;font-size:13px;color:#334155;">${docsHtml}</ul>
        ` : ''}
      </td></tr>
    </table>

    <p style="margin:0;color:#475569;font-size:13px;line-height:1.6;">Notre équipe RH reviendra vers vous prochainement pour la suite du processus. Merci de votre intérêt pour <strong>${escHtml(data.branding.schoolName)}</strong>.</p>
  `;

  return { subject, html: renderEmail(data.branding, body) };
}

// ============================================================================
// 2. ENTRETIEN PROGRAMMÉ
// ============================================================================
export function renderInterviewScheduled(
  data: RecruitmentEmailData & {
    interviewDate: Date | string;
    interviewTime?: string;
    format: string;
    evaluator?: string;
    type?: string;
  },
): { subject: string; html: string } {
  const subject = `📅 Entretien programmé — ${data.jobTitle} chez ${data.branding.schoolName}`;
  const body = `
    ${renderBadge('blue', '📅 Entretien programmé')}
    <h2 style="margin:0 0 8px;color:#0f172a;font-size:20px;">Bonjour ${escHtml(data.candidateFirstName)},</h2>
    <p style="margin:0 0 20px;color:#475569;line-height:1.6;">Votre candidature pour le poste de <strong style="color:#0D1F6E;">${escHtml(data.jobTitle)}</strong> a retenu notre attention. Nous vous convoquons à un entretien.</p>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:20px;">
      <tr><td style="padding:16px 20px;">
        <h3 style="margin:0 0 12px;color:#0D1F6E;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">📋 Détails de l'entretien</h3>
        <p style="margin:0 0 8px;font-size:13px;color:#334155;"><strong>📅 Date :</strong> ${formatDateFR(data.interviewDate)}</p>
        ${data.interviewTime ? `<p style="margin:0 0 8px;font-size:13px;color:#334155;"><strong>⏰ Heure :</strong> ${escHtml(formatTimeFR(data.interviewTime))}</p>` : ''}
        <p style="margin:0 0 8px;font-size:13px;color:#334155;"><strong>🎯 Format :</strong> ${escHtml(data.format)}</p>
        ${data.type ? `<p style="margin:0 0 8px;font-size:13px;color:#334155;"><strong>📝 Type :</strong> ${escHtml(data.type)}</p>` : ''}
        ${data.evaluator ? `<p style="margin:0;font-size:13px;color:#334155;"><strong>👤 Évaluateur :</strong> ${escHtml(data.evaluator)}</p>` : ''}
      </td></tr>
    </table>

    <p style="margin:0;color:#475569;font-size:13px;line-height:1.6;">Merci de vous présenter à l'heure prévue. En cas d'empêchement, contactez l'établissement dès que possible pour reprogrammer.</p>
  `;
  return { subject, html: renderEmail(data.branding, body) };
}

// ============================================================================
// 3. TEST PROGRAMMÉ
// ============================================================================
export function renderTestScheduled(
  data: RecruitmentEmailData & {
    testName: string;
    testType?: string;
    description?: string;
    duration?: number;
    instructions?: string;
    maxScore?: number;
    passingScore?: number;
  },
): { subject: string; html: string } {
  const subject = `📝 Test programmé — ${data.jobTitle} chez ${data.branding.schoolName}`;
  const body = `
    ${renderBadge('orange', '📝 Test à passer')}
    <h2 style="margin:0 0 8px;color:#0f172a;font-size:20px;">Bonjour ${escHtml(data.candidateFirstName)},</h2>
    <p style="margin:0 0 20px;color:#475569;line-height:1.6;">Dans le cadre de votre candidature pour le poste de <strong style="color:#0D1F6E;">${escHtml(data.jobTitle)}</strong>, vous êtes convié(e) à passer un test d'évaluation.</p>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:20px;">
      <tr><td style="padding:16px 20px;">
        <h3 style="margin:0 0 12px;color:#0D1F6E;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">📋 Détails du test</h3>
        <p style="margin:0 0 8px;font-size:13px;color:#334155;"><strong>📝 Nom du test :</strong> ${escHtml(data.testName)}</p>
        ${data.testType ? `<p style="margin:0 0 8px;font-size:13px;color:#334155;"><strong>🎯 Type :</strong> ${escHtml(data.testType)}</p>` : ''}
        ${data.duration ? `<p style="margin:0 0 8px;font-size:13px;color:#334155;"><strong>⏱️ Durée :</strong> ${data.duration} minutes</p>` : ''}
        ${data.maxScore ? `<p style="margin:0 0 8px;font-size:13px;color:#334155;"><strong>📊 Score maximum :</strong> ${data.maxScore}/100</p>` : ''}
        ${data.passingScore ? `<p style="margin:0 0 8px;font-size:13px;color:#334155;"><strong>✅ Score requis :</strong> ${data.passingScore}/100</p>` : ''}
        ${data.description ? `<p style="margin:12px 0 8px;font-size:13px;color:#334155;"><strong>Description :</strong><br />${escHtml(data.description)}</p>` : ''}
        ${data.instructions ? `<p style="margin:12px 0 0;font-size:13px;color:#334155;"><strong>📌 Instructions :</strong><br />${escHtml(data.instructions)}</p>` : ''}
      </td></tr>
    </table>

    <p style="margin:0;color:#475569;font-size:13px;line-height:1.6;">Merci de bien préparer ce test. Les modalités de passation vous seront communiquées par l'établissement.</p>
  `;
  return { subject, html: renderEmail(data.branding, body) };
}

// ============================================================================
// 4. RÉSULTAT ENTRETIEN (validé ou rejeté)
// ============================================================================
export function renderInterviewResult(
  data: RecruitmentEmailData & {
    result: 'RÉUSSI' | 'ÉCHEC' | string;
    score?: number;
    feedback?: string;
    evaluator?: string;
    interviewDate?: Date | string;
  },
): { subject: string; html: string } {
  const isPassed = data.result === 'RÉUSSI';
  const subject = `${isPassed ? '✅ Entretien réussi' : '❌ Entretien non concluant'} — ${data.jobTitle} chez ${data.branding.schoolName}`;
  const body = `
    ${renderBadge(isPassed ? 'green' : 'red', isPassed ? '✅ Entretien réussi' : '❌ Entretien non concluant')}
    <h2 style="margin:0 0 8px;color:#0f172a;font-size:20px;">Bonjour ${escHtml(data.candidateFirstName)},</h2>
    <p style="margin:0 0 20px;color:#475569;line-height:1.6;">Nous revenons vers vous suite à votre entretien pour le poste de <strong style="color:#0D1F6E;">${escHtml(data.jobTitle)}</strong>.</p>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:20px;">
      <tr><td style="padding:16px 20px;">
        <h3 style="margin:0 0 12px;color:#0D1F6E;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">📋 Résultat de l'entretien</h3>
        <p style="margin:0 0 8px;font-size:13px;color:#334155;"><strong>Résultat :</strong> <span style="color:${isPassed ? '#047857' : '#b91c1c'};font-weight:bold;">${escHtml(data.result)}</span></p>
        ${data.score != null ? `<p style="margin:0 0 8px;font-size:13px;color:#334155;"><strong>Score obtenu :</strong> ${data.score}/100</p>` : ''}
        ${data.evaluator ? `<p style="margin:0 0 8px;font-size:13px;color:#334155;"><strong>Évaluateur :</strong> ${escHtml(data.evaluator)}</p>` : ''}
        ${data.interviewDate ? `<p style="margin:0 0 8px;font-size:13px;color:#334155;"><strong>Date de l'entretien :</strong> ${formatDateFR(data.interviewDate)}</p>` : ''}
        ${data.feedback ? `<p style="margin:12px 0 0;font-size:13px;color:#334155;"><strong>Feedback :</strong><br />${escHtml(data.feedback)}</p>` : ''}
      </td></tr>
    </table>

    <p style="margin:0;color:#475569;font-size:13px;line-height:1.6;">${isPassed ? `Félicitations ! Votre candidature poursuit son processus. Nous reviendrons vers vous pour la suite des étapes.` : `Nous vous remercions de l'intérêt que vous avez porté à <strong>${escHtml(data.branding.schoolName)}</strong> et vous souhaitons plein de succès dans vos futures démarches.`}</p>
  `;
  return { subject, html: renderEmail(data.branding, body) };
}

// ============================================================================
// 5. RÉSULTAT TEST (validé ou rejeté)
// ============================================================================
export function renderTestResult(
  data: RecruitmentEmailData & {
    result: string;
    score?: number;
    maxScore?: number;
    passingScore?: number;
    testName?: string;
    feedback?: string;
  },
): { subject: string; html: string } {
  const isPassed = ['RÉUSSI', 'VALIDÉ', 'PASS'].includes((data.result || '').toUpperCase());
  const subject = `${isPassed ? '✅ Test réussi' : '❌ Test non réussi'} — ${data.jobTitle} chez ${data.branding.schoolName}`;
  const body = `
    ${renderBadge(isPassed ? 'green' : 'red', isPassed ? '✅ Test réussi' : '❌ Test non réussi')}
    <h2 style="margin:0 0 8px;color:#0f172a;font-size:20px;">Bonjour ${escHtml(data.candidateFirstName)},</h2>
    <p style="margin:0 0 20px;color:#475569;line-height:1.6;">Nous vous informons des résultats de votre test pour le poste de <strong style="color:#0D1F6E;">${escHtml(data.jobTitle)}</strong>.</p>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:20px;">
      <tr><td style="padding:16px 20px;">
        <h3 style="margin:0 0 12px;color:#0D1F6E;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">📋 Résultat du test</h3>
        ${data.testName ? `<p style="margin:0 0 8px;font-size:13px;color:#334155;"><strong>Test :</strong> ${escHtml(data.testName)}</p>` : ''}
        <p style="margin:0 0 8px;font-size:13px;color:#334155;"><strong>Résultat :</strong> <span style="color:${isPassed ? '#047857' : '#b91c1c'};font-weight:bold;">${escHtml(data.result)}</span></p>
        ${data.score != null ? `<p style="margin:0 0 8px;font-size:13px;color:#334155;"><strong>Score obtenu :</strong> ${data.score}${data.maxScore ? `/${data.maxScore}` : '/100'}</p>` : ''}
        ${data.passingScore != null ? `<p style="margin:0 0 8px;font-size:13px;color:#334155;"><strong>Score requis :</strong> ${data.passingScore}/100</p>` : ''}
        ${data.feedback ? `<p style="margin:12px 0 0;font-size:13px;color:#334155;"><strong>Feedback :</strong><br />${escHtml(data.feedback)}</p>` : ''}
      </td></tr>
    </table>

    <p style="margin:0;color:#475569;font-size:13px;line-height:1.6;">${isPassed ? `Félicitations ! Votre candidature poursuit son processus.` : `Nous vous remercions de votre intérêt pour <strong>${escHtml(data.branding.schoolName)}</strong>.`}</p>
  `;
  return { subject, html: renderEmail(data.branding, body) };
}

// ============================================================================
// 6. EMBAUCHÉ — contrat prêt pour signature
// ============================================================================
export function renderHired(
  data: RecruitmentEmailData & {
    contractType?: string;
    startDate?: Date | string;
    salary?: string;
    contractUrl?: string;
  },
): { subject: string; html: string } {
  const subject = `🎉 Félicitations — Vous êtes embauché(e) chez ${data.branding.schoolName} !`;
  const body = `
    ${renderBadge('green', '🎉 Embauche confirmée')}
    <h2 style="margin:0 0 8px;color:#0f172a;font-size:20px;">Félicitations ${escHtml(data.candidateFirstName)} !</h2>
    <p style="margin:0 0 20px;color:#475569;line-height:1.6;">Nous avons le plaisir de vous informer que votre candidature pour le poste de <strong style="color:#0D1F6E;">${escHtml(data.jobTitle)}</strong> a été retenue. Bienvenue dans l'équipe de <strong>${escHtml(data.branding.schoolName)}</strong> !</p>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:20px;">
      <tr><td style="padding:16px 20px;">
        <h3 style="margin:0 0 12px;color:#0D1F6E;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">📋 Détails de l'embauche</h3>
        <p style="margin:0 0 8px;font-size:13px;color:#334155;"><strong>Poste :</strong> ${escHtml(data.jobTitle)}</p>
        ${data.contractType ? `<p style="margin:0 0 8px;font-size:13px;color:#334155;"><strong>Type de contrat :</strong> ${escHtml(data.contractType)}</p>` : ''}
        ${data.startDate ? `<p style="margin:0 0 8px;font-size:13px;color:#334155;"><strong>Date de début :</strong> ${formatDateFR(data.startDate)}</p>` : ''}
        ${data.salary ? `<p style="margin:0;font-size:13px;color:#334155;"><strong>Salaire :</strong> ${escHtml(data.salary)}</p>` : ''}
      </td></tr>
    </table>

    <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:14px 18px;margin-bottom:20px;">
      <p style="margin:0;font-size:13px;color:#92400e;line-height:1.6;">
        <strong>✍️ Action requise :</strong> Votre contrat de travail est prêt pour signature.
        ${data.contractUrl ? `Cliquez sur le bouton ci-dessous pour le consulter et le signer électroniquement.` : `Veuillez contacter l'établissement pour les modalités de signature.`}
      </p>
    </div>

    ${data.contractUrl ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 20px;"><tr><td style="background:#0D1F6E;border-radius:8px;"><a href="${escHtml(data.contractUrl)}" style="display:inline-block;padding:12px 28px;color:#ffffff;text-decoration:none;font-weight:bold;font-size:14px;">✍️ Signer mon contrat</a></td></tr></table>` : ''}

    <p style="margin:0;color:#475569;font-size:13px;line-height:1.6;">Nous sommes ravis de vous compter parmi nous et restons à votre disposition pour toute question.</p>
  `;
  return { subject, html: renderEmail(data.branding, body) };
}

// ============================================================================
// 7. CONTRAT SIGNÉ — confirmation
// ============================================================================
export function renderContractSigned(
  data: RecruitmentEmailData & {
    contractType?: string;
    signedAt?: Date | string;
    contractUrl?: string;
  },
): { subject: string; html: string } {
  const subject = `✅ Contrat signé — Bienvenue définitive chez ${data.branding.schoolName}`;
  const body = `
    ${renderBadge('green', '✅ Contrat signé')}
    <h2 style="margin:0 0 8px;color:#0f172a;font-size:20px;">Bienvenue dans l'équipe, ${escHtml(data.candidateFirstName)} !</h2>
    <p style="margin:0 0 20px;color:#475569;line-height:1.6;">Votre contrat de travail pour le poste de <strong style="color:#0D1F6E;">${escHtml(data.jobTitle)}</strong> a été signé avec succès. Vous faites désormais officiellement partie de l'équipe de <strong>${escHtml(data.branding.schoolName)}</strong>.</p>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:20px;">
      <tr><td style="padding:16px 20px;">
        <h3 style="margin:0 0 12px;color:#0D1F6E;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">📋 Récapitulatif</h3>
        <p style="margin:0 0 8px;font-size:13px;color:#334155;"><strong>Poste :</strong> ${escHtml(data.jobTitle)}</p>
        ${data.contractType ? `<p style="margin:0 0 8px;font-size:13px;color:#334155;"><strong>Type de contrat :</strong> ${escHtml(data.contractType)}</p>` : ''}
        ${data.signedAt ? `<p style="margin:0;font-size:13px;color:#334155;"><strong>Date de signature :</strong> ${formatDateFR(data.signedAt)}</p>` : ''}
      </td></tr>
    </table>

    ${data.contractUrl ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 20px;"><tr><td style="background:#0D1F6E;border-radius:8px;"><a href="${escHtml(data.contractUrl)}" style="display:inline-block;padding:12px 28px;color:#ffffff;text-decoration:none;font-weight:bold;font-size:14px;">📄 Télécharger mon contrat</a></td></tr></table>` : ''}

    <p style="margin:0;color:#475569;font-size:13px;line-height:1.6;">L'équipe RH vous contactera prochainement pour les formalités d'accueil. Encore bienvenue et à très bientôt !</p>
  `;
  return { subject, html: renderEmail(data.branding, body) };
}

// ============================================================================
// 8. CANDIDATURE REJETÉE
// ============================================================================
export function renderRejected(
  data: RecruitmentEmailData & {
    reason?: string;
  },
): { subject: string; html: string } {
  const subject = `Candidature — Suite donnée à votre demande chez ${data.branding.schoolName}`;
  const body = `
    ${renderBadge('orange', 'Candidature non retenue')}
    <h2 style="margin:0 0 8px;color:#0f172a;font-size:20px;">Bonjour ${escHtml(data.candidateFirstName)},</h2>
    <p style="margin:0 0 20px;color:#475569;line-height:1.6;">Nous vous remercions de l'intérêt que vous avez porté à <strong>${escHtml(data.branding.schoolName)}</strong> et du temps que vous avez consacré à votre candidature pour le poste de <strong style="color:#0D1F6E;">${escHtml(data.jobTitle)}</strong>.</p>

    <p style="margin:0 0 20px;color:#475569;font-size:13px;line-height:1.6;">Après examen de votre dossier, nous regrettons de vous informer que nous ne pourrons pas donner une suite favorable à votre candidature à ce stade.</p>

    ${data.reason ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:20px;"><tr><td style="padding:16px 20px;"><h3 style="margin:0 0 8px;color:#0D1F6E;font-size:12px;text-transform:uppercase;">Motif</h3><p style="margin:0;font-size:13px;color:#334155;">${escHtml(data.reason)}</p></td></tr></table>` : ''}

    <p style="margin:0;color:#475569;font-size:13px;line-height:1.6;">Nous vous souhaitons plein de succès dans vos prochaines démarches et espérons avoir l'opportunité de collaborer à l'avenir.</p>
  `;
  return { subject, html: renderEmail(data.branding, body) };
}
