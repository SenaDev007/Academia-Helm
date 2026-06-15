/**
 * Script pour créer le fichier .env.local avec les variables Supabase
 * 
 * Usage: node scripts/create-env-local.js
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
# Obtenez ces valeurs depuis votre dashboard Supabase:
# https://app.supabase.com/project/[PROJECT_ID]/settings/api
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
  // Vérifier si le fichier existe déjà
  if (fs.existsSync(envLocalPath)) {
    console.log('⚠️  Le fichier .env.local existe déjà.');
    console.log('📝 Vérifiez son contenu et ajoutez les variables Supabase si nécessaire.');
    console.log('\n📋 Contenu à ajouter:');
    console.log('---');
    console.log(envLocalContent);
    console.log('---');
  } else {
    // Créer le fichier
    fs.writeFileSync(envLocalPath, envLocalContent, 'utf8');
    console.log('✅ Fichier .env.local créé avec succès !');
    console.log('📁 Emplacement:', envLocalPath);
    console.log('\n🔐 Variables configurées:');
    console.log('  - NEXT_PUBLIC_SUPABASE_URL');
    console.log('  - NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY');
    console.log('  - DATABASE_URL');
    console.log('  - DIRECT_URL');
    console.log('\n⚠️  N\'oubliez pas: ce fichier est dans .gitignore et ne sera pas commité.');
  }
} catch (error) {
  console.error('❌ Erreur lors de la création du fichier .env.local:', error.message);
  process.exit(1);
}

