/**
 * ============================================================================
 * ADMISSION EMAIL TEMPLATES — Branded for tenant school + Academia Helm footer
 * ============================================================================
 *
 * Templates HTML pour les notifications du cycle d'admission.
 * Pattern aligné sur recruitment-email-templates.ts (mêmes primitives visuelles).
 *
 * Templates:
 *   1. renderAdmissionReceived       → confirmation au parent après soumission
 *
 * Tous les templates retournent `{ subject, html }`.
 * ============================================================================
 */

// Réutilise les primitives visuelles du module RH (DRY)
export {
  escHtml,
  renderHeader,
  renderFooter,
  renderEmail,
  renderBadge,
  TenantBranding,
} from '../hr/recruitment-email-templates';

export interface AdmissionEmailData {
  /** Branding du tenant (école) */
  branding: import('../hr/recruitment-email-templates').TenantBranding;
  /** Nom complet de l'élève */
  childName: string;
  /** Prénom de l'élève (pour la carte récap) */
  childFirstName: string;
  /** Nom du responsable légal */
  guardianName: string;
  /** Email du responsable légal */
  guardianEmail: string;
  /** Année académique visée (ex: "2025-2026") */
  academicYearLabel: string;
  /** Classe / niveau souhaité (libellé humain, ex: "CM2") */
  requestedClassLabel: string;
  /** Numéro de dossier d'admission (ex: "CSPEB-A-25-0001") */
  admissionNumber?: string | null;
}

// ============================================================================
// 1. DEMANDE D'ADMISSION REÇUE — confirmation au parent
// ============================================================================
export function renderAdmissionReceived(
  data: AdmissionEmailData & {
    documentsSubmitted: Array<{ type: string; fileName: string }>;
  },
): { subject: string; html: string } {
  // Import inline pour éviter boucle circulaire
  const {
    renderEmail,
    renderBadge,
    escHtml,
  } = require('../hr/recruitment-email-templates');

  const subject = `✅ Demande d'admission reçue — ${data.childName} chez ${data.branding.schoolName}`;

  const documentsHtml = data.documentsSubmitted.length
    ? data.documentsSubmitted
        .map(
          (d) =>
            `<li style="margin-bottom:6px;"><strong>${escHtml(d.type)}</strong> — <span style="color:#475569;font-size:12px;">${escHtml(d.fileName)}</span></li>`,
        )
        .join('')
    : '<li style="color:#94a3b8;">Aucun document joint (le dossier sera complété ultérieurement)</li>';

  const bodyContent = `
    ${renderBadge('green', '✅ Demande d\'admission reçue')}

    <p style="margin:0 0 16px;font-size:15px;color:#0f172a;line-height:1.6;">
      Bonjour <strong>${escHtml(data.guardianName)}</strong>,
    </p>

    <p style="margin:0 0 16px;font-size:14px;color:#334155;line-height:1.6;">
      Nous accusons réception de votre demande d'admission pour
      <strong>${escHtml(data.childName)}</strong> en <strong>${escHtml(data.requestedClassLabel)}</strong>
      pour l'année scolaire <strong>${escHtml(data.academicYearLabel)}</strong>.
      Notre équipe pédagogique va examiner le dossier dans les plus brefs délais et reviendra
      vers vous pour les prochaines étapes (entretien, test d'évaluation, ou confirmation d'admission).
    </p>

    <!-- Carte récapitulative -->
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;margin:20px 0;">
      <tr>
        <td style="padding:16px 20px;">
          <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Récapitulatif du dossier</div>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="padding:4px 0;font-size:13px;color:#64748b;width:40%;">Élève :</td>
              <td style="padding:4px 0;font-size:13px;color:#0f172a;font-weight:600;">${escHtml(data.childName)}</td>
            </tr>
            <tr>
              <td style="padding:4px 0;font-size:13px;color:#64748b;">Classe souhaitée :</td>
              <td style="padding:4px 0;font-size:13px;color:#0f172a;font-weight:600;">${escHtml(data.requestedClassLabel)}</td>
            </tr>
            <tr>
              <td style="padding:4px 0;font-size:13px;color:#64748b;">Année scolaire :</td>
              <td style="padding:4px 0;font-size:13px;color:#0f172a;font-weight:600;">${escHtml(data.academicYearLabel)}</td>
            </tr>
            <tr>
              <td style="padding:4px 0;font-size:13px;color:#64748b;">Établissement :</td>
              <td style="padding:4px 0;font-size:13px;color:#0f172a;font-weight:600;">${escHtml(data.branding.schoolName)}</td>
            </tr>
            ${data.admissionNumber ? `
            <tr>
              <td style="padding:4px 0;font-size:13px;color:#64748b;">N° de dossier :</td>
              <td style="padding:4px 0;font-size:13px;color:#1e40af;font-weight:bold;font-family:monospace;">${escHtml(data.admissionNumber)}</td>
            </tr>` : ''}
            <tr>
              <td style="padding:4px 0;font-size:13px;color:#64748b;">Responsable légal :</td>
              <td style="padding:4px 0;font-size:13px;color:#0f172a;font-weight:600;">${escHtml(data.guardianName)}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Documents soumis -->
    <div style="margin:20px 0;">
      <div style="font-size:13px;font-weight:bold;color:#0f172a;margin-bottom:8px;">📎 Documents soumis :</div>
      <ul style="margin:0;padding-left:20px;list-style-type:disc;">
        ${documentsHtml}
      </ul>
    </div>

    <p style="margin:20px 0 0;font-size:13px;color:#475569;line-height:1.6;">
      Conservez précieusement le numéro de dossier ci-dessus pour toute communication
      avec notre service des admissions. Pour toute question, vous pouvez nous contacter
      ${data.branding.schoolEmail ? `à <a href="mailto:${escHtml(data.branding.schoolEmail)}" style="color:#1e40af;text-decoration:none;">${escHtml(data.branding.schoolEmail)}</a>` : 'directement à l\'école'}.
    </p>

    <p style="margin:16px 0 0;font-size:13px;color:#475569;line-height:1.6;">
      Cordialement,<br />
      <strong>Service des Admissions</strong><br />
      <em>${escHtml(data.branding.schoolName)}</em>
    </p>
  `;

  const html = renderEmail(data.branding, bodyContent, 'Admission');
  return { subject, html };
}
