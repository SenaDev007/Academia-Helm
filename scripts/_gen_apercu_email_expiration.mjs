// Génère les aperçus HTML des 2 cas d'email d'expiration (relecture visuelle)
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { transpileModule } = require('/home/z/.npm-global/lib/node_modules/typescript/lib/typescript.js');
const fs = require('fs');
const path = require('path');

const FILE = path.resolve('/home/z/my-project/Academia-Helm/apps/api-server/src/communication/services/email.service.ts');
const src = fs.readFileSync(FILE, 'utf8');
const js = transpileModule(src, {
  compilerOptions: { module: 1, target: 4, esModuleInterop: true, experimentalDecorators: true },
}).outputText;

const stubs = {
  '@nestjs/common': { Injectable: () => (c) => c, Logger: class { log(){} warn(){} error(){} debug(){} } },
  '@nestjs/config': { ConfigService: class { get(k, d) { return d; } } },
  'nodemailer': { createTransport: () => ({}) },
};
const m = { exports: {} };
new Function('module', 'exports', 'require', js)(m, m.exports, (name) => {
  if (stubs[name]) return stubs[name];
  throw new Error(`dépendance inattendue: ${name}`);
});
const { EmailService } = m.exports;
const svc = new EmailService({ get: (k, d) => (k === 'APP_PUBLIC_URL' ? 'https://academiahelm.com' : d) });

const GRID = [
  { code: 'SEED', name: 'Helm Essentiel', studentMin: 1, studentMax: 50, initialFee: 500000, yearlyAmount: 50000 },
  { code: 'GROW', name: 'Helm Croissance', studentMin: 51, studentMax: 150, initialFee: 500000, yearlyAmount: 75000 },
  { code: 'LEAD', name: 'Helm Performance', studentMin: 151, studentMax: 400, initialFee: 500000, yearlyAmount: 100000 },
  { code: 'NETWORK', name: 'Helm Institution', studentMin: 401, studentMax: null, initialFee: 500000, yearlyAmount: 150000 },
];

const c1 = svc.formatBillingReminderEmail({
  schoolName: 'EPP Sainte Thérèse Camp-Adagbè',
  planName: 'Helm Performance', planCode: 'LEAD', planRange: '151 à 400 élèves',
  planAnnualFee: 100000, planActivationFee: 500000,
  bilingualEnabled: true, bilingualYearlyFee: 100000, renewalFee: 200000,
  daysRemaining: 7, status: 'ACTIVE',
  renewalUrl: 'https://app.academiahelm.com/app/settings/billing',
  plansGrid: GRID,
});

const c2 = svc.formatBillingReminderEmail({
  schoolName: "CSP Mon Avenir Plus N'Dali",
  planName: 'Helm Croissance', planCode: 'GROW', planRange: '51 à 150 élèves',
  planAnnualFee: 75000, planActivationFee: 500000,
  bilingualEnabled: false, bilingualYearlyFee: 100000, renewalFee: 575000,
  daysRemaining: 3, status: 'TRIAL_ACTIVE',
  renewalUrl: 'https://app.academiahelm.com/app/settings/billing',
  plansGrid: GRID,
});

const OUT = '/home/z/my-project/download';
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'apercu-email-expiration-abonnement-actif.html'), c1.html);
fs.writeFileSync(path.join(OUT, 'apercu-email-expiration-essai.html'), c2.html);
console.log('✓ Aperçus générés :');
console.log('  - download/apercu-email-expiration-abonnement-actif.html (ACTIVE / Helm Performance / bilingue / J-7)');
console.log('  - download/apercu-email-expiration-essai.html (TRIAL / Helm Croissance / J-3)');
