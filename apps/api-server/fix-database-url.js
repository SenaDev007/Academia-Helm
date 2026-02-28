const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');

// Lire le fichier .env
let envContent = fs.readFileSync(envPath, 'utf8');

// Récupérer le mot de passe depuis DB_PASSWORD
const passwordMatch = envContent.match(/^DB_PASSWORD=(.+)$/m);
const password = passwordMatch ? passwordMatch[1].trim() : null;

if (!password) {
  console.error('❌ DB_PASSWORD non trouvé dans .env');
  process.exit(1);
}

console.log(`✅ Mot de passe trouvé: ${password.substring(0, 10)}...`);

// Encoder le mot de passe pour l'URL (gérer les caractères spéciaux)
const encodedPassword = encodeURIComponent(password);

// Remplacer DATABASE_URL
envContent = envContent.replace(
  /^DATABASE_URL=postgresql:\/\/postgres:[^@]+@localhost:5432\/academia_helm$/m,
  `DATABASE_URL=postgresql://postgres:${encodedPassword}@localhost:5432/academia_helm`
);

// Remplacer DIRECT_URL
envContent = envContent.replace(
  /^DIRECT_URL=postgresql:\/\/postgres:[^@]+@localhost:5432\/academia_helm$/m,
  `DIRECT_URL=postgresql://postgres:${encodedPassword}@localhost:5432/academia_helm`
);

// Écrire le fichier
fs.writeFileSync(envPath, envContent, 'utf8');

console.log('✅ DATABASE_URL et DIRECT_URL mis à jour avec le mot de passe correct');
console.log('✅ Fichier .env sauvegardé');
