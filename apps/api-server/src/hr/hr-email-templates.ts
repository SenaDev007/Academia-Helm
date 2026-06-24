/**
 * ============================================================================
 * HR EMAIL TEMPLATES — Notifications Congés & Heures Supplémentaires
 * ============================================================================
 *
 * Templates d'emails pour les notifications RH :
 * - Approbation / Rejet de demande de congé
 * - Validation / Rejet d'heures supplémentaires
 *
 * Utilise le même pattern Helm que les emails de recrutement :
 *   renderHeader(branding) + corps + renderFooter(branding)
 *
 * Palette : Navy #0D1F6E, Blue #1d4fa5, Gold #F5A623
 * ============================================================================
 */

import {
  renderEmail,
  renderBadge,
  escHtml,
  TenantBranding,
} from './recruitment-email-templates';

export interface LeaveDecisionEmailData {
  branding: TenantBranding;
  staffName: string;
  leaveType: string;
  leaveTypeLabel: string;
  startDate: Date | string;
  endDate: Date | string;
  daysCount: number;
  reason?: string;
  decision: 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
  approverName?: string;
}

export interface OvertimeDecisionEmailData {
  branding: TenantBranding;
  staffName: string;
  date: Date | string;
  hours: number;
  reason?: string;
  decision: 'VALIDATED' | 'REJECTED';
  rejectionReason?: string;
  validatorName?: string;
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
    return 'Date à confirmer';
  }
}

/**
 * Email de notification pour l'approbation ou le rejet d'une demande de congé.
 */
export function renderLeaveDecisionEmail(
  data: LeaveDecisionEmailData,
): { subject: string; html: string } {
  const isApproved = data.decision === 'APPROVED';
  const subject = isApproved
    ? `Demande de congé approuvée — ${data.leaveTypeLabel}`
    : `Demande de congé refusée — ${data.leaveTypeLabel}`;

  const badgeColor = isApproved ? 'green' : 'red';
  const badgeText = isApproved ? 'APPROUVÉE' : 'REFUSÉE';
  const titleColor = isApproved ? '#047857' : '#b91c1c';

  const bodyContent = `
    <div style="text-align:center;margin-bottom:24px;">
      <h1 style="font-size:22px;font-weight:bold;color:${titleColor};margin:0 0 8px;">
        ${isApproved ? 'Votre demande de congé a été approuvée' : 'Votre demande de congé a été refusée'}
      </h1>
      ${renderBadge(badgeColor, badgeText)}
    </div>

    <p style="font-size:14px;color:#0f172a;line-height:1.7;margin:0 0 20px;">
      Bonjour <strong>${escHtml(data.staffName)}</strong>,<br /><br />
      ${
        isApproved
          ? `Nous vous informons que votre demande de <strong>${escHtml(data.leaveTypeLabel)}</strong> a été <strong style="color:#047857;">approuvée</strong> par ${
              data.approverName ? `<strong>${escHtml(data.approverName)}</strong>` : 'la direction'
            }. Vous pouvez donc bénéficier de votre congé selon la période demandée.`
          : `Nous regrettons de vous informer que votre demande de <strong>${escHtml(data.leaveTypeLabel)}</strong> a été <strong style="color:#b91c1c;">refusée</strong>${
              data.approverName ? ` par <strong>${escHtml(data.approverName)}</strong>` : ''
            }.`
      }
    </p>

    <!-- Détails de la demande -->
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;margin:20px 0;">
      <tr>
        <td style="padding:16px 20px;border-bottom:1px solid #f1f5f9;">
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Type de congé</div>
          <div style="font-size:14px;font-weight:bold;color:#0f172a;">${escHtml(data.leaveTypeLabel)}</div>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 20px;border-bottom:1px solid #f1f5f9;">
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Période</div>
          <div style="font-size:14px;color:#0f172a;">
            Du <strong>${formatDateFR(data.startDate)}</strong><br />
            Au <strong>${formatDateFR(data.endDate)}</strong>
          </div>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 20px;border-bottom:1px solid #f1f5f9;">
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Durée</div>
          <div style="font-size:14px;color:#0f172a;"><strong>${data.daysCount} jour${data.daysCount > 1 ? 's' : ''}</strong></div>
        </td>
      </tr>
      ${data.reason ? `
      <tr>
        <td style="padding:16px 20px;border-bottom:1px solid #f1f5f9;">
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Motif de la demande</div>
          <div style="font-size:13px;color:#475569;font-style:italic;">${escHtml(data.reason)}</div>
        </td>
      </tr>` : ''}
      ${!isApproved && data.rejectionReason ? `
      <tr>
        <td style="padding:16px 20px;background:#fef2f2;">
          <div style="font-size:11px;color:#b91c1c;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Motif du refus</div>
          <div style="font-size:13px;color:#b91c1c;font-weight:500;">${escHtml(data.rejectionReason)}</div>
        </td>
      </tr>` : ''}
    </table>

    ${
      isApproved
        ? `<p style="font-size:13px;color:#475569;line-height:1.6;margin:16px 0 0;">
             Nous vous souhaitons un excellent congé. Pensez à organiser la transmission de vos responsabilités durant votre absence.
           </p>`
        : `<p style="font-size:13px;color:#475569;line-height:1.6;margin:16px 0 0;">
             Pour toute information complémentaire ou pour discuter de cette décision, n'hésitez pas à contacter la direction ou le service RH.
           </p>`
    }
  `;

  return {
    subject,
    html: renderEmail(data.branding, bodyContent),
  };
}

/**
 * Email de notification pour la validation ou le rejet d'heures supplémentaires.
 */
export function renderOvertimeDecisionEmail(
  data: OvertimeDecisionEmailData,
): { subject: string; html: string } {
  const isValidated = data.decision === 'VALIDATED';
  const subject = isValidated
    ? `Heures supplémentaires validées — ${data.hours}h`
    : `Heures supplémentaires rejetées — ${data.hours}h`;

  const badgeColor = isValidated ? 'green' : 'red';
  const badgeText = isValidated ? 'VALIDÉES' : 'REJETÉES';
  const titleColor = isValidated ? '#047857' : '#b91c1c';

  const bodyContent = `
    <div style="text-align:center;margin-bottom:24px;">
      <h1 style="font-size:22px;font-weight:bold;color:${titleColor};margin:0 0 8px;">
        ${isValidated ? 'Vos heures supplémentaires ont été validées' : 'Vos heures supplémentaires ont été rejetées'}
      </h1>
      ${renderBadge(badgeColor, badgeText)}
    </div>

    <p style="font-size:14px;color:#0f172a;line-height:1.7;margin:0 0 20px;">
      Bonjour <strong>${escHtml(data.staffName)}</strong>,<br /><br />
      ${
        isValidated
          ? `Nous vous informons que votre déclaration d'<strong>heures supplémentaires</strong> a été <strong style="color:#047857;">validée</strong> par ${
              data.validatorName ? `<strong>${escHtml(data.validatorName)}</strong>` : 'la direction'
            }. Ces heures seront prises en compte dans le calcul de votre rémunération.`
          : `Nous regrettons de vous informer que votre déclaration d'<strong>heures supplémentaires</strong> a été <strong style="color:#b91c1c;">rejetée</strong>${
              data.validatorName ? ` par <strong>${escHtml(data.validatorName)}</strong>` : ''
            }.`
      }
    </p>

    <!-- Détails de la déclaration -->
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;margin:20px 0;">
      <tr>
        <td style="padding:16px 20px;border-bottom:1px solid #f1f5f9;">
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Date</div>
          <div style="font-size:14px;font-weight:bold;color:#0f172a;">${formatDateFR(data.date)}</div>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 20px;border-bottom:1px solid #f1f5f9;">
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Nombre d'heures</div>
          <div style="font-size:14px;color:#0f172a;"><strong>${data.hours} heure${data.hours > 1 ? 's' : ''}</strong></div>
        </td>
      </tr>
      ${data.reason ? `
      <tr>
        <td style="padding:16px 20px;border-bottom:1px solid #f1f5f9;">
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Raison déclarée</div>
          <div style="font-size:13px;color:#475569;font-style:italic;">${escHtml(data.reason)}</div>
        </td>
      </tr>` : ''}
      ${!isValidated && data.rejectionReason ? `
      <tr>
        <td style="padding:16px 20px;background:#fef2f2;">
          <div style="font-size:11px;color:#b91c1c;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Motif du rejet</div>
          <div style="font-size:13px;color:#b91c1c;font-weight:500;">${escHtml(data.rejectionReason)}</div>
        </td>
      </tr>` : ''}
    </table>

    ${
      isValidated
        ? `<p style="font-size:13px;color:#475569;line-height:1.6;margin:16px 0 0;">
             Ces heures seront intégrées dans votre prochain bulletin de paie selon le taux horaire applicable.
           </p>`
        : `<p style="font-size:13px;color:#475569;line-height:1.6;margin:16px 0 0;">
             Pour toute information complémentaire ou pour corriger votre déclaration, n'hésitez pas à contacter la direction ou le service RH.
           </p>`
    }
  `;

  return {
    subject,
    html: renderEmail(data.branding, bodyContent),
  };
}
