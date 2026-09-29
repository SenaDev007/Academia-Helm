/**
 * ============================================================================
 * TEST — Email d'expiration d'abonnement aligné nouveaux plans (contrat AH)
 * ============================================================================
 * Transpile email.service.ts à la volée (pattern _test_contrat_refonte.mjs),
 * stubbe les dépendances Nest, et valide le rendu de formatBillingReminderEmail
 * avec les données RÉELLES de production (pricing_plans vérifié en base) :
 *   - Helm Essentiel 1-50     : activation 500 000, annuel 50 000
 *   - Helm Croissance 51-150  : activation 500 000, annuel 75 000
 *   - Helm Performance 151-400: activation 500 000, annuel 100 000
 *   - Helm Institution 401+   : activation 500 000, annuel 150 000
 *   - Option bilingue FR/EN   : 100 000 FCFA/an
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { transpileModule } = require('/home/z/.npm-global/lib/node_modules/typescript/lib/typescript.js');
const fs = require('fs');
const path = require('path');

const FILE = path.resolve('/home/z/my-project/Academia-Helm/apps/api-server/src/communication/services/email.service.ts');

// ── Transpile + stub des dépendances ──
const src = fs.readFileSync(FILE, 'utf8');
const js = transpileModule(src, {
  compilerOptions: { module: 1 /* CommonJS */, target: 4, esModuleInterop: true, experimentalDecorators: true },
}).outputText;

const stubs = {
  '@nestjs/common': { Injectable: () => (c) => c, Logger: class { log(){} warn(){} error(){} debug(){} } },
  '@nestjs/config': { ConfigService: class { get(k, d) { return d; } } },
  'nodemailer': { createTransport: () => ({}), },
};

const m = { exports: {} };
const fn = new Function('module', 'exports', 'require', js);
fn(m, m.exports, (name) => {
  if (stubs[name]) return stubs[name];
  throw new Error(`dépendance inattendue: ${name}`);
});
const { EmailService } = m.exports;

// ConfigService factice : URLs de production
const configStub = { get: (k, d) => (k === 'APP_PUBLIC_URL' ? 'https://academiahelm.com' : d) };
const svc = new EmailService(configStub);

// ── Grille réelle production (pricing_plans) ──
const GRID = [
  { code: 'SEED', name: 'Helm Essentiel', studentMin: 1, studentMax: 50, initialFee: 500000, yearlyAmount: 50000 },
  { code: 'GROW', name: 'Helm Croissance', studentMin: 51, studentMax: 150, initialFee: 500000, yearlyAmount: 75000 },
  { code: 'LEAD', name: 'Helm Performance', studentMin: 151, studentMax: 400, initialFee: 500000, yearlyAmount: 100000 },
  { code: 'NETWORK', name: 'Helm Institution', studentMin: 401, studentMax: null, initialFee: 500000, yearlyAmount: 150000 },
];
const BILINGUAL_Y = 100000;

let pass = 0, fail = 0;
function test(name, cond) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name}`); }
}

// ══ CAS 1 : LEAD actif, bilingue activé, J-7 (comme EPP Sainte Thérèse) ══
const c1 = svc.formatBillingReminderEmail({
  schoolName: 'EPP Sainte Thérèse Camp-Adagbè',
  planName: 'Helm Performance',
  planCode: 'LEAD',
  planRange: '151 à 400 élèves',
  planAnnualFee: 100000,
  planActivationFee: 500000,
  bilingualEnabled: true,
  bilingualYearlyFee: BILINGUAL_Y,
  renewalFee: 100000 + BILINGUAL_Y,
  daysRemaining: 7,
  status: 'ACTIVE',
  renewalUrl: 'https://app.academiahelm.com/app/settings/billing',
  plansGrid: GRID,
});

console.log('── CAS 1 : ACTIVE / LEAD / bilingue / J-7 ──');
test('Objet : « Rappel - école - Expiration d\'abonnement dans 7 jours »',
  c1.subject === "Rappel - EPP Sainte Thérèse Camp-Adagbè - Expiration d'abonnement dans 7 jours");
test('Plan officiel affiché (Helm Performance)',
  c1.html.includes('Helm Performance') && c1.text.includes('Helm Performance'));
test('Jamais le code brut LEAD comme nom de plan',
  !c1.html.includes('Plan actuel :</strong> LEAD') && !c1.text.includes('Plan actuel : LEAD\n'));
test('Tranche d\'élèves affichée (151 à 400 élèves)',
  c1.html.includes('151 à 400 élèves') && c1.text.includes('(151 à 400 élèves)'));
test('Frais annuels du plan : 100 000 FCFA/an',
  c1.html.includes('100 000 FCFA/an') && c1.text.includes('Frais annuels du plan : 100 000 FCFA/an'));
test('Option bilingue activée : 100 000 FCFA/an',
  c1.html.includes('Option bilingue FR/EN (activée)') && c1.html.includes('100 000 FCFA/an'));
test('Total à régler au renouvellement : 200 000 FCFA',
  c1.html.includes('200 000 FCFA') && c1.text.includes('200 000 FCFA'));
test('Règle contrat : seuls les frais annuels dus au renouvellement',
  c1.html.includes('seuls les <strong>frais annuels de votre plan</strong> sont dus'));
test('Règle contrat : activation non redevable au renouvellement',
  c1.html.includes('ne sont pas redevables au renouvellement') && c1.text.includes("Les frais d'activation ne sont dus qu'une seule fois"));
test('Grille des 4 plans (Article 3) présente',
  ['Helm Essentiel', 'Helm Croissance', 'Helm Performance', 'Helm Institution'].every((n) => c1.html.includes(n)));
test('Grille : montants activation 500 000 partout',
  (c1.html.match(/500 000/g) || []).length >= 5); // 4 lignes grille + note activation
test('Grille : frais annuels 50 000 / 75 000 / 100 000 / 150 000',
  c1.html.includes('50 000 / an') && c1.html.includes('75 000 / an') && c1.html.includes('100 000 / an') && c1.html.includes('150 000 / an'));
test('Plan courant surligné (✔ dans la grille)',
  /Helm Performance\s*<span[^>]*>✔<\/span>/.test(c1.html.replace('\n', '')) || c1.html.includes('Helm Performance <span style="color:#1d4fa5;">✔</span>'));
test('Capacité « 401 et plus » pour Institution',
  c1.html.includes('401 et plus') && c1.text.includes('401 et plus'));
test('21 modules métier + 6 complémentaires inclus (tous plans)',
  c1.html.includes('21 modules métier + 6 modules complémentaires'));
test('Conditions contrat : pénalité 15 jours',
  c1.html.includes('15 jours') && c1.text.includes('15 jours'));
test('Conditions contrat : dénonciation 60 jours (Article 5)',
  c1.html.includes('60 jours') && c1.text.includes('60 jours'));
test('Modalités : espèces contre reçu, virement, Mobile Money',
  c1.html.includes('espèces contre reçu') && c1.html.includes('Mobile Money'));
test('CTA : Renouveler maintenant → /app/settings/billing',
  c1.html.includes('Renouveler maintenant') && c1.html.includes('https://app.academiahelm.com/app/settings/billing'));
test('Logo email présent', c1.html.includes('/images/logo-academia-helm-email.png'));
test('Ancien chemin /billing/renew ABSENT', !c1.html.includes('/billing/renew'));
test('Anciens plans obsolètes ABSENTS (Plan Mensuel/Annuel - 1 École)',
  !c1.html.includes('Plan Mensuel') && !c1.html.includes('Plan Annuel') && !c1.text.includes('Plan Mensuel'));
test('Version texte : grille + lien renouvellement',
  c1.text.includes('Grille tarifaire — plans Academia Helm (contrat Article 3)') && c1.text.includes('Pour renouveler :'));
test('Helm Connect mentionné (gratuit, sans limitation)',
  c1.html.includes('Helm Connect'));

// ══ CAS 2 : TRIAL_ACTIVE GROW, sans bilingue, J-3 (URGENCE IMPORTANT) ══
const c2 = svc.formatBillingReminderEmail({
  schoolName: 'CSP Mon Avenir Plus N\'Dali',
  planName: 'Helm Croissance',
  planCode: 'GROW',
  planRange: '51 à 150 élèves',
  planAnnualFee: 75000,
  planActivationFee: 500000,
  bilingualEnabled: false,
  bilingualYearlyFee: BILINGUAL_Y,
  daysRemaining: 3,
  status: 'TRIAL_ACTIVE',
  renewalUrl: 'https://app.academiahelm.com/app/settings/billing',
  plansGrid: GRID,
});

console.log('\n── CAS 2 : TRIAL_ACTIVE / GROW / sans bilingue / J-3 ──');
test('Objet avec urgence [IMPORTANT] + « Fin de période d\'essai »',
  c2.subject.startsWith('[IMPORTANT] ') && c2.subject.includes("Fin de période d'essai dans 3 jours"));
test('Wording période d\'essai (pas « abonnement »)',
  c2.html.includes('période d\'essai') && c2.text.includes('période d\'essai'));
test('Essai : total = activation + frais annuels (575 000 FCFA)',
  c2.html.includes('575 000 FCFA') && c2.text.includes('575 000 FCFA'));
test('Essai : ligne frais d\'activation à la souscription',
  c2.html.includes('Frais d\'activation (une seule fois, à la souscription)'));
test('CTA essai : « Souscrire maintenant »',
  c2.html.includes('Souscrire maintenant'));
test('Essai : pas de note « activation non redevable » (inutile en souscription)',
  !c2.html.includes('ils ne sont pas redevables au renouvellement'));

// ══ CAS 3 : rétro-compatibilité minimale (ancienne signature) ══
const c3 = svc.formatBillingReminderEmail({
  schoolName: 'École Test',
  planName: 'Helm Institution',
  daysRemaining: 1,
  status: 'ACTIVE',
  renewalUrl: 'https://app.academiahelm.com/app/settings/billing',
});

console.log('\n── CAS 3 : rétro-compat (signature minimale, sans grille) ──');
test('Rendu correct sans enrichissements (pas de crash)',
  c3.html.includes('Helm Institution') && c3.html.includes('expire dans'));
test('Sans grille : bloc grille absent, email toujours correct',
  !c3.html.includes('Grille tarifaire') && c3.html.includes('Plan actuel'));
test('Objet URGENT J-1', c3.subject.startsWith('[URGENT] '));
test('Version texte correcte sans grille', c3.text.includes("Plan actuel : Helm Institution"));

// ══ Rendu échantillon pour relecture ══
console.log('\n════ ÉCHANTILLON HTML (cas 1, extrait) ════');
console.log(c1.html.substring(0, 1200));
console.log('…');
console.log('\n════ ÉCHANTILLON TEXTE (cas 2, complet) ════');
console.log(c2.text);

console.log(`\n════ RÉSULTAT : ${pass}/${pass + fail} tests OK ════`);
process.exit(fail ? 1 : 0);
