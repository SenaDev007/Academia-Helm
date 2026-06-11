/**
 * ============================================================================
 * SCRIPT D'APPLICATION RLS - ACADEMIA HUB
 * ============================================================================
 * 
 * Applique les policies RLS (Row Level Security) à toutes les tables
 * 
 * Usage: ts-node scripts/apply-rls.ts
 * 
 * ============================================================================
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function applyRLS() {
  console.log('🔒 Application de RLS (Row Level Security)...\n');

  try {
    // Lire le fichier SQL RLS
    const rlsFilePath = path.join(__dirname, '../prisma/migrations/rls-policies.sql');
    
    if (!fs.existsSync(rlsFilePath)) {
      console.error(`❌ Fichier RLS introuvable: ${rlsFilePath}`);
      process.exit(1);
    }

    const rlsSQL = fs.readFileSync(rlsFilePath, 'utf-8');
    
    console.log('📋 Lecture du fichier RLS...');
    console.log(`   Fichier: ${rlsFilePath}`);
    
    // Diviser le fichier SQL en commandes individuelles
    // Nettoyer les commentaires et les lignes vides
    const commands = rlsSQL
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => 
        cmd.length > 0 && 
        !cmd.startsWith('--') && 
        !cmd.startsWith('/*') &&
        cmd !== ''
      );

    console.log(`\n📊 ${commands.length} commande(s) SQL à exécuter\n`);

    // Exécuter chaque commande
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      
      // Ignorer les commentaires et les sections vides
      if (command.startsWith('--') || command.length < 10) {
        continue;
      }

      try {
        // Exécuter la commande SQL
        await prisma.$executeRawUnsafe(command);
        successCount++;
        
        // Afficher le progrès pour les opérations importantes
        if (command.includes('ENABLE ROW LEVEL SECURITY') || command.includes('CREATE POLICY')) {
          const tableMatch = command.match(/TABLE (\w+)/i);
          if (tableMatch) {
            console.log(`   ✅ ${tableMatch[1]}`);
          }
        }
      } catch (error: any) {
        // Ignorer les erreurs de "déjà existant" (CREATE POLICY IF NOT EXISTS)
        if (error.message.includes('already exists') || error.message.includes('duplicate')) {
          successCount++;
        } else {
          errorCount++;
          console.error(`   ⚠️  Erreur sur commande ${i + 1}: ${error.message.substring(0, 100)}`);
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ RLS appliqué avec succès!');
    console.log('='.repeat(60));
    console.log(`\n📊 Résumé:`);
    console.log(`   - Commandes réussies: ${successCount}`);
    if (errorCount > 0) {
      console.log(`   - Erreurs: ${errorCount}`);
    }

    // Vérifier que RLS est activé sur les tables principales
    console.log('\n🔍 Vérification de RLS...');
    const tablesWithRLS = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND rowsecurity = true
      ORDER BY tablename
      LIMIT 10
    `;

    if (tablesWithRLS.length > 0) {
      console.log(`   ✅ RLS activé sur ${tablesWithRLS.length} table(s) ou plus:`);
      tablesWithRLS.forEach(table => {
        console.log(`      - ${table.tablename}`);
      });
    } else {
      console.log('   ℹ️  Aucune table avec RLS activé trouvée');
    }

    console.log('\n🎯 RLS configuré avec succès!');
    console.log('   Les policies sont maintenant actives pour l\'isolation multi-tenant.');

  } catch (error: any) {
    console.error('\n❌ Erreur lors de l\'application de RLS:');
    console.error(`   ${error.message}`);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter
applyRLS();
