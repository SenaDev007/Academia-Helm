/**
 * Test logique — rendu HTML du contrat (numéros de reçus, horodatage signatures,
 * rang annexe) et des reçus/factures (détail, toutes lettres, échéancier).
 * Transpile les deux services et appelle les méthodes privées de rendu.
 */
// (tsc utilisé — plus besoin du transpileur bun)
const fs = require('fs');
const path = require('path');
const Module = require('module');

// ⤵ transpile TS → CJS via tsc (le sandbox a typescript) puis exécute stubbé
const { execSync } = require('child_process');
const TSC = '/home/z/my-project/node_modules/typescript/bin/tsc';
function loadTs(filePaths) {
  const outDir = '/tmp/ts-out-' + Date.now();
  try {
    execSync(
      `node ${TSC} ${filePaths.join(' ')} --module commonjs --target es2020 --esModuleInterop --skipLibCheck --noEmitOnError false --outDir ${outDir}`,
      { stdio: 'pipe', timeout: 60000 },
    );
  } catch {
    // erreurs de TYPE uniquement (modules non installés) — le JS est quand
    // même émis par tsc (--noEmitOnError false)
  }
  const moduleCache = {};
  function loadJs(jsPath) {
    if (moduleCache[jsPath]) return moduleCache[jsPath].exports;
    const js = fs.readFileSync(jsPath, 'utf8');
    const fn = new Function('require', 'module', 'exports', '__dirname', '__filename', js);
    const mod = { exports: {} };
    moduleCache[jsPath] = mod;
    fn(stubRequire, mod, mod.exports, path.dirname(jsPath), jsPath);
    return mod.exports;
  }
  const stubRequire = (m) => {
    if (m === '@nestjs/common') {
      return {
        Injectable: () => (cls) => cls,
        Logger: class { log() {} warn() {} error() {} },
      };
    }
    if (m.endsWith('prisma.service')) return { PrismaService: class {} };
    if (m.endsWith('puppeteer-pool.service')) return { PuppeteerPoolService: class {} };
    if (m.endsWith('storage.service')) return { StorageService: class {} };
    if (m === 'fs') return fs;
    if (m === 'path') return path;
    if (m === 'https') return require('https');
    if (m.startsWith('.')) {
      // résout RELATIF au __dirname du module transpilé (outDir conserve
      // la hiérarchie) et charge AVEC les stubs (récursif)
      const resolved = path.resolve(currentDir, m);
      const jsPath = fs.existsSync(resolved + '.js') ? resolved + '.js' : resolved;
      return loadJs(jsPath);
    }
    return require(m);
  };
  let currentDir = null;
  const loaded = {};
  for (const fp of filePaths) {
    const base = path.basename(fp, '.ts');
    // tsc préserve la hiérarchie : src/onboarding/... → outDir/onboarding/...
    const candidates = [
      path.join(outDir, base + '.js'),
      path.join(outDir, 'src', 'onboarding', base + '.js'),
    ];
    let jsPath = candidates.find((c) => fs.existsSync(c));
    if (!jsPath) {
      // recherche récursive
      const found = execSync(`find ${outDir} -name "${base}.js" | head -1`).toString().trim();
      jsPath = found;
    }
    currentDir = path.dirname(jsPath);
    loaded[base] = loadJs(jsPath);
  }
  return loaded;
}

let pass = 0, fail = 0;
const check = (label, cond, detail = '') => {
  if (cond) { pass++; console.log(`✓ ${label}`); }
  else { fail++; console.log(`✗ ${label}${detail ? ' — ' + detail : ''}`); }
};

(async () => {
  // ── 1. Contrat + reçus (tsc → CJS, exécutés stubbés) ──
  const loaded = loadTs([
    path.join(__dirname, '../apps/api-server/src/onboarding/contract-generation.service.ts'),
    path.join(__dirname, '../apps/api-server/src/onboarding/billing-receipt.service.ts'),
  ]);
  const contractMod = loaded['contract-generation.service'];
  const ContractGenerationService = contractMod.ContractGenerationService;
  const svc = new ContractGenerationService();
  const buildHtml = (data) => svc.buildContractHtml(data, { yehiOrTech: '', academiaHelm: '' });

  // Cas A : annexe mono-école (2e école) + reçu + noms + horodatage
  const htmlAnnexe = buildHtml({
    schoolName: 'École Test Annexe',
    promoterName: 'Jean Promoteur',
    schoolAddress: 'N\'Dali',
    schoolCity: 'N\'Dali',
    schoolPhone: '+22990000000',
    schoolEmail: 'test@example.com',
    studentCount: 120,
    planCode: 'GROW',
    planName: 'Helm Croissance',
    bilingual: true,
    subdomain: 'ecole-test-annexe',
    effectiveDate: '06/09/2026',
    schoolsCount: 1,
    activationFee: 425000,
    annualFee: 75000,
    totalYearOne: 600000,
    bilingualFee: 100000,
    annexRank: 2,
    activationBaseFee: 500000,
    activationDiscountPercent: 15,
    paymentMethod: 'cash',
    subscriptionPaid: true,
    bilingualPaid: true,
    receivedBy: 'agent@academiahelm.com',
    receivedByName: 'Sènakpon AKPOVI',
    paymentDates: ['2026-09-05T10:00:00.000Z'],
    receiptNumbers: ['REC-AH-2026-00001'],
    paymentPlan: 'full',
    promoterSignedAt: '2026-09-06T14:32:00.000Z',
    providerSignedAt: '2026-09-06T14:35:00.000Z',
    promoterSignatureDataUrl: 'data:image/png;base64,xxx',
    providerSignatureDataUrl: 'data:image/png;base64,yyy',
  });
  check('contrat annexe : mention « École annexe — 2e établissement du groupe »', htmlAnnexe.includes('2<sup>e</sup> établissement du groupe'));
  check('contrat annexe : effectif estimé 120', /Effectif estimé.*120/.test(htmlAnnexe.replace(/\s+/g, ' ')));
  check('contrat annexe : numéro de reçu REC-AH-2026-00001', htmlAnnexe.includes('<strong>REC-AH-2026-00001</strong>'));
  check('contrat annexe : agent « Sènakpon AKPOVI »', htmlAnnexe.includes('Sènakpon AKPOVI'));
  check('contrat annexe : remise 15 % en 4.3', htmlAnnexe.includes('remise de 15 %'));
  check('contrat annexe : horodatage promoteur (14:32)', /Signé électroniquement le .* à 14:32/.test(htmlAnnexe));
  check('contrat annexe : horodatage prestataire (14:35)', /à 14:35/.test(htmlAnnexe));
  check('contrat annexe : date de règlement 05/09/2026', htmlAnnexe.includes('05/09/2026'));

  // Cas B : échéancier avec reçu d'acompte rattaché à la tranche 1
  const htmlEchel = buildHtml({
    schoolName: 'École Échel',
    promoterName: 'A B',
    schoolCity: 'Cotonou',
    studentCount: 60,
    planCode: 'GROW', planName: 'Helm Croissance', bilingual: false, subdomain: 'ecole-echel',
    activationFee: 500000, annualFee: 75000, totalYearOne: 575000,
    paymentMethod: 'cash', subscriptionPaid: false,
    paymentPlan: 'installments',
    installments: [
      { label: 'Acompte à la signature', amount: 200000 },
      { label: 'Tranche 2', amount: 375000, dueDate: '2026-10-30' },
    ],
    downPaymentReceived: true,
    installmentReceipts: [{ index: 0, receiptNumber: 'REC-AH-2026-00002' }],
    promoterSignedAt: new Date().toISOString(),
  });
  check('échéancier : reçu tranche 1 REC-AH-2026-00002', htmlEchel.includes('<strong>REC-AH-2026-00002</strong>'));
  check('échéancier : tranche 2 sans reçu (cellule vide)', /Tranche 2<\/td>[^<]*<td class="r">375 000/.test(htmlEchel));

  // ── 2. Reçu / facture (billing-receipt.service.ts) ──
  const billingMod = loaded['billing-receipt.service'];
  const BillingReceiptService = billingMod.BillingReceiptService;
  const bsvc = new BillingReceiptService(null, null);
  const renderHtml = (input, number) => bsvc.renderHtml(input, number, { yehiOrTech: '', academiaHelm: '' });

  const receiptHtml = renderHtml({
    kind: 'RECEIPT',
    transactionType: 'FULL_SUBSCRIPTION',
    draftId: 'd-1',
    payerName: 'Jean Promoteur',
    payerEmail: 'jp@example.com',
    issuedByName: 'Sènakpon AKPOVI',
    issuedByEmail: 'agent@academiahelm.com',
    paymentMethod: 'CASH',
    paidAt: new Date('2026-09-05T10:00:00Z'),
    lines: [
      { label: "Frais d'activation (2e école du groupe — barème annexe −15 %)", amount: 425000 },
      { label: 'Frais annuels — plan Helm Croissance', amount: 75000 },
      { label: 'Option bilingue FR/EN (1re année)', amount: 100000 },
    ],
    amount: 600000,
    contractRef: 'CT-AH-2026-TEST',
    schoolName: 'École Test Annexe',
  }, 'REC-AH-2026-00001');
  check('reçu : titre « Reçu d\'encaissement »', receiptHtml.includes('Reçu d\u2019encaissement'));
  check('reçu : numéro REC-AH-2026-00001', receiptHtml.includes('REC-AH-2026-00001'));
  check('reçu : montant total 600 000', receiptHtml.includes('600 000'));
  check('reçu : toutes lettres « six cent mille »', receiptHtml.includes('six cent mille'));
  check('reçu : agent émetteur', receiptHtml.includes('Sènakpon AKPOVI'));
  check('reçu : ligne activation remisée', receiptHtml.includes('barème annexe'));
  check('reçu : mention quittance', /tient lieu de quittance/.test(receiptHtml));

  const invoiceHtml = renderHtml({
    kind: 'INVOICE',
    transactionType: 'FULL_SUBSCRIPTION',
    draftId: 'd-1',
    payerName: 'Jean Promoteur',
    paymentMethod: 'CASH',
    paidAt: new Date(),
    lines: [
      { label: "Frais d'activation", amount: 500000 },
      { label: 'Frais annuels', amount: 75000 },
    ],
    amount: 575000,
    contractRef: 'CT-AH-2026-TEST',
    installments: [
      { label: 'Acompte à la signature', amount: 200000, receiptNumber: 'REC-AH-2026-00002' },
      { label: 'Tranche 2', amount: 375000, dueDate: '2026-10-30' },
    ],
  }, 'FAC-AH-2026-00001');
  check('facture : titre « Facture de souscription »', invoiceHtml.includes('Facture de souscription'));
  check('facture : échéancier avec reçu émis', invoiceHtml.includes('REC-AH-2026-00002'));
  check('facture : solde restant 375 000', invoiceHtml.includes('375 000'));
  check('facture : TVA non applicable', /TVA non applicable/.test(invoiceHtml));

  // ── 3. Numérotation — test de nextNumber avec un fake prisma ──
  const calls = [];
  const fakePrisma = {
    billingDocument: {
      count: async ({ where }) => { calls.push(where); return 2; },
      findUnique: async ({ where }) => null,
      create: async ({ data }) => ({ ...data, id: 'x' }),
    },
  };
  const bsvc2 = new BillingReceiptService(fakePrisma, null);
  const nextNumber = (kind) => bsvc2.nextNumber(kind);
  const r1 = await nextNumber('RECEIPT');
  check('numérotation : REC-AH-2026-00003 après 2 existants', r1.documentNumber === 'REC-AH-2026-00003', r1.documentNumber);
  const r2 = await nextNumber('INVOICE');
  check('numérotation : FAC-AH-2026-00003', r2.documentNumber === 'FAC-AH-2026-00003', r2.documentNumber);

  console.log(`\n${pass}/${pass + fail} tests OK`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => { console.error('ERREUR:', e); process.exit(1); });
