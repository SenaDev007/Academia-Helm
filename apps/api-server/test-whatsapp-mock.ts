/**
 * Test du WhatsAppService (mode mock) — sans envoyer de vrai message.
 *
 * Usage :
 *   cd apps/api-server
 *   npx ts-node -e "require('./test-whatsapp-mock').run()"
 *
 * Ou plus simple (test unitaire isolé) :
 *   npx ts-node test-whatsapp-mock.ts
 */

import { WhatsAppTemplateRegistry } from './src/communication/services/whatsapp-template.registry';
import {
  normalizePhoneE164,
  toGupshupDestination,
  isValidPhoneE164,
  isBeninPhone,
  getBeninPhoneVariants,
} from './src/common/utils/phone';

async function run() {
  console.log('\n🧪 === TESTS WHATSAPP SERVICE (mode mock) ===\n');

  // === Test 1 : Phone util ===
  console.log('--- Test 1 : phone.ts ---');
  const tests: Array<[string, string]> = [
    ['01 97 12 34 56', '+22997123456'],
    ['+2290197123456', '+22997123456'],
    ['22997123456', '+22997123456'],
    ['+33612345678', '+33612345678'],
  ];
  let pass = 0;
  for (const [input, expected] of tests) {
    const result = normalizePhoneE164(input);
    const ok = result === expected;
    if (ok) pass++;
    console.log(`  ${ok ? '✅' : '❌'} normalizePhoneE164("${input}") = "${result}" (attendu: "${expected}")`);
  }
  console.log(`  → ${pass}/${tests.length} OK\n`);

  // === Test 2 : Gupshup format ===
  console.log('--- Test 2 : format Gupshup ---');
  const gupshupTests: Array<[string, string]> = [
    ['+22997123456', '22997123456'],
    ['+33612345678', '33612345678'],
  ];
  for (const [input, expected] of gupshupTests) {
    const result = toGupshupDestination(input);
    const ok = result === expected;
    console.log(`  ${ok ? '✅' : '❌'} toGupshupDestination("${input}") = "${result}"`);
  }
  console.log();

  // === Test 3 : Registry ===
  console.log('--- Test 3 : WhatsAppTemplateRegistry ---');
  const registry = new WhatsAppTemplateRegistry();
  const list = registry.list();
  console.log(`  ✅ ${list.length} templates chargés`);

  const byModule = {
    students: registry.listByModule('students').length,
    hr: registry.listByModule('hr').length,
    pedagogy: registry.listByModule('pedagogy').length,
  };
  console.log(`  ✅ Répartition : students=${byModule.students}, hr=${byModule.hr}, pedagogy=${byModule.pedagogy}`);
  console.log(`  ${byModule.students === 2 && byModule.hr === 15 && byModule.pedagogy === 3 ? '✅' : '❌'} Comptes attendus : 2/15/3\n`);

  // === Test 4 : Validation des bodyParams ===
  console.log('--- Test 4 : validateBodyParams ---');
  const admission = registry.get('admission_recue');
  if (admission) {
    const ok6 = registry.validateBodyParams('admission_recue', ['a', 'b', 'c', 'd', 'e', 'f']);
    const ok5 = registry.validateBodyParams('admission_recue', ['a', 'b', 'c', 'd', 'e']);
    console.log(`  ${ok6 ? '✅' : '❌'} admission_recue(6 params) → validate=true`);
    console.log(`  ${!ok5 ? '✅' : '❌'} admission_recue(5 params) → validate=false (attendu)`);
  }
  console.log();

  // === Test 5 : renderBody ===
  console.log('--- Test 5 : renderBody ---');
  try {
    const rendered = registry.renderBody('admission_recue', [
      'Marie ADANDE',
      'Jean ADANDE',
      '2025-2026',
      'CP1',
      'ADM-2025-001',
      'CSPEB',
    ]);
    const hasMarie = rendered.includes('Bonjour Marie ADANDE');
    const hasJean = rendered.includes('Jean ADANDE');
    const hasAdm = rendered.includes('ADM-2025-001');
    console.log(`  ${hasMarie ? '✅' : '❌'} Variable {{1}} substituée (Bonjour Marie ADANDE)`);
    console.log(`  ${hasJean ? '✅' : '❌'} Variable {{2}} substituée (Jean ADANDE)`);
    console.log(`  ${hasAdm ? '✅' : '❌'} Variable {{5}} substituée (ADM-2025-001)`);
    console.log('\n--- Aperçu du rendu ---');
    console.log(rendered);
  } catch (e: any) {
    console.log(`  ❌ renderBody failed: ${e.message}`);
  }

  console.log('\n🎉 === FIN DES TESTS ===\n');
}

run().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
