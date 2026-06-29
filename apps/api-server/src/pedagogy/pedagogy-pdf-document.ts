/**
 * ============================================================================
 * PEDAGOGY PDF DOCUMENT — Récapitulatif profil enseignant (pièce jointe email)
 * ============================================================================
 *
 * Génère un PDF via Puppeteer (page.pdf()) qui regroupe TOUTES les données
 * pédagogiques d'un enseignant. Ce PDF est joint à l'email de notification.
 *
 * Structure du PDF :
 *   ┌──────────────────────────────────────────────────────────┐
 *   │  EN-TÊTE (répétable sur chaque page)                     │
 *   │  ├─ Logo école + Nom école (gauche)                      │
 *   │  ├─ Coordonnées école (droite)                           │
 *   │  └─ Bande doré + mention « Pédagogie »                   │
 *   ├──────────────────────────────────────────────────────────┤
 *   │  TITRE PRINCIPAL                                         │
 *   │  « Récapitulatif pédagogique — [Nom Enseignant] »        │
 *   │  Année scolaire + statut charge (badge coloré)           │
 *   ├──────────────────────────────────────────────────────────┤
 *   │  1. Identité (tableau)                                   │
 *   │  2. Paramètres académiques                               │
 *   │  3. Habilitations par matière (badges)                   │
 *   │  4. Autorisations par niveau (badges)                    │
 *   │  5. Disponibilités hebdomadaires — GRILLE MATRICIELLE    │
 *   │     (tableau jour × créneaux avec cellules colorées)     │
 *   │  6. Multigrade (blocs)                                   │
 *   │  7. Affectations par classe (tableau)                    │
 *   │  8. Charge horaire globale (récap + barre)               │
 *   ├──────────────────────────────────────────────────────────┤
 *   │  PIED DE PAGE (répétable sur chaque page)                │
 *   │  ├─ Logo Academia Helm + slogan                          │
 *   │  ├─ « Document généré automatiquement le [date] »        │
 *   │  └─ Numéro de page (Page X / Y)                          │
 *   └──────────────────────────────────────────────────────────┘
 *
 * Le PDF utilise les mêmes couleurs que l'email (navy + or) et la même
 * charte graphique que les autres documents Academia Helm.
 *
 * ⚠️ Le HTML est conçu pour l'impression A4 :
 *   - Marges 12mm
 *   - Page breaks gérés via CSS (page-break-inside: avoid sur les sections)
 *   - Polices system (Arial/Helvetica) pour compatibilité maximale
 * ============================================================================
 */

import { PuppeteerPoolService } from '../common/services/puppeteer-pool.service';
import { TeacherProfileSummaryData } from './pedagogy-email-templates';
import { Injectable, Logger } from '@nestjs/common';

const DAY_LABELS: Record<number, string> = {
  1: 'Lundi',
  2: 'Mardi',
  3: 'Mercredi',
  4: 'Jeudi',
  5: 'Vendredi',
  6: 'Samedi',
  0: 'Dimanche',
};

/** Convertit "HH:mm" en "HHhMM" (ex: "14:30" → "14h30"). */
function formatHour(time: string): string {
  if (!time) return '';
  const m = /^(\d{1,2}):(\d{2})/.exec(time);
  if (!m) return time;
  return `${parseInt(m[1], 10)}h${m[2]}`;
}

function escHtml(s: string | number | undefined | null): string {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Génère la grille matricielle des disponibilités (jour × créneaux).
 *
 * ⚠️ IMPORTANT : `data.availabilities` contient les INDISPONIBILITÉS (DB brute).
 * `data.availableSlots` contient les créneaux RÉELLEMENT DISPONIBLES
 * (calculés par complément).
 *
 * Cette fonction affiche la grille COMPLETE 7h-19h × Lun-Sam avec :
 *   - cellules vertes ✓ pour les créneaux disponibles
 *   - cellules rouges ✗ pour les créneaux indisponibles
 *   - cellules grisées — pour les créneaux hors plage (si la matrice n'est
 *     pas complète)
 *
 * C'est la même représentation visuelle que le frontend, pour que l'enseignant
 * retrouve ses marques dans le PDF.
 */
function renderAvailabilityMatrix(data: TeacherProfileSummaryData): string {
  // Construire la grille complète 7h-19h × Lun-Sam
  // Créneaux fixes : 7h-8h, 8h-9h, ..., 18h-19h (12 créneaux)
  const TIME_SLOTS: Array<{ start: string; end: string }> = [];
  for (let h = 7; h < 19; h++) {
    TIME_SLOTS.push({
      start: `${String(h).padStart(2, '0')}:00`,
      end: `${String(h + 1).padStart(2, '0')}:00`,
    });
  }
  const MATRIX_DAYS = [1, 2, 3, 4, 5, 6]; // Lun-Sam

  // Construire un Set des indisponibilités pour lookup rapide
  // Format clé : `${dayOfWeek}-${startTime}-${endTime}`
  const unavailableSet = new Set<string>();
  for (const av of (data.availabilities || [])) {
    unavailableSet.add(`${av.dayOfWeek}-${av.startTime}-${av.endTime}`);
  }

  // Header row avec les créneaux horaires
  const slotHeaders = TIME_SLOTS
    .map((s) =>
      `<th style="background:#0D1F6E;color:#fff;padding:6px 4px;font-size:9px;font-weight:bold;text-align:center;border:1px solid #1e3a8a;white-space:nowrap;">${escHtml(formatHour(s.start))}<br/><span style="font-size:7px;font-weight:400;opacity:0.8;">→${escHtml(formatHour(s.end))}</span></th>`,
    )
    .join('');

  // Lignes par jour
  const dayRows = MATRIX_DAYS
    .map((day) => {
      const dayName = DAY_LABELS[day] || 'Jour';
      const cells = TIME_SLOTS
        .map((s) => {
          const key = `${day}-${s.start}-${s.end}`;
          const isUnavailable = unavailableSet.has(key);
          // Si indisponible → rouge ✗ ; si disponible → vert ✓
          const bg = isUnavailable ? '#fef2f2' : '#ecfdf5';
          const border = isUnavailable ? '#fca5a5' : '#6ee7b7';
          const symbol = isUnavailable ? '✗' : '✓';
          const color = isUnavailable ? '#b91c1c' : '#047857';
          return `<td style="background:${bg};border:1px solid ${border};padding:6px 2px;text-align:center;font-size:12px;font-weight:bold;color:${color};">${symbol}</td>`;
        })
        .join('');
      return `
        <tr>
          <td style="background:#f1f5f9;padding:6px 8px;font-size:10px;font-weight:bold;color:#0D1F6E;border:1px solid #e2e8f0;white-space:nowrap;">${escHtml(dayName)}</td>
          ${cells}
        </tr>`;
    })
    .join('');

  // Légende
  const legend = `
    <div style="display:flex;gap:12px;margin-top:6px;font-size:9px;color:#64748b;">
      <span style="display:inline-flex;align-items:center;gap:4px;">
        <span style="display:inline-block;width:12px;height:12px;background:#ecfdf5;border:1px solid #6ee7b7;border-radius:2px;text-align:center;line-height:10px;color:#047857;font-weight:bold;font-size:8px;">✓</span>
        Disponible
      </span>
      <span style="display:inline-flex;align-items:center;gap:4px;">
        <span style="display:inline-block;width:12px;height:12px;background:#fef2f2;border:1px solid #fca5a5;border-radius:2px;text-align:center;line-height:10px;color:#b91c1c;font-weight:bold;font-size:8px;">✗</span>
        Indisponible
      </span>
    </div>`;

  return `
    <table style="width:100%;border-collapse:collapse;margin:8px 0;">
      <thead>
        <tr>
          <th style="background:#0D1F6E;color:#fff;padding:6px 8px;font-size:10px;font-weight:bold;text-align:left;border:1px solid #1e3a8a;">Jour</th>
          ${slotHeaders}
        </tr>
      </thead>
      <tbody>${dayRows}</tbody>
    </table>
    ${legend}`;
}

/**
 * Titre de section avec barre dorée.
 */
function sectionTitle(icon: string, title: string): string {
  return `<h3 style="margin:18px 0 8px;color:#0D1F6E;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #F5A623;padding-bottom:4px;">${icon} ${escHtml(title)}</h3>`;
}

/**
 * Génère le HTML complet du PDF (sans header/footer Puppeteer — ils seront
 * gérés via les options displayHeaderFooter de page.pdf()).
 */
function buildPdfHtml(data: TeacherProfileSummaryData): string {
  const workloadPercent = data.maxWeeklyHours > 0
    ? Math.min(Math.round((data.totalAssignedHours / data.maxWeeklyHours) * 100), 999)
    : 0;
  const isSurcharged = data.totalAssignedHours > data.maxWeeklyHours;
  const isUnderloaded = data.maxWeeklyHours > 0 && data.totalAssignedHours < data.maxWeeklyHours * 0.7;
  const workloadLabel = data.maxWeeklyHours <= 0
    ? 'Non défini'
    : (isSurcharged ? `Surchargé (${workloadPercent}%)` : (isUnderloaded ? `Sous-chargé (${workloadPercent}%)` : `Optimal (${workloadPercent}%)`));
  const workloadColor = isSurcharged ? '#b91c1c' : (isUnderloaded ? '#92400e' : '#047857');
  const workloadBg = isSurcharged ? '#fef2f2' : (isUnderloaded ? '#fffbeb' : '#ecfdf5');
  const workloadBorder = isSurcharged ? '#fca5a5' : (isUnderloaded ? '#fcd34d' : '#6ee7b7');

  const languagesLabel = (data.assignedLanguages && data.assignedLanguages.length > 0)
    ? data.assignedLanguages.join(' / ')
    : 'Non défini';

  // ─── Identité ────────────────────────────────────────────────────────────────
  const identityRows: string[] = [];
  identityRows.push(`
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;width:35%;background:#f8fafc;">Enseignant</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#0f172a;font-weight:bold;">${escHtml(data.teacherName)}</td>
    </tr>`);
  if (data.matricule) {
    identityRows.push(`
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;background:#f8fafc;">Matricule</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#0f172a;font-weight:600;">${escHtml(data.matricule)}</td>
      </tr>`);
  }
  if (data.schoolLevelName) {
    identityRows.push(`
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;background:#f8fafc;">Niveau affecté</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#0f172a;font-weight:600;">${escHtml(data.schoolLevelName)}</td>
      </tr>`);
  }
  identityRows.push(`
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;background:#f8fafc;">Piste linguistique</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#0f172a;font-weight:600;">${escHtml(languagesLabel)}</td>
    </tr>`);
  if (data.email) {
    identityRows.push(`
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;background:#f8fafc;">Email</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#0f172a;font-weight:600;">${escHtml(data.email)}</td>
      </tr>`);
  }
  identityRows.push(`
    <tr>
      <td style="padding:8px 12px;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;background:#f8fafc;">Année scolaire</td>
      <td style="padding:8px 12px;font-size:12px;color:#0f172a;font-weight:600;">${escHtml(data.academicYearLabel)}</td>
    </tr>`);

  // ─── Paramètres académiques ──────────────────────────────────────────────────
  const academicRows = `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;width:50%;background:#f8fafc;">Charge maximale / semaine</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#0f172a;font-weight:bold;">${data.maxWeeklyHours}h</td>
    </tr>
    <tr>
      <td style="padding:8px 12px;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;background:#f8fafc;">Statut Semainier</td>
      <td style="padding:8px 12px;font-size:12px;font-weight:bold;color:${data.isSemainier ? '#92400e' : '#475569'};">${data.isSemainier ? '★ Oui (Semainier)' : 'Non'}</td>
    </tr>`;

  // ─── Habilitations ───────────────────────────────────────────────────────────
  const qualificationsHtml = data.subjectQualifications.length > 0
    ? data.subjectQualifications
        .map(
          (sq) =>
            `<span style="display:inline-block;background:${sq.certified ? '#ecfdf5' : '#f1f5f9'};border:1px solid ${sq.certified ? '#6ee7b7' : '#cbd5e1'};color:${sq.certified ? '#047857' : '#475569'};padding:4px 8px;border-radius:4px;font-size:10px;font-weight:600;margin:2px;">${sq.certified ? '✓ ' : ''}${escHtml(sq.subjectCode || sq.subjectName)}</span>`,
        )
        .join('')
    : `<span style="font-size:11px;color:#94a3b8;font-style:italic;">Aucune habilitation déclarée</span>`;

  // ─── Autorisations ───────────────────────────────────────────────────────────
  const authorizationsHtml = data.levelAuthorizations.length > 0
    ? data.levelAuthorizations
        .map(
          (la) =>
            `<span style="display:inline-block;background:#eff6ff;border:1px solid #93c5fd;color:#1e40af;padding:4px 8px;border-radius:4px;font-size:10px;font-weight:600;margin:2px;">${escHtml(la.levelName)}</span>`,
        )
        .join('')
    : `<span style="font-size:11px;color:#94a3b8;font-style:italic;">Aucune autorisation de niveau</span>`;

  // ─── Multigrade ──────────────────────────────────────────────────────────────
  const multigradeHtml = data.multigradeAssignments.length > 0
    ? data.multigradeAssignments
        .map((mg) => {
          const classList = mg.classNames.join(' + ');
          const langSuffix = mg.language ? ` <span style="color:#64748b;font-weight:400;">(${escHtml(mg.language)})</span>` : '';
          const notes = mg.notes ? `<div style="font-size:10px;color:#64748b;font-style:italic;margin-top:4px;">📝 ${escHtml(mg.notes)}</div>` : '';
          const statusBadge = mg.isActive
            ? '<span style="display:inline-block;background:#ecfdf5;border:1px solid #6ee7b7;color:#047857;padding:2px 6px;border-radius:999px;font-size:9px;font-weight:bold;margin-left:6px;">Actif</span>'
            : '<span style="display:inline-block;background:#fef2f2;border:1px solid #fca5a5;color:#b91c1c;padding:2px 6px;border-radius:999px;font-size:9px;font-weight:bold;margin-left:6px;">Inactif</span>';
          return `
            <div style="background:#fffbeb;border:1px solid #fcd34d;border-left:4px solid #F5A623;border-radius:4px;padding:8px 12px;margin-bottom:6px;">
              <div style="font-size:12px;font-weight:bold;color:#92400e;">⚡ ${escHtml(classList)}${langSuffix}${statusBadge}</div>
              ${notes}
            </div>`;
        })
        .join('')
    : `<div style="background:#f8fafc;border:1px dashed #cbd5e1;border-radius:4px;padding:8px 12px;text-align:center;">
        <span style="font-size:11px;color:#64748b;font-style:italic;">Aucune affectation multigrade</span>
      </div>`;

  // ─── Affectations par classe ─────────────────────────────────────────────────
  let classAssignmentsHtml: string;
  if (data.classAssignments.length === 0) {
    classAssignmentsHtml = `
      <div style="background:#f8fafc;border:1px dashed #cbd5e1;border-radius:4px;padding:8px 12px;text-align:center;">
        <span style="font-size:11px;color:#64748b;font-style:italic;">Aucune affectation par classe</span>
      </div>`;
  } else {
    const sorted = [...data.classAssignments].sort((a, b) => {
      if (a.className !== b.className) return a.className.localeCompare(b.className);
      return a.subjectCode.localeCompare(b.subjectCode);
    });
    const rows = sorted
      .map(
        (a, idx) => `
          <tr style="${idx % 2 === 1 ? 'background:#f8fafc;' : ''}">
            <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;font-size:11px;font-weight:bold;color:#0D1F6E;width:30%;">${escHtml(a.className)}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;font-size:11px;color:#334155;">
              <strong>${escHtml(a.subjectCode)}</strong>
              <span style="color:#64748b;"> — ${escHtml(a.subjectName)}</span>
            </td>
            <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;font-size:11px;font-weight:bold;color:#1e40af;text-align:right;white-space:nowrap;width:60px;">${a.weeklyHours}h</td>
          </tr>`,
      )
      .join('');

    classAssignmentsHtml = `
      <table style="width:100%;border-collapse:collapse;margin:8px 0;">
        <thead>
          <tr style="background:#0D1F6E;color:#fff;">
            <th style="padding:6px 10px;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;text-align:left;">Classe</th>
            <th style="padding:6px 10px;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;text-align:left;">Matière</th>
            <th style="padding:6px 10px;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;text-align:right;">Heures</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  // ─── Charge horaire récap ────────────────────────────────────────────────────
  const workloadRecap = `
    <table style="width:100%;border-collapse:collapse;margin:8px 0;background:${workloadBg};border:1px solid ${workloadBorder};border-radius:8px;">
      <tr>
        <td style="padding:12px 16px;vertical-align:middle;">
          <div style="font-size:10px;color:${workloadColor};text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;font-weight:bold;">Charge assignée</div>
          <div style="font-size:24px;font-weight:bold;color:${workloadColor};line-height:1;">
            ${data.totalAssignedHours}h
            <span style="font-size:13px;color:#64748b;font-weight:400;"> / ${data.maxWeeklyHours}h</span>
          </div>
          <div style="font-size:11px;color:${workloadColor};font-weight:bold;margin-top:6px;">${workloadLabel}</div>
        </td>
        <td style="padding:12px 16px;vertical-align:middle;text-align:right;width:140px;">
          <div style="width:120px;height:10px;background:#ffffff;border-radius:999px;overflow:hidden;border:1px solid ${workloadBorder};margin-left:auto;">
            <div style="height:100%;width:${Math.min(workloadPercent, 100)}%;background:${workloadColor};border-radius:999px;"></div>
          </div>
          <div style="font-size:9px;color:#64748b;margin-top:4px;">${workloadPercent}% de la capacité</div>
        </td>
      </tr>
    </table>`;

  // ─── HTML complet ────────────────────────────────────────────────────────────
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Récapitulatif pédagogique — ${escHtml(data.teacherName)}</title>
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0; padding: 0;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 12px;
      color: #0f172a;
      background: #ffffff;
    }
    .pdf-container {
      padding: 4px 0;
    }
    /* Évite les coupures de page au milieu d'une section */
    .section { page-break-inside: avoid; }
    /* Force un saut de page avant certaines sections critiques si nécessaire */
    .page-break-before { page-break-before: always; }
    @page {
      size: A4;
      margin: 22mm 14mm 26mm 14mm;
    }
  </style>
</head>
<body>
  <div class="pdf-container">

    <!-- TITRE PRINCIPAL avec badge de statut -->
    <div style="text-align:center;margin:0 0 16px;padding:14px;background:linear-gradient(160deg,#0D1F6E 0%,#0D3B85 100%);border-radius:8px;color:#fff;">
      <h1 style="margin:0 0 6px;font-size:18px;font-weight:bold;color:#fff;letter-spacing:0.5px;">
        Récapitulatif pédagogique
      </h1>
      <div style="font-size:13px;color:#F5A623;font-weight:bold;margin-bottom:8px;">
        ${escHtml(data.teacherName)}
      </div>
      <div style="font-size:11px;color:#c7d2fe;">
        Année scolaire ${escHtml(data.academicYearLabel)}
      </div>
      <div style="display:inline-block;background:${workloadBg};border:1px solid ${workloadBorder};color:${workloadColor};padding:4px 12px;border-radius:999px;font-size:11px;font-weight:bold;margin-top:8px;">
        📊 ${workloadLabel}
      </div>
    </div>

    <!-- 1. Identité -->
    <div class="section">
      ${sectionTitle('👤', 'Identité')}
      <table style="width:100%;border-collapse:collapse;margin:8px 0;background:#fff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
        ${identityRows.join('')}
      </table>
    </div>

    <!-- 2. Paramètres académiques -->
    <div class="section">
      ${sectionTitle('⚙️', 'Paramètres académiques')}
      <table style="width:100%;border-collapse:collapse;margin:8px 0;background:#fff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
        ${academicRows}
      </table>
    </div>

    <!-- 3. Habilitations -->
    <div class="section">
      ${sectionTitle('🎓', 'Habilitations par matière')}
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;margin:8px 0;">${qualificationsHtml}</div>
    </div>

    <!-- 4. Autorisations -->
    <div class="section">
      ${sectionTitle('🏫', 'Autorisations par niveau')}
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;margin:8px 0;">${authorizationsHtml}</div>
    </div>

    <!-- 5. Disponibilités — GRILLE MATRICIELLE -->
    <div class="section">
      ${sectionTitle('📅', 'Disponibilités hebdomadaires')}
      ${renderAvailabilityMatrix(data)}
    </div>

    <!-- 6. Multigrade -->
    <div class="section">
      ${sectionTitle('⚡', 'Affectations multigrade')}
      ${multigradeHtml}
    </div>

    <!-- 7. Affectations par classe -->
    <div class="section">
      ${sectionTitle('📋', 'Affectations par classe')}
      ${classAssignmentsHtml}
    </div>

    <!-- 8. Charge horaire globale -->
    <div class="section">
      ${sectionTitle('📊', 'Charge horaire globale')}
      ${workloadRecap}
    </div>

  </div>
</body>
</html>`;
}

/**
 * Header HTML pour Puppeteer (displayHeaderFooter).
 * Affiché en haut de CHAQUE page du PDF :
 *   - Logo + nom école (gauche)
 *   - Coordonnées école (droite)
 *   - Bande doré + mention « Pédagogie »
 *
 * ⚠️ Le HTML du header/footer Puppeteer a accès aux variables :
 *   - <span class="date"></span> → date courante
 *   - <span class="title"></span> → titre du document (passé via options)
 *   - <span class="url"></span> → URL (non utilisé ici)
 *   - <span class="pageNumber"></span> → numéro de page courant
 *   - <span class="totalPages"></span> → nombre total de pages
 *
 * Marges définies dans @page → 22mm en haut, 26mm en bas, pour laisser
 * de la place au header/footer.
 */
function buildPdfHeaderHtml(data: TeacherProfileSummaryData): string {
  const schoolName = escHtml(data.branding.schoolName || 'Établissement');
  const schoolLogo = data.branding.schoolLogo
    ? `<img src="${escHtml(data.branding.schoolLogo)}" alt="${schoolName}" style="max-height:36px;max-width:120px;object-fit:contain;" />`
    : `<div style="width:36px;height:36px;border:2px solid #F5A623;border-radius:8px;text-align:center;line-height:32px;background:rgba(245,166,35,0.12);"><span style="font-size:14px;font-weight:bold;color:#F2C94C;">${escHtml((data.branding.schoolName || 'EC').substring(0, 2).toUpperCase())}</span></div>`;

  const contactItems: string[] = [];
  if (data.branding.schoolAddress) contactItems.push(escHtml(data.branding.schoolAddress));
  if (data.branding.schoolPhone) contactItems.push(`Tél : ${escHtml(data.branding.schoolPhone)}`);
  if (data.branding.schoolEmail) contactItems.push(`<a href="mailto:${escHtml(data.branding.schoolEmail)}" style="color:#475569;text-decoration:none;">${escHtml(data.branding.schoolEmail)}</a>`);
  const contactHtml = contactItems
    .map((c) => `<div style="font-size:9px;color:#64748b;margin-top:1px;">${c}</div>`)
    .join('');

  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { font-family: Arial, Helvetica, sans-serif; }
  .pdf-header {
    width: 100%;
    padding: 0 14mm 6px;
    border-bottom: 2px solid #F5A623;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .pdf-header-left { display: flex; align-items: center; gap: 10px; }
  .pdf-header-right { text-align: right; }
  .pdf-header-school-name { font-size: 13px; font-weight: bold; color: #0D1F6E; }
  .pdf-header-module { font-size: 9px; color: #F5A623; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }
</style>
</head>
<body>
  <div class="pdf-header">
    <div class="pdf-header-left">
      ${schoolLogo}
      <div>
        <div class="pdf-header-school-name">${schoolName}</div>
        <div class="pdf-header-module">Pédagogie</div>
      </div>
    </div>
    <div class="pdf-header-right">
      ${contactHtml}
    </div>
  </div>
</body>
</html>`;
}

/**
 * Footer HTML pour Puppeteer — affiché en bas de CHAQUE page.
 *   - Logo Academia Helm + slogan (gauche)
 *   - Date de génération (centre)
 *   - Numéro de page (droite)
 */
function buildPdfFooterHtml(): string {
  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { font-family: Arial, Helvetica, sans-serif; }
  .pdf-footer {
    width: 100%;
    padding: 6px 14mm 0;
    border-top: 1px solid #e2e8f0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 9px;
    color: #64748b;
  }
  .pdf-footer-left { display: flex; align-items: center; gap: 6px; }
  .pdf-footer-center { color: #94a3b8; font-style: italic; }
  .pdf-footer-right { color: #0D1F6E; font-weight: bold; }
  .pdf-footer-logo {
    width: 18px; height: 18px;
    border-radius: 4px;
    background: linear-gradient(160deg, #0D1F6E 0%, #0D3B85 100%);
    text-align: center; line-height: 18px;
    color: #F5A623; font-size: 10px; font-weight: bold;
  }
</style>
</head>
<body>
  <div class="pdf-footer">
    <div class="pdf-footer-left">
      <div class="pdf-footer-logo">AH</div>
      <div>
        <div style="font-size:10px;font-weight:bold;color:#0D1F6E;">Academia Helm</div>
        <div style="font-size:8px;color:#94a3b8;">Plateforme de pilotage éducatif</div>
      </div>
    </div>
    <div class="pdf-footer-center">
      Document généré automatiquement le <span class="date"></span>
    </div>
    <div class="pdf-footer-right">
      Page <span class="pageNumber"></span> / <span class="totalPages"></span>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Service responsable de la génération du PDF de récapitulatif enseignant.
 *
 * Utilise PuppeteerPoolService (singleton global) pour éviter de lancer
 * un nouveau Chromium à chaque appel.
 */
@Injectable()
export class PedagogyPdfDocumentService {
  private readonly logger = new Logger(PedagogyPdfDocumentService.name);

  constructor(private readonly puppeteerPool: PuppeteerPoolService) {}

  /**
   * Génère le PDF de récapitulatif pédagogique pour un enseignant.
   *
   * @returns Buffer PDF prêt à être joint à un email (Content-Type: application/pdf)
   */
  async generateTeacherProfilePdf(
    data: TeacherProfileSummaryData,
  ): Promise<Buffer> {
    const html = buildPdfHtml(data);
    const headerHtml = buildPdfHeaderHtml(data);
    const footerHtml = buildPdfFooterHtml();

    this.logger.log(
      `📄 Generating PDF for teacher ${data.teacherName} — ${data.classAssignments.length} class assignments, ${data.availabilities.length} unavailable slots, ${data.availableSlots.length} available slots`,
    );

    const { page } = await this.puppeteerPool.acquirePage();
    try {
      // ⚠️ Utiliser 'domcontentloaded' au lieu de 'networkidle0' :
      //   - 'networkidle0' attend que TOUTES les requêtes réseau soient terminées
      //     (y compris les <img> du header qui chargent le logo école depuis
      //     l'API). Si l'API n'est pas joignable depuis l'intérieur du conteneur
      //     Fly.io (loopback), ça timeout pendant 30s puis jette une erreur.
      //   - 'domcontentloaded' se contente du DOM prêt — suffisant pour le PDF
      //     car les styles sont inline (pas de CSS externe) et le logo est
      //     optionnel (s'il ne charge pas, le PDF a juste un placeholder).
      //
      // Timeout augmenté à 30s (était 15s) — pour les enseignants avec beaucoup
      // de matières (ex: 22 matières × détails), le HTML peut être volumineux
      // et Chromium a besoin de plus de temps pour parser + render.
      await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 30000 });

      // Petite attente pour que les polices/images se chargent (best-effort)
      await new Promise((resolve) => setTimeout(resolve, 500));

      // ⚠️ IMPORTANT : page.pdf() retourne un Uint8Array dans Puppeteer v13+,
      // PAS un Buffer. Si on ne convertit pas explicitement, le test
      // `instanceof Buffer` dans le service Resend échoue → la pièce jointe
      // est silencieusement filtrée → l'email part sans PDF.
      //
      // Solution : convertir explicitement en Buffer via Buffer.from().
      // Buffer.from(uint8array) crée un vrai Buffer qui partage la mémoire
      // avec l'Uint8Array (zéro copie, rapide).
      const pdfResult = await page.pdf({
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: headerHtml,
        footerTemplate: footerHtml,
        // Marges définies dans @page CSS — ici on aligne avec les mêmes valeurs
        // pour que le header/footer Puppeteer se positionnent correctement.
        margin: {
          top: '22mm',
          bottom: '26mm',
          left: '14mm',
          right: '14mm',
        },
        // Timeout implicite sur page.pdf() — si Chromium met trop longtemps
        // à générer le PDF (ex: OOM sur contenu volumineux), on échoue vite
        // plutôt que de bloquer la file d'attente du pool.
        timeout: 30000,
      });

      // Convertir explicitement en Buffer (Puppeteer v25 retourne Uint8Array)
      const pdfBuffer: Buffer = Buffer.isBuffer(pdfResult)
        ? pdfResult
        : Buffer.from(pdfResult);

      // ⚠️ Vérification de sécurité : si le PDF fait 0 bytes, c'est que
      // Chromium a crashé silencieusement. On jette une erreur explicite
      // pour que le service de notification log "PDF generation failed"
      // et envoie l'email sans pièce jointe (déjà géré).
      if (pdfBuffer.length === 0) {
        throw new Error('PDF generation returned 0 bytes (Chromium crash?)');
      }

      this.logger.log(
        `  ✅ PDF generated — ${Math.round(pdfBuffer.length / 1024)}KB — type: ${pdfResult.constructor.name} → Buffer(${pdfBuffer.length} bytes)`,
      );

      return pdfBuffer;
    } finally {
      await this.puppeteerPool.releasePage(page);
    }
  }
}
