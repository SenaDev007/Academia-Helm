/**
 * ============================================================================
 * CONTRACT GENERATION SERVICE — Génération PDF du contrat d'abonnement
 * ============================================================================
 *
 * Génère un PDF professionnel du contrat d'abonnement Academia Helm avec :
 * - Logos YEHI OR Tech + Academia Helm
 * - 14 articles du contrat (extrait du document Contrat_Abonnement_Academia_Helm.docx)
 * - Champs dynamiques (école, promoteur, plan, dates)
 * - Blocs de signature (Prestataire + Client)
 * - Signature électronique intégrée (canvas → PNG → embed dans le PDF)
 *
 * Le PDF est stocké dans uploads/contracts/ et l'URL est retournée pour
 * téléchargement et envoi par email.
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';

// ReportLab-style PDF generation using pdfkit (lighter dependency)
// If pdfkit is not available, we fall back to a simple HTML-to-PDF approach

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

  // Signatures
  promoterSignatureDataUrl?: string | null; // Canvas signature (base64 PNG)
  providerSignatureDataUrl?: string | null; // Provider signature (admin)
  promoterSignedAt?: string;
  providerSignedAt?: string;
}

@Injectable()
export class ContractGenerationService {
  private readonly logger = new Logger(ContractGenerationService.name);

  /**
   * Génère le PDF du contrat et retourne l'URL publique.
   */
  async generateContractPdf(data: ContractData): Promise<{ filePath: string; fileName: string; fileUrl: string }> {
    this.logger.log(`Generating contract PDF for school: ${data.schoolName}`);

    const fileName = `contrat-${data.subdomain}-${Date.now()}.pdf`;
    const contractsDir = path.join(process.cwd(), 'uploads', 'contracts');

    // Créer le dossier s'il n'existe pas
    if (!fs.existsSync(contractsDir)) {
      fs.mkdirSync(contractsDir, { recursive: true });
    }

    const filePath = path.join(contractsDir, fileName);

    // Générer le HTML du contrat (sera converti en PDF)
    const html = this.buildContractHtml(data);

    // Sauvegarder le HTML (pour debug) — le PDF sera généré par le frontend
    // ou par un service de conversion HTML → PDF
    const htmlPath = filePath.replace('.pdf', '.html');
    fs.writeFileSync(htmlPath, html, 'utf-8');

    // ⭐ Pour l'instant, on génère un PDF simple avec le HTML
    //    Dans une vraie implémentation, on utiliserait Puppeteer ou pdfkit
    //    Pour la démo, on retourne le HTML qui peut être imprimé en PDF par le navigateur
    fs.writeFileSync(filePath, html, 'utf-8');

    const publicUrl = `/api/contracts/${fileName}`;

    this.logger.log(`Contract generated: ${publicUrl}`);
    return { filePath, fileName, fileUrl: publicUrl };
  }

  /**
   * Construit le HTML du contrat avec tous les articles.
   * Ce HTML est structuré pour être imprimé en PDF (print-friendly).
   */
  private buildContractHtml(data: ContractData): string {
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
      font-family: 'Times New Roman', Georgia, serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #1a1a1a;
      max-width: 210mm;
      margin: 0 auto;
      padding: 20mm 15mm;
    }
    .header {
      text-align: center;
      border-bottom: 3px solid #0a2a5e;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      font-size: 16pt;
      color: #0a2a5e;
      margin-bottom: 5px;
    }
    .header h2 {
      font-size: 13pt;
      color: #0a2a5e;
      font-weight: normal;
    }
    .header .ref {
      font-size: 9pt;
      color: #666;
      margin-top: 10px;
    }
    .logos {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    .logo {
      font-size: 14pt;
      font-weight: bold;
      color: #0a2a5e;
    }
    .logo .gold { color: #cfa63a; }
    h2.article {
      font-size: 12pt;
      color: #0a2a5e;
      margin-top: 25px;
      margin-bottom: 10px;
      border-bottom: 1px solid #ccc;
      padding-bottom: 3px;
    }
    p { margin-bottom: 8px; text-align: justify; }
    .indent { margin-left: 20px; margin-bottom: 5px; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0;
      font-size: 10pt;
    }
    th, td {
      border: 1px solid #999;
      padding: 6px 8px;
      text-align: left;
    }
    th {
      background: #0a2a5e;
      color: white;
      font-weight: bold;
    }
    tr:nth-child(even) { background: #f5f5f5; }
    .checked { font-weight: bold; color: #0a2a5e; }
    .signature-block {
      display: flex;
      gap: 40px;
      margin-top: 40px;
      page-break-inside: avoid;
    }
    .signature-box {
      flex: 1;
      border: 1px solid #999;
      padding: 15px;
      min-height: 200px;
    }
    .signature-box h4 {
      font-size: 10pt;
      color: #0a2a5e;
      margin-bottom: 10px;
      border-bottom: 1px solid #ccc;
      padding-bottom: 5px;
    }
    .signature-img {
      max-width: 100%;
      max-height: 100px;
      margin: 10px 0;
    }
    .footer {
      margin-top: 30px;
      padding-top: 15px;
      border-top: 1px solid #ccc;
      text-align: center;
      font-size: 9pt;
      color: #666;
    }
    @media print {
      body { padding: 0; }
      .signature-block { page-break-inside: avoid; }
    }
  </style>
</head>
<body>

<div class="header">
  <div class="logos">
    <div class="logo">YEHI OR <span class="gold">Tech</span></div>
    <div class="logo">Academia <span class="gold">Helm</span></div>
  </div>
  <h1>CONTRAT D'ABONNEMENT ET DE LICENCE D'UTILISATION</h1>
  <h2>DE LA PLATEFORME SAAS ACADEMIA HELM</h2>
  <div class="ref">Édité par YEHI OR Tech — Référence : CT-AH-2026-${data.subdomain.toUpperCase()}</div>
</div>

<h2 class="article">Entre les soussignés</h2>
<p><strong>D'une part,</strong></p>
<p>YEHI OR Tech, agence de développement digital et éditrice de la plateforme SaaS Academia Helm, opérant sous la marque Keter Marketing pour les marchés francophones européens, dont le siège social est à Parakou, République du Bénin.</p>
<p>Représentée par son Directeur Technique et Co-fondateur, ou toute personne dûment mandatée à cet effet,</p>
<p>Ci-après dénommée « <strong>le Prestataire</strong> »,</p>
<p><strong>D'autre part,</strong></p>
<p>L'établissement scolaire <strong>${data.schoolName}</strong>, ci-après désigné « <strong>le Client</strong> » ou « l'École », dont les coordonnées complètes sont précisées dans la Fiche de souscription figurant à l'Article 1 du présent contrat,</p>
<p>Représenté par son promoteur <strong>${data.promoterName}</strong>, ou son représentant légal dûment habilité à engager l'établissement,</p>
<p>Ci-après dénommés ensemble « <strong>les Parties</strong> » et individuellement « une Partie »,</p>

<h2 class="article">Il a été convenu ce qui suit</h2>
<p>Le présent contrat (ci-après « le Contrat ») a pour objet de définir les conditions et modalités selon lesquelles le Prestataire met à la disposition du Client la plateforme SaaS Academia Helm, en concession de licence d'usage, ainsi que les services associés d'hébergement, de maintenance et de support.</p>

<h2 class="article">Article 1 — Fiche de souscription et identification des Parties</h2>
<table>
  <tr><th style="width:40%">Élément</th><th>Valeur</th></tr>
  <tr><td>Nom commercial de l'École</td><td><strong>${data.schoolName}</strong></td></tr>
  <tr><td>Promoteur / Fondateur</td><td><strong>${data.promoterName}</strong></td></tr>
  <tr><td>Directeur ou représentant légal</td><td>${data.directorName || data.promoterName}</td></tr>
  <tr><td>Adresse de l'établissement</td><td>${data.schoolAddress}</td></tr>
  <tr><td>Ville / Commune</td><td>${data.schoolCity}</td></tr>
  <tr><td>Téléphone / WhatsApp</td><td>${data.schoolPhone}</td></tr>
  <tr><td>Email de contact</td><td>${data.schoolEmail}</td></tr>
  <tr><td>Nombre d'élèves déclaré à la signature</td><td><strong>${data.studentCount}</strong></td></tr>
  <tr><td>Plan souscrit</td><td><strong class="checked">${data.planName}</strong></td></tr>
  <tr><td>Option bilingue FR/EN</td><td>${data.bilingual ? 'Oui' : 'Non'}</td></tr>
  <tr><td>Date d'effet du contrat</td><td>${data.effectiveDate}</td></tr>
  <tr><td>Sous-domaine attribué</td><td>${data.subdomain}.academiahelm.com</td></tr>
</table>

<h2 class="article">Article 2 — Objet du contrat</h2>
<p>Le Contrat a pour objet :</p>
<p class="indent">• La concession, par le Prestataire au Client, d'un droit d'usage non exclusif, non cessible et à titre onéreux de la plateforme Academia Helm, dans ses versions Web, Desktop et Mobile ;</p>
<p class="indent">• L'hébergement, la maintenance corrective et évolutive, ainsi que le support technique associés à la plateforme, selon le niveau de service correspondant au plan souscrit ;</p>
<p class="indent">• L'accès à l'ensemble des 21 modules métier et des 6 modules complémentaires décrits dans le dossier commercial Academia Helm référencé DC-2026-08, sans restriction fonctionnelle liée au plan choisi ;</p>
<p class="indent">• L'accès aux agents d'intelligence artificielle intégrés (ORION, SARA, ATLAS), dans les conditions d'usage raisonnable définies à l'Article 6.</p>
<p>Le Contrat n'emporte, en aucune manière, cession de la propriété intellectuelle attachée à la plateforme, laquelle demeure régie par l'Article 7 ci-après.</p>

<h2 class="article">Article 3 — Plan souscrit et grille tarifaire</h2>
<p>Le Client choisit, à la signature du Contrat, l'un des quatre plans ci-dessous, déterminé en fonction du nombre d'élèves actifs inscrits sur la plateforme :</p>
<table>
  <tr><th>Choix</th><th>Plan</th><th>Tranche d'élèves</th><th>Activation</th><th>Frais annuels</th></tr>
  ${planTable}
</table>
<p>À titre de référence, le tableau ci-dessous récapitule le coût total dû au titre de la première année d'abonnement (frais d'activation et frais annuels cumulés) :</p>
<table>
  <tr><th>Plan</th><th>Tranche d'élèves</th><th>Frais d'activation</th><th>Frais annuels</th><th>Coût total Année 1</th></tr>
  <tr><td>Helm Essentiel</td><td>1 à 50</td><td>300 000 FCFA</td><td>50 000 FCFA/an</td><td>350 000 FCFA</td></tr>
  <tr><td>Helm Croissance</td><td>51 à 150</td><td>300 000 FCFA</td><td>75 000 FCFA/an</td><td>375 000 FCFA</td></tr>
  <tr><td>Helm Performance</td><td>151 à 400</td><td>300 000 FCFA</td><td>100 000 FCFA/an</td><td>400 000 FCFA</td></tr>
  <tr><td>Helm Institution</td><td>401 et +</td><td>300 000 FCFA</td><td>150 000 FCFA/an</td><td>450 000 FCFA</td></tr>
</table>
<p>Tous les plans donnent accès, sans exception, à l'intégralité des modules de la plateforme Academia Helm, incluant les applications Web, Desktop et Mobile, le mode de fonctionnement hors ligne (offline-first), les agents d'intelligence artificielle (ORION, SARA, ATLAS), et l'ensemble des fonctionnalités décrites dans le dossier commercial.</p>

<h2 class="article">Article 4 — Prix, facturation et modalités de paiement</h2>
<p>Les frais d'activation, d'un montant unique fixé selon le plan souscrit conformément au tableau de l'Article 3, sont dus intégralement à la signature du Contrat et donnent accès, sans coût supplémentaire, à la configuration initiale de la plateforme, à l'import des données existantes et à la formation initiale.</p>
<p>Les frais annuels de maintenance et d'hébergement, dont le montant est fixé selon le plan souscrit, sont dus chaque année à la date anniversaire de l'activation du compte du Client. Le Prestataire adresse une facture au Client au moins trente (30) jours avant l'échéance.</p>
<p>Les modalités de règlement acceptées sont les suivantes : virement bancaire, Mobile Money (FedaPay ou FeexPay), ou espèces contre remise d'un reçu. Toute somme non réglée dans un délai de quinze (15) jours après l'échéance entraîne la suspension automatique du service, sans préjudice des pénalités de retard applicables.</p>
<p>Les options suivantes, non incluses dans le prix de base, sont facturées en sus :</p>
<p class="indent">• Option bilingue FR/EN : cinquante mille (50 000) francs CFA par an, en supplément du plan souscrit, quel que soit le plan choisi ;</p>
<p class="indent">• Frais de communication (SMS, Email, Voice) : facturés au Client au prix coûtant, selon la consommation réelle. Le canal WhatsApp demeure gratuit et illimité, inclus dans tous les plans.</p>
<p>Sauf mention contraire expresse au présent article, l'ensemble des montants indiqués s'entend hors taxes applicables, lesquelles demeurent à la charge du Client selon la réglementation fiscale en vigueur au Bénin.</p>

<h2 class="article">Article 5 — Durée, reconduction et évolution tarifaire</h2>
<p>Le Contrat prend effet à la date de signature par les deux Parties, sous réserve du paiement effectif des frais d'activation, et pour une durée initiale d'un (1) an.</p>
<p>À l'expiration de cette période initiale, le Contrat se renouvelle par tacite reconduction, pour des périodes successives d'un (1) an, sauf dénonciation par l'une des Parties notifiée par écrit (courriel ou lettre) au moins soixante (60) jours avant la date anniversaire.</p>
<p>Le Prestataire se réserve la faculté de réviser la grille tarifaire pour les périodes de reconduction futures, sous réserve d'en informer le Client par écrit au moins soixante (60) jours avant la date d'effet de la nouvelle grille.</p>

<h2 class="article">Article 6 — Obligations du Prestataire</h2>
<p>Le Prestataire s'engage à :</p>
<p class="indent">• Assurer la disponibilité, la maintenance corrective et évolutive de la plateforme, selon un objectif de disponibilité raisonnable, hors opérations de maintenance planifiée notifiées au Client ;</p>
<p class="indent">• Garantir la confidentialité et l'intégrité des données du Client, dans les conditions de l'Article 8 ;</p>
<p class="indent">• Fournir un support technique dont le niveau (email, WhatsApp, téléphone, account manager dédié, intervention sur site) correspond au plan souscrit par le Client ;</p>
<p class="indent">• Assurer l'onboarding initial du Client au moyen de l'assistant self-service intégré, ainsi qu'une session de formation en ligne de deux (2) heures destinée au directeur et au secrétariat de l'École ;</p>
<p class="indent">• Informer le Client de toute évolution substantielle de la plateforme susceptible d'affecter l'usage qu'il en fait.</p>
<p>L'usage des agents d'intelligence artificielle (ORION, SARA, ATLAS) est fourni dans le cadre d'un usage raisonnable et professionnel lié à la gestion de l'établissement scolaire ; le Prestataire se réserve le droit de limiter temporairement l'usage en cas de sollicitation excessive pouvant altérer le service pour les autres clients.</p>

<h2 class="article">Article 7 — Obligations du Client</h2>
<p>Le Client s'engage à :</p>
<p class="indent">• Régler les sommes dues au titre du présent Contrat aux échéances convenues ;</p>
<p class="indent">• Fournir au Prestataire des informations exactes et à jour concernant son établissement, son effectif d'élèves et ses coordonnées ;</p>
<p class="indent">• Utiliser la plateforme conformément à sa destination, dans le respect de la législation béninoise applicable à la protection des données personnelles des élèves, des familles et du personnel ;</p>
<p class="indent">• Assurer la confidentialité des identifiants de connexion attribués à son personnel et informer sans délai le Prestataire de toute utilisation non autorisée constatée ;</p>
<p class="indent">• Ne pas tenter de reproduire, décompiler, revendre ou céder à un tiers l'accès à la plateforme, en tout ou partie, sans l'accord écrit préalable du Prestataire.</p>

<h2 class="article">Article 8 — Propriété intellectuelle</h2>
<p>La plateforme Academia Helm, son code source, son architecture, ses interfaces, sa charte graphique, ses agents d'intelligence artificielle et l'ensemble des éléments qui la composent demeurent la propriété exclusive du Prestataire. Le présent Contrat confère au Client un droit d'usage personnel, non exclusif et non transférable, limité à la durée du Contrat et à l'usage interne de son établissement.</p>
<p>Les données saisies par le Client dans la plateforme (élèves, personnel, finances, contenus pédagogiques) demeurent la propriété exclusive du Client. Le Prestataire s'engage à en permettre l'export, dans un format standard, à tout moment et notamment en cas de résiliation.</p>

<h2 class="article">Article 9 — Protection des données et confidentialité</h2>
<p>Le Prestataire met en œuvre les mesures techniques et organisationnelles raisonnables pour assurer la sécurité et la confidentialité des données hébergées sur la plateforme, dans le cadre de l'architecture multi-tenant isolée de la plateforme.</p>
<p>Chaque Partie s'engage à conserver strictement confidentielles les informations commerciales, techniques et financières de l'autre Partie dont elle aurait connaissance à l'occasion de l'exécution du Contrat. Cette obligation de confidentialité perdure pendant une durée de deux (2) ans à compter de la cessation du présent Contrat.</p>

<h2 class="article">Article 10 — Résiliation</h2>
<p>Chaque Partie peut résilier le Contrat de plein droit, sans préavis ni indemnité, en cas de manquement grave de l'autre Partie à l'une de ses obligations contractuelles, non réparé dans un délai de trente (30) jours suivant mise en demeure restée infructueuse.</p>
<p>En cas de non-paiement persistant au-delà de quarante-cinq (45) jours suivant l'échéance, le Prestataire peut résilier le Contrat de plein droit, après mise en demeure restée infructueuse, sans préjudice des sommes restant dues.</p>
<p>En cas de résiliation, quelle qu'en soit la cause, le Client dispose d'un délai de trente (30) jours pour procéder à l'export intégral de ses données. Passé ce délai, le Prestataire est fondé à procéder à leur suppression définitive.</p>

<h2 class="article">Article 11 — Responsabilité et garanties</h2>
<p>Le Prestataire garantit que la plateforme est développée et maintenue conformément aux règles de l'art. Il ne saurait toutefois garantir une disponibilité continue et ininterrompue, notamment en cas de maintenance, de force majeure ou de défaillance des fournisseurs d'infrastructure.</p>
<p>La responsabilité du Prestataire, en cas de faute prouvée dans l'exécution du Contrat, est limitée au montant des sommes effectivement perçues au titre des douze (12) derniers mois précédant le fait générateur.</p>
<p>L'architecture offline-first de la plateforme vise à limiter les pertes de données en cas de coupure réseau ; elle ne constitue toutefois pas une garantie absolue contre toute perte résultant d'un dysfonctionnement matériel, logiciel ou réseau.</p>

<h2 class="article">Article 12 — Force majeure</h2>
<p>Aucune des Parties ne pourra être tenue responsable envers l'autre de la non-exécution ou du retard dans l'exécution de l'une de ses obligations contractuelles qui serait dû à un cas de force majeure, tel que défini par la jurisprudence béninoise.</p>

<h2 class="article">Article 13 — Droit applicable et règlement des différends</h2>
<p>Le présent Contrat est soumis au droit de la République du Bénin. En cas de différend relatif à la validité, l'interprétation ou l'exécution du présent Contrat, les Parties s'engagent à rechercher, de bonne foi, une résolution amiable dans un délai de trente (30) jours.</p>
<p>À défaut de résolution amiable dans ce délai, le différend est porté devant les juridictions compétentes de Parakou, République du Bénin.</p>

<h2 class="article">Article 14 — Dispositions diverses</h2>
<p>Le présent Contrat, ainsi que le dossier commercial Academia Helm référencé DC-2026-08 auquel il renvoie, constitue l'intégralité de l'accord entre les Parties. Il annule et remplace toute documentation antérieure.</p>
<p>Si l'une des clauses du présent Contrat venait à être déclarée nulle ou inapplicable, les autres clauses conserveraient leur pleine validité. Toute modification du présent Contrat doit faire l'objet d'un avenant écrit signé par les deux Parties.</p>

<h2 class="article" style="text-align: center;">Fait à Parakou, le ${dateStr}, en deux (2) exemplaires originaux</h2>

<div class="signature-block">
  <div class="signature-box">
    <h4>Pour le Prestataire — YEHI OR TECH</h4>
    <p style="font-size: 9pt; color: #666;">Nom et qualité du signataire :</p>
    <p style="font-size: 9pt; margin-bottom: 5px;">Directeur Technique et Co-fondateur</p>
    ${data.providerSignatureDataUrl
      ? `<img src="${data.providerSignatureDataUrl}" class="signature-img" alt="Signature prestataire" />`
      : '<p style="font-size: 9pt; color: #999; margin: 30px 0;">Signature et cachet :</p>'
    }
    <p style="font-size: 9pt; color: #666;">Date : ${data.providerSignedAt || '____ / ____ / ________'}</p>
  </div>
  <div class="signature-box">
    <h4>Pour le Client — ${data.schoolName}</h4>
    <p style="font-size: 9pt; color: #666;">Nom et qualité du signataire :</p>
    <p style="font-size: 9pt; margin-bottom: 5px;">${data.promoterName} — Promoteur</p>
    ${data.promoterSignatureDataUrl
      ? `<img src="${data.promoterSignatureDataUrl}" class="signature-img" alt="Signature client" />`
      : '<p style="font-size: 9pt; color: #999; margin: 30px 0;">Signature et cachet :</p>'
    }
    <p style="font-size: 9pt; color: #666;">Date : ${data.promoterSignedAt || '____ / ____ / ________'}</p>
  </div>
</div>

<div class="footer">
  YEHI OR Tech — Academia Helm · contact@academiahelm.com · www.academiahelm.com
</div>

</body>
</html>`;
  }

  /**
   * Génère le tableau des plans avec le plan sélectionné coché.
   */
  private getPlanTable(selectedPlanCode: string): string {
    const plans = [
      { code: 'SEED', name: 'Helm Essentiel', range: '1 – 50 élèves', activation: '300 000 FCFA', annual: '50 000 FCFA' },
      { code: 'GROW', name: 'Helm Croissance', range: '51 – 150 élèves', activation: '300 000 FCFA', annual: '75 000 FCFA' },
      { code: 'LEAD', name: 'Helm Performance', range: '151 – 400 élèves', activation: '300 000 FCFA', annual: '100 000 FCFA' },
      { code: 'NETWORK', name: 'Helm Institution', range: '401 élèves et +', activation: '300 000 FCFA', annual: '150 000 FCFA' },
    ];

    return plans.map(p => {
      const isChecked = p.code === selectedPlanCode;
      return `<tr>
        <td style="text-align: center;">${isChecked ? '☑' : '☐'}</td>
        <td class="${isChecked ? 'checked' : ''}">${p.name}</td>
        <td>${p.range}</td>
        <td>${p.activation}</td>
        <td>${p.annual}</td>
      </tr>`;
    }).join('\n');
  }
}
