/**
 * Test du helper cityToDepartment (benin-territories.ts) — compilé via SWC.
 */
import { spawnSync } from 'child_process';
import { writeFileSync, mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// 1. Compile benin-territories.ts → CJS dans un fichier temporaire
const src = '/home/z/my-project/academia-helm/apps/api-server/src/common/constants/benin-territories.ts';
const dir = mkdtempSync(join(tmpdir(), 'benin-test-'));
const out = join(dir, 'benin-territories.cjs');
const r = spawnSync(
  'node',
  [
    join('/home/z/my-project/academia-helm/apps/api-server/node_modules/@swc/cli/bin/swc.js'),
    src,
    '-o', out,
    '-C', 'module.type=commonjs',
  ],
  { encoding: 'utf8' },
);
if (r.status !== 0) {
  console.error('SWC compile failed:', r.stderr);
  process.exit(1);
}

// 2. Charge et teste
const mod = await import(out); const { cityToDepartment, departmentKeys, territoryIncludesKeys } = mod.default ?? mod;

const cases = [
  ['Parakou', 'Borgou'],
  ["N'Dali", 'Borgou'],
  ['Abomey-Calavi', 'Atlantique'],
  ['Calavi', 'Atlantique'],
  ['Cotonou', 'Littoral'],
  ['Porto-Novo', 'Ouémé'],
  ['Porto Novo', 'Ouémé'],
  ['Bembèrèkè', 'Borgou'],
  ['Bohicon', 'Zou'],
  ['Dassa-Zoumè', 'Collines'],
  ['Natitingou', 'Atacora'],
  ['Malanville', 'Alibori'],
  ['Paris', null],
  ['', null],
  [null, null],
];

let failures = 0;
for (const [city, expected] of cases) {
  const got = cityToDepartment(city);
  if (got !== expected) {
    failures++;
    console.log(`✗ cityToDepartment(${JSON.stringify(city)}) = ${JSON.stringify(got)}, attendu ${JSON.stringify(expected)}`);
  } else {
    console.log(`✓ cityToDepartment(${JSON.stringify(city)}) = ${JSON.stringify(got)}`);
  }
}

// territoryIncludesKeys — utilisé pour l'attribution départementale
const terr = [
  ['Borgou', 'Borgou', true],
  ['Borgou', 'Alibori', false],
  ['Département de l\'Atlantique-Littoral', 'Atlantique', true],
];
for (const [territory, dept, expected] of terr) {
  const got = territoryIncludesKeys(territory, departmentKeys(dept));
  const ok = got === expected;
  if (!ok) failures++;
  console.log(`${ok ? '✓' : '✗'} territoryIncludesKeys("${territory}", "${dept}") = ${got}`);
}

console.log(failures === 0 ? '\nTOUS LES TESTS PASSENT' : `\n${failures} ÉCHEC(S)`);
process.exit(failures > 0 ? 1 : 0);
