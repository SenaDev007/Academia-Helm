/**
 * ============================================================================
 * TESTS — Poste « Coordinateur » dans les flux de recrutement (Task 13)
 * ============================================================================
 * Vérifie les deux changements backend :
 *   1. positions.service.ts — poste « Coordinateur » ajouté aux défauts +
 *      backfill idempotent pour les tenants EXISTANTS (LATE_DEFAULT_POSITIONS)
 *   2. staff-credential.service.ts — refineUserRole reconnaît les mots-clés
 *      coordinateur/coordonnateur/coordinator → DIRECTEUR (au lieu du
 *      fallback SECRETAIRE, manifestement faux pour un coordinateur)
 *
 * Exécution : bun scripts/_test_coordinateur.mjs
 * ============================================================================
 */
import { readFileSync } from 'fs';

const ROOT = new URL('..', import.meta.url).pathname;
const POSITIONS_FILE = ROOT + 'apps/api-server/src/positions/positions.service.ts';
const CREDENTIAL_FILE = ROOT + 'apps/api-server/src/hr/services/staff-credential.service.ts';

let pass = 0;
let fail = 0;
function check(label, cond) {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.error(`  ✗ ${label}`); }
}

// ── 0. Transpilation (syntaxe TS valide — Bun.Transpiler, zéro node_modules) ──
console.log('\n[0] Transpilation des fichiers modifiés');
for (const file of [POSITIONS_FILE, CREDENTIAL_FILE]) {
  try {
    const code = readFileSync(file, 'utf8');
    new Bun.Transpiler({ loader: 'ts' }).transformSync(code);
    check(`syntaxe TS OK — ${file.split('/').pop()}`, true);
  } catch (e) {
    check(`syntaxe TS OK — ${file.split('/').pop()} (${e.message})`, false);
  }
}

// ── 1. positions.service.ts — structure ──
console.log('\n[1] Poste « Coordinateur » dans positions.service.ts');
const posSrc = readFileSync(POSITIONS_FILE, 'utf8');
check("« Coordinateur » présent dans DEFAULT_POSITIONS (nouveaux tenants)",
  /\{\s*name:\s*'Coordinateur',\s*category:\s*'DIRECTOR'\s*\},/.test(posSrc.split('LATE_DEFAULT_POSITIONS')[0]));
check('LATE_DEFAULT_POSITIONS défini (backfill tenants existants)',
  /const LATE_DEFAULT_POSITIONS\s*=\s*\[/.test(posSrc) &&
  posSrc.includes("{ name: 'Coordinateur', category: 'DIRECTOR' }") &&
  posSrc.indexOf('LATE_DEFAULT_POSITIONS') < posSrc.lastIndexOf("{ name: 'Coordinateur'"));
check('findAll() appelle ensureLatePositions(tenantId)',
  (() => {
    const findAllIdx = posSrc.indexOf('async findAll(');
    const lateIdx = posSrc.indexOf('await this.ensureLatePositions(tenantId);');
    const rowsIdx = posSrc.indexOf('const rows = await this.prisma.', findAllIdx);
    return findAllIdx !== -1 && lateIdx !== -1 && lateIdx > findAllIdx && lateIdx < rowsIdx;
  })());
check('ensureLatePositions : SELECT par (tenantId, name) puis INSERT si manquant',
  posSrc.includes('SELECT "id" FROM "positions" WHERE "tenantId" = $1 AND "name" = $2 LIMIT 1') &&
  /private async ensureLatePositions[\s\S]*?continue;[\s\S]*?INSERT INTO "positions"/.test(posSrc));
check('ensureLatePositions : idempotent (continue si déjà présent — pas de doublon)',
  /existing\.length > 0\)\s*continue;/.test(posSrc));
check('La catégorie reste dans VALID_CATEGORIES (DIRECTOR ∈ TEACHER/ADMIN/SUPPORT/DIRECTOR)',
  posSrc.includes("const VALID_CATEGORIES = ['TEACHER', 'ADMIN', 'SUPPORT', 'DIRECTOR']"));

// ── 2. staff-credential.service.ts — reconnaissance du poste ──
console.log('\n[2] refineUserRole reconnaît « coordinateur » (staff-credential.service.ts)');
const credSrc = readFileSync(CREDENTIAL_FILE, 'utf8');
const branchStart = credSrc.indexOf("posLower.includes('coordinat')");
check("branche « coordinat » présente", branchStart !== -1);
check("variante béninoise « coordonnat » couverte", credSrc.includes("posLower.includes('coordonnat')"));
check("variante anglaise « coordinator » couverte", credSrc.includes("posLower.includes('coordinator')"));
check('la branche retourne UserRole.DIRECTEUR',
  /posLower\.includes\('coordinator'\)\s*\)\s*{\s*return UserRole\.DIRECTEUR;/.test(credSrc));
check('la branche est DANS le bloc roleType ADMIN/SUPPORT (comme les autres postes)',
  credSrc.indexOf("roleType === 'ADMIN' || roleType === 'SUPPORT'") < branchStart);
check('la branche est avant les rôles génériques (économe/directeur) — pas de masquage',
  branchStart < credSrc.indexOf("posLower.includes('économe')"));

// ── 3. Miroir logique — détection par mots-clés (mêmes variantes que la source) ──
console.log('\n[3] Logique de détection (miroir exact de la branche source)');
const isCoordinateur = (position) => {
  const p = (position || '').toLowerCase();
  return p.includes('coordinat') || p.includes('coordonnat') || p.includes('coordinator');
};
const COORDINATEURS = [
  'Coordinateur', 'coordinateur', 'Coordinateur Pédagogique',
  'Coordinateur Pédagogique Maternelle', 'Coordinateur Académique',
  'Coordinateur des Filières', 'Coordinatrice', 'Coordonnateur',
  'coordonnateur pédagogique', 'Coordinator', 'Responsable de la coordination',
  'COORDINATEUR',
];
for (const pos of COORDINATEURS) {
  check(`détecté : « ${pos} »`, isCoordinateur(pos));
}
const NON_COORDINATEURS = [
  'Secrétaire', 'Secrétaire Comptable', 'Comptable', 'Économe', 'Intendant',
  'Directeur', 'Directeur Adjoint', 'Proviseur', 'Censeur', 'Surveillant Général',
  'Professeur de Mathématiques', 'Instituteur', 'Animatrice', 'Bibliothécaire',
];
for (const pos of NON_COORDINATEURS) {
  check(`non détecté : « ${pos} »`, !isCoordinateur(pos));
}

// ── 4. Non-collision avec les branches VÉRIFIÉES AVANT (ordre de la source) ──
console.log('\n[4] Aucune collision avec les branches antérieures de refineUserRole');
const earlierKeywords = [
  'secrétaire comptable', 'secretaire comptable', 'secrétaire-comptable', 'secretaire-comptable',
  'surveillant général', 'surveillant general', 'surveillant-général', 'surveillant-general',
  'censeur',
];
for (const pos of COORDINATEURS) {
  const p = pos.toLowerCase();
  const collision = earlierKeywords.find((k) => p.includes(k));
  check(`« ${pos} » ne matche aucune branche antérieure`, !collision);
}

// ── Résultat ──
console.log(`\n──────────────────────────────────────`);
console.log(`Résultat : ${pass} OK, ${fail} échec(s)`);
if (fail > 0) process.exit(1);
