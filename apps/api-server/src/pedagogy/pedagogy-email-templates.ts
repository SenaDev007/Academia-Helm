/**
 * ============================================================================
 * PEDAGOGY EMAIL TEMPLATES — Récapitulatif profil enseignant
 * ============================================================================
 *
 * Template HTML envoyé automatiquement à un enseignant pour lui communiquer
 * l'intégralité de ses informations pédagogiques pour l'année en cours :
 *   1. Profil (nom, matricule, niveau, langue, statut)
 *   2. Paramètres académiques (maxWeeklyHours, isSemainier)
 *   3. Habilitations par matière
 *   4. Autorisations par niveau
 *   5. Disponibilités hebdomadaires (matrice jour × créneau)
 *   6. Multigrade (si applicable)
 *   7. Affectations par classe (avec matière + heures)
 *   8. Charge horaire globale (récapitulatif + statut optimal/sur/sous-chargé)
 *
 * IMPORTANT : Aucune saisie utilisateur. Le système rassemble toutes les
 * données puis envoie l'email automatiquement au nom de l'école, avec le
 * design Academia Helm (palette navy + or, header avec logo école).
 *
 * Réutilise renderHeader / renderFooter / renderBadge / escHtml du module RH
 * pour rester visuellement cohérent avec les autres emails de la plateforme.
 * ============================================================================
 */

import {
  renderEmail,
  renderBadge,
  escHtml,
  TenantBranding,
} from '../hr/recruitment-email-templates';

const DAY_LABELS: Record<number, string> = {
  1: 'Lundi',
  2: 'Mardi',
  3: 'Mercredi',
  4: 'Jeudi',
  5: 'Vendredi',
  6: 'Samedi',
  0: 'Dimanche',
};

/** Convertit "HH:mm" en format 12h lisible (ex: "14:00" → "14h00", "09:30" → "9h30"). */
function formatHour(time: string): string {
  if (!time) return '—';
  const m = /^(\d{1,2}):(\d{2})/.exec(time);
  if (!m) return time;
  return `${parseInt(m[1], 10)}h${m[2]}`;
}

export interface AvailabilitySlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface SubjectQualificationInfo {
  subjectCode?: string;
  subjectName: string;
  certified: boolean;
}

export interface LevelAuthorizationInfo {
  levelName: string;
}

export interface MultigradeInfo {
  classNames: string[]; // ex: ["CE1 A", "CE2 B"]
  language?: string | null;
  notes?: string | null;
  isActive: boolean;
}

export interface ClassAssignmentInfo {
  className: string;       // ex: "6ème A"
  subjectCode: string;     // ex: "MATH-101"
  subjectName: string;     // ex: "Mathématiques"
  weeklyHours: number;
}

export interface TeacherProfileSummaryData {
  /** Branding du tenant (école) — injecté dans header + footer */
  branding: TenantBranding;
  /** Année scolaire (ex: "2025-2026") */
  academicYearLabel: string;
  /** Prénom + nom complet de l'enseignant */
  teacherName: string;
  teacherFirstName: string;
  /** Matricule */
  matricule?: string;
  /** Email de l'enseignant (pour info dans le bloc récap) */
  email?: string;
  /** Niveau scolaire affecté (ex: "Maternelle", "Secondaire") */
  schoolLevelName?: string;
  /** Langue(s) enseignée(s) : ["FR"], ["EN"], ["FR","EN"] */
  assignedLanguages?: string[];
  /** Statut actif/inactif */
  isActive: boolean;

  // Paramètres académiques
  maxWeeklyHours: number;
  isSemainier: boolean;

  // Habilitations & autorisations
  subjectQualifications: SubjectQualificationInfo[];
  levelAuthorizations: LevelAuthorizationInfo[];

  // Disponibilités
  availabilities: AvailabilitySlot[];

  // Multigrade
  multigradeAssignments: MultigradeInfo[];

  // Affectations par classe
  classAssignments: ClassAssignmentInfo[];

  // Charge horaire
  totalAssignedHours: number;
}

/**
 * Calcule le statut de charge : Optimal / Surchargé / Sous-chargé.
 */
function computeWorkloadStatus(
  assigned: number,
  capacity: number,
): { label: string; color: 'green' | 'red' | 'orange'; percent: number } {
  if (capacity <= 0) {
    return { label: 'Non défini', color: 'orange', percent: 0 };
  }
  const percent = Math.min(Math.round((assigned / capacity) * 100), 999);
  if (assigned > capacity) {
    return { label: `Surchargé (${percent}%)`, color: 'red', percent };
  }
  if (assigned < capacity * 0.7) {
    return { label: `Sous-chargé (${percent}%)`, color: 'orange', percent };
  }
  return { label: `Optimal (${percent}%)`, color: 'green', percent };
}

/**
 * Génère le HTML de la matrice de disponibilités.
 * Regroupe les créneaux par jour (Lundi → Samedi), format compact.
 */
function renderAvailabilityTable(slots: AvailabilitySlot[]): string {
  if (!slots || slots.length === 0) {
    return `
      <div style="background:#f8fafc;border:1px dashed #cbd5e1;border-radius:8px;padding:14px;text-align:center;">
        <span style="font-size:12px;color:#64748b;font-style:italic;">Aucune disponibilité déclarée</span>
      </div>`;
  }

  // Grouper par jour
  const byDay = new Map<number, AvailabilitySlot[]>();
  for (const s of slots) {
    if (!byDay.has(s.dayOfWeek)) byDay.set(s.dayOfWeek, []);
    byDay.get(s.dayOfWeek)!.push(s);
  }

  // Trier les créneaux par heure de début (string comparison works for "HH:mm")
  for (const list of byDay.values()) {
    list.sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  // Trier les jours dans l'ordre Lundi → Samedi
  const dayOrder = [1, 2, 3, 4, 5, 6, 0];
  const rows = dayOrder
    .filter((d) => byDay.has(d))
    .map((day) => {
      const daySlots = byDay.get(day)!;
      const dayName = DAY_LABELS[day] || 'Jour';
      const slotsHtml = daySlots
        .map(
          (s) =>
            `<span style="display:inline-block;background:#eff6ff;border:1px solid #93c5fd;color:#1e40af;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:600;margin:2px;">${escHtml(formatHour(s.startTime))} – ${escHtml(formatHour(s.endTime))}</span>`,
        )
        .join(' ');
      return `
        <tr>
          <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:12px;font-weight:bold;color:#0f172a;width:90px;vertical-align:top;">${escHtml(dayName)}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#334155;">${slotsHtml}</td>
        </tr>`;
    })
    .join('');

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
      ${rows}
    </table>`;
}

/**
 * Génère le HTML de la liste des affectations par classe.
 * Chaque ligne = une classe + une matière + heures hebdomadaires.
 */
function renderClassAssignmentsTable(assignments: ClassAssignmentInfo[]): string {
  if (!assignments || assignments.length === 0) {
    return `
      <div style="background:#f8fafc;border:1px dashed #cbd5e1;border-radius:8px;padding:14px;text-align:center;">
        <span style="font-size:12px;color:#64748b;font-style:italic;">Aucune affectation par classe</span>
      </div>`;
  }

  // Trier par nom de classe puis par code matière
  const sorted = [...assignments].sort((a, b) => {
    if (a.className !== b.className) return a.className.localeCompare(b.className);
    return a.subjectCode.localeCompare(b.subjectCode);
  });

  const rows = sorted
    .map(
      (a, idx) => `
        <tr style="${idx % 2 === 1 ? 'background:#f8fafc;' : ''}">
          <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:12px;font-weight:bold;color:#0D1F6E;width:35%;">${escHtml(a.className)}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#334155;">
            <strong>${escHtml(a.subjectCode)}</strong>
            <span style="color:#64748b;"> — ${escHtml(a.subjectName)}</span>
          </td>
          <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:12px;font-weight:bold;color:#1e40af;text-align:right;white-space:nowrap;width:80px;">${a.weeklyHours}h</td>
        </tr>`,
    )
    .join('');

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
      <thead>
        <tr style="background:#0D1F6E;color:#fff;">
          <th style="padding:10px 14px;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;text-align:left;">Classe</th>
          <th style="padding:10px 14px;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;text-align:left;">Matière</th>
          <th style="padding:10px 14px;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;text-align:right;">Heures</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

/**
 * Email complet : récapitulatif pédagogique envoyé à l'enseignant.
 *
 * Le sujet est généré automatiquement — pas de saisie utilisateur.
 * Le contenu est entièrement déterminé par les données DB du teacher.
 */
export function renderTeacherProfileSummaryEmail(
  data: TeacherProfileSummaryData,
): { subject: string; html: string } {
  const subject = `📚 Votre profil pédagogique — ${data.academicYearLabel} — ${data.branding.schoolName}`;

  // ─── Statut de charge ──────────────────────────────────────────────────────
  const workload = computeWorkloadStatus(data.totalAssignedHours, data.maxWeeklyHours);

  // ─── Section helper ─────────────────────────────────────────────────────────
  const sectionTitle = (icon: string, title: string): string =>
    `<h3 style="margin:0 0 10px;color:#0D1F6E;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #F5A623;padding-bottom:6px;display:inline-block;">${icon} ${escHtml(title)}</h3>`;

  // ─── Bloc identité enseignant (header du corps) ─────────────────────────────
  const languagesLabel = (data.assignedLanguages && data.assignedLanguages.length > 0)
    ? data.assignedLanguages.join(' / ')
    : 'Non défini';

  const identityRows: string[] = [];
  identityRows.push(`
    <tr>
      <td style="padding:12px 18px;border-bottom:1px solid #f1f5f9;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;width:35%;">Enseignant</td>
      <td style="padding:12px 18px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#0f172a;font-weight:bold;">${escHtml(data.teacherName)}</td>
    </tr>`);
  if (data.matricule) {
    identityRows.push(`
      <tr>
        <td style="padding:12px 18px;border-bottom:1px solid #f1f5f9;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Matricule</td>
        <td style="padding:12px 18px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#0f172a;font-weight:600;">${escHtml(data.matricule)}</td>
      </tr>`);
  }
  if (data.schoolLevelName) {
    identityRows.push(`
      <tr>
        <td style="padding:12px 18px;border-bottom:1px solid #f1f5f9;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Niveau affecté</td>
        <td style="padding:12px 18px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#0f172a;font-weight:600;">${escHtml(data.schoolLevelName)}</td>
      </tr>`);
  }
  identityRows.push(`
    <tr>
      <td style="padding:12px 18px;border-bottom:1px solid #f1f5f9;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Piste linguistique</td>
      <td style="padding:12px 18px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#0f172a;font-weight:600;">${escHtml(languagesLabel)}</td>
    </tr>`);
  if (data.email) {
    identityRows.push(`
      <tr>
        <td style="padding:12px 18px;border-bottom:1px solid #f1f5f9;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Email</td>
        <td style="padding:12px 18px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#0f172a;font-weight:600;">${escHtml(data.email)}</td>
      </tr>`);
  }
  identityRows.push(`
    <tr>
      <td style="padding:12px 18px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Année scolaire</td>
      <td style="padding:12px 18px;font-size:13px;color:#0f172a;font-weight:600;">${escHtml(data.academicYearLabel)}</td>
    </tr>`);

  // ─── Paramètres académiques ─────────────────────────────────────────────────
  const academicSettingsRows = `
    <tr>
      <td style="padding:12px 18px;border-bottom:1px solid #f1f5f9;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Charge maximale / semaine</td>
      <td style="padding:12px 18px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#0f172a;font-weight:bold;">${data.maxWeeklyHours}h</td>
    </tr>
    <tr>
      <td style="padding:12px 18px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Statut Semainier</td>
      <td style="padding:12px 18px;font-size:13px;font-weight:bold;color:${data.isSemainier ? '#92400e' : '#475569'};">
        ${data.isSemainier ? '★ Oui (Semainier)' : 'Non'}
      </td>
    </tr>`;

  // ─── Habilitations par matière ──────────────────────────────────────────────
  const qualificationsHtml = data.subjectQualifications.length > 0
    ? data.subjectQualifications
        .map(
          (sq) =>
            `<span style="display:inline-block;background:${sq.certified ? '#ecfdf5' : '#f1f5f9'};border:1px solid ${sq.certified ? '#6ee7b7' : '#cbd5e1'};color:${sq.certified ? '#047857' : '#475569'};padding:4px 10px;border-radius:6px;font-size:11px;font-weight:600;margin:2px;">
              ${sq.certified ? '✓ ' : ''}${escHtml(sq.subjectCode || sq.subjectName)}
            </span>`,
        )
        .join('')
    : `<span style="font-size:12px;color:#94a3b8;font-style:italic;">Aucune habilitation déclarée</span>`;

  // ─── Autorisations par niveau ───────────────────────────────────────────────
  const authorizationsHtml = data.levelAuthorizations.length > 0
    ? data.levelAuthorizations
        .map(
          (la) =>
            `<span style="display:inline-block;background:#eff6ff;border:1px solid #93c5fd;color:#1e40af;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:600;margin:2px;">${escHtml(la.levelName)}</span>`,
        )
        .join('')
    : `<span style="font-size:12px;color:#94a3b8;font-style:italic;">Aucune autorisation de niveau</span>`;

  // ─── Multigrade ─────────────────────────────────────────────────────────────
  const multigradeHtml = data.multigradeAssignments.length > 0
    ? data.multigradeAssignments
        .map((mg) => {
          const classList = mg.classNames.join(' + ');
          const langSuffix = mg.language ? ` <span style="color:#64748b;font-weight:400;">(${escHtml(mg.language)})</span>` : '';
          const notes = mg.notes ? `<div style="font-size:11px;color:#64748b;font-style:italic;margin-top:4px;">📝 ${escHtml(mg.notes)}</div>` : '';
          const statusBadge = mg.isActive
            ? '<span style="display:inline-block;background:#ecfdf5;border:1px solid #6ee7b7;color:#047857;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:bold;margin-left:8px;">Actif</span>'
            : '<span style="display:inline-block;background:#fef2f2;border:1px solid #fca5a5;color:#b91c1c;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:bold;margin-left:8px;">Inactif</span>';
          return `
            <div style="background:#fffbeb;border:1px solid #fcd34d;border-left:4px solid #F5A623;border-radius:6px;padding:10px 14px;margin-bottom:8px;">
              <div style="font-size:13px;font-weight:bold;color:#92400e;">
                ⚡ ${escHtml(classList)}${langSuffix}${statusBadge}
              </div>
              ${notes}
            </div>`;
        })
        .join('')
    : `<div style="background:#f8fafc;border:1px dashed #cbd5e1;border-radius:6px;padding:10px 14px;text-align:center;">
        <span style="font-size:12px;color:#64748b;font-style:italic;">Aucune affectation multigrade</span>
      </div>`;

  // ─── Charge horaire (récap) ─────────────────────────────────────────────────
  const workloadColorMap = {
    green: { bg: '#ecfdf5', border: '#6ee7b7', text: '#047857' },
    red: { bg: '#fef2f2', border: '#fca5a5', text: '#b91c1c' },
    orange: { bg: '#fffbeb', border: '#fcd34d', text: '#92400e' },
  };
  const wlColor = workloadColorMap[workload.color];

  // ─── Corps de l'email ───────────────────────────────────────────────────────
  const bodyContent = `
    <div style="text-align:center;margin-bottom:24px;">
      <h1 style="font-size:22px;font-weight:bold;color:#0D1F6E;margin:0 0 8px;">
        Récapitulatif pédagogique
      </h1>
      ${renderBadge(workload.color, `📊 ${workload.label}`)}
    </div>

    <p style="font-size:14px;color:#0f172a;line-height:1.7;margin:0 0 20px;">
      Bonjour <strong>${escHtml(data.teacherFirstName)}</strong>,<br /><br />
      Vous recevez ce récapitulatif automatique de la part de <strong>${escHtml(data.branding.schoolName || 'votre établissement')}</strong>.
      Il compile l'intégralité de vos informations pédagogiques pour l'année <strong>${escHtml(data.academicYearLabel)}</strong> :
      profil, disponibilités, multigrade, affectations par classe et charge horaire globale.
    </p>

    <!-- 1. Identité -->
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:20px;overflow:hidden;">
      ${identityRows.join('')}
    </table>

    <!-- 2. Paramètres académiques -->
    <div style="margin-bottom:24px;">
      ${sectionTitle('⚙️', 'Paramètres académiques')}
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
        ${academicSettingsRows}
      </table>
    </div>

    <!-- 3. Habilitations par matière -->
    <div style="margin-bottom:24px;">
      ${sectionTitle('🎓', 'Habilitations par matière')}
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:14px 18px;">${qualificationsHtml}</div>
    </div>

    <!-- 4. Autorisations par niveau -->
    <div style="margin-bottom:24px;">
      ${sectionTitle('🏫', 'Autorisations par niveau')}
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:14px 18px;">${authorizationsHtml}</div>
    </div>

    <!-- 5. Disponibilités hebdomadaires -->
    <div style="margin-bottom:24px;">
      ${sectionTitle('📅', 'Disponibilités hebdomadaires')}
      ${renderAvailabilityTable(data.availabilities)}
    </div>

    <!-- 6. Multigrade -->
    <div style="margin-bottom:24px;">
      ${sectionTitle('⚡', 'Affectations multigrade')}
      ${multigradeHtml}
    </div>

    <!-- 7. Affectations par classe -->
    <div style="margin-bottom:24px;">
      ${sectionTitle('📋', 'Affectations par classe')}
      ${renderClassAssignmentsTable(data.classAssignments)}
    </div>

    <!-- 8. Charge horaire globale (récapitulatif) -->
    <div style="margin-bottom:24px;">
      ${sectionTitle('📊', 'Charge horaire globale')}
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${wlColor.bg};border:1px solid ${wlColor.border};border-radius:8px;overflow:hidden;">
        <tr>
          <td style="padding:18px 20px;vertical-align:middle;">
            <div style="font-size:11px;color:${wlColor.text};text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;font-weight:bold;">Charge assignée</div>
            <div style="font-size:28px;font-weight:bold;color:${wlColor.text};line-height:1;">
              ${data.totalAssignedHours}h
              <span style="font-size:14px;color:#64748b;font-weight:400;"> / ${data.maxWeeklyHours}h</span>
            </div>
            <div style="font-size:12px;color:${wlColor.text};font-weight:bold;margin-top:8px;">${workload.label}</div>
          </td>
          <td style="padding:18px 20px;vertical-align:middle;text-align:right;width:140px;">
            <!-- Barre de progression -->
            <div style="width:120px;height:8px;background:#ffffff;border-radius:999px;overflow:hidden;border:1px solid ${wlColor.border};">
              <div style="height:100%;width:${Math.min(workload.percent, 100)}%;background:${wlColor.text};border-radius:999px;"></div>
            </div>
            <div style="font-size:10px;color:#64748b;margin-top:6px;">${workload.percent}% de la capacité</div>
          </td>
        </tr>
      </table>
    </div>

    <p style="font-size:13px;color:#475569;line-height:1.6;margin:16px 0 0;border-top:1px solid #e2e8f0;padding-top:16px;">
      Pour toute question ou correction relative à ces informations, merci de vous rapprocher de la direction pédagogique de votre établissement.
    </p>

    <p style="font-size:13px;color:#475569;line-height:1.6;margin:12px 0 0;">
      Cordialement,<br />
      <strong>L'équipe pédagogique — ${escHtml(data.branding.schoolName || 'Academia Helm')}</strong>
    </p>
  `;

  return {
    subject,
    html: renderEmail(data.branding, bodyContent),
  };
}
