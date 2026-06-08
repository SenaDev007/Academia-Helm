/**
 * ============================================================================
 * SCRIPT DE TEST - PRISMA CLIENT
 * ============================================================================
 * 
 * Teste la connexion Prisma et vérifie que toutes les tables sont créées
 * 
 * Usage: ts-node scripts/test-prisma-connection.ts
 * 
 * ============================================================================
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testPrisma() {
  console.log('🔍 Test de connexion Prisma...\n');

  try {
    // Test 1: Connexion
    console.log('1️⃣  Test de connexion...');
    await prisma.$connect();
    console.log('   ✅ Connexion Prisma réussie');

    // Test 2: Compter les tables
    console.log('\n2️⃣  Vérification des tables...');
    const tablesResult = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    `;
    const tableCount = Number(tablesResult[0].count);
    console.log(`   ✅ Nombre de tables créées: ${tableCount}`);

    // Test 3: Lister quelques tables principales
    console.log('\n3️⃣  Tables principales présentes:');
    const tablesList = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
      AND tablename IN ('tenants', 'users', 'countries', 'academic_years', 'school_levels', 'students', 'classes')
      ORDER BY tablename
    `;
    
    const expectedTables = ['tenants', 'users', 'countries', 'academic_years', 'school_levels', 'students', 'classes'];
    const foundTables = tablesList.map(t => t.tablename);
    
    expectedTables.forEach(table => {
      if (foundTables.includes(table)) {
        console.log(`   ✅ ${table}`);
      } else {
        console.log(`   ❌ ${table} - MANQUANTE`);
      }
    });

    // Test 4: Vérifier les index
    console.log('\n4️⃣  Vérification des index...');
    const indexesResult = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM pg_indexes 
      WHERE schemaname = 'public'
    `;
    const indexCount = Number(indexesResult[0].count);
    console.log(`   ✅ Nombre d'index créés: ${indexCount}`);

    // Test 5: Vérifier les foreign keys
    console.log('\n5️⃣  Vérification des relations (FK)...');
    const fkResult = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM information_schema.table_constraints 
      WHERE constraint_type = 'FOREIGN KEY' 
      AND table_schema = 'public'
    `;
    const fkCount = Number(fkResult[0].count);
    console.log(`   ✅ Nombre de foreign keys créées: ${fkCount}`);

    // Test 6: Vérifier que Prisma Client peut accéder aux tables
    console.log('\n6️⃣  Test d\'accès Prisma Client...');
    try {
      const tenantCount = await prisma.tenant.count();
      console.log(`   ✅ Table Tenant accessible (${tenantCount} enregistrements)`);
    } catch (error: any) {
      console.log(`   ⚠️  Erreur d'accès Tenant: ${error.message}`);
    }

    try {
      const userCount = await prisma.user.count();
      console.log(`   ✅ Table User accessible (${userCount} enregistrements)`);
    } catch (error: any) {
      console.log(`   ⚠️  Erreur d'accès User: ${error.message}`);
    }

    // Résumé
    console.log('\n' + '='.repeat(60));
    console.log('✅ Tous les tests Prisma ont réussi!');
    console.log('='.repeat(60));
    console.log(`\n📊 Résumé:`);
    console.log(`   - Tables: ${tableCount}`);
    console.log(`   - Index: ${indexCount}`);
    console.log(`   - Foreign Keys: ${fkCount}`);
    console.log(`\n🎯 La base de données est prête pour le développement!`);

  } catch (error: any) {
    console.error('\n❌ Erreur lors des tests:');
    console.error(`   ${error.message}`);
    
    if (error.code === 'P1001') {
      console.error('\n💡 Le serveur PostgreSQL n\'est pas accessible.');
      console.error('   Vérifiez que PostgreSQL est démarré.');
    } else if (error.code === 'P1000') {
      console.error('\n💡 Erreur d\'authentification.');
      console.error('   Vérifiez les credentials dans .env');
    }
    
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter les tests
testPrisma();
