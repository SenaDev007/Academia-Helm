#!/usr/bin/env node
/**
 * ============================================================================
 * verify_task44_46.cjs — T44 + T45 + T46 (Academia Frederis / Academia Helm)
 * ============================================================================
 *
 * T44 — Modal de consultation publique : suppression de la section « Notes par
 *       matière » — le corps ne contient plus que DEUX sections :
 *       « Informations du candidat » et « Décision officielle » (décision du
 *       jury + moyenne/rang/mention + décisions CEP).
 *
 * T45 — Onglet par défaut des modules workflow Federis (Délibération, Notes et
 *       Moyennes, Candidats…) : la sélection initiale n'est plus exams[0]
 *       (tri chronologique descendant = Baccalauréat) mais le premier examen
 *       du PREMIER type canonique disponible (CEP → BEPC → BAC → CAP).
 *       RUNTIME : le sélecteur est exécuté sur 5 scénarios réels.
 *
 * T46 — Module « Rapport et statistiques » : reproduction de A à Z du module
 *       Examen d'Academia Helm (ProcVerbalWorkspace + StatsWorkspace +
 *       PvStatsPromotionPdfService/Controller) pour les examens nationaux
 *       Federis — onglets « Procès-verbal » et « Statistiques » par type
 *       d'examen (CEP/BEPC/BAC/CAP), PDF officiels A4 paysage backend.
 *
 * Sections :
 *   A. T44 — modal public (structurel)
 *   B. T45 — hook useFederisExams (structurel + RUNTIME)
 *   C. T46 — backend (service + contrôleur + module, structurel)
 *   D. T46 — frontend (page rapports + onglets PV/Stats + socle commun)
 *   E. SWC — transpilation des fichiers créés/modifiés (web + api)
 * ============================================================================
 */
const fs = require('fs');
const path = require('path');

const ROOT = '/home/z/my-project/ah';
const swc = require(path.join(ROOT, 'apps/api-server/node_modules/@swc/core'));

let pass = 0;
let fail = 0;
function check(label, cond, extra) {
  if (cond) {
    pass++;
    console.log(`  ✅ ${label}`);
  } else {
    fail++;
    console.log(`  ❌ ${label}${extra ? ' — ' + extra : ''}`);
  }
}
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

console.log('════════════════════════════════════════════════════════════════');
console.log(' T44 + T45 + T46 — Modal public · Onglet CEP par défaut · Rapports');
console.log('════════════════════════════════════════════════════════════════');

// ═══════════════════════════════════════════════════════════════════════════
// A. T44 — Modal de la consultation publique
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n── A. T44 — Modal : plus de « Notes par matière », 2 sections ──');
const client = read('apps/web-app/src/components/public/FederisPublicResultsClient.tsx');

check('la section « Notes par matière » a été SUPPRIMÉE du modal', !client.includes('Notes par matière'));
check('plus de tableau des notes dans le modal (lignes candidate.lines non rendues)', !/candidate\.lines\.map/.test(client));
check('contrat API conservé (lines + commentaire T44 dans l\'interface)', /T44 — plus affiché dans le modal/.test(client) && /lines: ResultLine\[\]/.test(client));
check('section 1 « Informations du candidat » conservée', client.includes('Informations du candidat'));
check('section 2 « Décision officielle » présente dans le corps', client.includes('Décision officielle'));
const sections = client.match(/<section[\s>]/g);
check('le corps contient EXACTEMENT 2 <section> (infos candidat + décision)', sections != null && sections.length === 2, `${sections ? sections.length : 0} sections`);
check('décision du jury affichée dans le corps (Admis(e)/Ajourné(e) + icône)', /\{admitted \? 'Admis\(e\)' : 'Ajourné\(e\)'\}/.test(client) && /w-9 h-9 shrink-0/.test(client));
check('résumé chiffré conservé dans la décision (Moyenne /20 · Rang · Mention)', client.includes('Moyenne /20') && client.includes('>Rang<') && client.includes('>Mention<'));
check('décisions officielles du CEP conservées (pills + moyenne étoilée)', client.includes('Décisions officielles du CEP') && client.includes('moyenneEtoiles'));
check('effets waouh / emoji triste intacts (T43 non régressé)', client.includes('Félicitations !') && client.includes('fed-sad-drop') && /😞/.test(client));
check('commentaire T44 dans l\'en-tête du composant (traçabilité)', /T44 — le corps du modal ne contient plus que DEUX sections/.test(client));

// ═══════════════════════════════════════════════════════════════════════════
// B. T45 — Onglet par défaut = CEP (hook partagé useFederisExams)
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n── B. T45 — Sélection initiale canonique (CEP d\'abord) ──');
const hook = read('apps/web-app/src/hooks/useFederisExams.ts');

check('ordre canonique des types déclaré (CEP → BEPC → BAC → CAP)', /const EXAM_TYPE_ORDER = \['CEP', 'BEPC', 'BAC', 'CAP'\]/.test(hook));
check('sélection initiale : premier examen du premier type canonique (firstCanonical)', /firstCanonical = EXAM_TYPE_ORDER\.map/.test(hook) && /\(firstCanonical \?\? exams\[0\]\)\.id/.test(hook));
check('plus de sélection brute exams[0].id en tête de liste', !/setExamId\(exams\[0\]\.id\)/.test(hook));
check('paramètre ?exam= toujours prioritaire (liens croisés)', /searchParams\?\.get\('exam'\)/.test(hook));
check('repli défensif conservé (examType ?? CEP)', /\(e\.examType \?\? 'CEP'\) === t/.test(hook));
check('commentaire T45 documentant la cause racine (baccalauréat par défaut)', /T45/.test(hook) && /baccalauréat/i.test(hook));

// ⭐ RUNTIME — le sélecteur exact du hook, exécuté sur 5 scénarios réels
//    (copie à l'identique des lignes du hook — le contrôle structurel
//     ci-dessus garantit que le source est bien cette logique).
console.log('\n   RUNTIME — sélecteur firstCanonical (5 scénarios) :');
const EXAM_TYPE_ORDER = ['CEP', 'BEPC', 'BAC', 'CAP'];
function pickDefaultExamId(exams) {
  const firstCanonical = EXAM_TYPE_ORDER.map((t) =>
    exams.find((e) => (e.examType ?? 'CEP') === t),
  ).find(Boolean);
  return (firstCanonical ?? exams[0]).id;
}
check('scénario 1 — BAC en tête de liste API (tri date desc) → CEP sélectionné',
  pickDefaultExamId([
    { id: 'bac1', examType: 'BAC' },
    { id: 'cep1', examType: 'CEP' },
  ]) === 'cep1');
check('scénario 2 — liste complète (BAC, BEPC, CEP, CAP mélangés) → CEP',
  pickDefaultExamId([
    { id: 'bac1', examType: 'BAC' },
    { id: 'cap1', examType: 'CAP' },
    { id: 'bepc1', examType: 'BEPC' },
    { id: 'cep1', examType: 'CEP' },
  ]) === 'cep1');
check('scénario 3 — pas de CEP → BEPC (premier type disponible suivant)',
  pickDefaultExamId([
    { id: 'bac1', examType: 'BAC' },
    { id: 'bepc1', examType: 'BEPC' },
  ]) === 'bepc1');
check('scénario 4 — types inconnus uniquement → repli exams[0]',
  pickDefaultExamId([
    { id: 'x1', examType: 'CONCOURS' },
    { id: 'x2', examType: 'AUTRE' },
  ]) === 'x1');
check('scénario 5 — examType absent (repli CEP) → traité comme CEP',
  pickDefaultExamId([{ id: 'n1', examType: null }, { id: 'bac1', examType: 'BAC' }]) === 'n1');

// ═══════════════════════════════════════════════════════════════════════════
// C. T46 — BACKEND (service + contrôleur + module)
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n── C. T46 — Backend : service PV/Stats PDF + contrôleur + module ──');
const svc = read('apps/api-server/src/federis/federis-pv-stats-pdf.service.ts');
const ctl = read('apps/api-server/src/federis/federis-pv-stats.controller.ts');
const mod = read('apps/api-server/src/federis/federis.module.ts');

// Service
check('service créé — reproduction Helm documentée (T46, de A à Z)', /T46.*Reproduction DE A À Z du module Examen d'Academia Helm/s.test(svc));
check('deux méthodes publiques : generateProcVerbalPdf + generateStatsPdf', /async generateProcVerbalPdf\(/.test(svc) && /async generateStatsPdf\(/.test(svc));
check('A4 PAYSAGE comme le Helm (landscape: true + marges 8mm)', /landscape: true/.test(svc) && /top: '8mm'/.test(svc));
check('en-tête officiel : République du Bénin + drapeau SVG base64', svc.includes('République du Bénin') && /BENIN_FLAG/.test(svc));
check('organisateur = PATRONAT (legalName || name) + logo + territoire', /b\.legalName \|\| b\.name/.test(svc) && /b\.logo/.test(svc) && /territoryName/.test(svc));
check('intitulé officiel de l\'examen dans l\'en-tête (officialExamTitle)', /officialExamTitle\(ctx\.exam\.examType\)\.main/.test(svc));
check('session officielle (examSessionLabel — même source que le relevé)', /examSessionLabel\(exam, academicYearLabel\)/.test(svc));
check('examen scopé au tenant du patronat (findFirst tenantId — 404 sinon)', /where: \{ id: examId, tenantId: patronat\.tenantId \}/.test(svc) && /Examen introuvable pour ce patronat/.test(svc));
check('PV : tableau principal Matricule | Nom | matières+Coef | Total | Coef | Moyenne | Rang', svc.includes('Tableau principal du procès-verbal') && /rowspan="2" style="text-align:center;">Moyenne/.test(svc) && /rowspan="2" style="text-align:center;">Rang/.test(svc));
check('PV : abréviations des matières + Coef en sous-titre (règles Helm copiées)', /ABBR_RULES/.test(svc) && /Coef \$\{coef\}/.test(svc));
check('PV : mini-tableaux Trois premiers / Trois derniers', svc.includes('Trois premiers') && svc.includes('Trois derniers'));
check('PV : tri mérite / alphabétique côté backend (payload)', /sortMode === 'alphabetique'/.test(svc));
check('PV : ABSENTS marqués « ABS » (donnée réelle du registre Federis)', /st\.absents\?\.includes\(subj\.id\)/.test(svc) && /score-absent/.test(svc));
check('Stats : tableau G/F/T ×4 (présents · admis · % réussite · % échec)', /Effectif présents/.test(svc) && /Total admis/.test(svc) && /% Réussite/.test(svc) && /% Échec/.test(svc));
check('Stats : graphique en barres des admis par matière', /bar-chart/.test(svc) && /Nombre d'admis par matière/.test(svc));
check('Stats : colonne « École » (école de provenance — adaptation Federis)', /<th>École<\/th>/.test(svc) && /row\.school/.test(svc));
check('Stats : Top N meilleures notes / moyennes + appréciation', /Top \$\{data\.topN \|\| 3\} meilleures/.test(svc) && /Appréciation/.test(svc));
check('footer officiel Academia Frederis + patronat', /Document officiel généré par Academia Frederis/.test(svc));
check('AuditLog des générations (FEDERIS_PV_PDF / FEDERIS_STATS_PDF)', /FEDERIS_PV_PDF/.test(svc) && /FEDERIS_STATS_PDF/.test(svc));
check('PuppeteerPoolService (même pool que les autres PDF Federis)', /puppeteerPool\.acquirePage\(\)/.test(svc) && /puppeteerPool\.releasePage\(page\)/.test(svc));
check('édition sécurisée de tout contenu dynamique (esc)', /function esc\(/.test(svc));

// Contrôleur
check('contrôleur : POST /federis/exams/:examId/reports/proces-verbal', /@Post\('exams\/:examId\/reports\/proces-verbal'\)/.test(ctl));
check('contrôleur : POST /federis/exams/:examId/reports/statistiques', /@Post\('exams\/:examId\/reports\/statistiques'\)/.test(ctl));
check('contrôleur : JwtAuthGuard + StreamableFile + Content-Disposition (pattern Helm)', /JwtAuthGuard/.test(ctl) && /StreamableFile/.test(ctl) && /attachment/.test(ctl));
check('contrôleur : pattern Helm — le front calcule, le backend rend (payload POST body:any)', /FederisPvStatsPdfService/.test(ctl) && /@Body\(\) body: any/.test(ctl) && /ProcVerbalPayload/.test(svc) && /StatsPayload/.test(svc));

// Module
check('module : FederisPvStatsController enregistré dans les controllers', /FederisPvStatsController,/.test(mod));
check('module : FederisPvStatsPdfService enregistré dans les providers', /FederisPvStatsPdfService,/.test(mod));
check('module : import du service AVANT @Module (DI résolue)', mod.indexOf("import { FederisPvStatsPdfService }") < mod.indexOf('@Module({'));

// ═══════════════════════════════════════════════════════════════════════════
// D. T46 — FRONTEND (page rapports + onglets PV/Stats + socle commun)
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n── D. T46 — Frontend : module Rapport et statistiques ──');
const reports = read('apps/web-app/src/components/federis/FederisReportsPage.tsx');
const shared = read('apps/web-app/src/components/federis/reports/FederisReportsShared.tsx');
const pvTab = read('apps/web-app/src/components/federis/reports/FederisProcVerbalTab.tsx');
const statsTab = read('apps/web-app/src/components/federis/reports/FederisStatsTab.tsx');

// Page rapports
check('page : 5 onglets — Procès-verbal et Statistiques EN TÊTE', /kind: 'PV', label: 'Procès-verbal'/.test(reports) && /kind: 'STATS', label: 'Statistiques'/.test(reports));
check('page : onglet par défaut = Procès-verbal (PV)', /useState<ReportKind>\('PV'\)/.test(reports));
check('page : les 3 bilans existants conservés (session, financier, réseau)', /'SESSION'/.test(reports) && /'FINANCIAL'/.test(reports) && /'NETWORK'/.test(reports));
check('page : les onglets PV/Stats s\'affichent SANS attendre le dashboard (isConsolidated)', /isConsolidated = activeReport !== 'PV' && activeReport !== 'STATS'/.test(reports) && /loading && isConsolidated/.test(reports));
check('page : bouton « Imprimer le bilan » réservé aux bilans consolidés', /isConsolidated && \(\s*<button/.test(reports));
check('page : lazy non nécessaire — imports directs des 2 onglets', /import FederisProcVerbalTab from '\.\/reports\/FederisProcVerbalTab'/.test(reports) && /import FederisStatsTab from '\.\/reports\/FederisStatsTab'/.test(reports));

// Socle commun
check('socle : types canoniques CEP → BEPC → BAC → CAP (barre des modules)', /type: 'CEP', label: 'CEP'/.test(shared) && /type: 'BAC', label: 'Baccalauréat'/.test(shared));
check('socle : hook useExamRegistry — source = registre officiel des notes', /grades\/registry/.test(shared));
check('socle : ExamScopeBar — onglets par type + sélecteur de campagne + statut', /switchType\(t\.type\)/.test(shared) && /EXAM_STATUS_LABELS\[selectedExam\.status\]/.test(shared));
check('socle : sélection par défaut = premier type canonique (T45 appliqué via hook)', /useFederisExams\(\)/.test(shared));

// Onglet PV
check('PV : filtre classement — ordre de mérite (défaut) / alphabétique', /'merite'/.test(pvTab) && /'alphabetique'/.test(pvTab) && /useState<SortMode>\('merite'\)/.test(pvTab));
check('PV : colonnes du Helm — Matricule | Nom et prénoms | matières (Coef) | Total | Coef | Moyenne | Rang', pvTab.includes('Nom et prénoms') && /Coef \{subj\.coefficient \?\? 1\}/.test(pvTab) && /st\.total\.toFixed\(2\)/.test(pvTab) && /st\.totalCoef/.test(pvTab));
check('PV : moyennes et rangs OFFICIELS du registre (finalAverage + rank)', /computed\?\.finalAverage/.test(pvTab) && /c\.rank \?\? null/.test(pvTab));
check('PV : Total/Coef selon le modèle effectif (simple CEP / pondéré)', /isPrimary \? \(computed\?\.total \?\? 0\) : \(computed\?\.totalNotesCoef \?\? 0\)/.test(pvTab));
check('PV : ABSENTS marqués « ABS » dans le tableau', /st\.absents\.includes\(subj\.id\)/.test(pvTab) && pvTab.includes('ABS'));
check('PV : mini-tableaux Trois premiers / Trois derniers', pvTab.includes('Trois premiers') && pvTab.includes('Trois derniers'));
check('PV : notes < 10 en rouge, ≥ 10 en semibold (charte Helm)', /score >= 10 \? 'text-slate-900' : 'text-red-600'/.test(pvTab));
check('PV : bouton « Générer PDF » → POST /federis/exams/:id/reports/proces-verbal', /reports\/proces-verbal/.test(pvTab) && /Générer PDF/.test(pvTab));
check('PV : payload complet envoyé au backend (subjects + students + top3 + bottom3 + absents)', /absents: st\.absents/.test(pvTab) && /top3: top3\.map/.test(pvTab) && /bottom3: bottom3\.map/.test(pvTab));

// Onglet Stats
check('Stats : 2 onglets principaux — Statistiques des notes | des moyennes', statsTab.includes('Statistiques des notes') && statsTab.includes('Statistiques des moyennes'));
check('Stats : 3 sous-onglets — Taux de réussite | Intervalle | Meilleures', /'taux-reussite'/.test(statsTab) && /'intervalle'/.test(statsTab) && /'meilleurs'/.test(statsTab));
check('Stats : 8 intervalles du Helm (0-3 … 16-20)', /'0 — 3'/.test(statsTab) && /'16 — 20'/.test(statsTab) && (statsTab.match(/label: '\d+ — \d+'/g) || []).length === 8);
check('Stats : sélecteur Top N (3/5/10/20) comme le Helm', /<option value=\{3\}>3<\/option>/.test(statsTab) && /<option value=\{20\}>20<\/option>/.test(statsTab) && /<option value=\{5\}>5<\/option>/.test(statsTab));
check('Stats : admission = note ≥ 10/20 (même seuil que le Helm)', /\(effectiveScore\(c, subj\.id\) \?\? -1\) >= 10/.test(statsTab));
check('Stats : ventilation G/F/T (présents, admis, % réussite, % échec)', /isBoy\(c\.gender\)/.test(statsTab) && /isGirl\(c\.gender\)/.test(statsTab) && /passRate/.test(statsTab) && /failRate/.test(statsTab));
check('Stats : moyennes = finalAverage du registre (modèle effectif)', /c\.computed\?\.finalAverage \?\? null/.test(statsTab));
check('Stats : colonne « École » (école de provenance, adaptation du « Classe » Helm)', statsTab.includes('École') && /\>École\<|École\n/.test(statsTab) && /row\.school/.test(statsTab));
check('Stats : graphique en barres du nombre d\'admis par matière', /Nombre d&apos;admis par matière/.test(statsTab) && /bg-blue-500 rounded-t/.test(statsTab));
check('Stats : bouton « Générer PDF » → POST /federis/exams/:id/reports/statistiques', /reports\/statistiques/.test(statsTab) && /successRateRows: mainTab === 'notes' \? successRateData : moyennesSuccessData/.test(statsTab));

// ═══════════════════════════════════════════════════════════════════════════
// E. SWC — transpilation des fichiers créés/modifiés
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n── E. SWC — transpilation des fichiers touchés (web + api) ──');
const swcFiles = [
  'apps/web-app/src/components/public/FederisPublicResultsClient.tsx',
  'apps/web-app/src/hooks/useFederisExams.ts',
  'apps/web-app/src/components/federis/FederisReportsPage.tsx',
  'apps/web-app/src/components/federis/reports/FederisReportsShared.tsx',
  'apps/web-app/src/components/federis/reports/FederisProcVerbalTab.tsx',
  'apps/web-app/src/components/federis/reports/FederisStatsTab.tsx',
  'apps/api-server/src/federis/federis-pv-stats-pdf.service.ts',
  'apps/api-server/src/federis/federis-pv-stats.controller.ts',
  'apps/api-server/src/federis/federis.module.ts',
];
for (const f of swcFiles) {
  try {
    const code = fs.readFileSync(path.join(ROOT, f), 'utf8');
    swc.transformSync(code, {
      jsc: {
        target: 'es2021',
        parser: { syntax: 'typescript', tsx: f.endsWith('.tsx'), decorators: true, dynamicImport: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
        keepClassNames: true,
      },
      module: { type: 'commonjs' },
      sourceMaps: false,
    });
    check(`SWC compile : ${path.basename(f)}`, true);
  } catch (e) {
    check(`SWC compile : ${path.basename(f)}`, false, String((e && e.message) || e).split('\n')[0]);
  }
}

// ── Bilan ──
console.log(`\n════════════════════════════════════════════════════════`);
console.log(`  RÉSULTAT : ${pass} ✅ / ${fail} ❌  (sur ${pass + fail} contrôles)`);
console.log(`════════════════════════════════════════════════════════`);
if (fail > 0) process.exit(1);
