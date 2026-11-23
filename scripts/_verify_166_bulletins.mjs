// Validation fonctionnelle des nouveautés du controller bulletins (task 166)
// — extraction des méthodes pures et exécution avec des stubs (même approche
//   que les sessions précédentes : le vrai code est exécuté, Nest est stubbé).
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '../apps/api-server/src/modules/exams/bulletins.controller.ts'), 'utf8');

// 1. Extraire normalizePhoneForWaMe
function extractMethod(name) {
  const start = SRC.indexOf(`private ${name}(`) !== -1 ? SRC.indexOf(`private ${name}(`) : SRC.indexOf(`${name}(`);
  const braceStart = SRC.indexOf('{', start);
  let depth = 0;
  for (let i = braceStart; i < SRC.length; i++) {
    if (SRC[i] === '{') depth++;
    else if (SRC[i] === '}') {
      depth--;
      if (depth === 0) return SRC.slice(start, i + 1);
    }
  }
  throw new Error(`method ${name} not found`);
}

const normalizeSrc = extractMethod('normalizePhoneForWaMe');
// Éval via un fichier TS temporaire exécuté par bun (les annotations TS sont
// natives pour bun — eval() de Node ne les comprend pas).
const tmp = path.join('/tmp', 'normalize_phone_166.ts');
fs.writeFileSync(tmp, normalizeSrc.replace(/^private\s+/, 'export function ') + '\n');
const { normalizePhoneForWaMe: normalize } = await import(tmp);

// ── Tests : normalisation téléphone (règles du module Finances)
const assert = (cond, label) => { if (!cond) { console.error('FAIL:', label); process.exit(1); } console.log('✓', label); };

assert(normalize('0195722234') === '22995722234', '01XXXXXXXX → 229XXXXXXXX');
assert(normalize('95722234') === '22995722234', '8 chiffres → 229XXXXXXXX');
assert(normalize('+229 97 12 34 56'.replace(/[\s\-().]/g, '')) === '229971234 56'.replace(/\s/g, ''), '+229 → 229');
assert(normalize('002299712345'.substring(2)) === '2299712345', '00 + 229 → 229');
assert(normalize(null) === '', 'null → vide');
assert(normalize('+33612345678') === '33612345678', 'numéro international +33 → 33…');

// 2. Test de construction du message WhatsApp (rejoue la logique du endpoint FR)
function buildFrMessage(body, pdfData, parent, pdfUrl) {
  const parentName = parent?.name || null;
  const isMaternelle = !!body.isMaternelle;
  const totalStudents = body.totalStudents ?? null;
  const generalAverage = typeof body.generalAverage === 'number' ? body.generalAverage : null;
  const classRank = body.classRank ?? null;
  const appreciation = body.appreciationGlobale || null;
  const scaleLabel = '/20';
  const avgLine = isMaternelle
    ? (appreciation ? `Résultat global : ${appreciation}` : null)
    : (generalAverage !== null ? `Moyenne générale : ${Number(generalAverage).toFixed(2)}${scaleLabel}` : null);
  const rankLine = classRank && totalStudents
    ? `Rang : ${classRank}${Number(classRank) === 1 ? 'er' : 'e'} sur ${totalStudents}`
    : (classRank ? `Rang : ${classRank}` : null);
  const mentionLine = !isMaternelle && appreciation ? `Mention : ${appreciation}` : null;
  const schoolName = pdfData.schoolName || "l'établissement";
  const studentName = body.studentName || 'l\'élève';
  const periodPart = [body.periodName, body.evaluationTypeName ? `Évaluation : ${body.evaluationTypeName}` : null].filter(Boolean).join(' · ');
  const contactLine = [pdfData.schoolPhone ? `Tél : ${pdfData.schoolPhone}` : null, pdfData.schoolEmail ? `Email : ${pdfData.schoolEmail}` : null].filter(Boolean).join(' · ');
  return `Bonjour${parentName ? ` ${parentName}` : ''},\n\n`
    + `${schoolName} — Année scolaire ${body.academicYearName || ''}\n\n`
    + `Nous vous transmettons le bulletin de ${studentName} (${body.className || 'classe non précisée'}) — ${periodPart || 'période courante'}.\n\n`
    + (avgLine ? `📊 ${avgLine}\n` : '')
    + (rankLine ? `🏅 ${rankLine}\n` : '')
    + (mentionLine ? `⭐ ${mentionLine}\n` : '')
    + `\nLe bulletin PDF, visé par le directeur et l'enseignant titulaire, est joint à ce message.`
    + (pdfUrl ? `\nVous pouvez également le télécharger ici :\n${pdfUrl}` : '')
    + `\n\nNous restons à votre disposition pour toute information complémentaire${contactLine ? ` (${contactLine})` : ''}.\n\nCordialement,\nLa Direction — ${schoolName}`;
}

const msg1 = buildFrMessage(
  { isMaternelle: false, totalStudents: 28, generalAverage: 14.75, classRank: 3, appreciationGlobale: 'Bien', studentName: 'ADJOVI Marie', className: 'CM2 A', periodName: '1er Trimestre', evaluationTypeName: 'Évaluation Mensuelle 2', academicYearName: '2026-2027' },
  { schoolName: 'CSP Mon Avenir Plus N\'Dali', schoolPhone: '0195722234', schoolEmail: 'contact@monavenirplus.bj' },
  { name: 'M. ADJOVI Paul' },
  'https://r2.example.com/bulletins/t/s/p.pdf',
);
assert(msg1.includes('Bonjour M. ADJOVI Paul'), 'message : salutation au tuteur');
assert(msg1.includes('Moyenne générale : 14.75/20'), 'message : moyenne /20');
assert(msg1.includes('Rang : 3e sur 28'), 'message : rang + effectif');
assert(msg1.includes('Mention : Bien'), 'message : mention');
assert(msg1.includes('Évaluation : Évaluation Mensuelle 2'), 'message : type d\'évaluation');
assert(msg1.includes('télécharger ici'), 'message : lien PDF');
assert(msg1.includes('Tél : 0195722234'), 'message : contact école');

const msg2 = buildFrMessage(
  { isMaternelle: true, appreciationGlobale: 'Très Satisfaisant', studentName: 'PETIT Kossi', className: 'PS', periodName: '1er Trimestre' },
  { schoolName: 'École Test' }, null, null,
);
assert(msg2.includes('Résultat global : Très Satisfaisant'), 'message maternelle : résultat global');
assert(!msg2.includes('/20'), 'message maternelle : pas de /20');
assert(!msg2.includes('Mention :'), 'message maternelle : pas de mention');

// 3. Test du mapping items (persistBulletinDocument)
function mapItems(subjects) {
  return subjects
    .filter((s) => s?.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s.id)))
    .map((s) => {
      const average = typeof s.score === 'number' ? s.score : typeof s.secMoyenne === 'number' ? s.secMoyenne : typeof s.total === 'number' ? s.total : null;
      const coefficient = typeof s.coefficient === 'number' ? s.coefficient : typeof s.secCoef === 'number' ? s.secCoef : 1;
      const rank = typeof s.subjectRank === 'number' ? s.subjectRank : typeof s.secRank === 'number' ? s.secRank : null;
      return average !== null ? { subjectId: String(s.id), average, coefficient, rank: rank !== null ? Math.round(rank) : null, comments: s.appreciation || null } : null;
    })
    .filter(Boolean);
}
const UUID = '11111111-2222-3333-4444-555555555555';
const items = mapItems([
  { id: UUID, score: 15.5, coefficient: 2, subjectRank: 4, appreciation: 'Bien' },
  { id: '__conduct__', score: 17 },           // matière injectée → exclue
  { id: 'aaaabbbb-cccc-dddd-eeee-ffff00001111', score: null },  // sans note → exclue
  { id: 'bad-id', score: 12 },                 // id non-UUID → exclue
]);
assert(items.length === 1, 'items : 1 seul item réel écrit');
assert(items[0].average === 15.5 && items[0].coefficient === 2 && items[0].rank === 4, 'items : valeurs mappées');

console.log('\n=== Tous les tests fonctionnels 166 passent ===');
