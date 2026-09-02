/**
 * ============================================================================
 * CONTRACT GENERATION SERVICE — Génération PDF du contrat d'abonnement
 * ============================================================================
 *
 * Génère un PDF professionnel du contrat d'abonnement Academia Helm avec :
 * - Logos YEHI OR Tech + Academia Helm (embed en base64 dans le HTML)
 * - 14 articles du contrat (extrait du document Contrat_Abonnement_Academia_Helm.docx)
 * - Champs dynamiques (école, promoteur, plan, dates)
 * - Blocs de signature (Prestataire + Client)
 * - Signature électronique intégrée (canvas → PNG → embed dans le PDF)
 *
 * Le PDF est stocké dans uploads/contracts/ et l'URL est retournée pour
 * téléchargement et envoi par email.
 *
 * ⭐ Le design du PDF est IDENTIQUE à celui affiché dans l'interface ContractStep.tsx
 *    (mêmes logos, mêmes couleurs, même structure 2 colonnes).
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

  // Pricing
  activationFee: number;
  annualFee: number;
  totalYearOne: number;
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

  /**
   * Construit le HTML du contrat avec tous les articles.
   * Le design correspond à celui de ContractStep.tsx (interface React).
   */
  private buildContractHtml(
    data: ContractData,
    logos: { yehiOrTech: string; academiaHelm: string },
  ): string {
    const planTable = this.getPlanTable(data.planCode);
    const dateStr = new Date().toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'long', year: 'numeric',
    });

    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Contrat d'abonnement — ${data.schoolName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', 'Inter', 'Helvetica Neue', Arial, sans-serif;
      font-size: 10px;
      line-height: 1.45;
      color: #1f2937;
      background: #ffffff;
      max-width: 210mm;
      margin: 0 auto;
      padding: 8mm 6mm;
    }
    .header {
      background: linear-gradient(90deg, #0a1d3f 0%, #0b2f73 50%, #0a1d3f 100%);
      color: #ffffff;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      border-radius: 6px 6px 0 0;
    }
    .header .brand {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .header .logo-box {
      background: rgba(255, 255, 255, 0.95);
      padding: 4px;
      border-radius: 4px;
      width: 50px;
      height: 50px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .header .logo-box img { max-width: 100%; max-height: 100%; }
    .header .brand-text { line-height: 1.1; }
    .header .brand-text .name { font-size: 12px; font-weight: 700; }
    .header .brand-text .name .gold { color: #f5b335; }
    .header .brand-text .tagline { font-size: 9px; color: #bfdbfe; }
    .header .title-block { text-align: center; flex: 1; }
    .header .title-block h1 {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .header .title-block .ref { font-size: 9px; color: #bfdbfe; margin-top: 2px; }

    .body {
      padding: 12px 16px;
      display: grid;
      grid-template-columns: 5fr 7fr;
      gap: 12px;
    }
    h2.article {
      font-size: 10px;
      color: #0a1d3f;
      margin-top: 8px;
      margin-bottom: 4px;
      border-bottom: 1px solid #d1d5db;
      padding-bottom: 2px;
      font-weight: 700;
    }
    h2.article:first-child { margin-top: 0; }
    p { margin-bottom: 4px; text-align: justify; }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2px 8px;
      font-size: 10px;
    }
    .meta-grid .label { color: #6b7280; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 4px 0;
      font-size: 9px;
    }
    th, td {
      border: 1px solid #d1d5db;
      padding: 3px 5px;
      text-align: left;
    }
    th {
      background: #0a1d3f;
      color: #ffffff;
      font-weight: 700;
    }
    tr.selected { background: #eff6ff; font-weight: 700; }
    .signature-section {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 4px;
      padding: 8px;
      margin-top: auto;
    }
    .signature-section h3 {
      font-size: 10px;
      color: #0a1d3f;
      margin-bottom: 6px;
      font-weight: 700;
    }
    .signature-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .signature-box {
      border: 1px dashed #9ca3af;
      border-radius: 4px;
      padding: 6px;
      min-height: 90px;
      background: #ffffff;
    }
    .signature-box .label {
      font-size: 9px;
      color: #4b5563;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .signature-box img {
      max-width: 100%;
      max-height: 70px;
      display: block;
      margin: 4px 0;
    }
    .signature-box .date {
      font-size: 8px;
      color: #9ca3af;
      margin-top: 4px;
    }
    .sign-placeholder {
      font-size: 9px;
      color: #9ca3af;
      text-align: center;
      padding: 20px 0;
    }
    .footer {
      background: #0a1d3f;
      color: #bfdbfe;
      padding: 5px 16px;
      text-align: center;
      font-size: 9px;
      border-radius: 0 0 6px 6px;
      border-top: 1px solid rgba(245, 179, 53, 0.2);
    }
    .col-left, .col-right {
      display: flex;
      flex-direction: column;
    }
    .col-right { gap: 6px; }
    .highlight-box {
      background: #ecfdf5;
      border: 1px solid #6ee7b7;
      border-radius: 4px;
      padding: 4px 8px;
      margin-top: 4px;
      font-size: 10px;
      font-weight: 700;
      color: #047857;
    }
    .bilingual-note {
      font-size: 9px;
      color: #b45309;
      margin-top: 2px;
    }
    .payment-box {
      background: #f0fdf4;
      border: 1px solid #86efac;
      border-radius: 4px;
      padding: 4px 8px;
      margin-top: 4px;
      font-size: 9.5px;
    }
    .payment-box p { margin-bottom: 2px; text-align: left; }
    @media print {
      body { padding: 0; }
      .signature-section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>

<div class="header">
  <div class="brand">
    <div class="logo-box">
      <img src="${logos.yehiOrTech}" alt="YEHI OR Tech" />
    </div>
    <div class="brand-text">
      <div class="name">YEHI OR <span class="gold">Tech</span></div>
      <div class="tagline">Digital Agency · Parakou</div>
    </div>
  </div>

  <div class="title-block">
    <h1>Contrat d'abonnement et de licence d'utilisation</h1>
    <div class="ref">Plateforme SaaS Academia Helm · Réf. CT-AH-2026-${data.subdomain.toUpperCase().substring(0, 12)}</div>
  </div>

  <div class="brand">
    <div class="brand-text" style="text-align: right;">
      <div class="name">Academia <span class="gold">Helm</span></div>
      <div class="tagline">School Management</div>
    </div>
    <div class="logo-box">
      <img src="${logos.academiaHelm}" alt="Academia Helm" />
    </div>
  </div>
</div>

<div class="body">
  <!-- ═══════════════ COLONNE GAUCHE — Articles 1 à 7 ═══════════════ -->
  <div class="col-left">
    <h2 class="article">Entre les soussignés</h2>
    <p><strong>YEHI OR Tech</strong>, éditrice de la plateforme SaaS Academia Helm, sise à Parakou, République du Bénin, représentée par son Directeur Technique et Co-fondateur, ci-après « <strong>le Prestataire</strong> ».</p>
    <p><strong>${data.schoolName}</strong>, représentée par son promoteur <strong>${data.promoterName}</strong>, ci-après « <strong>le Client</strong> ».</p>

    <h2 class="article">Article 1 — Fiche de souscription</h2>
    <div class="meta-grid">
      <div><span class="label">École :</span> <strong>${data.schoolName}</strong></div>
      <div><span class="label">Promoteur :</span> <strong>${data.promoterName}</strong></div>
      <div><span class="label">Ville :</span> ${data.schoolCity}</div>
      <div><span class="label">Tél :</span> ${data.schoolPhone}</div>
      <div><span class="label">Email :</span> ${data.schoolEmail}</div>
      <div><span class="label">Élèves :</span> <strong>${data.studentCount}</strong></div>
      <div><span class="label">Plan :</span> <strong>${data.planName}</strong></div>
      <div><span class="label">Bilingue :</span> ${data.bilingual ? 'Oui' : 'Non'}</div>
      <div style="grid-column: 1 / -1;"><span class="label">Sous-domaine :</span> ${data.subdomain}.academiahelm.com</div>
      <div style="grid-column: 1 / -1;"><span class="label">Date d'effet :</span> ${data.effectiveDate}</div>
    </div>

    <h2 class="article">Article 2 — Objet du contrat</h2>
    <p>Concession d'un droit d'usage non exclusif, non cessible et à titre onéreux de la plateforme Academia Helm (Web, Desktop, Mobile), hébergement, maintenance corrective et évolutive, support technique, onboarding, formation, et accès aux agents d'intelligence artificielle (ORION, SARA, ATLAS) dans le cadre d'un usage raisonnable et professionnel.</p>

    <h2 class="article">Article 3 — Plan souscrit et grille tarifaire</h2>
    <table>
      <thead>
        <tr>
          <th>Plan</th>
          <th>Élèves</th>
          <th style="text-align: right;">Activation (FCFA)</th>
          <th style="text-align: right;">Annuel (FCFA)</th>
          <th style="text-align: right;">Total An 1 (FCFA)</th>
        </tr>
      </thead>
      <tbody>
        ${planTable}
      </tbody>
    </table>
    ${data.bilingual ? '<p class="bilingual-note">Option bilingue FR/EN : <strong>50 000 FCFA/an</strong> (en supplément du plan)</p>' : ''}
    <div class="highlight-box">Coût total Année 1 : ${data.totalYearOne.toLocaleString('fr-FR')} FCFA</div>

    <h2 class="article">Article 4 — Prix et modalités de paiement</h2>
    <p>Frais d'activation de <strong>300 000 FCFA</strong> dus à la signature. Frais annuels de <strong>${data.annualFee.toLocaleString('fr-FR')} FCFA</strong> dus chaque année à la <strong>date d'échéance annuelle</strong>. Réglement par virement bancaire, Mobile Money (FedaPay) ou espèces contre reçu. WhatsApp inclus gratuitement et illimité. SMS, Email et Voice facturés au prix coûtant selon la consommation réelle.</p>
    ${this.buildPaymentBoxHtml(data)}

    <h2 class="article">Article 5 — Durée et reconduction</h2>
    <p>Durée initiale d'un (1) an à compter de la date d'effet. Renouvelable par tacite reconduction pour des périodes successives d'un (1) an, sauf dénonciation par écrit au moins 60 jours avant la <strong>date d'échéance annuelle</strong>. Le Prestataire se réserve le droit de réviser la grille tarifaire pour les périodes de reconduction futures, sous réserve d'en informer le Client au moins 60 jours avant l'échéance.</p>

    <h2 class="article">Article 6 — Obligations du Prestataire</h2>
    <p>Disponibilité et maintenance de la plateforme, support technique, onboarding et formation initiale, confidentialité et sécurité des données, information en cas d'évolution substantielle. Usage des agents IA dans le cadre d'un usage raisonnable et professionnel.</p>

    <h2 class="article">Article 7 — Obligations du Client</h2>
    <p>Paiement des sommes dues aux échéances, informations exactes et à jour, usage conforme à la destination, confidentialité des identifiants de connexion, respect de la législation béninoise applicable à la protection des données personnelles.</p>
  </div>

  <!-- ═══════════════ COLONNE DROITE — Articles 8 à 14 + Signatures ═══════════════ -->
  <div class="col-right">
    <div>
      <h2 class="article">Article 8 — Propriété intellectuelle</h2>
      <p>La plateforme Academia Helm demeure la propriété exclusive du Prestataire. Le présent Contrat confère au Client un droit d'usage personnel, non exclusif et non transférable. Les données saisies par le Client demeurent sa propriété exclusive ; le Prestataire s'engage à en permettre l'export à tout moment.</p>
    </div>

    <div>
      <h2 class="article">Article 9 — Protection des données et confidentialité</h2>
      <p>Mesures techniques et organisationnelles raisonnables pour assurer la sécurité et la confidentialité des données. Confidentialité réciproque pendant 2 ans post-contractuelles.</p>
    </div>

    <div>
      <h2 class="article">Article 10 — Résiliation</h2>
      <p>Résiliation pour manquement grave après mise en demeure infructueuse (30 jours). Non-paiement persistant au-delà de 45 jours → résiliation de plein droit. Export des données sous 30 jours après résiliation.</p>
    </div>

    <div>
      <h2 class="article">Article 11 — Responsabilité et garanties</h2>
      <p>Responsabilité du Prestataire limitée aux sommes perçues sur les 12 derniers mois. L'architecture offline-first vise à limiter les pertes de données sans garantie absolue.</p>
    </div>

    <div>
      <h2 class="article">Article 12 — Force majeure</h2>
      <p>Aucune des Parties n'est responsable d'une non-exécution due à un cas de force majeure tel que défini par la jurisprudence béninoise.</p>
    </div>

    <div>
      <h2 class="article">Article 13 — Droit applicable et juridiction</h2>
      <p>Droit de la République du Bénin. Résolution amiable préalable (30 jours). À défaut, compétence des juridictions de Parakou.</p>
    </div>

    <div>
      <h2 class="article">Article 14 — Dispositions diverses</h2>
      <p>Le présent Contrat constitue l'intégralité de l'accord entre les Parties. Toute modification doit faire l'objet d'un avenant écrit signé des deux Parties.</p>
    </div>

    <!-- ── Section signatures ── -->
    <div class="signature-section">
      <h3>✍️ Signatures électroniques</h3>
      <div class="signature-grid">
        <div class="signature-box">
          <div class="label">Pour le Client — ${data.promoterName} (Promoteur)</div>
          ${data.promoterSignatureDataUrl
            ? `<img src="${data.promoterSignatureDataUrl}" alt="Signature promoteur" />`
            : '<div class="sign-placeholder">Signature du promoteur</div>'
          }
          <div class="date">Date : ${data.promoterSignedAt ? new Date(data.promoterSignedAt).toLocaleDateString('fr-FR') : dateStr}</div>
        </div>
        <div class="signature-box">
          <div class="label">Pour le Prestataire — YEHI OR Tech</div>
          ${data.providerSignatureDataUrl
            ? `<img src="${data.providerSignatureDataUrl}" alt="Signature prestataire" />`
            : '<div class="sign-placeholder">Signature du représentant YEHI OR Tech</div>'
          }
          <div class="date">Date : ${data.providerSignedAt ? new Date(data.providerSignedAt).toLocaleDateString('fr-FR') : '____ / ____ / ________'}</div>
        </div>
      </div>
      <p style="text-align: center; font-size: 9px; color: #6b7280; margin-top: 6px;">
        Fait à Parakou, le ${dateStr}, en deux (2) exemplaires originaux.
      </p>
    </div>
  </div>
</div>

<div class="footer">
  YEHI OR Tech — Academia Helm · support@academiahelm.com · www.academiahelm.com · Parakou, République du Bénin
</div>

</body>
</html>`;
  }

  /**
   * Bloc « modalité retenue » de l'Article 4 :
   * - paiement intégral en espèces (paymentPlan absent ou 'full') ;
   * - paiement échelonné par tranches ('installments') avec échéancier.
   */
  private buildPaymentBoxHtml(data: ContractData): string {
    if (data.paymentMethod !== 'cash') {
      return '';
    }

    const esc = (s: string) => String(s ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const fmtDate = (iso?: string) => {
      if (!iso) return '';
      const d = new Date(iso);
      if (isNaN(d.getTime())) return esc(iso);
      return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    if (data.paymentPlan === 'installments' && data.installments && data.installments.length > 0) {
      const rows = data.installments
        .map((inst, i) => {
          const due = i === 0 && !inst.dueDate ? 'À la signature' : fmtDate(inst.dueDate);
          return `<tr>
            <td>${i + 1}</td>
            <td>${esc(inst.label || (i === 0 ? 'Acompte' : `Tranche ${i + 1}`))}</td>
            <td>${due}</td>
            <td style="text-align: right;">${Number(inst.amount || 0).toLocaleString('fr-FR')}</td>
          </tr>`;
        })
        .join('\n');
      const total = data.installments.reduce((sum, inst) => sum + Number(inst.amount || 0), 0);

      return `
    <div class="payment-box">
      <p><strong>Modalité retenue pour la présente souscription : paiement en espèces par tranches.</strong></p>
      <p>Souscription (frais d'activation + frais annuels du plan ${esc(data.planName)}${data.bilingual ? ' + option bilingue FR/EN (annuelle)' : ''}) réglée en <strong>${data.installments.length} tranche(s)</strong>${data.receivedBy ? `, encaissées et suivies par ${esc(data.receivedBy)} pour YEHI OR Tech` : ''}, selon l'échéancier ci-dessous :</p>
      <table>
        <thead>
          <tr>
            <th>N°</th>
            <th>Libellé</th>
            <th>Échéance</th>
            <th style="text-align: right;">Montant (FCFA)</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
          <tr style="background: #f0fdf4; font-weight: 700;">
            <td colspan="3" style="text-align: right;">TOTAL ANNÉE 1</td>
            <td style="text-align: right;">${total.toLocaleString('fr-FR')}</td>
          </tr>
        </tbody>
      </table>
      <p>Acompte (tranche n° 1) : <strong>${data.downPaymentReceived !== false ? 'encaissé en espèces à la signature' : 'à encaisser à la signature'}</strong>${data.receivedBy ? `, par ${esc(data.receivedBy)}` : ''}. Chaque règlement donne lieu à un reçu établi par le Prestataire.</p>
      <p>À défaut de règlement d'une tranche à son échéance, et après mise en demeure demeurée sans effet pendant trente (30) jours, le Prestataire peut suspendre l'accès à la plateforme puis engager la résiliation dans les conditions de l'Article 10, sans préjudice du recouvrement des sommes restant dues. Les sommes déjà réglées demeurent acquises au Prestataire.</p>
    </div>`;
    }

    return `
    <div class="payment-box">
      <p><strong>Modalité retenue pour la présente souscription : paiement en espèces.</strong></p>
      <p>Souscription (frais d'activation + frais annuels du plan ${esc(data.planName)}) : <strong>${data.subscriptionPaid ? 'réglée en espèces à la signature' : 'à régler'}</strong>${data.receivedBy ? `, encaissée par ${esc(data.receivedBy)} pour YEHI OR Tech` : ''}.</p>
      ${data.bilingual ? `<p>Option bilingue FR/EN : <strong>${(data.bilingualFee ?? 50000).toLocaleString('fr-FR')} FCFA/an</strong>, facturation <strong>annuelle</strong> — ${data.bilingualPaid ? 'frais de la première année réglés en espèces' : 'à régler'}.</p>` : ''}
    </div>`;
  }

  /**
   * Génère le tableau des plans avec le plan sélectionné mis en évidence.
   */
  private getPlanTable(selectedPlanCode: string): string {
    const plans = [
      { code: 'SEED', name: 'Helm Essentiel', range: '1 à 50', activation: '300 000', annual: '50 000', total: '350 000' },
      { code: 'GROW', name: 'Helm Croissance', range: '51 à 150', activation: '300 000', annual: '75 000', total: '375 000' },
      { code: 'LEAD', name: 'Helm Performance', range: '151 à 400', activation: '300 000', annual: '100 000', total: '400 000' },
      { code: 'NETWORK', name: 'Helm Institution', range: '401 et +', activation: '300 000', annual: '150 000', total: '450 000' },
    ];

    return plans.map(p => {
      const isSelected = p.code === selectedPlanCode;
      return `<tr class="${isSelected ? 'selected' : ''}">
        <td>${p.name}${isSelected ? ' <span style="color:#059669;">☑</span>' : ''}</td>
        <td>${p.range}</td>
        <td style="text-align: right;">${p.activation}</td>
        <td style="text-align: right;">${p.annual}</td>
        <td style="text-align: right;">${p.total}</td>
      </tr>`;
    }).join('\n');
  }
}
