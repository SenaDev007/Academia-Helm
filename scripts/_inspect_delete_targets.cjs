/**
 * Inspection des 4 personnels à supprimer (Sophie Test, Fatou Test,
 * Léontine Devo, Jean-Baptiste Adjovi) + inventaire de leurs données liées.
 */
const pg = require('pg');

const c = new pg.Client({
  connectionString: 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
  ssl: { rejectUnauthorized: false },
});

const TARGETS = [
  { first: 'Sophie', last: 'Test' },
  { first: 'Fatou', last: 'Test' },
  { first: 'Léontine', last: 'Devo' },
  { first: 'Jean-Baptiste', last: 'Adjovi' },
];

(async () => {
  await c.connect();

  // Pass 1 : retrouver les Staff correspondants (nom/prénom insensible à la casse)
  for (const t of TARGETS) {
    console.log(`\n=== ${t.first} ${t.last} ===`);
    const staff = await c.query(
      `SELECT id, "tenantId", "firstName", "lastName", email, position, status,
              "employeeNumber", "globalMatricule"
       FROM staff
       WHERE lower("firstName") = lower($1) AND lower("lastName") = lower($2)`,
      [t.first, t.last],
    );
    if (staff.rows.length === 0) {
      console.log('  (aucun staff trouvé — recherche large)');
      const wide = await c.query(
        `SELECT id, "tenantId", "firstName", "lastName", email FROM staff
         WHERE lower("lastName") = lower($2) OR lower("firstName") = lower($1)`,
        [t.first, t.last],
      );
      wide.rows.forEach((r) => console.log('  ~', JSON.stringify(r)));
      continue;
    }
    for (const s of staff.rows) {
      console.log(`  Staff ${s.id} | ${s.firstName} ${s.lastName} | ${s.email} | ${s.position} | ${s.status} | ${s.employeeNumber}`);
      const sid = s.id;

      // Inventaire des tables liées contenant staffId / teacherId / userId
      const inv = {};
      const probes = [
        ['contracts', `SELECT count(*)::int AS n FROM contracts WHERE "staffId" = $1`],
        ['hr_internships', `SELECT count(*)::int AS n FROM hr_internships WHERE "staffId" = $1`],
        ['hr_payroll_documents (payroll)', `SELECT count(*)::int AS n FROM hr_payroll_documents WHERE "staffId" = $1`],
        ['teachers (email link)', `SELECT count(*)::int AS n FROM teachers WHERE email = $1`],
        ['users (email link)', `SELECT count(*)::int AS n FROM users WHERE email = $1`],
        ['salaries', `SELECT count(*)::int AS n FROM salaries WHERE "staffId" = $1`],
      ];
      for (const [label, q] of probes) {
        try {
          const r = await c.query(q, [label.includes('email') ? s.email : sid]);
          if (r.rows[0].n > 0) inv[label] = r.rows[0].n;
        } catch (e) { /* table inexistante */ }
      }
      console.log('  Données liées:', JSON.stringify(inv));

      // Users liés par email (pour montrer le rôle)
      const u = await c.query(
        `SELECT id, email, role, status FROM users WHERE lower(email) = lower($1)`,
        [s.email],
      );
      u.rows.forEach((r) => console.log(`  User ${r.id} | ${r.email} | ${r.role} | ${r.status}`));
    }
  }

  // Contrôles croisés : payments / finance liés à ces emails ?
  console.log('\n=== Vérifications croisées ===');
  const emails = [];
  for (const t of TARGETS) {
    const r = await c.query(
      `SELECT email FROM staff WHERE lower("firstName")=lower($1) AND lower("lastName")=lower($2)`,
      [t.first, t.last],
    );
    r.rows.forEach((x) => x.email && emails.push(x.email));
  }
  if (emails.length) {
    console.log('Emails cibles:', emails.join(', '));
    for (const em of emails) {
      const tables = ['payments', 'invoices', 'receipts'];
      for (const tb of tables) {
        try {
          const r = await c.query(`SELECT count(*)::int AS n FROM ${tb} WHERE lower(email)=lower($1)`, [em]);
          if (r.rows[0].n > 0) console.log(`  ${tb}: ${r.rows[0].n} ligne(s) pour ${em}`);
        } catch (e) { /* table absente */ }
      }
    }
  }

  await c.end();
})().catch((e) => { console.error('ERREUR:', e.message); process.exit(1); });
