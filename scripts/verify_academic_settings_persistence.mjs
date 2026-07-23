/**
 * Vérifie la persistance des paramètres académiques dans Neon DB
 * - Liste toutes les entrées de school_academic_settings
 * - Vérifie les status (DRAFT, ACTIVE, LOCKED)
 * - Vérifie le contenu du config JSON
 */
import pg from 'pg';

const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

async function main() {
  const client = new pg.Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('✅ Connecté à Neon DB\n');

    // 1. Vérifier que la table existe
    const tableCheck = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_name = 'school_academic_settings'
    `);
    if (tableCheck.rows.length === 0) {
      console.log('❌ La table school_academic_settings n\'existe pas !');
      return;
    }
    console.log('✅ Table school_academic_settings existe\n');

    // 2. Vérifier le schéma de la table
    const schema = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'school_academic_settings'
      ORDER BY ordinal_position
    `);
    console.log('📋 Schéma de la table:');
    schema.rows.forEach(col => {
      console.log(`  • ${col.column_name} (${col.data_type}) — nullable: ${col.is_nullable}`);
    });
    console.log();

    // 3. Lister tous les paramètres enregistrés
    const all = await client.query(`
      SELECT
        id,
        name,
        "countryCode",
        "levelCode",
        language,
        "schoolYearId",
        status,
        config,
        "createdAt",
        "updatedAt"
      FROM school_academic_settings
      ORDER BY "updatedAt" DESC
      LIMIT 20
    `);
    console.log(`📊 Nombre total de paramètres enregistrés: ${all.rows.length}\n`);

    if (all.rows.length === 0) {
      console.log('⚠️  AUCUN paramètre enregistré — la sauvegarde n\'a PAS persisté en DB !');
      return;
    }

    // Afficher chaque entrée
    all.rows.forEach((row, idx) => {
      console.log(`─── Paramètre #${idx + 1} ───────────────────────────────`);
      console.log(`  ID:         ${row.id}`);
      console.log(`  Nom:        ${row.name}`);
      console.log(`  Niveau:     ${row.levelCode}`);
      console.log(`  Langue:     ${row.language || '(null)'}`);
      console.log(`  Pays:       ${row.countryCode}`);
      console.log(`  Année:      ${row.schoolYearId}`);
      console.log(`  Status:     ${row.status}`);
      console.log(`  Créé le:    ${row.createdAt}`);
      console.log(`  Modifié le: ${row.updatedAt}`);
      const cfg = typeof row.config === 'string' ? JSON.parse(row.config) : row.config;
      console.log(`  Config:`);
      console.log(`    • Types d'évaluation: ${cfg.assessmentTypes?.length || 0} types`);
      if (cfg.assessmentTypes?.length) {
        cfg.assessmentTypes.forEach((at) => {
          console.log(`        - ${at.code} (${at.label}) — required=${at.required}, includedInAverage=${at.includedInAverage}`);
        });
      }
      console.log(`    • Formule matière:     ${cfg.calculationRules?.subjectAverage?.expression || '(non définie)'}`);
      console.log(`    • Formule générale:    ${cfg.calculationRules?.generalAverage?.expression || '(non définie)'}`);
      console.log(`    • Politique absence:   ${cfg.absencePolicy}`);
      console.log(`    • Arrondi:             ${cfg.roundingDecimals} décimales, mode=${cfg.roundingMode}`);
      console.log(`    • Barème:              ${cfg.scoreMin} → ${cfg.scoreMax}, seuil réussite=${cfg.passScore}`);
      console.log(`    • Seuil qualitatif:    ${cfg.qualitativeThreshold}`);
      console.log(`    • Mentions:            ${cfg.mentions?.length || 0} mentions`);
      console.log(`    • Règles classement:   scope=${cfg.rankingScope}, tie=${cfg.tieMode}, excludeAbsentees=${cfg.excludeAbsentees}`);
      console.log(`    • Options bulletin:    showRank=${cfg.bulletinOptions?.showRank}, showMention=${cfg.bulletinOptions?.showMention}, showLogo=${cfg.bulletinOptions?.showSchoolLogo}`);
      console.log();
    });

    // 4. Vérifier spécifiquement le status ACTIVE
    const active = await client.query(`
      SELECT
        id, name, "levelCode", language, status,
        "updatedAt"
      FROM school_academic_settings
      WHERE status = 'ACTIVE'
      ORDER BY "updatedAt" DESC
    `);
    console.log(`✅ Paramètres ACTIVÉS: ${active.rows.length}`);
    active.rows.forEach(r => {
      console.log(`  • [${r.levelCode}|${r.language || 'all'}] ${r.name} — ${r.updatedAt}`);
    });
    console.log();

    // 5. Vérifier les entrées DRAFT
    const drafts = await client.query(`
      SELECT
        id, name, "levelCode", language, status,
        "updatedAt"
      FROM school_academic_settings
      WHERE status = 'DRAFT'
      ORDER BY "updatedAt" DESC
    `);
    console.log(`✏️  Paramètres en BROUILLON: ${drafts.rows.length}`);
    drafts.rows.forEach(r => {
      console.log(`  • [${r.levelCode}|${r.language || 'all'}] ${r.name} — ${r.updatedAt}`);
    });
    console.log();

    // 6. Vérifier les logs d'audit (si table existe)
    try {
      const audit = await client.query(`
        SELECT COUNT(*) AS count FROM academic_settings_audit_logs
      `);
      console.log(`📝 Logs d'audit: ${audit.rows[0].count} entrées`);
    } catch (e) {
      console.log(`⚠️  Table academic_settings_audit_logs non accessible: ${e.message}`);
    }

    console.log('\n✅ Vérification terminée');

  } catch (err) {
    console.error('❌ Erreur:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
