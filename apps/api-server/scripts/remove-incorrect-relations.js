const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
let content = fs.readFileSync(schemaPath, 'utf8');

// Supprimer toutes les lignes avec "tenants Tenant[]" ou "tenants Tenant?"
content = content.replace(/^\s+tenants\s+Tenant(\[\])?\s*$/gm, '');

// Supprimer les lignes vides multiples
content = content.replace(/\n\s*\n\s*\n/g, '\n\n');

fs.writeFileSync(schemaPath, content);
console.log('✅ Relations incorrectes supprimées!');
