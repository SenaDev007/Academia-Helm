// Test bcryptjs avec un hash connu pour vérifier que bcryptjs fonctionne
const bcrypt = require('bcryptjs');

// Hash de référence : "password" avec cost 12 (généré en ligne)
const testHash = bcrypt.hashSync('password', 12);
console.log('Hash de référence pour "password":', testHash);
console.log('Vérification "password" vs hash de référence:', bcrypt.compareSync('password', testHash));
console.log('');

// Maintenant testons le hash fourni par l'utilisateur
const userHash = '$2a$12$IE6h3PZa6aaLw84SLI1/v..qwfAXC./kd9g7peNPf09BHIydT.CtG';
console.log('Hash user length:', userHash.length);
console.log('Hash user prefix:', userHash.substring(0, 7));

// Vérifier si le hash est valide structurellement
try {
  // bcryptjs getSalt extrait le salt du hash
  const salt = bcrypt.getSalt(userHash);
  console.log('Salt extrait:', salt);
} catch (err) {
  console.log('Erreur extraction salt:', err.message);
}

// Test avec un mot de passe simple
const simplePassword = 'password';
const result = bcrypt.compareSync(simplePassword, userHash);
console.log(`Compare "${simplePassword}":`, result);

// Test avec un autre mot de passe très simple
const result2 = bcrypt.compareSync('123456', userHash);
console.log(`Compare "123456":`, result2);
