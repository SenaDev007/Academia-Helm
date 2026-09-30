#!/usr/bin/env node
/**
 * ============================================================================
 * verify_task27a.cjs — T27 volet A (relevés côté Helm) : vérification BACKEND
 * ============================================================================
 * Fichiers couverts :
 *   - federis/zip-writer.ts (NOUVEAU)
 *   - federis/federis-school-exams.service.ts (stat fix + bulk + parents)
 *   - federis/federis-school-exams.controller.ts (routes zip + send-to-parents)
 *   - federis/federis.module.ts (ParentProvisioningModule)
 *   - parent-portal/parent-portal-national-exams.controller.ts (NOUVEAU)
 *   - parent-portal/parent-portal.module.ts
 *
 * 1. SWC parse (config .swcrc du build Railway) — 0 erreur de syntaxe.
 * 2. Résolution des imports relatifs de ces fichiers (convention TS .js→.ts).
 * 3. Contrôles structurels : fix stats, routes, garde-fou parent, zip-writer.
 * 4. RUNTIME du zip-writer : CRC32 + structure binaire (signatures, offsets,
 *    EOCD) validés sur un ZIP relu octet par octet.
 */
const fs = require('fs');
const path = require('path');

const ROOT = '/home/z/my-project/ah';
const swc = require('/tmp/node_modules/@swc/core');

let pass = 0;
let fail = 0;
function check(label, cond, extra) {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra ? ' — ' + extra : ''}`); }
}

const FILES = [
  'apps/api-server/src/federis/zip-writer.ts',
  'apps/api-server/src/federis/federis-school-exams.service.ts',
  'apps/api-server/src/federis/federis-school-exams.controller.ts',
  'apps/api-server/src/federis/federis.module.ts',
  'apps/api-server/src/parent-portal/parent-portal-national-exams.controller.ts',
  'apps/api-server/src/parent-portal/parent-portal.module.ts',
];

console.log('— 1. SWC parse (syntaxe) —');
/** Transpile via @swc/core — même config que le build Railway (pattern task23). */
function swcCompileString(code, isTsx) {
  return swc.transformSync(code, {
    jsc: {
      target: 'es2021',
      parser: { syntax: 'typescript', tsx: isTsx, decorators: true, dynamicImport: true },
      transform: { legacyDecorator: true, decoratorMetadata: true },
      keepClassNames: true,
    },
    module: { type: 'commonjs' },
    sourceMaps: false,
  });
}
for (const rel of FILES) {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  let ok = true; let err = '';
  try { swcCompileString(src, rel.endsWith('.tsx')); } catch (e) { ok = false; err = e.message.split('\n')[0]; }
  check(`SWC ${path.basename(rel)}`, ok, err);
}

console.log('— 2. Résolution des imports relatifs —');
function resolveImport(fromFile, spec) {
  if (!spec.startsWith('.')) return true; // alias/absolu/packaged
  const base = path.join(path.dirname(fromFile), spec);
  const cands = [];
  for (const ext of ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json']) cands.push(base + ext);
  cands.push(path.join(base, 'index.ts'), path.join(base, 'index.js'));
  if (spec.endsWith('.js') || spec.endsWith('.mjs')) {
    const stripped = spec.replace(/\.(js|mjs)$/, '');
    const b2 = path.join(path.dirname(fromFile), stripped);
    for (const ext of ['.ts', '.tsx']) cands.push(b2 + ext);
  }
  return cands.some((c) => fs.existsSync(c));
}
for (const rel of FILES) {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const specs = [...src.matchAll(/(?:from\s+|require\()\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
  const bad = specs.filter((s) => !resolveImport(path.join(ROOT, rel), s));
  check(`imports ${path.basename(rel)} (${specs.length} analysés)`, bad.length === 0, bad.join(', '));
}

console.log('— 3. Contrôles structurels —');
const svc = fs.readFileSync(path.join(ROOT, FILES[1]), 'utf8');
const ctl = fs.readFileSync(path.join(ROOT, FILES[2]), 'utf8');
const ppc = fs.readFileSync(path.join(ROOT, FILES[4]), 'utf8');
const mod = fs.readFileSync(path.join(ROOT, FILES[3]), 'utf8');
const ppm = fs.readFileSync(path.join(ROOT, FILES[5]), 'utf8');
const zip = fs.readFileSync(path.join(ROOT, FILES[0]), 'utf8');

check('service : fix carte stats = ajournes.length (plus de filter AJOURNE)',
  /ajournes:\s*ajournes\.length/.test(svc) && !/ajournes:\s*ajournes\.filter/.test(svc));
check('service : méthode getSchoolRelevesBulkZip présente', /async getSchoolRelevesBulkZip\(/.test(svc));
check('service : méthode sendRelevesToParents présente', /async sendRelevesToParents\(/.test(svc));
check('service : email via sendCategorized + pièce jointe PDF',
  /sendCategorized\(\{/.test(svc) && /attachments:\s*\[/.test(svc) && /contentType:\s*'application\/pdf'/.test(svc));
check('service : Helm Connect sendAttachmentMessage + notification NATIONAL_EXAM_RELEVE',
  /sendAttachmentMessage\(/.test(svc) && /ensureUserForPrimaryGuardianOfStudent\(/.test(svc) && /'NATIONAL_EXAM_RELEVE'/.test(svc));
check('service : garde requireDirection sur l’envoi aux parents (décision officielle)',
  /resolveSchoolContext\(tenantId,\s*userId,\s*role,\s*true\)/.test(svc));
check('service : relevés limités aux DÉJÀ DISTRIBUÉS (releveDispatched)',
  /\.filter\(\(r\) => r\.releveDispatched\)/.test(svc));
check('controller : GET :examType/releves/zip', /@Get\(':examType\/releves\/zip'\)/.test(ctl));
check('controller : POST :examType/releves/send-to-parents', /@Post\(':examType\/releves\/send-to-parents'\)/.test(ctl));
check('controller : Content-Type application/zip', /'application\/zip'/.test(ctl));
check('module federis : ParentProvisioningModule importé', /ParentProvisioningModule/.test(mod));
check('parent-portal : @Get national-exams/:studentId', /@Get\('national-exams\/:studentId'\)/.test(ppc));
check('parent-portal : PDF relevé garde 3 niveaux (guardian + studentId + distribution)',
  /assertStudentBelongsToGuardian/.test(ppc) && /metadata as any\)\?\.studentId !== studentId/.test(ppc) && /documentType: 'RELEVE_NOTES'/.test(ppc));
check('parent-portal module : FederisModule importé + contrôleur enregistré',
  /FederisModule/.test(ppm) && /ParentPortalNationalExamsController/.test(ppm));
check('zip-writer : STORE + UTF-8 flags + EOCD',
  /0x04034b50/.test(zip) && /0x02014b50/.test(zip) && /0x06054b50/.test(zip) && /0x0800/.test(zip));

console.log('— 4. RUNTIME zip-writer (CRC32 + structure binaire relue) —');
(async () => {
  const out = swcCompileString(zip, false);
  const tmpMod = '/tmp/task27-zip-writer.cjs';
  fs.writeFileSync(tmpMod, out.code);
  const mod$ = require(tmpMod);
  const { createZipArchive, safeReleveFileName } = mod$;
  const pdfA = Buffer.from('%PDF-1.4 faux relevé admissible A — contenu binaire \u00e9\u00e0\u00e8');
  const pdfB = Buffer.from('%PDF-1.4 faux relevé ajourné B');
  const nameA = safeReleveFileName('CEP-2026-00042', 'KÔRA Mariam');
  const nameB = safeReleveFileName('BEPC-2026-00007', "D'Almeida Jean-Pierre");
  const archive = createZipArchive([
    { name: nameA, data: pdfA },
    { name: nameB, data: pdfB, mtime: new Date('2026-01-15T10:30:00Z') },
  ]);

  check('nom de fichier A normalisé (accents/tirets → _)', nameA === 'Releve_CEP_2026_00042_KORA_Mariam.pdf', nameA);
  check('nom de fichier B normalisé (apostrophe)', nameB === 'Releve_BEPC_2026_00007_DAlmeida_Jean_Pierre.pdf', nameB);

  // Relecture : signatures + extraction des données + CRC
  let off = 0;
  const files = [];
  while (archive.length - off >= 4 && archive.readUInt32LE(off) === 0x04034b50) {
    const nameLen = archive.readUInt16LE(off + 26);
    const extraLen = archive.readUInt16LE(off + 28);
    const dataSize = archive.readUInt32LE(off + 22);
    const crc = archive.readUInt32LE(off + 14);
    const name = archive.slice(off + 30, off + 30 + nameLen).toString('utf8');
    const data = archive.slice(off + 30 + nameLen + extraLen, off + 30 + nameLen + extraLen + dataSize);
    // CRC de contrôle recalculé par le test (le writer utilise la même table)
    const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
    let c = 0xffffffff; for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
    const crcCheck = (c ^ 0xffffffff) >>> 0;
    files.push({ name, data, crc, crcCheck });
    off += 30 + nameLen + extraLen + dataSize;
  }
  check('archive : 2 entrées locales lues', files.length === 2, `lu=${files.length}`);
  check('archive : données A intactes', files[0]?.data.equals(pdfA) === true);
  check('archive : données B intactes', files[1]?.data.equals(pdfB) === true);
  check('archive : CRC32 A = recalcul', files[0]?.crc === files[0]?.crcCheck, `${files[0]?.crc} vs ${files[0]?.crcCheck}`);
  check('archive : CRC32 B = recalcul', files[1]?.crc === files[1]?.crcCheck);

  // Central directory + EOCD
  check('archive : central directory à la position attendue', archive.length - off >= 4 && archive.readUInt32LE(off) === 0x02014b50,
    `offset=${off}`);
  const eocdPos = archive.length - 22;
  check('archive : EOCD finale', archive.readUInt32LE(eocdPos) === 0x06054b50);
  check('archive : EOCD compte 2 entrées', archive.readUInt16LE(eocdPos + 10) === 2);
  check('archive : EOCD taille répertoire cohérente',
    archive.readUInt32LE(eocdPos + 12) === eocdPos - off,
    `cdSize=${archive.readUInt32LE(eocdPos + 12)} attendu=${eocdPos - off}`);
  // Vérification directe de l'attribut externe rw-r--r-- (non signé)
  const cdStart = off;
  const extAttrs = archive.readUInt32LE(cdStart + 38);
  check('archive : attributs externes 644 non signé', extAttrs === ((0o100644 << 16) >>> 0), `lu=${extAttrs}`);

  // Archive VIDE : EOCD seule
  const empty = createZipArchive([]);
  check('archive vide : 22 octets, 0 entrée', empty.length === 22 && empty.readUInt16LE(10) === 0, `len=${empty.length}`);

  console.log(`\nRésultat : ${pass} OK, ${fail} échec(s)`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error('RUNTIME ERROR', e); process.exit(1); });
