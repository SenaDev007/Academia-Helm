#!/usr/bin/env node
/**
 * ============================================================================
 * verify_task27b.cjs — T27 volet B : refonte des corps de bulletins (Frederis)
 * ============================================================================
 * Couverture :
 *   FRONT  — apps/web-app/src/app/app/exams/bulletins/page.tsx
 *             (Maternelle/Primaire/Secondaire × éval+trimestriel, VueParMatière,
 *              Moyennes de classe) — en-têtes/pieds de page conservés.
 *   BACK   — bulletin-pdf.service.ts (buildHtml × 4 variantes FR) — les 4 PDF
 *             générés backend partagent le même système que l'UI.
 *   ANGLOPHONE — hors périmètre (niveaux FR demandés) : doit rester intact.
 *
 * 1. SWC parse des 2 fichiers.
 * 2. Contrôles structurels FRONT (corps refaits + zones conservées).
 * 3. Contrôles structurels BACK (CSS notes, filets, bandeaux, helpers).
 * 4. Anglophone strictement identique à HEAD (git show).
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = '/home/z/my-project/ah';
const swc = require('/home/z/node_modules/@swc/core');

let pass = 0, fail = 0;
function check(label, cond, extra) {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra ? ' — ' + extra : ''}`); }
}
function swcParse(file, isTsx) {
  const code = fs.readFileSync(file, 'utf8');
  swc.transformSync(code, {
    jsc: { target: 'es2021', parser: { syntax: 'typescript', tsx: isTsx, decorators: true, dynamicImport: true }, transform: { legacyDecorator: true, decoratorMetadata: true }, keepClassNames: true },
    module: { type: 'commonjs' }, sourceMaps: false,
  });
}

const PAGE = path.join(ROOT, 'apps/web-app/src/app/app/exams/bulletins/page.tsx');
const PDFS = path.join(ROOT, 'apps/api-server/src/modules/exams/services/bulletin-pdf.service.ts');
const page = fs.readFileSync(PAGE, 'utf8');
const pdf = fs.readFileSync(PDFS, 'utf8');

console.log('— 1. SWC parse —');
for (const [f, x] of [[PAGE, true], [PDFS, false]]) {
  let ok = true, err = '';
  try { swcParse(f, x); } catch (e) { ok = false; err = e.message.split('\n')[0]; }
  check(`SWC ${path.basename(f)}`, ok, err);
}

// ─── Helpers d'extraction (bornes fiables) ──────────────────────────────────
function between(text, a, b) {
  const i = text.indexOf(a);
  const j = b ? text.indexOf(b, i + a.length) : text.length;
  return i >= 0 && j > i ? text.slice(i, j) : '';
}
const matPage1 = between(page, 'function BulletinMaternellePage1({', 'function BulletinPrimairePage1({');
const priPage1 = between(page, 'function BulletinPrimairePage1({', 'function BulletinSecondairePage1({');
const secPage1 = between(page, 'function BulletinSecondairePage1({', 'function BulletinSecondaireEvalPage1({');
const secEval = between(page, 'function BulletinSecondaireEvalPage1({', 'function BulletinAnglophonePage1({');
const vpmTrim = between(page, 'function VueParMatiereTrimestriel({', 'function VueParMatiereAnnuel({');
const vpmAnn = between(page, 'function VueParMatiereAnnuel({', 'function generateVueParMatiereHtml({');
const moyTrim = between(page, 'function MoyennesTrimestrielTable(', 'function MoyennesAnnuelTable(');
const moyAnn = between(page, 'function MoyennesAnnuelTable(', 'function generateBulletinHtml(');
const angloUI = between(page, 'function BulletinAnglophonePage1({', 'function BulletinSecondairePage2({');
const pdfFR = between(pdf, 'private buildHtml(data: BulletinPdfData', 'private buildHtmlAnglophone(')
  + between(pdf, 'private buildHtmlVueParMatiere(', '\n}\nexport class') // jusqu'à la fin réelle
  + between(pdf, 'private buildHtmlVueParMatiere(', null).slice(0, 0); // no-op
const pdfFRall = pdf.slice(pdf.indexOf('private buildHtml(data: BulletinPdfData'), pdf.indexOf('private buildHtmlAnglophone('))
  + pdf.slice(pdf.indexOf('private buildHtmlVueParMatiere('));

console.log('— 2. FRONT — corps refondu « façon Frederis » —');
check('Maternelle P1 : cadre arrondi noir + border-separate',
  matPage1.includes('rounded-lg overflow-hidden border-2 border-black') && matPage1.includes('border-separate border-spacing-0'));
check('Maternelle P1 : en-tête BLANC (plus de fond navy)', /<tr className="bg-white">/.test(matPage1) && !matPage1.includes('#0A2A5E'));
check('Maternelle P1 : plus de fond coloré par cellule (bg-blue-50/30 disparu)', !matPage1.includes('bg-blue-50/30'));
check('Maternelle P1 : filets conditionnels dernière ligne (rowB)', /const rowB = idx === sortedSubjects\.length - 1 \? '' : 'border-b'/.test(matPage1));
check('Primaire P1 : cadre noir + en-tête blanc', priPage1.includes('border-2 border-black') && /<tr className="bg-white">/.test(priPage1) && !priPage1.includes('#0D3B85'));
check('Primaire P1 : TOTAL en bandeau navy (seul accent)', /className="bg-\[#0A2A5E\] text-white font-bold"/.test(priPage1) && priPage1.includes('Total général'));
check('Primaire P1 : synthèse carte divisible (plus de lignes colorées)', priPage1.includes('divide-y divide-slate-100') && !priPage1.includes('bg-emerald-50 px-2') && !priPage1.includes('bg-blue-50 px-2'));
check('Secondaire P1 (trimestriel CEG) : info + tableau refaits', secPage1.includes('border-separate border-spacing-0') && secPage1.includes('border-2 border-black') && !secPage1.includes('#0D3B85'));
check('Secondaire P1 : lignes de catégorie sobres (bg-slate-100)', /className="bg-slate-100 font-bold"/.test(secPage1));
check('Secondaire P1 : moyenne trimestrielle en bandeau navy', /className="bg-\[#0A2A5E\] text-white font-bold"/.test(secPage1) && secPage1.includes('Moyenne trimestrielle'));
check('Secondaire P1 : récap cadre noir + bandeau navy', secPage1.includes('border-2 border-black') && /bg-\[#0A2A5E\] text-white/.test(secPage1) && secPage1.includes('Récapitulatif de l\u2019année (3e trimestre)'.replace('\\u2019', '’')) || secPage1.includes('Récapitulatif de l\'année'));
check('Secondaire éval P1 : tableau simple refait', secEval.includes('border-2 border-black') && !secEval.includes('#0D3B85') && /bg-\[#0A2A5E\] text-white font-bold/.test(secEval));
check('VueParMatière Trimestriel : cadre noir + tfoot navy', vpmTrim.includes('border-2 border-black') && vpmTrim.includes('bg-[#0A2A5E] text-white') && !vpmTrim.includes('#0A2A5E\''));
function sliceFn(text, fname, endMarker) {
  return between(text, `function ${fname}(`, endMarker);
}
function tableZone(text) {
  const i = text.indexOf('<div className="overflow-x-auto rounded-lg border-2 border-black">');
  const j = text.indexOf('</table>', i);
  return i >= 0 && j > i ? text.slice(i, j) : '';
}
const vpmTrimTable = tableZone(vpmTrim);
const vpmAnnTable = tableZone(vpmAnn);
const qTrim = between(vpmTrim, 'const qColor', '};');
const qAnn = between(vpmAnn, 'const qColor', '};');
check('VueParMatière Trimestriel : qColor TEXTE seule', qTrim.includes('text-emerald-700') && !qTrim.includes('bg-emerald-100') && !qTrim.includes('bg-blue-100'));
check('VueParMatière Annuel : cadre noir + qColor texte', vpmAnnTable.includes('border-2 border-black') && qAnn.includes('text-emerald-700') && !qAnn.includes('bg-blue-100') && !vpmAnnTable.includes('bg-emerald-100 text-emerald-700'));
check('MoyennesTrim (classe) : en-tête blanc + filets noirs', moyTrim.includes('border-separate border-spacing-0') && /<tr className="bg-white">/.test(moyTrim) && !moyTrim.includes('#0D3B85'));
check('MoyennesAnnuel (classe) : idem', moyAnn.includes('border-separate border-spacing-0') && /<tr className="bg-white">/.test(moyAnn) && !moyAnn.includes('#0D3B85'));
check("Bandeaux d'en-tête des cartes : blanc sobre (plus de dégradé bleu)", !page.includes('bg-gradient-to-r from-blue-50 to-slate-50'));
check("Zone conservée : components anglophones INTACTS (navy d'origine conservé)", angloUI.includes('#0D3B85'));

console.log('— 3. BACK — PDF générés (4 builders FR) —');
check('CSS notes ×4 : separate + cadre 2px noir arrondi', pdfFRall.split('border-collapse:separate; border-spacing:0; border:2px solid #000; border-radius:8px').length - 1 === 4);
check('CSS notes ×4 : :last-child sans filet droit', (pdfFRall.match(/border-right:none; \}/g) || []).length >= 4);
check('CSS notes ×4 : dernière ligne sans filet bas', pdfFRall.split('table.notes tbody tr:last-child td { border-bottom:none; }').length - 1 === 4);
check('Plus de zebra dans les notes', !pdfFRall.includes('tbody tr:nth-child(even)'));
check('En-têtes <tr> blancs (≥6)', (pdfFRall.match(/<tr style="background:#fff;color:#000;">/g) || []).length >= 6);
check('Aucun fond coloré par cellule (ecfdf5/eff6ff/fffbeb/dbeafe/e0f2fe)', !pdfFRall.match(/background:#(ecfdf5|eff6ff|fffbeb|dbeafe|e0f2fe)/));
check('Bordures inline #cbd5e1/#0D3B85/#114FC4 éliminées des builders FR', !pdfFRall.match(/border:1px solid #(cbd5e1|0D3B85|114FC4);/));
check('Totaux sobres : #f1f5f9 présent, #e2e8f0 disparu des lignes', pdfFRall.includes('background:#f1f5f9;font-weight:bold;') && !pdfFRall.includes('background:#e2e8f0;font-weight:bold;'));
check('buildHtml : TOTAL GENERAL en bandeau navy', between(pdf, 'private buildHtml(data: BulletinPdfData', 'private buildHtmlSecondaire(').includes('background:#0A2A5E;color:#fff;font-weight:bold;'));
check('buildHtml : sous-en-têtes TS/S/PS blancs (pas blanc-sur-blanc)', !pdfFRall.includes('<tr style="color:white;">'));
check('Secondaire : récap cadre noir 8px + labels slate', pdfFRall.includes('border:2px solid #000;border-radius:8px;') && pdfFRall.includes('background:#f1f5f9;'));
check('Secondaire : moyenne trimestrielle navy + valeurs blanches', between(pdf, 'const totalRows = `', '`;').includes('background:#0A2A5E;color:#fff;font-weight:bold;'));
check('Eval : ligne Moyenne éval navy + wrapper neutralisé (style="")', between(pdf, 'private buildHtmlSecondaireEval(', 'private buildHtmlAnglophone(').includes('style=""'));
check('VPM : tfoot navy avec valeurs blanches', pdfFRall.includes('font-size:12px;color:#fff;'));
check('VPM : helper valBg supprimé, S sobre #0f172a', !pdf.includes('const valBg = ') && pdf.includes("val >= 1.5 ? '#0f172a' : '#d97706'"));
check('VPM : cellules sans fond (valBg retiré des templates)', !pdfFRall.includes('background:${valBg('));

console.log('— 4. Anglophone strictement identique à HEAD —');
try {
  const orig = execSync(`git show HEAD:apps/api-server/src/modules/exams/services/bulletin-pdf.service.ts`, { cwd: ROOT, maxBuffer: 1 << 26 }).toString();
  const curAnglo = between(pdf, 'private buildHtmlAnglophone(', 'private buildHtmlVueParMatiere(');
  const origAnglo = between(orig, 'private buildHtmlAnglophone(', 'private buildHtmlVueParMatiere(');
  check('builder anglophone inchangé octet par octet', curAnglo === origAnglo);
  const curUI = page;
  const origUI = execSync(`git show HEAD:apps/web-app/src/app/app/exams/bulletins/page.tsx`, { cwd: ROOT, maxBuffer: 1 << 26 }).toString();
  const curAngloUI = between(curUI, 'function BulletinAnglophonePage1({', 'function BulletinSecondairePage2({');
  const origAngloUI = between(origUI, 'function BulletinAnglophonePage1({', 'function BulletinSecondairePage2({');
  check('components anglophones UI inchangés', curAngloUI === origAngloUI);
} catch (e) {
  check('comparaison git (anglophone)', false, e.message.split('\n')[0]);
}

console.log(`\nRésultat : ${pass} OK, ${fail} échec(s)`);
process.exit(fail === 0 ? 0 : 1);
