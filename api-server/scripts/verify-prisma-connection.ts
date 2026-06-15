/**
 * ============================================================================
 * SCRIPT DE VÉRIFICATION - CONNEXION PRISMA À SUPABASE
 * ============================================================================
 * 
 * Vérifie que Prisma peut se connecter correctement à Supabase
 * 
 * Usage: ts-node scripts/verify-prisma-connection.ts
 * 
 * ============================================================================
 */

import { PrismaClient } from '@prisma/client';

async function verifyConnection() {
  console.log('🔍 Vérification de la connexion Prisma à Supabase...\n');

  // 1. Vérifier les variables d'environnement
  console.log('1️⃣  Vérification des variables d\'environnement:');
  const databaseUrl = process.env.DATABASE_URL;
  const directUrl = process.env.DIRECT_URL;

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL n\'est pas défini');
    console.error('   Configurez DATABASE_URL dans votre fichier .env');
    process.exit(1);
  } else {
    // Masquer le mot de passe dans l'URL pour la sécurité
    const maskedUrl = databaseUrl.replace(/:[^:@]+@/, ':****@');
    console.log(`✅ DATABASE_URL est défini: ${maskedUrl}`);
  }

  if (!directUrl) {
    console.error('❌ DIRECT_URL n\'est pas défini');
    console.error('   Configurez DIRECT_URL dans votre fichier .env');
    process.exit(1);
  } else {
    const maskedUrl = directUrl.replace(/:[^:@]+@/, ':****@');
    console.log(`✅ DIRECT_URL est défini: ${maskedUrl}`);
  }

  // 2. Vérifier le format des URLs
  console.log('\n2️⃣  Vérification du format des URLs:');
  const dbUrlPattern = /^postgresql:\/\//;
  if (!dbUrlPattern.test(databaseUrl || '')) {
    console.error('❌ DATABASE_URL n\'a pas le format attendu (postgresql://...)');
    process.exit(1);
  } else {
    console.log('✅ Format DATABASE_URL valide');
  }

  if (!dbUrlPattern.test(directUrl || '')) {
    console.error('❌ DIRECT_URL n\'a pas le format attendu (postgresql://...)');
    process.exit(1);
  } else {
    console.log('✅ Format DIRECT_URL valide');
  }

  // 3. Tester la connexion
  console.log('\n3️⃣  Test de connexion à la base de données:');
  const prisma = new PrismaClient();

  try {
    // Test de connexion basique
    await prisma.$connect();
    console.log('✅ Connexion à la base de données réussie');

    // Vérifier que la base est accessible (requête simple)
    const result = await prisma.$queryRaw`SELECT version()`;
    if (result) {
      console.log('✅ Base de données PostgreSQL accessible');
    }

    // Vérifier les tables existantes (si aucune table, c'est normal pour une base vide)
    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename
    `;

    if (tables.length === 0) {
      console.log('ℹ️  Aucune table trouvée dans le schéma public (base vide - normal pour une nouvelle installation)');
    } else {
      console.log(`ℹ️  ${tables.length} table(s) trouvée(s) dans le schéma public:`);
      tables.slice(0, 5).forEach(table => {
        console.log(`   - ${table.tablename}`);
      });
      if (tables.length > 5) {
        console.log(`   ... et ${tables.length - 5} autre(s)`);
      }
    }

    console.log('\n✅ Configuration Prisma validée avec succès!');
    console.log('   La connexion à Supabase fonctionne correctement.');
    console.log('\n📋 Prochaines étapes:');
    console.log('   1. Exécutez: npx prisma migrate dev --name init');
    console.log('   2. Génerez le client: npx prisma generate');

  } catch (error: any) {
    console.error('\n❌ Erreur de connexion à la base de données:');
    console.error(`   ${error.message}`);

    if (error.code === 'P1001') {
      console.error('\n💡 Causes possibles:');
      console.error('   - Le serveur Supabase n\'est pas accessible');
      console.error('   - Les credentials DATABASE_URL sont incorrects');
      console.error('   - Le firewall bloque la connexion');
    } else if (error.code === 'P1000') {
      console.error('\n💡 Causes possibles:');
      console.error('   - La base de données n\'existe pas');
      console.error('   - Les credentials n\'ont pas les permissions');
    } else if (error.code === 'P1017') {
      console.error('\n💡 Causes possibles:');
      console.error('   - Le serveur a fermé la connexion');
      console.error('   - Timeout de connexion');
    }

    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter la vérification
verifyConnection()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Erreur inattendue:', error);
    process.exit(1);
  });
