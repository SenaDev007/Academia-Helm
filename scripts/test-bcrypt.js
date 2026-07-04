// Test bcryptjs avec différents mots de passe contre le hash fourni
const bcrypt = require('bcryptjs');

const hash = '$2a$12$IE6h3PZa6aaLw84SLI1/v..qwfAXC./kd9g7peNPf09BHIydT.CtG';

// Liste de mots de passe à tester
const passwords = [
  'AdminHelm2026!',
  'AcademiaHelm2026',
  'AcademiaHelm2026!',
  'admin2026',
  'Admin2026!',
  'Academia2026!',
  'S.akpovitohou2026',
  's.akpovitohou',
  'password',
  'admin',
  'SenaDev007',
  'Academia Helm',
  'academiahelm',
  'Helm2026!',
  'Aurore2026!',
];

console.log('Hash length:', hash.length);
console.log('Hash prefix:', hash.substring(0, 7));
console.log('Cost factor:', hash.substring(4, 6));
console.log('');

(async () => {
  for (const pwd of passwords) {
    try {
      const match = await bcrypt.compare(pwd, hash);
      if (match) {
        console.log(`✅ MATCH FOUND: "${pwd}"`);
        process.exit(0);
      } else {
        console.log(`❌ "${pwd}"`);
      }
    } catch (err) {
      console.log(`⚠️  Error for "${pwd}": ${err.message}`);
    }
  }
  console.log('\n❌ Aucun match trouvé parmi la liste.');
  process.exit(1);
})();
