// Génère un hash bcrypt pour un mot de passe donné
// Usage: node scripts/generate-admin-hash.js "MonMotDePasse2026!"
const bcrypt = require('bcryptjs');

const password = process.argv[2];
if (!password) {
  console.error('Usage: node generate-admin-hash.js <password>');
  process.exit(1);
}

// Cost factor 12 (aligné avec le hash existant $2a$12$...)
const hash = bcrypt.hashSync(password, 12);

console.log('Password:', password);
console.log('Hash bcrypt (cost 12):', hash);
console.log('');
console.log('Format JSON pour ADMIN_PASSWORDS:');
console.log('{');
console.log('  "s.akpovitohou@gmail.com": "' + hash + '",');
console.log('  "senakponakpovi@academiahelm.com": "' + hash + '"');
console.log('}');
console.log('');
console.log('Vérification:');
console.log('bcrypt.compare(password, hash) =', bcrypt.compareSync(password, hash));
