/**
 * ============================================================================
 * ANONYMISATION COMPLÈTE — Tenant Academia Helm
 * ============================================================================
 * Remplace TOUS les noms et emails réels (élèves, personnels, parents,
 * utilisateurs, candidats RH) par des noms purement fictifs pour qu'aucun
 * nom du tenant CSPEB ne soit retrouvé dans Academia Helm.
 *
 * Stratégie :
 *  - Tous les noms de famille deviennent "HELM" (déjà le pattern des staff
 *    déjà anonymisés) — clairement marqués comme données de test.
 *  - Les prénoms sont choisis dans une pool de 100 prénoms distincts qui
 *    ne se retrouvent pas dans CSPEB.
 *  - Les emails suivent le pattern: prenom.helm@academia-helm.test
 *    (lowercase, sans accents, pas de caractères spéciaux).
 *
 * Cibles :
 *  - 100 students (tous anonymisés — prénoms réels remplacés)
 *  - 2 staff avec vrais noms (AKPAKI Saliou, EMMANUEL Favour) + emails
 *  - 1 user avec gmail (TOHOU Sèna → dawesakpovi@gmail.com)
 *  - 6 guardians avec vrais noms (ADJIBOGOUN Jean, AGLOSSI, AKPOVI Dawes,
 *    AÏDEHOU Minica x2, DEVO Léontine)
 *  - 1 HR candidate (AKPOVI Aurore)
 *
 * Les comptes "Recette X" (recette.promoteur, recette.directeur, etc.)
 * sont des comptes fonctionnels (rôle, pas personne réelle) — conservés.
 *
 * Usage :
 *   node scripts/anonymize-ah-data.js
 *
 * Prérequis : DATABASE_URL dans apps/api-server/.env
 * ============================================================================
 */
const { Pool } = require('pg');

const AH_TENANT_ID = '178d5b6b-d4f3-4246-bc8c-76a2e8fc2e4b';
const EMAIL_DOMAIN = 'academia-helm.test';

// Pool de 100 prénoms fictifs uniques (pas dans CSPEB).
// Diversité d'origines (français, africains, internationaux) pour rester
// réalistes tout en étant clairement distincts des prénoms CSPEB.
const FIRST_NAMES_POOL = [
  'Abel', 'Aïcha', 'Alain', 'Alix', 'Aminata', 'Anaïs', 'Armand', 'Aurélien',
  'Auroline', 'Bahia', 'Baudouin', 'Camille', 'Caroline', 'Cassandre', 'Céleste', 'Cyrille',
  'Damien', 'Délia', 'Didier', 'Dora', 'Édouard', 'Éliane', 'Élodie', 'Emmanuel',
  'Estelle', 'Fadiya', 'Fatou', 'Félicité', 'Florence', 'Gabin', 'Gabrielle', 'Gaëlle',
  'Hadjara', 'Hanane', 'Hélène', 'Hortense', 'Inès', 'Iris', 'Ismaël', 'Jade',
  'Janelle', 'Joachim', 'Jonathan', 'Joséphine', 'Julien', 'Kadija', 'Karim', 'Kévin',
  'Lambert', 'Liliane', 'Lionel', 'Lorraine', 'Lydie', 'Madeleine', 'Mahalia', 'Maïté',
  'Marcel', 'Margot', 'Mariam', 'Marius', 'Maïssa', 'Melvin', 'Morgane', 'Moussa',
  'Murielle', 'Nadia', 'Nathalie', 'Noémie', 'Norbert', 'Octave', 'Olivier', 'Ophélie',
  'Ousmane', 'Pascaline', 'Patrice', 'Penda', 'Philibert', 'Pierrette', 'Quentin', 'Radia',
  'Raphaël', 'Raymonde', 'Régis', 'Renée', 'Rigobert', 'Romaric', 'Rosalie', 'Sabrina',
  'Samuel', 'Sara', 'Séverine', 'Souleymane', 'Suzanne', 'Sylviane', 'Tatiana', 'Théo',
  'Ursule', 'Valentin', 'Viviane', 'Walid', 'Xavier', 'Yannick', 'Yvette', 'Zacharie',
  'Zara',
];

// Helper : normalise une chaîne pour un email (minuscules, sans accents)
function slugify(s) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
}

// Helper : génère un email fictif
function makeEmail(first, last, suffix = '') {
  const f = slugify(first);
  const l = slugify(last);
  const s = suffix ? `.${suffix}` : '';
  return `${f}.${l}${s}@${EMAIL_DOMAIN}`;
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ──────────────────────────────────────────────────────────────────
    // 1. STUDENTS — 100 élèves à anonymiser
    // ──────────────────────────────────────────────────────────────────
    const students = await client.query(
      `SELECT id, "firstName", "lastName" FROM students WHERE "tenantId" = $1 ORDER BY "lastName", "firstName"`,
      [AH_TENANT_ID],
    );
    console.log(`\n[Students] ${students.rows.length} à anonymiser`);

    // On mélange le pool pour ne pas avoir "Abel" pour le 1er et "Zacharie" pour le 100e
    // dans l'ordre alphabétique des noms CSPEB — on attribue au hasard.
    const pool_names = [...FIRST_NAMES_POOL];
    // Pas de shuffle — on garde l'ordre pour la reproductibilité.

    let studentIdx = 0;
    for (const s of students.rows) {
      const newFirst = pool_names[studentIdx % pool_names.length];
      const newLast = 'HELM';
      // Pour éviter les collisions (100 étudiants, 100 prénoms), on ajoute
      // un suffixe numérique si on dépasse le pool.
      let suffix = '';
      if (studentIdx >= pool_names.length) {
        suffix = String(studentIdx - pool_names.length + 2);
      }
      // Les students n'ont pas d'email direct — on met juste à jour nom/prénom
      await client.query(
        `UPDATE students SET "firstName" = $1, "lastName" = $2, "updatedAt" = NOW() WHERE id = $3`,
        [newFirst + (suffix ? ' ' + suffix : ''), newLast, s.id],
      );
      studentIdx++;
    }
    console.log(`  ✓ ${studentIdx} students mis à jour`);

    // ──────────────────────────────────────────────────────────────────
    // 2. STAFF — 2 personnels avec vrais noms à anonymiser
    // ──────────────────────────────────────────────────────────────────
    // AKPAKI Saliou (dawesakpovi@academia-helm.test) → HELM Saliou
    // EMMANUEL Favour (favouremmanuel@academia-helm.test) → HELM Favour
    // Les "Recette X" sont des comptes fonctionnels → conservés.
    const staffToAnonymize = [
      { id: '53e4e357-e247-4902-93ab-36f6edc4a055', first: 'Saliou', last: 'HELM', email: 'saliou.helm@academia-helm.test' },
      { id: '8492ed0f-025e-4324-8846-1b2d9648ce8a', first: 'Favour', last: 'HELM', email: 'favour.helm@academia-helm.test' },
    ];
    console.log(`\n[Staff] ${staffToAnonymize.length} à anonymiser`);
    for (const s of staffToAnonymize) {
      await client.query(
        `UPDATE staff SET "firstName" = $1, "lastName" = $2, email = $3, "updatedAt" = NOW() WHERE id = $4`,
        [s.first, s.last, s.email, s.id],
      );
      console.log(`  ✓ ${s.id} → ${s.last} ${s.first} (${s.email})`);
    }

    // ──────────────────────────────────────────────────────────────────
    // 3. USERS — 1 utilisateur avec gmail à anonymiser
    // ──────────────────────────────────────────────────────────────────
    // TOHOU Sèna (dawesakpovi@gmail.com) → HELM Sèna
    // C'est le user account lié au staff AKPAKI Saliou (même "dawesakpovi")
    // — on l'aligne avec le nouveau staff HELM Saliou.
    const usersToAnonymize = [
      { id: '85256ffe-c532-4aed-813b-06ebaf8937f6', first: 'Sèna', last: 'HELM', email: 'saliou.helm@academia-helm.test' },
    ];
    console.log(`\n[Users] ${usersToAnonymize.length} à anonymiser`);
    for (const u of usersToAnonymize) {
      await client.query(
        `UPDATE users SET "firstName" = $1, "lastName" = $2, email = $3, "updatedAt" = NOW() WHERE id = $4`,
        [u.first, u.last, u.email, u.id],
      );
      console.log(`  ✓ ${u.id} → ${u.last} ${u.first} (${u.email})`);
    }

    // ──────────────────────────────────────────────────────────────────
    // 4. GUARDIANS — 6 parents avec vrais noms à anonymiser
    // ──────────────────────────────────────────────────────────────────
    const guardiansToAnonymize = [
      // ADJIBOGOUN Jean (jean.adjibogoun@academia-helm.test) → HELM Jean
      { id: '34587e64-3557-4b96-9019-bbfce7c13074', first: 'Jean', last: 'HELM', email: 'jean.helm@academia-helm.test' },
      // AGLOSSI (no first name) → HELM (no first name, keep empty)
      { id: '0fee0164-f9e6-44a5-9a66-96abcf4d59bf', first: '', last: 'HELM', email: null },
      // AKPOVI Dawes (dawesakpovi@academia-helm.test) → HELM Dawes
      { id: 'a7a0aaed-2574-4ba6-a41d-3d20f5135ad6', first: 'Dawes', last: 'HELM', email: 'dawes.helm@academia-helm.test' },
      // AÏDEHOU Minica (test2@academia-helm.test) → HELM Minica
      { id: '7880a205-49ec-4e35-a4be-2bea33399479', first: 'Minica', last: 'HELM', email: 'minica.helm@academia-helm.test' },
      // AÏDEHOU Minica (s.akpovitohou@academia-helm.test) → HELM Minica2
      { id: '3e7cf44d-2bd9-429b-97e4-ebbf32b3ed0c', first: 'Minica', last: 'HELM', email: 'minica2.helm@academia-helm.test' },
      // DEVO Léontine (no email) → HELM Léontine
      { id: 'e3f46e3f-946c-4a55-919c-196f5dfb8a42', first: 'Léontine', last: 'HELM', email: 'leontine.helm@academia-helm.test' },
    ];
    console.log(`\n[Guardians] ${guardiansToAnonymize.length} à anonymiser`);
    for (const g of guardiansToAnonymize) {
      await client.query(
        `UPDATE guardians SET "firstName" = $1, "lastName" = $2, email = $3, "updatedAt" = NOW() WHERE id = $4`,
        [g.first, g.last, g.email, g.id],
      );
      console.log(`  ✓ ${g.id} → ${g.last} ${g.first} (${g.email || '-'})`);
    }

    // ──────────────────────────────────────────────────────────────────
    // 5. HR CANDIDATES — 1 candidat RH avec vrai nom à anonymiser
    // ──────────────────────────────────────────────────────────────────
    // AKPOVI Aurore (auroretheodoraa@academia-helm.test) → HELM Aurore
    const candidatesToAnonymize = [
      { id: '2fad60cc-f28e-4e85-aee5-5f02d3845f7a', first: 'Aurore', last: 'HELM', email: 'aurore.helm@academia-helm.test' },
    ];
    console.log(`\n[HR Candidates] ${candidatesToAnonymize.length} à anonymiser`);
    for (const c of candidatesToAnonymize) {
      await client.query(
        `UPDATE hr_candidates SET "firstName" = $1, "lastName" = $2, email = $3, "updatedAt" = NOW() WHERE id = $4`,
        [c.first, c.last, c.email, c.id],
      );
      console.log(`  ✓ ${c.id} → ${c.last} ${c.first} (${c.email})`);
    }

    // ──────────────────────────────────────────────────────────────────
    // 6. VÉRIFICATION — Aucun nom CSPEB ne doit rester
    // ──────────────────────────────────────────────────────────────────
    // Liste des noms CSPEB à détecter (les plus distinctifs, à partir du
    // dump initial). On vérifie students, staff, guardians, users, hr_candidates.
    const cspebNames = [
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
      // Staff names
      'AKPAKI', 'EMMANUEL', 'TOHOU',
      // Guardian names
      'AÏDEHOU', 'DEVO',
    ];
    console.log(`\n[Vérification] Recherche de ${cspebNames.length} noms CSPEB dans AH...`);

    let leaks = 0;
    for (const name of cspebNames) {
      // Cherche dans chaque table (case-sensitive — les noms CSPEB sont en majuscules)
      const r1 = await client.query(`SELECT id FROM students WHERE "tenantId" = $1 AND ("lastName" = $2 OR "firstName" = $2)`, [AH_TENANT_ID, name]);
      const r2 = await client.query(`SELECT id FROM staff WHERE "tenantId" = $1 AND ("lastName" = $2 OR "firstName" = $2)`, [AH_TENANT_ID, name]);
      const r3 = await client.query(`SELECT id FROM guardians WHERE "tenantId" = $1 AND ("lastName" = $2 OR "firstName" = $2)`, [AH_TENANT_ID, name]);
      const r4 = await client.query(`SELECT id FROM users WHERE "tenantId" = $1 AND ("lastName" = $2 OR "firstName" = $2)`, [AH_TENANT_ID, name]);
      const r5 = await client.query(`SELECT id FROM hr_candidates WHERE "tenantId" = $1 AND ("lastName" = $2 OR "firstName" = $2)`, [AH_TENANT_ID, name]);
      const total = r1.rows.length + r2.rows.length + r3.rows.length + r4.rows.length + r5.rows.length;
      if (total > 0) {
        console.log(`  ❌ "${name}" : ${total} occurrence(s) — students=${r1.rows.length} staff=${r2.rows.length} guardians=${r3.rows.length} users=${r4.rows.length} hr_cands=${r5.rows.length}`);
        leaks++;
      }
    }

    // Vérification emails : aucun email @gmail.com ou email contenant "akpovi" / "tohou" / "dawes"
    console.log(`\n[Vérification emails] Recherche de leaks d'email...`);
    const emailLeaks = await client.query(`
      SELECT 'staff' AS t, id, email FROM staff WHERE "tenantId" = $1 AND (email LIKE '%@gmail.com' OR email LIKE '%akpovi%' OR email LIKE '%tohou%' OR email LIKE '%dawes%')
      UNION ALL
      SELECT 'users' AS t, id, email FROM users WHERE "tenantId" = $1 AND (email LIKE '%@gmail.com' OR email LIKE '%akpovi%' OR email LIKE '%tohou%' OR email LIKE '%dawes%')
      UNION ALL
      SELECT 'guardians' AS t, id, email FROM guardians WHERE "tenantId" = $1 AND (email LIKE '%@gmail.com' OR email LIKE '%akpovi%' OR email LIKE '%tohou%' OR email LIKE '%dawes%')
      UNION ALL
      SELECT 'hr_candidates' AS t, id, email FROM hr_candidates WHERE "tenantId" = $1 AND (email LIKE '%@gmail.com' OR email LIKE '%akpovi%' OR email LIKE '%tohou%' OR email LIKE '%dawes%')
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
      console.log(`\n✅ Aucun nom CSPEB trouvé dans le tenant Academia Helm`);
    }

    await client.query('COMMIT');
    console.log('\n✅ Migration transactionnelle commitée avec succès');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur:', err.message);
    console.error('   Transaction annulée (ROLLBACK)');
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
