/**
 * ============================================================================
 * TESTS LOGIQUES — Documents de paie FP/EP (RH Bénin) — bun direct
 * ============================================================================
 * Teste les fonctions PURES de payroll-document-templates.ts (+ intégration du
 * snapshot builder du service via les mêmes règles) : gabarits HTML, blocs
 * conditionnels CNSS/IFU, numérotation, congés, cumuls, distinction visuelle
 * des deux documents. Aucune dépendance Nest/Prisma — tout est mocké.
 * ============================================================================
 */

import {
  renderFicheDePaieHtml,
  renderEtatDePaiementHtml,
  formatDocumentNumber,
  monthLabel,
  joursOuvres,
  ancienneteLabel,
  computeConges,
  esc,
  fmtMoney,
  MENTION_ETAT_PAIEMENT,
  MENTION_FICHE_CONSERVATION,
} from '../apps/api-server/src/hr/services/payroll-document-templates.ts';

let pass = 0;
let fail = 0;
function ok(cond, label) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    console.error(`  ✗ ${label}`);
  }
}

// ─── Fixtures ──────────────────────────────────────────────────────────────

const period = {
  year: 2026, month: 1, label: monthLabel(2026, 1),
  startDate: '2026-01-01', endDate: '2026-01-31', joursOuvres: joursOuvres(2026, 1),
};

const employeur = {
  raisonSociale: "Complexe Scolaire La Grâce", formeJuridique: 'SARL',
  rccm: 'RB/COT/12345', ifu: '1234567890123', cnss: 'CNSS-445566',
  adresse: 'Cotonou, Bénin', telephone: '+229 97 00 00 00',
  email: 'direction@lagrace.bj', representant: 'Mme AHOYO Sylvie', qualite: 'Directrice',
};

const ficheDeclare = {
  kind: 'FICHE_DE_PAIE',
  statutContractuel: 'SALARIE_DECLARE',
  cnssDeclare: true,
  documentNumber: 'FP-2026-000123',
  period, fiscalYear: 2026, employeur,
  salarie: {
    matricule: 'AH-STF-26-000042', nom: 'DOSSOU', prenoms: 'Jean',
    poste: 'Professeur de mathématiques', categorie: 'Enseignant',
    cnssNumber: 'CNSS-112233', anciennete: '3 ans 2 mois',
    ancienneteDepuis: '2022-11-01', joursTravailles: period.joursOuvres,
  },
  gains: { base: 250000, heuresSup: 15000, primes: 25000, brut: 290000 },
  retenues: { cnss: 10440, its: 15420, autres: 0, total: 25860 },
  net: 264140,
  chargesPatronales: {
    prestationsFamiliales: 26100, risquesProfessionnels: 2900,
    vieillesse: 46400, total: 44660, informatif: true,
  },
  cumuls: { brut: 1740000, impot: 92520, cnss: 62640, net: 1584840, documents: 6 },
  conges: { acquis: 18, pris: 5, solde: 13 },
  rates: { fiscalYear: 2026, cnssSalarialPct: 3.6, sourceNotes: null },
  mention: MENTION_FICHE_CONSERVATION,
};

const ficheNonDeclare = {
  ...ficheDeclare,
  statutContractuel: 'SALARIE_NON_DECLARE',
  cnssDeclare: false,
  documentNumber: 'FP-2026-000124',
  salarie: { ...ficheDeclare.salarie, cnssNumber: null },
  retenues: { cnss: 0, its: 25000, autres: 0, total: 25000 },
  chargesPatronales: null,
  cumuls: { brut: 580000, impot: 50000, cnss: 0, net: 530000, documents: 2 },
};

const etatAvecIfu = {
  kind: 'ETAT_DE_PAIEMENT',
  statutContractuel: 'PRESTATAIRE_SERVICE',
  documentNumber: 'EP-2026-000045',
  period, fiscalYear: 2026, employeur,
  prestataire: {
    nom: 'KOUTON', prenoms: 'Fatou', ifu: '1029384756012',
    contratReference: 'CT-9A8B7C6D', description: 'Maintenance informatique mensuelle',
    mode: 'FORFAIT', heures: null, tauxHoraire: null,
  },
  decompte: { brut: 300000, tauxAib: 3, aib: 9000, net: 291000 },
  cumuls: { brut: 900000, impot: 27000, cnss: 0, net: 873000, documents: 3 },
  rates: { fiscalYear: 2026, aibPct: 3, sourceNotes: null },
  mention: MENTION_ETAT_PAIEMENT,
};

const etatSansIfu = {
  ...etatAvecIfu,
  documentNumber: 'EP-2026-000046',
  prestataire: { ...etatAvecIfu.prestataire, ifu: null },
  decompte: { brut: 200000, tauxAib: 5, aib: 10000, net: 190000 },
};

// ─── 1. Numérotation ───────────────────────────────────────────────────────

console.log('\n[1] Numérotation FP/EP');
ok(formatDocumentNumber('FICHE_DE_PAIE', 2026, 1) === 'FP-2026-000001', 'FP séquence 1 → FP-2026-000001');
ok(formatDocumentNumber('FICHE_DE_PAIE', 2026, 123) === 'FP-2026-000123', 'FP séquence 123 → FP-2026-000123');
ok(formatDocumentNumber('ETAT_DE_PAIEMENT', 2026, 45) === 'EP-2026-000045', 'EP séquence 45 → EP-2026-000045');
ok(formatDocumentNumber('ETAT_DE_PAIEMENT', 2027, 1) === 'EP-2027-000001', 'nouvel exercice → recomptage');
ok(/^[FE]P-\d{4}-\d{6}$/.test(formatDocumentNumber('FICHE_DE_PAIE', 2026, 999999)), 'format regex');

// ─── 2. Gabarit FICHE DE PAIE (salarié déclaré) ────────────────────────────

console.log('\n[2] Fiche de paie — salarié DÉCLARÉ');
let html = renderFicheDePaieHtml(ficheDeclare);
ok(html.includes('Fiche de paie'.toUpperCase().toLowerCase()) || /Fiche de paie/i.test(html), 'titre « Fiche de paie »');
ok(html.includes('FP-2026-000123'), 'numéro FP affiché');
ok(html.includes('CNSS-112233'), 'n° CNSS affiché (déclaré)');
ok(html.includes('3,6'), 'taux CNSS salarial affiché (depuis le snapshot, pas en dur)');
ok(html.includes('Charges patronales'), 'bloc charges patronales présent (déclaré)');
ok(html.includes('NON déduites du net'), 'mention « non déduites du net »');
ok(html.includes('Cumuls annuels'), 'cumuls annuels présents');
ok(html.includes('1 740 000'), 'cumul brut formaté FR');
ok(html.includes('Congés payés'), 'bloc congés présents');
ok(html.includes('18') && html.includes('13'), 'acquis/solde congés');
ok(html.includes(MENTION_FICHE_CONSERVATION), 'mention conservation sans limitation de durée');
ok(!html.includes('Projet'), 'pas de filigrane PROJET (document émis)');
ok(html.includes('#1e3a5f'), 'identité visuelle bleu nuit');
ok(!html.includes('#14532d'), 'PAS la couleur verte de l\u2019état');
ok(html.includes('290 000'), 'brut formaté');
ok(html.includes('264 140'), 'net formaté');
ok(html.includes('15 420'), 'ITS affiché');

// ─── 3. Gabarit FICHE DE PAIE (salarié non déclaré) ────────────────────────

console.log('\n[3] Fiche de paie — salarié NON DÉCLARÉ');
html = renderFicheDePaieHtml(ficheNonDeclare);
ok(!html.includes('Cotisation CNSS'), 'PAS de ligne CNSS (non déclaré)');
ok(!html.includes('CNSS-112233'), 'PAS de n° CNSS');
ok(!html.includes('Charges patronales'), 'PAS de charges patronales');
ok(html.includes('non déclaré à la CNSS'), 'libellé statut non déclaré');
ok(html.includes('25 000'), 'ITS seul affiché');
ok(!html.includes('Cumul CNSS'), 'PAS de cumul CNSS');

// ─── 4. Gabarit ÉTAT DE PAIEMENT ───────────────────────────────────────────

console.log('\n[4] État de paiement — prestataire');
html = renderEtatDePaiementHtml(etatAvecIfu);
ok(/État de paiement/i.test(html), 'titre « État de paiement »');
ok(html.includes('EP-2026-000045'), 'numéro EP affiché');
ok(html.includes('ne constitue pas une fiche de paie'), 'avertissement « ne constitue pas une fiche de paie »');
ok(html.includes('AIB'), 'retenue AIB affichée');
ok(html.includes('3 %'), 'taux AIB 3 % (avec IFU)');
ok(html.includes('1029384756012'), 'IFU affiché');
ok(html.includes('CT-9A8B7C6D'), 'référence contrat');
ok(html.includes('forfait'), 'mode FORFAIT affiché');
ok(html.includes('#14532d'), 'identité visuelle verte');
ok(!html.includes('#1e3a5f'), 'PAS la couleur bleue de la fiche');
ok(!html.includes('CNSS (salariale)'), 'PAS de cotisation CNSS salariale');
ok(!html.includes('Charges patronales'), 'PAS de charges patronales');
ok(!html.includes('Congés payés'), 'PAS de congés (prestataire)');
ok(html.includes('signature') || html.includes('Prestataire'), 'bloc signature prestataire');
ok(html.includes('900 000'), 'cumul brut');

console.log('\n[4bis] État de paiement — SANS IFU (taux 5 %)');
html = renderEtatDePaiementHtml(etatSansIfu);
ok(html.includes('5 %'), 'taux AIB 5 % (sans IFU)');
ok(html.includes('sans IFU'), 'mention « sans IFU »');
ok(!html.includes('1029384756012'), 'PAS d\u2019IFU affiché');

// ─── 5. Prévisualisation (sans numéro) ─────────────────────────────────────

console.log('\n[5] Prévisualisation');
const previewFiche = renderFicheDePaieHtml({ ...ficheDeclare, documentNumber: null });
ok(previewFiche.includes('PROJET — NON ÉMIS'), 'numéro = PROJET');
ok(previewFiche.includes('Projet'), 'filigrane PROJET');
ok(previewFiche.includes('PRÉVISUALISATION'), 'pied « PRÉVISUALISATION »');
const previewEtat = renderEtatDePaiementHtml({ ...etatAvecIfu, documentNumber: null });
ok(previewEtat.includes('PROJET — NON ÉMIS') && previewEtat.includes('Projet'), 'prévisu EP filigranée');

// ─── 6. Échappement HTML (données utilisateur) ─────────────────────────────

console.log('\n[6] Sécurité / échappement');
const malicious = renderFicheDePaieHtml({
  ...ficheDeclare,
  salarie: { ...ficheDeclare.salarie, nom: '<script>alert(1)</script>', prenoms: 'X"&Y' },
});
ok(!malicious.includes('<script>alert'), 'script injecté échappé');
ok(malicious.includes('&lt;script&gt;'), 'entités HTML présentes');
ok(esc('<b>&"\'') === '&lt;b&gt;&amp;&quot;&#39;', 'esc() couvre < > & " \'');

// ─── 7. Helpers purs ───────────────────────────────────────────────────────

console.log('\n[7] Helpers');
ok(monthLabel(2026, 1) === 'Janvier 2026', 'monthLabel');
ok(joursOuvres(2026, 1) === 22, 'janvier 2026 = 22 jours ouvrés (jeu 1er → sam 31)');
ok(joursOuvres(2026, 2) >= 20 && joursOuvres(2026, 2) <= 21, 'février 2026 = 20-21 ouvrés');
ok(ancienneteLabel('2022-11-01', new Date('2026-01-31')) === '3 ans 2 mois', 'ancienneté 3 ans 2 mois');
ok(ancienneteLabel(null, new Date()) === '—', 'ancienneté sans date = —');
ok(fmtMoney(264140) === '264 140', 'fmtMoney séparateur espace FR');

// ─── 8. Congés (barème jours/mois — jamais en dur) ─────────────────────────

console.log('\n[8] Congés payés (taux issu du barème)');
const c1 = computeConges({ joursCongesParMois: 1.5, hireDate: '2025-09-01', periodEnd: new Date('2026-12-31'), joursPris: 5 });
ok(c1.acquis === 18, `acquis 12 mois de l'exercice × 1,5 = 18 (obtenu ${c1.acquis})`);
ok(c1.solde === 13, 'solde = 18 − 5');
const c1b = computeConges({ joursCongesParMois: 1.5, hireDate: '2025-09-01', periodEnd: new Date('2026-01-31'), joursPris: 0 });
ok(c1b.acquis === 1.5, `janvier seul de l'exercice = 1 mois × 1,5 = 1,5 (obtenu ${c1b.acquis})`);
const c2 = computeConges({ joursCongesParMois: 2, hireDate: '2026-01-10', periodEnd: new Date('2026-01-31'), joursPris: 0 });
ok(c2.acquis === 2, `embauche mi-janvier = 1 mois × 2 = 2 (obtenu ${c2.acquis})`);
const c3 = computeConges({ joursCongesParMois: 1.5, hireDate: null, periodEnd: new Date('2026-03-31'), joursPris: 2 });
ok(c3.acquis === 4.5, 'sans date d\u2019embauche = depuis le 1er janvier');

// ─── 9. Cohérence des calculs moteur (identité des deux fiches) ────────────

console.log('\n[9] Cohérence métier (montants de la ligne figée)');
ok(ficheDeclare.gains.brut === ficheDeclare.gains.base + ficheDeclare.gains.heuresSup + ficheDeclare.gains.primes, 'brut = base + HS + primes');
ok(ficheDeclare.net === ficheDeclare.gains.brut - ficheDeclare.retenues.total, 'net = brut − retenues');
ok(etatAvecIfu.decompte.net === etatAvecIfu.decompte.brut - etatAvecIfu.decompte.aib, 'net EP = brut − AIB');
ok(Math.abs(etatAvecIfu.decompte.aib - (etatAvecIfu.decompte.brut * 3) / 100) < 0.01, 'AIB = brut × 3 %');
ok(Math.abs(etatSansIfu.decompte.aib - (etatSansIfu.decompte.brut * 5) / 100) < 0.01, 'AIB sans IFU = brut × 5 %');

// ─── Résultat ──────────────────────────────────────────────────────────────

console.log(`\n════════════════════════════════════════`);
console.log(`RÉSULTAT : ${pass} réussis / ${fail} échecs`);
if (fail > 0) process.exit(1);
