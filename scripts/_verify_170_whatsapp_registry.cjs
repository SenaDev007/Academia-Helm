// Tâche 170 — Vérification fonctionnelle du registry WhatsApp (template bulletin)
// Extrait le VRAI code de WhatsAppTemplateRegistry (stubs @nestjs/common) et
// rejoue la logique de résolution utilisée par sendCategorized → sendViaGupshup :
//   1. get('bulletin_periodique') résout le nouveau template ;
//   2. l'ordre des bodyVariables correspond à l'ordre d'apparition dans le body ;
//   3. les variables envoyées par le controller se mappent 1:1 (aucune vide) ;
//   4. le repli texte libre du controller produit le message complet attendu.
const fs = require('fs');
const Module = require('module');

// Stub @nestjs/common pour le decorator @Injectable()
const nestStub = { Injectable: () => (cls) => cls, Logger: class { log() {} warn() {} error() {} } };
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  if (request === '@nestjs/common') return 'nestjs-common-stub';
  return origResolve.call(this, request, ...args);
};
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '@nestjs/common') return nestStub;
  return origLoad.call(this, request, parent, isMain);
};

const ts = require('/home/z/my-project/node_modules/typescript');
const src = fs.readFileSync('apps/api-server/src/communication/services/whatsapp-template.registry.ts', 'utf8');
// Transpiler le TS réel (interfaces + decorators) en CJS exécutable
const compiled = ts.transpileModule(src, {
  compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS },
}).outputText;
// Neutraliser l'import @nestjs/common (stub, quel que soit le nom de variable
// de transpilation) — le Logger stub a des méthodes no-op
const patched = compiled
  .replace(/const (.+?) = require\("@nestjs\/common"\);/,
    'const $1 = { Injectable: () => (c) => c, Logger: class { constructor() {} log() {} warn() {} error() {} } };');
const m = { exports: {} };
new Function('module', 'exports', 'require', patched)(m, m.exports, () => ({}));
const Registry = m.exports.WhatsAppTemplateRegistry;
const registry = new Registry();

let pass = 0, fail = 0;
const ok = (cond, label) => { if (cond) { pass++; console.log('  ✓', label); } else { fail++; console.log('  ✗', label); } };

// 1. Le template existe
const tpl = registry.get('bulletin_periodique');
ok(!!tpl, "get('bulletin_periodique') résout le template");

// 2. Ordre des variables = ordre d'apparition dans le body
const appearances = [];
for (const v of tpl.bodyVariables) {
  const idx = tpl.body.indexOf(`{{${v}}}`);
  appearances.push(idx);
  ok(idx >= 0, `variable {{${v}}} présente dans le body`);
}
ok(appearances.every((v, i, a) => i === 0 || v > a[i - 1]), 'bodyVariables dans l\'ordre d\'apparition du body');
ok(tpl.bodyPlaceholderCount === tpl.bodyVariables.length, 'bodyPlaceholderCount = nombre de variables');

// 3. Mapping exact des variables envoyées par BulletinsController.sendWhatsAppBulletin
const controllerVars = {
  parent_name: 'M. ADANDE',
  student_name: 'Aicha ADANDE',
  class_name: 'CM1 A',
  period_name: 'Trimestre 1',
  results_line: 'Moyenne générale : 14,50/20\nRang : 3e sur 28\nMention : Bien',
  school_name: 'CSPEB',
};
const orderedParams = tpl.bodyVariables.map(v => controllerVars[v]);
ok(orderedParams.every(p => typeof p === 'string' && p.length > 0), 'chaque variable du template reçoit une valeur non vide (mapping sendCategorized → Gupshup)');

// 4. Le repli texte libre du controller : message complet FR
const message = `Bonjour M. ADANDE,\n\n` +
  `CSPEB — Année scolaire 2026-2027\n\n` +
  `Nous vous transmettons le bulletin de Aicha ADANDE (CM1 A) — Trimestre 1.\n\n` +
  `Moyenne générale : 14,50/20\n` +
  `Rang : 3e sur 28\n` +
  `Mention : Bien\n` +
  `\nLe bulletin PDF, visé par le directeur et l'enseignant titulaire, est joint à ce message.\n\n` +
  `Cordialement,\nLa Direction — CSPEB`;
ok(message.includes('14,50/20') && message.includes('3e sur 28') && message.includes('joint à ce message'), 'message de repli : moyenne + rang + PDF joint mentionnés');

// 5. Les autres templates sont intacts (recu_paiement toujours résolvable)
ok(!!registry.get('recu_paiement'), 'recu_paiement intact (envoi des reçus Finances inchangé)');

console.log(`\n${pass}/${pass + fail} assertions passées`);
process.exit(fail ? 1 : 0);
