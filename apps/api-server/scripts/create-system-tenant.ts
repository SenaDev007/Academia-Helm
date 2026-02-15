/**
 * Script pour créer un tenant système pour les logs d'audit
 */

import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';

// Charger les variables d'environnement
dotenv.config({ path: '.env' });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL is required');
  process.exit(1);
}

async function createSystemTenant() {
  // Créer un pool PostgreSQL
  const pool = new Pool({ connectionString: databaseUrl });
  
  try {
    console.log('🔍 Vérification du tenant système...');
    
    // Vérifier si le tenant système existe
    const checkQuery = `
      SELECT id, name, slug 
      FROM tenants 
      WHERE slug = 'system' OR name = 'System';
    `;
    
    const result = await pool.query(checkQuery);
    
    if (result.rows.length > 0) {
      console.log(`✅ Le tenant système existe déjà: ${result.rows[0].id}`);
      console.log(`   Nom: ${result.rows[0].name}, Slug: ${result.rows[0].slug}`);
    } else {
      console.log('📦 Création du tenant système...');
      
      // Récupérer un country_id valide (nécessaire pour créer un tenant)
      const countryQuery = await pool.query('SELECT id FROM countries LIMIT 1');
      
      if (countryQuery.rows.length === 0) {
        console.error('❌ Aucun pays trouvé dans la base de données. Créez d\'abord un pays.');
        process.exit(1);
      }
      
      const countryId = countryQuery.rows[0].id;
      
      // Créer le tenant système
      const insertQuery = `
        INSERT INTO tenants (id, name, slug, "countryId", type, "subscriptionStatus", status, "subscriptionPlan", "createdAt", "updatedAt")
        VALUES (
          gen_random_uuid(),
          'System',
          'system',
          $1,
          'SYSTEM',
          'ACTIVE',
          'active',
          'system',
          NOW(),
          NOW()
        )
        RETURNING id, name, slug;
      `;
      
      const insertResult = await pool.query(insertQuery, [countryId]);
      
      console.log(`✅ Tenant système créé avec succès:`);
      console.log(`   ID: ${insertResult.rows[0].id}`);
      console.log(`   Nom: ${insertResult.rows[0].name}`);
      console.log(`   Slug: ${insertResult.rows[0].slug}`);
    }
    
    console.log('✅ Migration terminée avec succès');
  } catch (error: any) {
    console.error('❌ Erreur lors de la création du tenant système:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

createSystemTenant();
