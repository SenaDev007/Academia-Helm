/**
 * ============================================================================
 * CONTRACT GENERATION SERVICE — Génération PDF du contrat d'abonnement
 * ============================================================================
 *
 * ⭐ CONTRAT CONFORME AU DOCUMENT WORD de référence
 *    (Contrat_Abonnement_Academia_Helm.docx — « exactement ça, bien structuré,
 *    bien designé ») :
 *      - Page A4 portrait, UNE colonne, défilement vertical (plus de layout
 *        2 colonnes compact à 9px)
 *      - Les 14 articles avec leurs textes INTÉGRAUX (plus de résumés)
 *      - Article 1 : fiche de souscription en tableau à 2 colonnes
 *      - Article 3 : grille tarifaire complète (6 colonnes) + option bilingue
 *        + coût total Année 1 en chiffres ET en toutes lettres
 *      - Article 4 : 4.1 conditions générales, 4.2 modalité retenue (cases),
 *        4.3 certification d'encaissement (espèces), 4.4 échéancier de
 *        tranches (tableau 7 colonnes + TOTAL + clause de défaut)
 *      - Signatures : tableau 2 colonnes LE CLIENT / LE PRESTATAIRE
 *
 * ⭐ MULTI-ÉCOLES : le contrat s'adapte au nombre d'établissements souscrits —
 *    fiche (écoles du groupe), Article 3 (détail par école), Article 4
 *    (montants × nombre d'écoles, « c'est payant en fonction du nombre
 *    d'écoles »).
 *
 * Le document HTML généré est servi pour consultation (route :fileName) et
 * converti en vrai PDF pour l'email au promoteur.
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';

export interface ContractInstallment {
  label: string;
  amount: number; // FCFA
  dueDate?: string; // ISO ou vide pour « à la signature »
}

/** École annexe déclarée (multi-écoles dès l'onboarding / paramètres). */
export interface ContractAnnex {
  name: string;
  city?: string;
}

export interface ContractData {
  // Fiche de souscription (Article 1)
  schoolName: string;
  promoterName: string;
  directorName?: string;
  schoolAddress: string;
  schoolCity: string;
  schoolPhone: string;
  schoolEmail: string;
  studentCount: number;
  planCode: string; // SEED, GROW, LEAD, NETWORK
  planName: string; // Helm Essentiel, Helm Croissance, etc.
  bilingual: boolean;
  subdomain: string;
  effectiveDate: string;

  // ⭐ MULTI-ÉCOLES — nombre d'établissements souscrits au contrat (1 = mono-école)
  schoolsCount?: number;
  // ⭐ Écoles annexes (nom + ville propres — renseignées pour les écoles 2..N)
  annexes?: ContractAnnex[];

  // Pricing (PAR ÉCOLE — le total est multiplié par schoolsCount)
  activationFee: number;
  annualFee: number;
  totalYearOne: number; // ⭐ TOTAL GROUPE (déjà multiplié côté appelant)
  bilingualFee?: number;

  // ⭐ Paiement en espèces (mode YEHI OR Tech) — aligne le contrat sur
  //    ce qui a été renseigné/marqué dans le wizard
  paymentMethod?: 'cash' | 'online';
  subscriptionPaid?: boolean;
  bilingualPaid?: boolean;
  receivedBy?: string; // Email de l'agent YEHI OR Tech qui a encaissé

  // ⭐ Paiement échelonné par tranches (espèces) — échéancier saisi dans
  //    le wizard (étape 3). Le contrat reprend l'échéancier tel quel.
  paymentPlan?: 'full' | 'installments';
  installments?: ContractInstallment[];
  downPaymentReceived?: boolean; // Acompte (tranche n° 1) encaissé à la signature

  // Signatures
  promoterSignatureDataUrl?: string | null; // Canvas signature (base64 PNG)
  providerSignatureDataUrl?: string | null; // Provider signature (admin)
  promoterSignedAt?: string;
  providerSignedAt?: string;

  // ⭐ Contrat déjà signé manuellement (version papier) : aucune signature
  //    numérique n'est recueillie ; le PDF est délivré avec la mention
  //    « déjà signé manuellement » (signature sur l'exemplaire papier).
  signedManually?: boolean;
}

/** Grille tarifaire officielle (contrat Article 3 — miroir pricing_plans). */
const PLAN_GRID: { code: string; name: string; range: string; activation: number; annual: number }[] = [
  { code: 'SEED', name: 'Helm Essentiel', range: '1 à 50', activation: 500000, annual: 50000 },
  { code: 'GROW', name: 'Helm Croissance', range: '51 à 150', activation: 500000, annual: 75000 },
  { code: 'LEAD', name: 'Helm Performance', range: '151 à 400', activation: 500000, annual: 100000 },
  { code: 'NETWORK', name: 'Helm Institution', range: '401 et plus', activation: 500000, annual: 150000 },
];

// ── Montant en toutes lettres (contrat Article 3) ───────────────────────────
const UNITS_FR = [
  'zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf',
];
const TENS_FR: Record<number, string> = { 2: 'vingt', 3: 'trente', 4: 'quarante', 5: 'cinquante', 6: 'soixante' };

function below100Fr(n: number): string {
  if (n < 20) return UNITS_FR[n];
  if (n < 70) {
    const t = Math.floor(n / 10);
    const u = n % 10;
    if (u === 0) return TENS_FR[t];
    if (u === 1) return `${TENS_FR[t]}-et-un`;
    return `${TENS_FR[t]}-${UNITS_FR[u]}`;
  }
  if (n < 80) {
    if (n === 71) return 'soixante-et-onze';
    return `soixante-${UNITS_FR[n - 60]}`;
  }
  if (n === 80) return 'quatre-vingts';
  return `quatre-vingt-${UNITS_FR[n - 80]}`;
}

function below1000Fr(n: number): string {
  if (n < 100) return below100Fr(n);
  const c = Math.floor(n / 100);
  const r = n % 100;
  if (c === 1) return r === 0 ? 'cent' : `cent ${below100Fr(r)}`;
  return r === 0 ? `${UNITS_FR[c]} cents` : `${UNITS_FR[c]} cent ${below100Fr(r)}`;
}

/** Convertit un montant entier (FCFA) en toutes lettres françaises. */
export function amountToFrenchWords(n: number): string {
  const v = Math.max(0, Math.round(n));
  if (v === 0) return 'zéro';
  const parts: string[] = [];
  const millions = Math.floor(v / 1000000);
  const rest = v % 1000000;
  if (millions > 0) parts.push(millions === 1 ? 'un million' : `${below1000Fr(millions)} millions`);
  const thousands = Math.floor(rest / 1000);
  const rem = rest % 1000;
  if (thousands > 0) {
    if (thousands === 1) {
      parts.push('mille');
    } else {
      // « cent » est invariable devant « mille » : six cent mille (pas de « s »)
      const t = thousands % 100 === 0 && thousands >= 200
        ? `${UNITS_FR[thousands / 100]} cent`
        : below1000Fr(thousands);
      parts.push(`${t} mille`);
    }
  }
  if (rem > 0) parts.push(below1000Fr(rem));
  return parts.join(' ');
}

@Injectable()
export class ContractGenerationService {
  private readonly logger = new Logger(ContractGenerationService.name);

  // ⭐ Cache des logos en base64 (évite de re-fetch à chaque génération)
  private logoCache: { yehiOrTech?: string; academiaHelm?: string } = {};

  /**
   * Fetch une image depuis une URL et la convertit en base64 data URI.
   * Utilisé pour embed les logos dans le PDF HTML (self-contained).
   */
  private async fetchImageAsBase64(url: string): Promise<string | null> {
    return new Promise((resolve) => {
      https.get(url, (res) => {
        if (res.statusCode !== 200) {
          this.logger.warn(`Failed to fetch ${url}: ${res.statusCode}`);
          resolve(null);
          return;
        }
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          const base64 = buffer.toString('base64');
          const ext = url.split('.').pop()?.toLowerCase() || 'webp';
          resolve(`data:image/${ext};base64,${base64}`);
        });
        res.on('error', () => resolve(null));
      }).on('error', () => resolve(null));
    });
  }

  /**
   * Récupère les logos en base64 (avec cache).
   */
  private async getLogos(): Promise<{ yehiOrTech: string; academiaHelm: string }> {
    if (this.logoCache.yehiOrTech && this.logoCache.academiaHelm) {
      return this.logoCache as { yehiOrTech: string; academiaHelm: string };
    }

    const baseUrl = process.env.FRONTEND_URL || 'https://academiahelm.com';
    const [yehi, helm] = await Promise.all([
      this.fetchImageAsBase64(`${baseUrl}/images/logo-yehi-or-tech.webp`),
      this.fetchImageAsBase64(`${baseUrl}/images/logo-Academia Hub.webp`),
    ]);

    this.logoCache = {
      yehiOrTech: yehi || `${baseUrl}/images/logo-yehi-or-tech.webp`,
      academiaHelm: helm || `${baseUrl}/images/logo-Academia Hub.webp`,
    };
    return this.logoCache as { yehiOrTech: string; academiaHelm: string };
  }

  /**
   * Génère le PDF du contrat et retourne l'URL publique.
   */
  async generateContractPdf(data: ContractData): Promise<{ filePath: string; fileName: string; fileUrl: string }> {
    this.logger.log(`Generating contract PDF for school: ${data.schoolName}`);

    const fileName = `contrat-${data.subdomain}-${Date.now()}.html`;
    const contractsDir = path.join(process.cwd(), 'uploads', 'contracts');

    if (!fs.existsSync(contractsDir)) {
      fs.mkdirSync(contractsDir, { recursive: true });
    }

    const filePath = path.join(contractsDir, fileName);

    // ⭐ Récupérer les logos en base64 (self-contained PDF)
    const logos = await this.getLogos();
    const html = this.buildContractHtml(data, logos);

    fs.writeFileSync(filePath, html, 'utf-8');

    const publicUrl = `/api/onboarding/contract/${fileName}`;
    this.logger.log(`Contract generated: ${publicUrl}`);
    return { filePath, fileName, fileUrl: publicUrl };
  }

  /** Formate un montant FCFA avec espaces fines (ex : 550 000). */
  private fmt(n: number): string {
    return Math.round(n).toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' ');
  }

  /** Date FR courte (jj/mm/aaaa) depuis ISO ou « » si absente. */
  private fmtDate(iso?: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  /**
   * Construit le HTML du contrat — structure EXACTE du document Word de
   * référence : page A4 portrait, une colonne, 14 articles en textes
   * intégraux, tableaux (fiche, grille, échéancier), signatures en 2 colonnes.
   */
  private buildContractHtml(
    data: ContractData,
    logos: { yehiOrTech: string; academiaHelm: string },
  ): string {
    const schoolsCount = Math.max(1, data.schoolsCount || 1);
    const annexes = (data.annexes || []).filter((a) => a?.name && String(a.name).trim().length >= 2);
    const bilingualFee = data.bilingual ? (data.bilingualFee ?? 50000) : 0;
    // ⭐ Total cohérent : PAR ÉCOLE (activation + annuel + bilingue) × nombre d'écoles
    const perSchoolTotal = data.activationFee + data.annualFee + bilingualFee;
    const totalYearOne = schoolsCount > 1 ? perSchoolTotal * schoolsCount : perSchoolTotal;

    const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    const contractRef = `CT-AH-${new Date().getFullYear()}-${data.subdomain.toUpperCase().substring(0, 12)}`;
    const isInstallments = data.paymentPlan === 'installments' && !!data.installments && data.installments.length > 0;
    const schedule = (data.installments || []).map((inst, i) => ({
      label: inst.label || (i === 0 ? 'Acompte à la signature' : `Tranche ${i + 1}`),
      amount: Math.max(0, Math.round(Number(inst.amount) || 0)),
      dueDate: inst.dueDate,
    }));
    const scheduleTotal = schedule.reduce((s, t) => s + t.amount, 0);

    // Grille tarifaire : ligne du plan souscrit cochée
    const planRows = PLAN_GRID.map((p) => {
      const selected = p.code === data.planCode;
      return `<tr class="${selected ? 'selected' : ''}">
        <td>${p.name}${selected ? ' <span class="check">☑</span>' : ''}</td>
        <td class="c">${p.range}</td>
        <td class="r">${this.fmt(p.activation)}</td>
        <td class="r">${this.fmt(p.annual)}</td>
        <td class="r">${this.fmt(p.activation + p.annual)}</td>
        <td class="c">${selected ? '<span class="check">☑</span>' : '☐'}</td>
      </tr>`;
    }).join('');

    // ⭐ Détail multi-écoles (Article 3) — une ligne par établissement souscrit
    const multiSchoolRows: string[] = [];
    for (let i = 0; i < schoolsCount; i++) {
      const name = i === 0 ? data.schoolName : (annexes[i - 1]?.name || `${data.schoolName} - Annexe ${i}`);
      const city = i === 0 ? data.schoolCity : (annexes[i - 1]?.city || data.schoolCity);
      multiSchoolRows.push(`<tr>
        <td>${i + 1}</td>
        <td>${this.esc(name)}</td>
        <td>${this.esc(city || '')}</td>
        <td class="r">${this.fmt(data.activationFee)}</td>
        <td class="r">${this.fmt(data.annualFee)}</td>
        <td class="r">${this.fmt(data.activationFee + data.annualFee)}</td>
      </tr>`);
    }
    const multiSchoolTable = schoolsCount > 1 ? `
      <p class="p"><strong>Détail de la souscription multi-écoles</strong> — la présente souscription couvre
      <strong>${schoolsCount} établissements</strong>, chacun disposant de son espace isolé sur la plateforme
      (données, personnels, élèves, frais de scolarité propres) et facturé comme suit :</p>
      <table class="tbl">
        <thead>
          <tr><th>N°</th><th>Établissement</th><th>Ville</th><th class="r">Activation (FCFA)</th><th class="r">Frais annuels (FCFA)</th><th class="r">Année 1 (FCFA)</th></tr>
        </thead>
        <tbody>
          ${multiSchoolRows.join('')}
          ${bilingualFee > 0 ? `<tr><td class="c" colspan="5">Option bilingue FR/EN par établissement</td><td class="r">${this.fmt(bilingualFee)}</td></tr>` : ''}
          <tr class="total-row"><td colspan="5">TOTAL ANNÉE 1 — GROUPE (${schoolsCount} établissements)</td><td class="r">${this.fmt(totalYearOne)}</td></tr>
        </tbody>
      </table>` : '';

    // Échéancier 4.4 (mode tranches)
    const scheduleTable = isInstallments ? `
      <table class="tbl">
        <thead>
          <tr><th>Tranche</th><th>Libellé</th><th class="r">Montant (FCFA)</th><th>Échéance</th><th>Réglé le</th><th>N° de reçu</th><th>Paraphe</th></tr>
        </thead>
        <tbody>
          ${schedule.map((t, i) => `<tr${i === 0 && data.downPaymentReceived ? ' class="selected"' : ''}>
            <td class="c">${i + 1}</td>
            <td>${this.esc(t.label)}</td>
            <td class="r">${this.fmt(t.amount)}</td>
            <td>${t.dueDate ? this.fmtDate(t.dueDate) : 'à la signature'}</td>
            <td>${i === 0 && data.downPaymentReceived ? today : ''}</td>
            <td></td>
            <td></td>
          </tr>`).join('')}
          <tr class="total-row"><td colspan="2">TOTAL À RÉGLER (en chiffres)</td><td class="r">${this.fmt(scheduleTotal)}</td><td colspan="4"></td></tr>
        </tbody>
      </table>` : '';

    // Bloc signatures
    const promoterSig = data.promoterSignatureDataUrl
      ? `<img src="${data.promoterSignatureDataUrl}" class="signature-img" alt="Signature du Client" />`
      : data.signedManually
        ? '<div class="manual-stamp">Déjà signé manuellement<br /><small>(voir exemplaire papier)</small></div>'
        : '<div class="sig-placeholder">&nbsp;</div>';
    const providerSig = data.providerSignatureDataUrl
      ? `<img src="${data.providerSignatureDataUrl}" class="signature-img" alt="Signature du Prestataire" />`
      : data.signedManually
        ? '<div class="manual-stamp">Déjà signé manuellement<br /><small>(voir exemplaire papier)</small></div>'
        : '<div class="sig-placeholder">&nbsp;</div>';

    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Contrat d'abonnement — ${this.esc(data.schoolName)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: A4 portrait; margin: 14mm 12mm; }
    body {
      font-family: 'Georgia', 'Times New Roman', 'Segoe UI', serif;
      font-size: 10.5px;
      line-height: 1.55;
      color: #1a1a2e;
      background: #ffffff;
      max-width: 186mm;
      margin: 0 auto;
      padding: 10mm 8mm;
    }
    .logos { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6mm; }
    .logos img { height: 16mm; width: auto; }
    .doc-title { text-align: center; margin: 4mm 0 2mm; }
    .doc-title h1 { font-size: 15px; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase; line-height: 1.35; color: #0a1d3f; }
    .doc-title .platform { font-size: 10.5px; color: #444; margin-top: 1.5mm; }
    .doc-ref { text-align: center; font-size: 10px; color: #333; margin-bottom: 1.5mm; }
    .doc-ref strong { color: #0a1d3f; }
    .doc-ref-note { text-align: center; font-size: 8.5px; font-style: italic; color: #666; margin-bottom: 5mm; }
    h2.parties {
      font-size: 12px; font-weight: 700; color: #0a1d3f;
      text-transform: uppercase; letter-spacing: 0.4px;
      border-bottom: 1.5pt solid #0a1d3f; padding-bottom: 1mm; margin: 6mm 0 2.5mm;
    }
    h3.article {
      font-size: 11.5px; font-weight: 700; color: #0a1d3f;
      border-bottom: 0.75pt solid #b9c2d0; padding-bottom: 0.8mm; margin: 5mm 0 2mm;
      page-break-after: avoid;
    }
    h4.sub { font-size: 10.5px; font-weight: 700; color: #0a1d3f; margin: 3mm 0 1.2mm; page-break-after: avoid; }
    .p { text-align: justify; margin-bottom: 1.8mm; }
    .p.tight { margin-bottom: 1mm; }
    .note { font-size: 8.5px; font-style: italic; color: #666; margin: 1mm 0 2mm; }
    .tbl { width: 100%; border-collapse: collapse; margin: 2mm 0 3mm; font-size: 9.5px; }
    .tbl th {
      background: #0a1d3f; color: #fff; font-weight: 600;
      border: 0.5pt solid #0a1d3f; padding: 1.6mm 2mm; text-align: left;
    }
    .tbl td { border: 0.5pt solid #8a94a6; padding: 1.5mm 2mm; vertical-align: top; }
    .tbl tr.selected td { background: #eef4ff; font-weight: 600; }
    .tbl tr.total-row td { background: #f5f0e1; font-weight: 700; border-top: 1pt solid #0a1d3f; }
    .tbl .r { text-align: right; }
    .tbl .c { text-align: center; }
    .check { color: #1a7a4a; font-weight: 700; }
    .checkbox-line { margin: 1mm 0; }
    .filled-box { background: #f2f7f2; border: 0.5pt solid #1a7a4a; border-radius: 2mm; padding: 2mm 2.5mm; margin: 1.5mm 0; }
    .signatures { width: 100%; border-collapse: collapse; margin-top: 4mm; }
    .signatures td { width: 50%; border: 0.75pt solid #0a1d3f; padding: 3mm; vertical-align: top; }
    .signatures .who { font-weight: 700; font-size: 10.5px; color: #0a1d3f; margin-bottom: 1.5mm; text-align: center; text-transform: uppercase; letter-spacing: 0.3px; }
    .signatures .field { margin: 1mm 0; font-size: 9.5px; }
    .signatures .field strong { color: #0a1d3f; }
    .sig-placeholder { height: 14mm; border-bottom: 0.5pt dotted #999; margin-top: 6mm; }
    .signature-img { max-height: 14mm; max-width: 60mm; margin-top: 3mm; object-fit: contain; }
    .manual-stamp {
      margin-top: 4mm; padding: 2mm; text-align: center; font-weight: 700;
      color: #8a6d1a; background: #fdf6e3; border: 0.75pt dashed #c9a84c; border-radius: 2mm; font-size: 10px;
    }
    .footer-note { margin-top: 5mm; font-size: 8.5px; color: #666; text-align: center; border-top: 0.5pt solid #ccc; padding-top: 2mm; }
  </style>
</head>
<body>
  <!-- En-tête logos -->
  <div class="logos">
    <img src="${logos.yehiOrTech}" alt="YEHI OR Tech" onerror="this.style.display='none'" />
    <img src="${logos.academiaHelm}" alt="Academia Helm" onerror="this.style.display='none'" />
  </div>

  <div class="doc-title">
    <h1>Contrat d'abonnement<br />et de licence d'utilisation</h1>
    <p class="platform">Plateforme SaaS Academia Helm — Applications Web, Desktop et Mobile</p>
  </div>
  <p class="doc-ref">Référence : <strong>${this.esc(contractRef)}</strong></p>
  <p class="doc-ref-note">(Référence au format de la plateforme : CT-AH-année de signature-sous-domaine de l'établissement (Article 1), en majuscules, douze caractères au plus — exemple : CT-AH-2026-ESPERANCE)</p>

  <h2 class="parties">Entre les soussignés</h2>
  <p class="p">YEHI OR Tech, agence de services numériques (Digital Agency), dont le siège est situé à Parakou, République du Bénin, représentée par M. <strong>AKPOVI TOHOU</strong> Sènakpon Dawes, en sa qualité de Directeur Technique et fondateur, dûment habilité(e) aux fins des présentes,</p>
  <p class="p">ci-après dénommée <strong>« le Prestataire »</strong>, d'une part,</p>
  <p class="p"><strong>${this.esc(data.schoolName)}</strong>, sise ${this.esc(data.schoolCity)}, représentée par M./Mme <strong>${this.esc(data.promoterName)}</strong>, en sa qualité de Promoteur, dûment habilité(e) aux fins des présentes,</p>
  <p class="p">ci-après dénommée <strong>« le Client »</strong>, d'autre part,</p>
  <p class="p">Ci-après désignées ensemble <strong>« les Parties »</strong> et individuellement <strong>« la Partie »</strong>. Il a été convenu ce qui suit :</p>

  <h3 class="article">Article 1 — Fiche de souscription</h3>
  <p class="p">La fiche ci-dessous récapitule les informations déclarées par le Client et acceptées par le Prestataire. Le Client reconnaît l'exactitude des renseignements portés dans la présente fiche, dont dépendent notamment la détermination du plan applicable et la création de l'espace de l'établissement sur la plateforme.</p>
  <table class="tbl">
    <thead>
      <tr><th style="width:34%">Renseignement</th><th>Information déclarée (à compléter par le Client)</th></tr>
    </thead>
    <tbody>
      <tr><td><strong>Établissement</strong></td><td>${this.esc(data.schoolName)}</td></tr>
      ${annexes.length > 0 ? `<tr><td><strong>Écoles annexes (${annexes.length})</strong></td><td>${annexes.map((a) => this.esc(a.name) + (a.city ? ` — ${this.esc(a.city)}` : '')).join(' ; ')}</td></tr>` : ''}
      <tr><td><strong>Nombre d'établissements souscrits</strong></td><td>${schoolsCount}</td></tr>
      <tr><td><strong>Promoteur (nom et prénom)</strong></td><td>${this.esc(data.promoterName)}</td></tr>
      <tr><td><strong>Directeur / Directrice</strong></td><td>${this.esc(data.directorName || data.promoterName)}</td></tr>
      <tr><td><strong>Adresse complète</strong></td><td>${this.esc(data.schoolAddress || data.schoolCity)}</td></tr>
      <tr><td><strong>Ville</strong></td><td>${this.esc(data.schoolCity)}</td></tr>
      <tr><td><strong>Téléphone</strong></td><td>${this.esc(data.schoolPhone)}</td></tr>
      <tr><td><strong>Adresse électronique (e-mail)</strong></td><td>${this.esc(data.schoolEmail)}</td></tr>
      <tr><td><strong>Effectif estimé (nombre d'élèves)</strong></td><td>${data.studentCount}</td></tr>
      <tr><td><strong>Plan choisi (cocher une seule case)</strong></td><td>☐ Helm Essentiel ☐ Helm Croissance ☐ Helm Performance ☐ Helm Institution — <strong>${this.esc(data.planName)}</strong></td></tr>
      <tr><td><strong>Option bilingue FR/EN (cocher)</strong></td><td>${data.bilingual ? '<span class="check">☑ Oui</span> ☐ Non' : '☐ Oui <span class="check">☑ Non</span>'}</td></tr>
      <tr><td><strong>Sous-domaine souhaité</strong></td><td>${this.esc(data.subdomain)}.academiahelm.com</td></tr>
      <tr><td><strong>Date d'effet souhaitée</strong></td><td>${this.esc(data.effectiveDate || today)}</td></tr>
    </tbody>
  </table>

  <h3 class="article">Article 2 — Objet du contrat</h3>
  <p class="p">Le Prestataire concède au Client, dans les conditions du présent contrat, un droit d'usage non exclusif, non cessible et à titre onéreux de la plateforme Academia Helm (applications Web, Desktop et Mobile). Le présent contrat couvre notamment : l'hébergement de la plateforme, la maintenance corrective et évolutive, le support technique, l'accompagnement à la prise en main (onboarding), la formation initiale des utilisateurs, ainsi que l'accès aux agents d'intelligence artificielle (ORION, SARA, ATLAS) dans le cadre d'un usage raisonnable et professionnel (ces agents IA ne sont pas encore déployés). Les fonctionnalités accessibles au Client varient selon le plan souscrit, tel que défini à l'Article 3.</p>

  <h3 class="article">Article 3 — Plan souscrit et grille tarifaire</h3>
  <p class="p">Le Client souscrit l'un des plans ci-dessous en cochant, dans la colonne « Votre choix », le plan qui correspond à l'effectif déclaré à l'Article 1. Les montants s'entendent en francs CFA (FCFA), toutes taxes comprises.</p>
  <table class="tbl">
    <thead>
      <tr><th>Plan</th><th class="c">Capacité (élèves)</th><th class="r">Activation (FCFA)</th><th class="r">Frais annuels (FCFA)</th><th class="r">Total Année 1 (FCFA)</th><th class="c">Votre choix</th></tr>
    </thead>
    <tbody>${planRows}</tbody>
  </table>
  <p class="p checkbox-line">${data.bilingual ? '<span class="check">☑</span>' : '☐'} Option bilingue FR/EN souscrite — supplément de <strong>${this.fmt(bilingualFee)} (${this.esc(amountToFrenchWords(bilingualFee))}) FCFA par an</strong>, à facturation annuelle${schoolsCount > 1 ? `, par établissement (${schoolsCount} établissements → ${this.fmt(bilingualFee * schoolsCount)} FCFA/an)` : ''}.</p>
  <p class="p checkbox-line">${data.bilingual ? '☐' : '<span class="check">☑</span>'} Option bilingue non souscrite.</p>
  ${multiSchoolTable}
  <p class="p"><strong>Coût total Année 1, option bilingue incluse le cas échéant :</strong> <strong>${this.fmt(totalYearOne)} (${this.esc(amountToFrenchWords(totalYearOne))}) FCFA</strong>${schoolsCount > 1 ? ` — soit ${this.fmt(perSchoolTotal)} FCFA par établissement × ${schoolsCount} établissements` : ''}.</p>

  <h3 class="article">Article 4 — Prix et modalités de paiement</h3>
  <h4 class="sub">4.1 — Conditions générales de prix</h4>
  <p class="p">Le Client verse au Prestataire : d'une part, des frais d'activation uniques de 500 000 (cinq cent mille) FCFA${schoolsCount > 1 ? ' <strong>par établissement souscrit</strong>' : ''}, dus intégralement à la signature du présent contrat ; d'autre part, des frais annuels d'abonnement conformes au plan souscrit à l'Article 3, payables d'avance à chaque date d'échéance annuelle. Le règlement s'effectue en espèces contre reçu établi par le Prestataire, modalité de référence du présent contrat, ou, le cas échéant, par virement bancaire ou Mobile Money. Le service de messagerie Helm Connect est inclus gratuitement et sans limitation. Ce service de messagerie est à l'instar de WhatsApp, mais sans dépendance à WhatsApp. Le service e-mail est également gratuit.</p>
  <h4 class="sub">4.2 — Modalité de règlement retenue (cocher une seule case)</h4>
  <p class="p checkbox-line">${!isInstallments ? '<span class="check">☑</span>' : '☐'} Paiement intégral en espèces : la totalité de la souscription (frais d'activation, frais annuels et, le cas échéant, frais de l'option bilingue de la première année) est réglée à la signature du présent contrat — la section 4.3 est complétée.</p>
  <p class="p checkbox-line">${isInstallments ? '<span class="check">☑</span>' : '☐'} Paiement échelonné par tranches : la souscription est réglée selon l'échéancier accepté par le Prestataire — la section 4.4 est complétée, datée et émargée.</p>

  <h4 class="sub">4.3 — Paiement intégral en espèces (certification d'encaissement)</h4>
  <div class="filled-box">
    <p class="p tight">La présente section certifie l'encaissement des sommes réglées en espèces par le Client ; elle est complétée et signée par le Prestataire :</p>
    <p class="p tight checkbox-line">${!isInstallments && data.subscriptionPaid ? '<span class="check">☑</span>' : '☐'} La souscription — frais d'activation de 500 000 FCFA${schoolsCount > 1 ? ` × ${schoolsCount} établissements` : ''} et frais annuels du plan souscrit — a été intégralement réglée en espèces.</p>
    <p class="p tight checkbox-line">${data.bilingual && !isInstallments && data.bilingualPaid ? '<span class="check">☑</span>' : '☐'} Option bilingue FR/EN souscrite : les frais de la première année, à facturation annuelle, ont été réglés en espèces.</p>
    <p class="p tight">Encaissé par (nom et prénom de l'agent YEHI OR Tech) : <strong>${this.esc(data.receivedBy || '_________________________________')}</strong></p>
    <p class="p tight">N° du ou des reçus : ____________________ — Date(s) de règlement : ${!isInstallments && data.subscriptionPaid ? this.esc(today) : '____ / ____ / ________'}</p>
  </div>

  <h4 class="sub">4.4 — Paiement échelonné par tranches</h4>
  <p class="p">En cas d'accord exprès du Prestataire, le Client peut régler la souscription par tranches, selon l'échéancier ci-dessous. Un acompte est versé à la signature du présent contrat et le solde est intégralement réglé au plus tard le ____ / ____ / ________ (date limite convenue entre les Parties). Chaque règlement donne lieu à l'établissement d'un reçu, dont le numéro est reporté dans l'échéancier, et à l'émargement (paraphe) du représentant du Prestataire.</p>
  ${scheduleTable || `
  <table class="tbl">
    <thead>
      <tr><th>Tranche</th><th>Libellé</th><th class="r">Montant (FCFA)</th><th>Échéance</th><th>Réglé le</th><th>N° de reçu</th><th>Paraphe</th></tr>
    </thead>
    <tbody>
      <tr><td class="c">1</td><td>Acompte à la signature</td><td></td><td></td><td></td><td></td><td></td></tr>
      <tr><td class="c">2</td><td>Tranche 2</td><td></td><td></td><td></td><td></td><td></td></tr>
      <tr><td class="c">3</td><td>Tranche 3</td><td></td><td></td><td></td><td></td><td></td></tr>
      <tr><td class="c">4</td><td>Solde</td><td></td><td></td><td></td><td></td><td></td></tr>
      <tr class="total-row"><td colspan="2">TOTAL À RÉGLER (en chiffres)</td><td class="r"></td><td colspan="4"></td></tr>
    </tbody>
  </table>`}
  <p class="note">Émargement : paraphe apposé par le représentant du Prestataire lors de chaque encaissement. L'échéancier complété fait partie intégrante du présent contrat au sens de l'Article 14.</p>
  <p class="p">À défaut de règlement intégral du solde à la date limite convenue, et après mise en demeure demeurée sans effet pendant trente (30) jours, le Prestataire peut suspendre l'accès à la plateforme, puis engager la résiliation dans les conditions de l'Article 10, sans préjudice du recouvrement des sommes restant dues. Les tranches déjà réglées demeurent acquises au Prestataire au titre de la couverture des coûts d'activation et d'exploitation du service.</p>

  <h3 class="article">Article 5 — Durée et reconduction</h3>
  <p class="p">Le présent contrat est conclu pour une durée initiale d'un (1) an à compter de la date d'effet mentionnée à l'Article 1. Il se renouvelle par tacite reconduction pour des périodes successives d'un (1) an, sauf dénonciation par l'une des Parties, notifiée par écrit au moins soixante (60) jours avant la date d'échéance annuelle. Le Prestataire se réserve le droit de réviser la grille tarifaire pour les périodes de reconduction futures, sous réserve d'en informer le Client au moins soixante (60) jours avant l'échéance concernée ; le maintien de l'abonnement au-delà de cette échéance vaut acceptation de la nouvelle grille.</p>

  <h3 class="article">Article 6 — Obligations du Prestataire</h3>
  <p class="p">Le Prestataire s'engage à : (i) assurer la disponibilité, l'hébergement et la maintenance corrective et évolutive de la plateforme ; (ii) fournir un support technique dans des délais raisonnables ; (iii) assurer l'accompagnement à la prise en main (onboarding) et la formation initiale des utilisateurs du Client ; (iv) mettre en œuvre des mesures techniques et organisationnelles raisonnables afin de garantir la sécurité et la confidentialité des données du Client ; (v) informer le Client en cas d'évolution substantielle de la plateforme ; et (vi) encadrer l'usage des agents d'intelligence artificielle (ORION, SARA, ATLAS) dans la limite d'un usage raisonnable et professionnel.</p>

  <h3 class="article">Article 7 — Obligations du Client</h3>
  <p class="p">Le Client s'engage à : (i) régler les sommes dues aux échéances convenues, conformément à l'Article 4 ; (ii) fournir des informations exactes, complètes et à jour, notamment celles figurant à l'Article 1 ; (iii) faire un usage de la plateforme conforme à sa destination ; (iv) préserver la confidentialité des identifiants de connexion mis à sa disposition et en garantir la maîtrise ; et (v) respecter la législation béninoise applicable, notamment en matière de protection des données à caractère personnel.</p>

  <h3 class="article">Article 8 — Propriété intellectuelle</h3>
  <p class="p">La plateforme Academia Helm, y compris ses logiciels, bases de données, structures, modèles et documentations associées, demeure la propriété exclusive du Prestataire. Le présent contrat confère au Client un droit d'usage personnel, non exclusif et non transférable, limité à la durée du contrat. Les données saisies par le Client demeurent sa propriété exclusive ; le Prestataire s'engage à en permettre l'export à tout moment et, au plus tard, dans les conditions fixées à l'Article 10.</p>

  <h3 class="article">Article 9 — Protection des données et confidentialité</h3>
  <p class="p">Chaque Partie s'engage à mettre en œuvre des mesures techniques et organisationnelles raisonnables pour assurer la sécurité et la confidentialité des données traitées dans le cadre du présent contrat. Les Parties s'obligent réciproquement à un devoir de confidentialité sur les informations non publiques échangées, pendant toute la durée du contrat et pendant deux (2) ans après son expiration ou sa résiliation.</p>

  <h3 class="article">Article 10 — Résiliation</h3>
  <p class="p">En cas de manquement grave de l'une des Parties à ses obligations, l'autre Partie peut résilier le contrat de plein droit après mise en demeure par écrit demeurée sans effet pendant trente (30) jours. Le non-paiement persistant des sommes dues au-delà de quarante-cinq (45) jours à compter de leur échéance entraîne la résiliation de plein droit du contrat, sans autre formalité. En cas de résiliation, quelle qu'en soit la cause, le Client dispose d'un délai de trente (30) jours pour procéder à l'export de ses données ; le Prestataire apporte son assistance technique à cette fin.</p>

  <h3 class="article">Article 11 — Responsabilité et garanties</h3>
  <p class="p">La responsabilité du Prestataire, toutes causes confondues, est limitée au montant total des sommes effectivement perçues au titre du contrat au cours des douze (12) derniers mois précédant la survenance du fait générateur. L'architecture offline-first de la plateforme vise à limiter les pertes de données en cas d'indisponibilité de la connexion ; cette architecture ne constitue toutefois pas une garantie absolue contre toute perte de données. Le Client demeure seul responsable de la saisie, de l'exactitude et de la sauvegarde de ses données.</p>

  <h3 class="article">Article 12 — Force majeure</h3>
  <p class="p">Aucune des Parties n'est tenue responsable d'une inexécution ou d'un retard d'exécution de ses obligations dû à un cas de force majeure tel que défini par la législation et la jurisprudence béninoises. La Partie affectée en informe l'autre par écrit dans un délai raisonnable ; les Parties conviennent alors des modalités de continuation du contrat. À défaut d'accord, le contrat peut être résilié sans indemnité.</p>

  <h3 class="article">Article 13 — Droit applicable et juridiction</h3>
  <p class="p">Le présent contrat est régi par le droit de la République du Bénin. En cas de différend relatif à sa formation, son interprétation, son exécution ou sa résiliation, les Parties s'efforcent de le résoudre à l'amiable dans un délai de trente (30) jours à compter de la notification écrite du différend. À défaut d'accord amiable, compétence est expressément attribuée aux juridictions de Parakou, nonobstant pluralité de défendeurs ou appel en garantie.</p>

  <h3 class="article">Article 14 — Dispositions diverses</h3>
  <p class="p">Le présent contrat et ses éventuels avenants expriment l'intégralité de l'accord des Parties sur son objet et se substituent à toute correspondance, proposition ou document antérieur. Toute modification doit faire l'objet d'un avenant écrit, daté et signé des deux Parties. Si l'une quelconque des stipulations du présent contrat était déclarée nulle ou inapplicable, les autres stipulations conserveraient toute leur force et leur portée. L'échéancier de paiement par tranches éventuellement complété en application de l'Article 4 fait partie intégrante du présent contrat.</p>

  <h2 class="parties">Signatures</h2>
  <p class="p">Fait à _________________, le ____ / ____ / ________, en deux (2) exemplaires originaux, dont un pour chaque Partie.</p>
  <table class="signatures">
    <tr>
      <td>
        <div class="who">Le Client</div>
        <p class="field"><strong>Établissement :</strong> ${this.esc(data.schoolName)}</p>
        <p class="field"><strong>Représenté par :</strong> M./Mme ${this.esc(data.promoterName)}</p>
        <p class="field"><strong>Qualité :</strong> Promoteur</p>
        <p class="field">Signature, précédée de la mention manuscrite <strong>« Lu et approuvé »</strong> :</p>
        ${promoterSig}
        <p class="field" style="margin-top:2mm"><strong>Cachet de l'établissement :</strong></p>
      </td>
      <td>
        <div class="who">Le Prestataire</div>
        <p class="field"><strong>Dénomination :</strong> YEHI OR Tech</p>
        <p class="field"><strong>Siège :</strong> Parakou, République du Bénin</p>
        <p class="field"><strong>Représenté par :</strong> M./Mme AKPOVI TOHOU S. D.</p>
        <p class="field"><strong>Qualité :</strong> Directeur Technique et fondateur</p>
        <p class="field">Signature et cachet de la société :</p>
        ${providerSig}
      </td>
    </tr>
  </table>

  <p class="footer-note">YEHI OR Tech — Academia Helm · support@academiahelm.com · www.academiahelm.com · Parakou, République du Bénin</p>
</body>
</html>`;
  }

  /** Échappe le HTML pour les valeurs dynamiques. */
  private esc(value: string): string {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
