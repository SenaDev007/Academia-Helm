/**
 * ============================================================================
 * FIX ANONYMISATION — Phase 2
 * ============================================================================
 * Suite à anonymize-ah-data.js, certains prénoms restants sont encore des
 * prénoms CSPEB (Saliou, Favour, Sèna, Jean, Dawes, Minica, Léontine, Aurore).
 * Ce script les remplace par des prénoms purement fictifs du pool (Karim,
 * Jade, Alain, Lydie, etc.) pour qu'aucun prénom CSPEB ne subsiste.
 *
 * Cibles :
 *  - Staff HELM Saliou (53e4e357) → HELM Karim (karim.helm@academia-helm.test)
 *  - Staff HELM Favour (8492ed0f) → HELM Jade (jade.helm@academia-helm.test)
 *  - User HELM Sèna (85256ffe) → HELM Karim (karim.helm@academia-helm.test)
 *  - Guardian HELM Jean (34587e64) → HELM Alain (alain.helm@academia-helm.test)
 *  - Guardian HELM Dawes (a7a0aaed) → HELM Patrice (patrice.helm@academia-helm.test)
 *  - Guardian HELM Minica (7880a205) → HELM Lydie (lydie.helm@academia-helm.test)
 *  - Guardian HELM Minica (3e7cf44d) → HELM Lydie (lydie2.helm@academia-helm.test)
 *  - Guardian HELM Léontine (e3f46e3f) → HELM Hélène (helene.helm@academia-helm.test)
 *  - HR Candidate HELM Aurore (2fad60cc) → HELM Auroline (auroline.helm@academia-helm.test)
 * ============================================================================
 */
const { Pool } = require('pg');

const AH_TENANT_ID = '178d5b6b-d4f3-4246-bc8c-76a2e8fc2e4b';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Staff fixes
    const staffFixes = [
      { id: '53e4e357-e247-4902-93ab-36f6edc4a055', first: 'Karim', email: 'karim.helm@academia-helm.test' },
      { id: '8492ed0f-025e-4324-8846-1b2d9648ce8a', first: 'Jade', email: 'jade.helm@academia-helm.test' },
    ];
    console.log(`\n[Staff fixes] ${staffFixes.length} à corriger`);
    for (const s of staffFixes) {
      await client.query(
        `UPDATE staff SET "firstName" = $1, email = $2, "updatedAt" = NOW() WHERE id = $3`,
        [s.first, s.email, s.id],
      );
      console.log(`  ✓ ${s.id} → HELM ${s.first} (${s.email})`);
    }

    // User fixes
    const userFixes = [
      // TOHOU Sèna was linked to AKPAKI Saliou (same dawesakpovi email) — use same Karim identity
      { id: '85256ffe-c532-4aed-813b-06ebaf8937f6', first: 'Karim', email: 'karim.helm@academia-helm.test' },
    ];
    console.log(`\n[User fixes] ${userFixes.length} à corriger`);
    for (const u of userFixes) {
      await client.query(
        `UPDATE users SET "firstName" = $1, email = $2, "updatedAt" = NOW() WHERE id = $3`,
        [u.first, u.email, u.id],
      );
      console.log(`  ✓ ${u.id} → HELM ${u.first} (${u.email})`);
    }

    // Guardian fixes
    const guardianFixes = [
      { id: '34587e64-3557-4b96-9019-bbfce7c13074', first: 'Alain', email: 'alain.helm@academia-helm.test' },
      { id: 'a7a0aaed-2574-4ba6-a41d-3d20f5135ad6', first: 'Patrice', email: 'patrice.helm@academia-helm.test' },
      { id: '7880a205-49ec-4e35-a4be-2bea33399479', first: 'Lydie', email: 'lydie.helm@academia-helm.test' },
      { id: '3e7cf44d-2bd9-429b-97e4-ebbf32b3ed0c', first: 'Lydie', email: 'lydie2.helm@academia-helm.test' },
      { id: 'e3f46e3f-946c-4a55-919c-196f5dfb8a42', first: 'Hélène', email: 'helene.helm@academia-helm.test' },
    ];
    console.log(`\n[Guardian fixes] ${guardianFixes.length} à corriger`);
    for (const g of guardianFixes) {
      await client.query(
        `UPDATE guardians SET "firstName" = $1, email = $2, "updatedAt" = NOW() WHERE id = $3`,
        [g.first, g.email, g.id],
      );
      console.log(`  ✓ ${g.id} → HELM ${g.first} (${g.email})`);
    }

    // HR Candidate fixes
    const candFixes = [
      { id: '2fad60cc-f28e-4e85-aee5-5f02d3845f7a', first: 'Auroline', email: 'auroline.helm@academia-helm.test' },
    ];
    console.log(`\n[HR Candidate fixes] ${candFixes.length} à corriger`);
    for (const c of candFixes) {
      await client.query(
        `UPDATE hr_candidates SET "firstName" = $1, email = $2, "updatedAt" = NOW() WHERE id = $3`,
        [c.first, c.email, c.id],
      );
      console.log(`  ✓ ${c.id} → HELM ${c.first} (${c.email})`);
    }

    // ─── VÉRIFICATION FINALE ───
    // Liste élargie de tous les prénoms CSPEB qu'on ne doit plus voir dans AH.
    const cspebFirstNames = [
      // Students prénoms CSPEB
      'Bilane', 'Miracle', 'Marouane', 'Moubdiyath', 'Moumina', 'Zakiath',
      'Judicaël', 'Olouwa-Fèmi', 'Déreck', 'Mariano', 'Marie-Exaucé', 'Olivia',
      'Adéchina', 'Teslime', 'Sèhomie', 'Raïssa', 'Islamiath', 'Hady',
      'Dieudonné', 'Ange', 'Divine', 'Malika', 'Mazoune', 'Altesse',
      'Nadiatou', 'Sèfiou', 'Mouina', 'Rachade', 'Ramane', 'Boris',
      'Merveille', 'Sara', 'Carine', 'Fahim', 'Farouk', 'Charist',
      'Moudjana', 'Iriel', 'Cadnel', 'Angela', 'Olivier', 'Oswaldine',
      'Anne-Marie', 'Jude', 'Armando', 'Abdou Ramane', 'Christian', 'Cécile',
      'Basile', 'Matthias', 'Albéric', 'Alexandrine', 'Charles Boromè',
      'Sèhouanlan', 'Diane', 'Léonce', 'Machkour', 'Mistourath', 'Françoise',
      'Narcisse', 'Winner', 'Owen', 'Latifou', 'Laurice', 'Nongnissou',
      'Fernando', 'Géraud', 'Roumana', 'Youchoura', 'Abdoul Chakour',
      'Nazira', 'Yasmine', 'Follakè', 'Olatoundji', 'Marie-Claire',
      'Abdoulaye', 'Nazif', 'Faosiatou', 'Amza', 'Anatou', 'Djamila',
      'Sanni', 'Ouzérou', 'Afizou', 'Goodness', 'Hakim', 'Kingsley',
      'Olamimé', 'Sylvestre', 'Oswaldo', 'Judith', 'Kadidja', 'Ester',
      'Marouf', 'Aïmane',
      // Staff prénoms CSPEB
      'Saliou', 'Favour',
      // User prénoms CSPEB
      'Sèna',
      // Guardian prénoms CSPEB
      'Jean', 'Dawes', 'Minica', 'Léontine',
      // HR Candidate prénoms CSPEB
      'Aurore',
    ];
    const cspebLastNames = [
      'ABOUBAKARY', 'ACLINOU', 'ADAM', 'ADAMOU', 'ADITTI', 'ADJIBOGOUN',
      'AGLOSSI', 'AKOTCHAYE', 'AKPATA', 'AKPE', 'AKPOVI', 'AKPOVI TOHOU',
      'ALASSANE', 'ALIDOU', 'ALLASSANE', 'ASSAKOU', 'ASSOGBA', 'ATCHADE',
      'AYENA', 'BANKOLE', 'BELLO', 'BIAOU', 'BOSSOU', 'BOUYAGUI', 'CHABI',
      'CHAMOU', 'CODJIA', 'DAGBANON', 'DAGNISSE', 'DEGBE', 'DIMON', 'ETEKA',
      'FADOHAN', 'FONTECLOUNON', 'GNANGASSI', 'GNANHOUI', 'HESSOU', 'IBRAHIM',
      'INOUSSA', 'KANHONOU', 'KARIM', 'KOTCHONI', 'KWAMI ADDO', 'LINO',
      'MAMAH', 'MOUMOUNI', 'MOUSTAPHA', 'ODAH', 'OLODO', 'OROU DAROU',
      'SALAMI', 'SALIFOU', 'SAMANI', 'SAMON', 'SONKPIAN', 'SOURADJOU',
      'TCHABI', 'TCHEBE', 'TOKPONHOUE', 'WOROU', 'WOROU DOUAROU', 'YABI',
      'ZIME', 'ZIME KABOURA',
      'AKPAKI', 'EMMANUEL', 'TOHOU', 'AÏDEHOU', 'DEVO',
    ];

    console.log(`\n[Vérification finale] Recherche de ${cspebFirstNames.length + cspebLastNames.length} noms CSPEB...`);

    let leaks = 0;
    for (const name of [...cspebFirstNames, ...cspebLastNames]) {
      const r = await client.query(`
        SELECT 'students' AS t, id FROM students WHERE "tenantId" = $1 AND ("lastName" = $2 OR "firstName" = $2)
        UNION ALL SELECT 'staff', id FROM staff WHERE "tenantId" = $1 AND ("lastName" = $2 OR "firstName" = $2)
        UNION ALL SELECT 'guardians', id FROM guardians WHERE "tenantId" = $1 AND ("lastName" = $2 OR "firstName" = $2)
        UNION ALL SELECT 'users', id FROM users WHERE "tenantId" = $1 AND ("lastName" = $2 OR "firstName" = $2)
        UNION ALL SELECT 'hr_candidates', id FROM hr_candidates WHERE "tenantId" = $1 AND ("lastName" = $2 OR "firstName" = $2)
      `, [AH_TENANT_ID, name]);
      if (r.rows.length > 0) {
        console.log(`  ❌ "${name}" : ${r.rows.length} occurrence(s) — ${r.rows.map(x => x.t).join(', ')}`);
        leaks++;
      }
    }

    // Vérification emails
    console.log(`\n[Vérification emails] Recherche de leaks...`);
    const emailLeaks = await client.query(`
      SELECT 'staff' AS t, id, email FROM staff WHERE "tenantId" = $1 AND (
        email LIKE '%@gmail.com' OR email LIKE '%akpovi%' OR email LIKE '%tohou%'
        OR email LIKE '%dawes%' OR email LIKE '%saliou%' OR email LIKE '%favour%'
        OR email LIKE '%minica%' OR email LIKE '%leontine%' OR email LIKE '%aurore%'
        OR email LIKE '%adjibogoun%' OR email LIKE '%aglossi%' OR email LIKE '%aidehou%'
        OR email LIKE '%devo%' OR email LIKE '%akpaki%' OR email LIKE '%emmanuel%'
      )
      UNION ALL
      SELECT 'users', id, email FROM users WHERE "tenantId" = $1 AND (
        email LIKE '%@gmail.com' OR email LIKE '%akpovi%' OR email LIKE '%tohou%'
        OR email LIKE '%dawes%' OR email LIKE '%saliou%' OR email LIKE '%favour%'
        OR email LIKE '%minica%' OR email LIKE '%leontine%' OR email LIKE '%aurore%'
      )
      UNION ALL
      SELECT 'guardians', id, email FROM guardians WHERE "tenantId" = $1 AND (
        email LIKE '%@gmail.com' OR email LIKE '%akpovi%' OR email LIKE '%tohou%'
        OR email LIKE '%dawes%' OR email LIKE '%saliou%' OR email LIKE '%favour%'
        OR email LIKE '%minica%' OR email LIKE '%leontine%' OR email LIKE '%aurore%'
        OR email LIKE '%adjibogoun%' OR email LIKE '%aglossi%' OR email LIKE '%aidehou%'
        OR email LIKE '%devo%'
      )
      UNION ALL
      SELECT 'hr_candidates', id, email FROM hr_candidates WHERE "tenantId" = $1 AND (
        email LIKE '%@gmail.com' OR email LIKE '%akpovi%' OR email LIKE '%tohou%'
        OR email LIKE '%dawes%' OR email LIKE '%aurore%'
      )
    `, [AH_TENANT_ID]);
    if (emailLeaks.rows.length > 0) {
      console.log(`  ❌ ${emailLeaks.rows.length} email(s) à risque :`);
      emailLeaks.rows.forEach(r => console.log(`     ${r.t} ${r.id} : ${r.email}`));
      leaks += emailLeaks.rows.length;
    } else {
      console.log(`  ✓ Aucun leak d'email`);
    }

    if (leaks > 0) {
      console.log(`\n⚠️  ${leaks} leak(s) détecté(s) — voir ci-dessus`);
    } else {
      console.log(`\n✅ AUCUN nom CSPEB trouvé dans le tenant Academia Helm — anonymisation 100%`);
    }

    await client.query('COMMIT');
    console.log('✅ Transaction commitée');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
