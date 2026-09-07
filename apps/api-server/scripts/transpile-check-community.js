/**
 * VALIDATION SYNTAXIQUE — transpile les fichiers du module community
 * (équivalent « transpile main.ts OK » des sessions précédentes) :
 * détecte erreurs de syntaxe, décorateurs mal placés, imports cassés
 * au niveau parsing (sans résolution de types — prisma generate absent).
 */
const ts = require('typescript');
const fs = require('fs');
const path = require('path');

const files = [
  'community.guard.ts',
  'community.repository.ts',
  'community-auth.service.ts',
  'community-provision.service.ts',
  'community.service.ts',
  'community-admin.service.ts',
  'community-scheduled-dispatcher.ts',
  'community.bootstrap.ts',
  'community.controller.ts',
  'community-admin.controller.ts',
  'community.module.ts',
  'community.dto.ts',
].map((f) => path.join(__dirname, '../src/community', f));
files.push(path.join(__dirname, '../src/main.ts'));
files.push(path.join(__dirname, '../src/app.module.ts'));

let failed = 0;
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const out = ts.transpileModule(src, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2021,
      experimentalDecorators: true,
      emitDecoratorMetadata: true,
      esModuleInterop: true,
      skipLibCheck: true,
    },
    fileName: file,
  });
  const diags = out.diagnostics || [];
  if (diags.length) {
    failed++;
    console.log(`❌ ${path.basename(file)}:`);
    for (const d of diags) {
      console.log('   ', ts.flattenDiagnosticMessageText(d.messageText, ' '));
    }
  } else {
    console.log(`✅ ${path.basename(file)} — transpile OK`);
  }
}
process.exit(failed ? 1 : 0);
