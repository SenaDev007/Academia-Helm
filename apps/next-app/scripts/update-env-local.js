/**
 * Script pour mettre à jour le fichier .env.local avec TOUTES les variables Supabase
 * 
 * Usage: node scripts/update-env-local.js
 * 
 * Ce script force la mise à jour du fichier .env.local avec toutes les variables requises
 */

const fs = require('fs');
const path = require('path');

const envLocalContent = `# ============================================================================
# SUPABASE CONFIGURATION
# ============================================================================
# 
# ⚠️ IMPORTANT: Ce fichier contient des informations sensibles
# Ne jamais commiter ce fichier (déjà dans .gitignore)
#
# Project URL: https://ankbtgwlofidxtafdueu.supabase.co
# Publishable API Key: sb_publishable_1XCM6w3jm4368f-P36BaKw_XrCoHmZy
# ============================================================================

# Supabase URL (public - safe to expose)
NEXT_PUBLIC_SUPABASE_URL=https://ankbtgwlofidxtafdueu.supabase.co

# Supabase Publishable Key (public - safe to expose)
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=sb_publishable_1XCM6w3jm4368f-P36BaKw_XrCoHmZy

# ============================================================================
# DATABASE CONNECTION (SERVER-SIDE ONLY)
# ============================================================================
# 
# ⚠️ NE JAMAIS exposer ces variables avec NEXT_PUBLIC_
# Ces variables sont utilisées uniquement côté serveur (Prisma, migrations)
# ============================================================================

# Direct connection to Supabase PostgreSQL
DATABASE_URL=postgresql://postgres:C%40ptain.Yehioracadhub202%21@db.ankbtgwlofidxtafdueu.supabase.co:5432/postgres

# Direct connection for migrations (Prisma)
DIRECT_URL=postgresql://postgres:C%40ptain.Yehioracadhub202%21@db.ankbtgwlofidxtafdueu.supabase.co:5432/postgres

# ============================================================================
# API CONFIGURATION
# ============================================================================

NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_APP_URL=http://localhost:3001
NEXT_PUBLIC_PLATFORM=web
NEXT_PUBLIC_ENV=development

# ============================================================================
# NOTES
# ============================================================================
# 
# 1. Les variables NEXT_PUBLIC_* sont automatiquement exposées côté client
# 2. DATABASE_URL et DIRECT_URL sont server-side only (pas de NEXT_PUBLIC_)
# 3. Le mot de passe dans DATABASE_URL doit être encodé en URL (%40 pour @, %21 pour !)
# 4. Pour production, utilisez connection pooling (port 6543) pour DATABASE_URL
# 5. DIRECT_URL doit toujours pointer vers le port 5432 (direct connection)
# ============================================================================
`;

const envLocalPath = path.join(__dirname, '..', '.env.local');

try {
  // Sauvegarder l'ancien fichier s'il existe
  let backupPath = null;
  if (fs.existsSync(envLocalPath)) {
    const oldContent = fs.readFileSync(envLocalPath, 'utf8');
    backupPath = envLocalPath + '.backup.' + Date.now();
    fs.writeFileSync(backupPath, oldContent, 'utf8');
    console.log('📦 Ancien fichier sauvegardé:', backupPath);
  }

  // Créer/Mettre à jour le fichier
  fs.writeFileSync(envLocalPath, envLocalContent, 'utf8');
  console.log('✅ Fichier .env.local créé/mis à jour avec succès !');
  console.log('📁 Emplacement:', envLocalPath);
  
  // Vérifier les variables
  console.log('\n🔐 Variables configurées:');
  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY',
    'DATABASE_URL',
    'DIRECT_URL',
    'NEXT_PUBLIC_API_URL',
    'NEXT_PUBLIC_APP_URL',
    'NEXT_PUBLIC_PLATFORM',
    'NEXT_PUBLIC_ENV'
  ];
  
  requiredVars.forEach(varName => {
    if (envLocalContent.includes(varName)) {
      console.log('  ✅', varName);
    } else {
      console.log('  ❌', varName, '(MANQUANT)');
    }
  });
  
  console.log('\n⚠️  N\'oubliez pas: ce fichier est dans .gitignore et ne sera pas commité.');
  if (backupPath) {
    console.log('💾 Backup disponible:', backupPath);
  }
} catch (error) {
  console.error('❌ Erreur lors de la création/mise à jour du fichier .env.local:', error.message);
  process.exit(1);
}

