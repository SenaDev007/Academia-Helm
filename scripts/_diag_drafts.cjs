/** Diagnostic : drafts récents + reçus/payments existants. */
const pg = require('pg');
async function connectWithRetry() {
  for (let i = 0; i < 6; i++) {
    const c = new pg.Client({
      connectionString: 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
      ssl: { rejectUnauthorized: false },
    });
    try { await c.connect(); return c; } catch (e) {
      await c.end().catch(() => {});
      await new Promise(r => setTimeout(r, 5000 + i * 4000));
    }
  }
  throw new Error('Impossible de se connecter');
}
(async () => {
  const c = await connectWithRetry();

  // Colonnes de onboarding_drafts
  const cols = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name='onboarding_drafts' ORDER BY ordinal_position");
  console.log('onboarding_drafts cols:', cols.rows.map(r => r.column_name).join(', '));

  const drafts = await c.query(`SELECT id, status, school_name, city, bilingual, preferred_subdomain,
    schools_count, promoter_email, created_at, updated_at, price_snapshot
    FROM onboarding_drafts ORDER BY created_at DESC LIMIT 8`);
  console.log('\n=== Drafts récents ===');
  drafts.rows.forEach((d) => {
    const p = d.price_snapshot || {};
    console.log(`- ${d.school_name} | ${d.status} | bilingue=${d.bilingual} | schools=${d.schools_count} | sub=${d.preferred_subdomain} | ${d.promoter_email} | ${new Date(d.created_at).toISOString().slice(0, 16)}`);
    console.log(`  id=${d.id}`);
    console.log(`  snap: plan=${p.planName} initialFee=${p.initialFee} yearly=${p.yearlyPrice} activationTotal=${p.activationTotal} annexRank=${p.annexRank}`);
    console.log(`  paymentMarked=${JSON.stringify(p.paymentMarked || {})}`);
    console.log(`  annexes=${JSON.stringify(d.annexes || [])}`);
  });

  // Tables de reçus / factures existantes ?
  for (const t of ['receipts', 'invoices', 'payment_receipts', 'documents']) {
    const ex = await c.query(`SELECT to_regclass($1) AS t`, [`public.${t}`]);
    if (ex.rows[0].t) {
      const n = await c.query(`SELECT count(*)::int AS n FROM ${t}`);
      console.log(`table ${t}: ${n.rows[0].n} lignes`);
    }
  }

  await c.end();
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
