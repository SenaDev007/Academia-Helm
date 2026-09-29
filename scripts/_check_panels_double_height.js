/**
 * Vérification de transpilation des 2 fichiers TSX modifiés
 * (retour utilisateur : hauteur des panneaux doublée — pédagogie enseignants/affectations).
 * Même pattern que les sessions précédentes (ts.transpileModule).
 */
const ts = require('/home/z/my-project/node_modules/typescript');
const fs = require('fs');
const path = require('path');

const BASE = __dirname + '/../apps/web-app/src/components/pedagogy';

const files = [
  `${BASE}/assignments/AssignmentsWorkspace.tsx`,
  `${BASE}/teachers/TeachersAcademicWorkspace.tsx`,
];

let fail = 0;
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const out = ts.transpileModule(src, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.Preserve,
      esModuleInterop: true,
    },
    reportDiagnostics: true,
    fileName: f,
  });
  const diags = (out.diagnostics || []).filter((d) => d.category === ts.DiagnosticCategory.Error);
  if (diags.length) {
    fail++;
    console.log('ECHEC', path.basename(f));
    diags.forEach((d) => console.log('   →', ts.flattenDiagnosticMessageText(d.messageText, '\n'), '(ligne', d.line + 1, ')'));
  } else {
    console.log('OK  ', path.basename(f));
  }
}

// Vérification supplémentaire : les nouvelles classes de hauteur sont bien présentes,
// et aucune ancienne valeur ne subsiste dans ces 2 fichiers.
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const checks = [
    ['lg:max-h-[calc(200vh-52rem)]', (src.match(/lg:max-h-\[calc\(200vh-52rem\)\]/g) || []).length],
    ['max-h-[120vh]', (src.match(/max-h-\[120vh\]/g) || []).length],
    ['ANCIEN calc(100vh-26rem)', (src.match(/calc\(100vh-26rem\)/g) || []).length],
    ['ANCIEN max-h-[60vh]', (src.match(/max-h-\[60vh\]/g) || []).length],
  ];
  console.log(`\n${path.basename(f)} :`);
  checks.forEach(([label, n]) => console.log(`   ${label} → ${n} occurrence(s)`));
}

console.log(fail ? `\n${fail} fichier(s) en échec` : `\n${files.length}/${files.length} fichiers transpilés sans erreur`);
process.exit(fail ? 1 : 0);
