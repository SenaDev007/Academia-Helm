/**
 * Script pour corriger la colonne tenantId dans audit_logs
 * 
 * Problème : La table a deux colonnes (tenantId text et tenant_id uuid)
 * Solution : Utiliser tenant_id (uuid) comme défini dans Prisma
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';

// Charger les variables d'environnement
dotenv.config({ path: '.env' });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL is required');
  process.exit(1);
}

async function fixAuditLogsTenantColumn() {
  // Créer un pool PostgreSQL
  const pool = new Pool({ connectionString: databaseUrl });
  
  try {
    console.log('🔍 Vérification des colonnes tenant dans audit_logs...');
    
    // Vérifier les colonnes existantes
    const columnsQuery = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'audit_logs' 
      AND column_name IN ('tenantId', 'tenant_id')
      ORDER BY column_name;
    `);
    
    console.log('📋 Colonnes trouvées:');
    console.log(JSON.stringify(columnsQuery.rows, null, 2));
    
    const hasTenantId = columnsQuery.rows.some(r => r.column_name === 'tenantId');
    const hasTenantIdSnake = columnsQuery.rows.some(r => r.column_name === 'tenant_id');
    
    if (hasTenantId && hasTenantIdSnake) {
      console.log('⚠️  Deux colonnes trouvées. Vérification des données...');
      
      // Vérifier si tenantId a des données
      const tenantIdData = await pool.query('SELECT COUNT(*) as count FROM audit_logs WHERE "tenantId" IS NOT NULL');
      const tenantIdCount = parseInt(tenantIdData.rows[0].count);
      
      // Vérifier si tenant_id a des données
      const tenantIdSnakeData = await pool.query('SELECT COUNT(*) as count FROM audit_logs WHERE tenant_id IS NOT NULL');
      const tenantIdSnakeCount = parseInt(tenantIdSnakeData.rows[0].count);
      
      console.log(`📊 tenantId (text): ${tenantIdCount} lignes avec données`);
      console.log(`📊 tenant_id (uuid): ${tenantIdSnakeCount} lignes avec données`);
      
      if (tenantIdCount === 0 && tenantIdSnakeCount > 0) {
        console.log('✅ tenantId est vide, tenant_id a des données. Suppression de tenantId...');
        await pool.query('ALTER TABLE audit_logs DROP COLUMN "tenantId"');
        console.log('✅ Colonne tenantId supprimée');
      } else if (tenantIdCount > 0 && tenantIdSnakeCount === 0) {
        console.log('⚠️  tenantId a des données, tenant_id est vide. Migration des données...');
        // Copier les données de tenantId vers tenant_id (si ce sont des UUIDs valides)
        await pool.query(`
          UPDATE audit_logs 
          SET tenant_id = "tenantId"::uuid 
          WHERE "tenantId" IS NOT NULL 
          AND "tenantId" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        `);
        console.log('✅ Données migrées de tenantId vers tenant_id');
        await pool.query('ALTER TABLE audit_logs DROP COLUMN "tenantId"');
        console.log('✅ Colonne tenantId supprimée');
      } else {
        console.log('⚠️  Les deux colonnes ont des données. Action manuelle requise.');
        console.log('⚠️  Veuillez vérifier manuellement quelle colonne utiliser.');
      }
    } else if (hasTenantId && !hasTenantIdSnake) {
      console.log('⚠️  Seulement tenantId (text) existe. Création de tenant_id (uuid)...');
      await pool.query(`
        ALTER TABLE audit_logs 
        ADD COLUMN tenant_id UUID;
      `);
      
      // Migrer les données si possible
      await pool.query(`
        UPDATE audit_logs 
        SET tenant_id = "tenantId"::uuid 
        WHERE "tenantId" IS NOT NULL 
        AND "tenantId" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      `);
      
      // Rendre NOT NULL
      await pool.query(`
        ALTER TABLE audit_logs 
        ALTER COLUMN tenant_id SET NOT NULL;
      `);
      
      // Ajouter la contrainte de clé étrangère
      await pool.query(`
        ALTER TABLE audit_logs
        ADD CONSTRAINT fk_audit_logs_tenant
          FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
      `);
      
      console.log('✅ Colonne tenant_id créée et configurée');
    } else if (!hasTenantId && hasTenantIdSnake) {
      console.log('✅ Seulement tenant_id (uuid) existe. C\'est correct !');
    } else {
      console.log('❌ Aucune colonne tenant trouvée. Création de tenant_id...');
      await pool.query(`
        ALTER TABLE audit_logs 
        ADD COLUMN tenant_id UUID NOT NULL;
      `);
      
      // Ajouter la contrainte de clé étrangère
      await pool.query(`
        ALTER TABLE audit_logs
        ADD CONSTRAINT fk_audit_logs_tenant
          FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
      `);
      
      console.log('✅ Colonne tenant_id créée');
    }
    
    // Vérification finale
    const finalCheck = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'audit_logs' 
      AND column_name IN ('tenantId', 'tenant_id')
      ORDER BY column_name;
    `);
    
    console.log('\n✅ État final des colonnes:');
    console.log(JSON.stringify(finalCheck.rows, null, 2));
    
    console.log('\n✅ Migration terminée avec succès');
  } catch (error: any) {
    console.error('❌ Erreur lors de la migration:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

fixAuditLogsTenantColumn();
