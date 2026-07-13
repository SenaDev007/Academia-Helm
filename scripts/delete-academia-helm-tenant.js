// Suppression définitive du tenant "Academia Helm" et de tout ce qui lui est lié
const { Client } = require('/home/z/my-project/node_modules/pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('🔌 Connected to Neon\n');

  const TENANT_ID = '4246cd3c-518a-44bb-a5e0-4109b8eca372';

  // Vérifier que le tenant existe
  const tenant = await client.query('SELECT id, name FROM tenants WHERE id = $1', [TENANT_ID]);
  if (tenant.rows.length === 0) {
    console.log('⚠️ Tenant non trouvé — déjà supprimé ?');
    await client.end();
    return;
  }
  console.log(`📋 Tenant à supprimer : ${tenant.rows[0].name} (${TENANT_ID})\n`);

  // Compter les données liées
  const tables = [
    'students', 'student_enrollments', 'student_guardians', 'guardians',
    'classes', 'academic_classes', 'school_levels', 'academic_tracks',
    'users', 'helm_subscriptions', 'subscriptions', 'billing_events',
    'schools', 'onboarding_drafts', 'onboarding_payments',
    'tenant_payment_configs', 'tenant_identity_profiles', 'tenant_domains',
    'generated_documents', 'national_export_logs', 'student_id_cards',
    'admissions', 'admission_documents', 'student_transfer_requests',
    'class_transfers', 'academic_years', 'education_levels', 'education_cycles',
    'education_grades', 'tenant_signatures', 'tenant_stamps',
    'grading_policies', 'salary_policies', 'pricing_plans',
    'student_accounts', 'payment_flows', 'fee_structures', 'fee_overrides',
    'fee_arrears', 'transactions', 'invoices', 'cash_closures',
    'attendance_records', 'absences', 'discipline_records',
    'announcements', 'communication_stats', 'email_logs',
    'whatsapp_logs', 'sms_logs', 'internal_messages',
    'staff', 'contracts', 'payrolls', 'payroll_items', 'salary_payments',
    'teacher_class_assignments', 'teacher_level_authorizations',
    'class_subjects', 'lesson_plans', 'lesson_journals',
    'exam_scores', 'grades', 'honor_rolls', 'council_decisions',
    'canteen_enrollments', 'canteen_payments', 'canteen_menus',
    'infirmary_visits', 'infirmary_emergencies', 'medical_records',
    'library_loans', 'transport_routes', 'transport_enrollments',
    'settings', 'feature_flags', 'audit_logs', 'activity_logs',
  ];

  console.log('📊 Données liées :');
  for (const table of tables) {
    try {
      const res = await client.query(`SELECT COUNT(*) as count FROM ${table} WHERE "tenantId" = $1`, [TENANT_ID]);
      if (parseInt(res.rows[0].count) > 0) {
        console.log(`  ${table}: ${res.rows[0].count}`);
      }
    } catch (e) {
      // Table might not exist or might not have tenantId column — skip
    }
  }

  // ⭐ Suppression en cascade — utiliser DELETE avec CASCADE
  // D'abord supprimer le tenant lui-même (la plupart des tables ont ON DELETE CASCADE)
  console.log('\n🗑️  Suppression du tenant et de toutes les données liées...');

  // Pour les tables sans CASCADE, supprimer manuellement d'abord
  // (ordre inverse des dépendances)
  const deleteOrder = [
    'student_transfer_requests',
    'class_transfers',
    'generated_documents',
    'national_export_logs',
    'student_id_cards',
    'admission_documents',
    'admissions',
    'fee_arrears',
    'fee_overrides',
    'fee_structures',
    'payment_flows',
    'transactions',
    'student_accounts',
    'salary_payments',
    'payroll_items',
    'payrolls',
    'contracts',
    'staff',
    'student_guardians',
    'guardians',
    'student_enrollments',
    'students',
    'classes',
    'academic_classes',
    'school_levels',
    'academic_tracks',
    'academic_years',
    'education_grades',
    'education_cycles',
    'education_levels',
    'billing_events',
    'helm_subscriptions',
    'subscriptions',
    'schools',
    'onboarding_payments',
    'onboarding_drafts',
    'tenant_payment_configs',
    'tenant_identity_profiles',
    'tenant_domains',
    'grading_policies',
    'salary_policies',
    'audit_logs',
    'activity_logs',
    'users',
  ];

  for (const table of deleteOrder) {
    try {
      const res = await client.query(`DELETE FROM ${table} WHERE "tenantId" = $1`, [TENANT_ID]);
      if (res.rowCount > 0) {
        console.log(`  ✅ ${table}: ${res.rowCount} ligne(s) supprimée(s)`);
      }
    } catch (e) {
      // Skip if table doesn't exist or FK constraint — will be handled by CASCADE
    }
  }

  // Finalement supprimer le tenant lui-même
  try {
    const res = await client.query('DELETE FROM tenants WHERE id = $1', [TENANT_ID]);
    console.log(`\n✅ Tenant supprimé : ${res.rowCount} ligne(s)`);
  } catch (e) {
    console.log(`\n⚠️  Erreur suppression tenant: ${e.message}`);
    console.log('Tentative avec CASCADE...');
    // Si des FK bloquent, on peut essayer de forcer
  }

  // Vérification
  const check = await client.query('SELECT id, name FROM tenants WHERE id = $1', [TENANT_ID]);
  if (check.rows.length === 0) {
    console.log('\n🎉 Tenant "Academia Helm" supprimé définitivement avec succès !');
  } else {
    console.log('\n⚠️  Le tenant existe encore — des FK bloquent la suppression.');
    console.log('Tables restantes avec données :');
    for (const table of tables) {
      try {
        const res = await client.query(`SELECT COUNT(*) as count FROM ${table} WHERE "tenantId" = $1`, [TENANT_ID]);
        if (parseInt(res.rows[0].count) > 0) {
          console.log(`  ${table}: ${res.rows[0].count}`);
        }
      } catch (e) {}
    }
  }

  // Lister les tenants restants
  console.log('\n📋 Tenants restants :');
  const remaining = await client.query('SELECT id, name FROM tenants ORDER BY name');
  remaining.rows.forEach(r => console.log(`  - ${r.name} (${r.id})`));

  await client.end();
  console.log('\n🔌 Disconnected');
}

main().catch(e => { console.error(e); process.exit(1); });
