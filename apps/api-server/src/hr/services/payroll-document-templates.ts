/**
 * ============================================================================
 * PAYROLL DOCUMENT TEMPLATES — Gabarits purs FP / EP (RH Bénin)
 * ============================================================================
 *
 * DEUX documents STRICTEMENT séparés, dérivés du statut contractuel :
 *
 *   1. FICHE DE PAIE (FP-YYYY-NNNNNN) — SALARIE_DECLARE / SALARIE_NON_DECLARE
 *      Gabarit « bleu nuit ». Bloc CNSS conditionnel (si déclaré), charges
 *      patronales à titre strictement informatif, cumuls annuels recalculés
 *      depuis les documents émis, congés payés (art. 7 du contrat de travail),
 *      mention de conservation sans limitation de durée.
 *
 *   2. ÉTAT DE PAIEMENT (EP-YYYY-NNNNNN) — PRESTATAIRE_SERVICE
 *      Gabarit « vert » + encadré d'avertissement en tête : ce document N'EST
 *      PAS une fiche de paie (pas de subordination, pas de CNSS, retenue AIB
 *      à la source). Les deux gabarits sont volontairement distincts
 *      visuellement pour qu'aucun contrôle ne confonde les deux natures.
 *
 * ⚠️ CONTRAINTE NON NÉGOCIABLE : aucun taux (CNSS/ITS/AIB/congés) n'est codé
 * en dur ici — tout provient du snapshot, lui-même alimenté par
 * payroll_fiscal_rates (versionné par exercice fiscal).
 *
 * Fichiers PURS (aucune dépendance Nest) → testables en isolation (bun).
 * ============================================================================
 */

// ─── Types des snapshots (figés à l'émission) ─────────────────────────────

export interface PeriodInfo {
  year: number;
  month: number; // 1-12
  label: string; // « Janvier 2026 »
  startDate: string; // ISO
  endDate: string; // ISO
  joursOuvres: number; // jours travaillables (lun-ven) du mois
}

export interface EmployerIdentity {
  raisonSociale: string;
  formeJuridique?: string | null;
  rccm?: string | null;
  ifu?: string | null;
  cnss?: string | null;
  adresse: string;
  telephone?: string | null;
  email?: string | null;
  representant: string;
  qualite: string;
}

export interface CumulsAnnuels {
  /** Cumul BRUT de l'exercice fiscal, INCLUANT le présent document */
  brut: number;
  /** Cumul ITS (fiches) ou AIB (états) de l'exercice, incluant le présent */
  impot: number;
  /** Cumul CNSS salariale de l'exercice, incluant le présent (0 si non déclaré) */
  cnss: number;
  /** Cumul NET de l'exercice, incluant le présent */
  net: number;
  /** Nombre de documents émis sur l'exercice, incluant le présent */
  documents: number;
}

export interface CongesInfo {
  /** Jours acquis sur l'exercice (mois travaillés × jours/mois du barème) */
  acquis: number;
  /** Jours pris (congés annuels approuvés) */
  pris: number;
  solde: number;
}

/** Bloc barème figé dans le snapshot (pistes d'audit du calcul). */
export interface RatesStamp {
  fiscalYear: number;
  cnssSalarialPct?: number;
  aibPct?: number;
  sourceNotes?: string | null;
}

export interface FichePaieSnapshot {
  kind: 'FICHE_DE_PAIE';
  statutContractuel: 'SALARIE_DECLARE' | 'SALARIE_NON_DECLARE';
  cnssDeclare: boolean;
  documentNumber: string | null; // null en prévisualisation
  period: PeriodInfo;
  fiscalYear: number;
  employeur: EmployerIdentity;
  salarie: {
    matricule: string;
    nom: string;
    prenoms: string;
    poste: string;
    categorie: string;
    cnssNumber: string | null; // null si non déclaré
    anciennete: string;
    ancienneteDepuis: string | null;
    joursTravailles: number;
  };
  gains: {
    base: number;
    heuresSup: number;
    primes: number;
    brut: number;
  };
  retenues: {
    cnss: number;
    its: number;
    autres: number;
    total: number;
  };
  net: number;
  chargesPatronales: {
    prestationsFamiliales: number;
    risquesProfessionnels: number;
    vieillesse: number;
    total: number;
    informatif: true;
  } | null;
  cumuls: CumulsAnnuels;
  conges: CongesInfo;
  rates: RatesStamp;
  mention: string;
}

export interface EtatPaiementSnapshot {
  kind: 'ETAT_DE_PAIEMENT';
  statutContractuel: 'PRESTATAIRE_SERVICE';
  documentNumber: string | null; // null en prévisualisation
  period: PeriodInfo;
  fiscalYear: number;
  employeur: EmployerIdentity;
  prestataire: {
    nom: string;
    prenoms: string;
    ifu: string | null; // null → AIB sans IFU
    contratReference: string | null;
    description: string | null;
    mode: 'FORFAIT' | 'HORAIRE' | null;
    heures?: number | null;
    tauxHoraire?: number | null;
  };
  decompte: {
    brut: number;
    tauxAib: number; // DÉRIVÉ (IFU présent/absent) — jamais saisi
    aib: number;
    net: number;
  };
  cumuls: CumulsAnnuels;
  rates: RatesStamp;
  mention: string;
}

export type PayrollDocumentSnapshot = FichePaieSnapshot | EtatPaiementSnapshot;

export const MENTION_FICHE_CONSERVATION =
  "Ce bulletin est à conserver sans limitation de durée.";

export const MENTION_ETAT_PAIEMENT =
  "Ce document ne constitue pas une fiche de paie. Il s'agit d'un état de paiement " +
  "relatif à un contrat de prestation de services, soumis à la retenue à la source AIB " +
  "(Acompte sur Impôt assis sur les Bénéfices) et excluant toute affiliation CNSS au titre " +
  "de la présente relation contractuelle. Le Prestataire demeure seul responsable de ses " +
  "obligations fiscales et sociales propres.";

export const MENTION_CHARGES_PATRONALES =
  "Charges patronales calculées à titre informatif — provisionnées pour la déclaration CNSS de l'employeur, NON déduites du net à payer.";

// ─── Helpers de formatage (purs) ───────────────────────────────────────────

export function esc(v: unknown): string {
  if (v == null) return '';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function fmtMoney(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  if (!isFinite(v)) return '0';
  // Normalisation des espaces fines ICU (U+202F/U+00A0) → espace standard :
  // copier-coller et extraction de texte du PDF prévisibles.
  return v
    .toLocaleString('fr-FR', { maximumFractionDigits: 0 })
    .replace(/[\u202f\u00a0]/g, ' ');
}

export function fmtDateFr(iso: string | Date | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function fmtDateTimeFr(iso: string | Date | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return (
    d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' à ' +
    d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  );
}

const MONTH_LABELS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

export function monthLabel(year: number, month: number): string {
  const m = Math.min(Math.max(Math.round(month), 1), 12);
  return `${MONTH_LABELS[m - 1]} ${year}`;
}

/** Jours travaillables du mois (lundi-vendredi) — champ d'identification indicatif. */
export function joursOuvres(year: number, month: number): number {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  let count = 0;
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

/** Ancienneté lisible (« 3 ans 2 mois ») entre deux dates. */
export function ancienneteLabel(from: string | Date | null, to: string | Date): string {
  if (!from) return '—';
  const d1 = new Date(from);
  if (isNaN(d1.getTime())) return '—';
  let months = (to.getFullYear() - d1.getFullYear()) * 12 + (to.getMonth() - d1.getMonth());
  if (to.getDate() < d1.getDate()) months--;
  if (months < 0) return "moins d'un mois";
  const ans = Math.floor(months / 12);
  const rest = months % 12;
  if (ans <= 0 && rest <= 0) return "moins d'un mois";
  const parts: string[] = [];
  if (ans > 0) parts.push(`${ans} an${ans > 1 ? 's' : ''}`);
  if (rest > 0) parts.push(`${rest} mois`);
  return parts.join(' ');
}

/**
 * Numéro de document de paie — format légal standard :
 *   FICHE_DE_PAIE    → FP-2026-000123
 *   ETAT_DE_PAIEMENT → EP-2026-000045
 * Séquence remise à zéro à chaque exercice fiscal.
 */
export function formatDocumentNumber(
  documentType: 'FICHE_DE_PAIE' | 'ETAT_DE_PAIEMENT',
  fiscalYear: number,
  sequence: number,
): string {
  const prefix = documentType === 'FICHE_DE_PAIE' ? 'FP' : 'EP';
  const seq = Math.max(1, Math.floor(sequence));
  return `${prefix}-${fiscalYear}-${String(seq).padStart(6, '0')}`;
}

/**
 * Congés payés : acquis = mois travaillés de l'exercice × jours/mois (BARÈME),
 * pris = jours de congés annuels approuvés sur l'exercice (module Congés).
 */
export function computeConges(opts: {
  joursCongesParMois: number; // issu de payroll_fiscal_rates — JAMAIS en dur
  hireDate: string | Date | null;
  periodEnd: Date;
  joursPris: number;
}): CongesInfo {
  const { joursCongesParMois, hireDate, periodEnd, joursPris } = opts;
  const yearStart = new Date(periodEnd.getFullYear(), 0, 1);
  let from = yearStart;
  if (hireDate) {
    const h = new Date(hireDate);
    if (!isNaN(h.getTime()) && h > from) from = h;
  }
  let months =
    (periodEnd.getFullYear() - from.getFullYear()) * 12 +
    (periodEnd.getMonth() - from.getMonth());
  if (periodEnd.getDate() >= 15) months += 1; // mois entamé à mi-mois compté
  months = Math.max(0, Math.min(months, 12));
  const acquis = Math.round(months * joursCongesParMois * 100) / 100;
  const pris = Math.max(0, joursPris);
  return {
    acquis,
    pris,
    solde: Math.round((acquis - pris) * 100) / 100,
  };
}

// ─── Gabarits HTML — deux identités visuelles DISTINCTES ───────────────────

const BASE_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1f2937; font-size: 11px; line-height: 1.45; }
  .sheet { padding: 28px 34px 22px; }
  .band { color: #fff; padding: 14px 18px; display: flex; justify-content: space-between; align-items: center; }
  .band .org { font-size: 15px; font-weight: 800; letter-spacing: .2px; }
  .band .org-sub { font-size: 8.5px; opacity: .85; margin-top: 2px; }
  .band .doc { text-align: right; }
  .band .doc .type { font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; }
  .band .doc .num { font-size: 10px; opacity: .9; margin-top: 2px; font-weight: 600; }
  .identity { border: 1px solid #d1d5db; border-radius: 4px; display: flex; margin-top: 10px; }
  .identity > div { flex: 1; padding: 8px 12px; }
  .identity > div + div { border-left: 1px solid #d1d5db; }
  .identity h4 { font-size: 8px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; margin-bottom: 4px; }
  .identity p { margin: 1px 0; }
  .identity .hl { font-weight: 700; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  caption { text-align: left; font-size: 9.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.2px; padding: 5px 10px; border-radius: 3px 3px 0 0; color: #fff; }
  th { font-size: 8px; text-transform: uppercase; letter-spacing: .8px; color: #6b7280; text-align: left; padding: 5px 10px; border-bottom: 1.5px solid #d1d5db; background: #f9fafb; }
  th.r, td.r { text-align: right; }
  td { padding: 4.5px 10px; border-bottom: 1px solid #e5e7eb; }
  tr.total td { font-weight: 800; background: #f3f4f6; border-top: 1.5px solid #9ca3af; }
  .net-box { margin-top: 14px; border-radius: 4px; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; }
  .net-box .lbl { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; }
  .net-box .val { font-size: 19px; font-weight: 900; }
  .note { font-size: 8.5px; color: #6b7280; margin-top: 6px; font-style: italic; }
  .two-col { display: flex; gap: 12px; margin-top: 12px; }
  .two-col > div { flex: 1; }
  .warn-box { border: 2px solid #b45309; background: #fef3c7; border-radius: 4px; padding: 10px 12px; margin-top: 10px; }
  .warn-box .t { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: .8px; color: #92400e; margin-bottom: 3px; }
  .warn-box .m { font-size: 8.6px; color: #78350f; }
  .sign { display: flex; gap: 30px; margin-top: 26px; }
  .sign > div { flex: 1; text-align: center; }
  .sign .who { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: #374151; }
  .sign .box { border: 1px dashed #9ca3af; border-radius: 3px; height: 58px; margin-top: 5px; }
  .sign .date { font-size: 8px; color: #6b7280; margin-top: 4px; }
  .footer { margin-top: 16px; border-top: 1px solid #d1d5db; padding-top: 7px; font-size: 7.8px; color: #6b7280; display: flex; justify-content: space-between; }
  .draft { position: fixed; top: 42%; left: 50%; transform: translate(-50%, -50%) rotate(-24deg); font-size: 42px; font-weight: 900; color: rgba(107, 114, 128, .16); letter-spacing: 8px; text-transform: uppercase; }
  @page { size: A4; margin: 0; }
`;

const FP_BLUE = '#1e3a5f'; // bleu nuit — fiche de paie
const EP_GREEN = '#14532d'; // vert foncé — état de paiement

/** Rendu HTML de la FICHE DE PAIE (identité bleu nuit). */
export function renderFicheDePaieHtml(s: FichePaieSnapshot): string {
  const num = s.documentNumber ? esc(s.documentNumber) : 'PROJET — NON ÉMIS';
  const gainsRows = [
    row('Salaire de base', s.gains.base),
    s.gains.heuresSup > 0 ? row('Heures supplémentaires', s.gains.heuresSup) : null,
    s.gains.primes > 0 ? row('Primes et indemnités', s.gains.primes) : null,
  ]
    .filter(Boolean)
    .join('');
  const retenuesRows = [
    s.cnssDeclare
      ? row(`Cotisation CNSS (salariale, ${fmt(s.rates.cnssSalarialPct)} %)`, s.retenues.cnss)
      : null,
    row('ITS (Impôt sur Traitements et Salaires)', s.retenues.its),
    s.retenues.autres > 0 ? row('Autres retenues', s.retenues.autres) : null,
  ]
    .filter(Boolean)
    .join('');

  const patronalBlock = s.chargesPatronales
    ? `
  <table>
    <caption style="background:${FP_BLUE}">Charges patronales (employeur)</caption>
    <tbody>
      ${row('Prestations familiales', s.chargesPatronales.prestationsFamiliales)}
      ${row('Risques professionnels', s.chargesPatronales.risquesProfessionnels)}
      ${row('Vieillesse, invalidité, décès', s.chargesPatronales.vieillesse)}
      <tr class="total">${rowHTML('Total charges patronales', s.chargesPatronales.total)}</tr>
    </tbody>
  </table>
  <p class="note">${esc(MENTION_CHARGES_PATRONALES)}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><style>${BASE_CSS}</style></head>
<body>${s.documentNumber ? '' : '<div class="draft">Projet</div>'}
<div class="sheet">
  <div class="band" style="background:${FP_BLUE}">
    <div>
      <div class="org">${esc(s.employeur.raisonSociale)}</div>
      <div class="org-sub">${esc(s.employeur.adresse)}${s.employeur.ifu ? ' · IFU ' + esc(s.employeur.ifu) : ''}${s.employeur.rccm ? ' · RCCM ' + esc(s.employeur.rccm) : ''}</div>
      ${s.employeur.cnss ? `<div class="org-sub">N° employeur CNSS ${esc(s.employeur.cnss)}</div>` : ''}
    </div>
    <div class="doc">
      <div class="type">Fiche de paie</div>
      <div class="num">N° ${num}</div>
      <div class="num">Période : ${esc(s.period.label)}</div>
    </div>
  </div>

  <div class="identity">
    <div>
      <h4>Salarié</h4>
      <p class="hl">${esc(s.salarie.prenoms)} ${esc(s.salarie.nom)}</p>
      <p>Matricule : <span class="hl">${esc(s.salarie.matricule)}</span></p>
      <p>Poste : ${esc(s.salarie.poste)}</p>
      <p>Catégorie : ${esc(s.salarie.categorie)}</p>
    </div>
    <div>
      <h4>Statut &amp; identification</h4>
      <p>Statut : <span class="hl">${s.cnssDeclare ? 'Salarié déclaré à la CNSS' : 'Salarié (non déclaré à la CNSS)'}</span></p>
      ${s.cnssDeclare && s.salarie.cnssNumber ? `<p>N° immatriculation CNSS : <span class="hl">${esc(s.salarie.cnssNumber)}</span></p>` : ''}
      <p>Ancienneté : ${esc(s.salarie.anciennete)}${s.salarie.ancienneteDepuis ? ` (depuis le ${fmtDateFr(s.salarie.ancienneteDepuis)})` : ''}</p>
      <p>Jours travaillés (ouvrés) : ${s.salarie.joursTravailles}</p>
    </div>
  </div>

  <table>
    <caption style="background:${FP_BLUE}">Gains</caption>
    <thead><tr><th>Rubrique</th><th class="r">Montant (FCFA)</th></tr></thead>
    <tbody>
      ${gainsRows}
      <tr class="total">${rowHTML('SALAIRE BRUT', s.gains.brut)}</tr>
    </tbody>
  </table>

  <table>
    <caption style="background:${FP_BLUE}">Retenues</caption>
    <thead><tr><th>Rubrique</th><th class="r">Montant (FCFA)</th></tr></thead>
    <tbody>
      ${retenuesRows}
      <tr class="total">${rowHTML('TOTAL RETENUES', s.retenues.total)}</tr>
    </tbody>
  </table>

  <div class="net-box" style="background:${FP_BLUE}">
    <span class="lbl">Net à payer</span>
    <span class="val">${fmtMoney(s.net)} FCFA</span>
  </div>

  ${patronalBlock}

  <div class="two-col">
    <table>
      <caption style="background:${FP_BLUE}">Cumuls annuels ${esc(String(s.fiscalYear))}</caption>
      <tbody>
        ${row('Cumul salaire brut', s.cumuls.brut)}
        ${row('Cumul ITS', s.cumuls.impot)}
        ${s.cnssDeclare ? row('Cumul CNSS (salariale)', s.cumuls.cnss) : ''}
        <tr class="total">${rowHTML('Cumul net à payer', s.cumuls.net)}</tr>
      </tbody>
    </table>
    <table>
      <caption style="background:${FP_BLUE}">Congés payés</caption>
      <tbody>
        ${row('Jours acquis (exercice)', s.conges.acquis)}
        ${row('Jours pris', s.conges.pris)}
        <tr class="total">${rowHTML('Solde disponible', s.conges.solde)}</tr>
      </tbody>
    </table>
  </div>

  <div class="footer">
    <span>${esc(MENTION_FICHE_CONSERVATION)}</span>
    <span>Exercice fiscal ${esc(String(s.fiscalYear))} · Barème ${esc(String(s.rates.fiscalYear))}${s.documentNumber ? ` · Émis le ${fmtDateTimeFr(new Date().toISOString())}` : ' · PRÉVISUALISATION'}</span>
  </div>
</div>
</body></html>`;
}

/** Rendu HTML de l'ÉTAT DE PAIEMENT (identité verte + avertissement). */
export function renderEtatDePaiementHtml(s: EtatPaiementSnapshot): string {
  const num = s.documentNumber ? esc(s.documentNumber) : 'PROJET — NON ÉMIS';
  const modeLine =
    s.prestataire.mode === 'FORFAIT'
      ? 'Rémunération : forfait convenu'
      : s.prestataire.mode === 'HORAIRE'
        ? `Rémunération : ${s.prestataire.heures ?? '—'} h × ${fmtMoney(s.prestataire.tauxHoraire ?? 0)} FCFA/h`
        : null;

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><style>${BASE_CSS}</style></head>
<body>${s.documentNumber ? '' : '<div class="draft">Projet</div>'}
<div class="sheet">
  <div class="warn-box">
    <div class="t">⚠ Avertissement — nature juridique du document</div>
    <div class="m">${esc(s.mention)}</div>
  </div>

  <div class="band" style="background:${EP_GREEN};margin-top:10px">
    <div>
      <div class="org">${esc(s.employeur.raisonSociale)}</div>
      <div class="org-sub">${esc(s.employeur.adresse)}${s.employeur.ifu ? ' · IFU ' + esc(s.employeur.ifu) : ''}${s.employeur.rccm ? ' · RCCM ' + esc(s.employeur.rccm) : ''}</div>
    </div>
    <div class="doc">
      <div class="type">État de paiement</div>
      <div class="num">N° ${num}</div>
      <div class="num">Période : ${esc(s.period.label)}</div>
    </div>
  </div>

  <div class="identity">
    <div>
      <h4>Prestataire</h4>
      <p class="hl">${esc(s.prestataire.prenoms)} ${esc(s.prestataire.nom)}</p>
      ${s.prestataire.ifu ? `<p>IFU : <span class="hl">${esc(s.prestataire.ifu)}</span></p>` : '<p>IFU : non renseigné</p>'}
      ${s.prestataire.contratReference ? `<p>Référence contrat : ${esc(s.prestataire.contratReference)}</p>` : ''}
    </div>
    <div>
      <h4>Prestation</h4>
      ${modeLine ? `<p>${modeLine}</p>` : ''}
      ${s.prestataire.description ? `<p>Objet : ${esc(s.prestataire.description)}</p>` : ''}
      <p>Période d'exécution : ${fmtDateFr(s.period.startDate)} → ${fmtDateFr(s.period.endDate)}</p>
    </div>
  </div>

  <table>
    <caption style="background:${EP_GREEN}">Décompte de paiement</caption>
    <thead><tr><th>Rubrique</th><th class="r">Montant (FCFA)</th></tr></thead>
    <tbody>
      ${row('Montant brut de la prestation', s.decompte.brut)}
      ${row(`Retenue à la source AIB (${fmt(s.decompte.tauxAib)} %${s.prestataire.ifu ? '' : ' — sans IFU'})`, s.decompte.aib)}
      <tr class="total">${rowHTML('NET À PAYER', s.decompte.net)}</tr>
    </tbody>
  </table>

  <div class="net-box" style="background:${EP_GREEN}">
    <span class="lbl">Net à payer</span>
    <span class="val">${fmtMoney(s.decompte.net)} FCFA</span>
  </div>

  <table>
    <caption style="background:${EP_GREEN}">Cumuls annuels ${esc(String(s.fiscalYear))}</caption>
    <tbody>
      ${row('Cumul brut versé (exercice)', s.cumuls.brut)}
      ${row('Cumul AIB retenue', s.cumuls.impot)}
      <tr class="total">${rowHTML('Cumul net versé', s.cumuls.net)}</tr>
    </tbody>
  </table>

  <div class="sign">
    <div>
      <div class="who">Pour l'employeur</div>
      <div class="box"></div>
      <div class="date">${esc(s.employeur.representant)}, ${esc(s.employeur.qualite)}</div>
    </div>
    <div>
      <div class="who">Le prestataire</div>
      <div class="box"></div>
      <div class="date">Réception du paiement = quitus de la période</div>
    </div>
  </div>

  <div class="footer">
    <span>${esc(s.mention)}</span>
    <span>Exercice fiscal ${esc(String(s.fiscalYear))}${s.documentNumber ? ` · Émis le ${fmtDateTimeFr(new Date().toISOString())}` : ' · PRÉVISUALISATION'}</span>
  </div>
</div>
</body></html>`;
}

// ─── micro-helpers internes ────────────────────────────────────────────────

function row(label: string, amount: number): string {
  return `<tr>${rowHTML(label, amount)}</tr>`;
}

function rowHTML(label: string, amount: number): string {
  return `<td>${esc(label)}</td><td class="r">${fmtMoney(amount)}</td>`;
}

function fmt(n: number | null | undefined): string {
  return String(n ?? 0).replace('.', ',');
}
