/**
 * ============================================================================
 * SCRIPT DE VÉRIFICATION RLS - ACADEMIA HUB
 * ============================================================================
 * 
 * Ce script vérifie que le système RLS est correctement configuré
 * et que toutes les politiques sont en place.
 * 
 * Usage:
 *   npx ts-node scripts/verify-rls.ts
 * 
 * ============================================================================
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyRLS() {
  console.log('🔍 Vérification du système RLS...\n');

  // 1. Vérifier que RLS est activé sur les tables principales
  console.log('1. Vérification RLS sur les tables principales...');
  const tables = await prisma.$queryRaw<Array<{ tablename: string; rowsecurity: boolean }>>`
    SELECT tablename, rowsecurity
    FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename IN (
      'tenants', 'users', 'students', 'guardians', 
      'student_guardians', 'academic_years', 'school_levels',
      'classes', 'teachers', 'payments', 'student_fees'
    )
    ORDER BY tablename;
  `;

  const tablesWithoutRLS = tables.filter(t => !t.rowsecurity);
  if (tablesWithoutRLS.length > 0) {
    console.error('❌ Les tables suivantes n\'ont pas RLS activé:');
    tablesWithoutRLS.forEach(t => console.error(`   - ${t.tablename}`));
  } else {
    console.log('✅ Toutes les tables principales ont RLS activé');
  }

  // 2. Vérifier les fonctions helper
  console.log('\n2. Vérification des fonctions helper...');
  const functions = await prisma.$queryRaw<Array<{ proname: string }>>`
    SELECT proname
    FROM pg_proc
    WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'auth')
    AND proname IN (
      'current_tenant_id',
      'is_super_admin',
      'is_orion',
      'user_role',
      'is_parent_of_student',
      'user_student_ids',
      'has_tenant_access'
    )
    ORDER BY proname;
  `;

  const expectedFunctions = [
    'current_tenant_id',
    'is_super_admin',
    'is_orion',
    'user_role',
    'is_parent_of_student',
    'user_student_ids',
    'has_tenant_access'
  ];

  const missingFunctions = expectedFunctions.filter(
    f => !functions.find(fn => fn.proname === f)
  );

  if (missingFunctions.length > 0) {
    console.error('❌ Fonctions manquantes:');
    missingFunctions.forEach(f => console.error(`   - auth.${f}()`));
  } else {
    console.log('✅ Toutes les fonctions helper sont présentes');
  }

  // 3. Vérifier les politiques RLS
  console.log('\n3. Vérification des politiques RLS...');
  const policies = await prisma.$queryRaw<Array<{ tablename: string; policyname: string; cmd: string }>>`
    SELECT tablename, policyname, cmd
    FROM pg_policies
    WHERE schemaname = 'public'
    ORDER BY tablename, policyname;
  `;

  const tablePolicyCounts = policies.reduce((acc, p) => {
    acc[p.tablename] = (acc[p.tablename] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log(`✅ ${policies.length} politiques trouvées sur ${Object.keys(tablePolicyCounts).length} tables`);
  
  // Afficher les tables avec le plus de politiques
  const topTables = Object.entries(tablePolicyCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  console.log('   Top 5 tables avec politiques:');
  topTables.forEach(([table, count]) => {
    console.log(`   - ${table}: ${count} politiques`);
  });

  // 4. Vérifier les index sur tenant_id
  console.log('\n4. Vérification des index sur tenant_id...');
  const indexes = await prisma.$queryRaw<Array<{ tablename: string; indexname: string }>>`
    SELECT 
      t.tablename,
      i.indexname
    FROM pg_indexes i
    JOIN pg_tables t ON i.tablename = t.tablename
    WHERE i.schemaname = 'public'
    AND i.indexname LIKE '%tenant_id%'
    ORDER BY t.tablename;
  `;

  console.log(`✅ ${indexes.length} index sur tenant_id trouvés`);

  // 5. Vérifier les rôles PostgreSQL
  console.log('\n5. Vérification des rôles PostgreSQL...');
  const roles = await prisma.$queryRaw<Array<{ rolname: string }>>`
    SELECT rolname
    FROM pg_roles
    WHERE rolname IN ('academia_app', 'academia_super_admin', 'academia_orion')
    ORDER BY rolname;
  `;

  const expectedRoles = ['academia_app', 'academia_super_admin', 'academia_orion'];
  const missingRoles = expectedRoles.filter(
    r => !roles.find(role => role.rolname === r)
  );

  if (missingRoles.length > 0) {
    console.error('❌ Rôles manquants:');
    missingRoles.forEach(r => console.error(`   - ${r}`));
  } else {
    console.log('✅ Tous les rôles sont présents');
  }

  // 6. Résumé
  console.log('\n' + '='.repeat(60));
  console.log('📊 RÉSUMÉ DE LA VÉRIFICATION');
  console.log('='.repeat(60));
  console.log(`Tables avec RLS: ${tables.filter(t => t.rowsecurity).length}/${tables.length}`);
  console.log(`Fonctions helper: ${functions.length}/${expectedFunctions.length}`);
  console.log(`Politiques RLS: ${policies.length}`);
  console.log(`Index tenant_id: ${indexes.length}`);
  console.log(`Rôles PostgreSQL: ${roles.length}/${expectedRoles.length}`);

  if (
    tablesWithoutRLS.length === 0 &&
    missingFunctions.length === 0 &&
    missingRoles.length === 0
  ) {
    console.log('\n✅ Toutes les vérifications ont réussi !');
    console.log('🎉 Le système RLS est correctement configuré.');
  } else {
    console.log('\n❌ Certaines vérifications ont échoué.');
    console.log('⚠️  Veuillez corriger les problèmes ci-dessus.');
    process.exit(1);
  }
}

// Exécuter la vérification
verifyRLS()
  .catch((error) => {
    console.error('❌ Erreur lors de la vérification:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
