const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
let content = fs.readFileSync(schemaPath, 'utf-8');

// Supprimer toutes les lignes "  tenants Tenant?" qui sont dupliquées
// On garde seulement la première occurrence si elle existe, sinon on supprime toutes
const lines = content.split('\n');
const cleanedLines = [];
let foundTenantsField = false;
let inTenantModel = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Détecter le début du modèle Tenant
  if (line.trim().startsWith('model Tenant')) {
    inTenantModel = true;
    cleanedLines.push(line);
    continue;
  }
  
  // Détecter la fin du modèle Tenant
  if (inTenantModel && line.trim().startsWith('}') && !line.includes('@')) {
    inTenantModel = false;
    cleanedLines.push(line);
    continue;
  }
  
  // Si on est dans le modèle Tenant et qu'on trouve "tenants Tenant?"
  if (inTenantModel && line.trim() === 'tenants Tenant?') {
    if (!foundTenantsField) {
      // Garder la première occurrence
      foundTenantsField = true;
      cleanedLines.push(line);
    }
    // Ignorer toutes les autres occurrences
    continue;
  }
  
  // Ajouter toutes les autres lignes
  cleanedLines.push(line);
}

const cleanedContent = cleanedLines.join('\n');
fs.writeFileSync(schemaPath, cleanedContent, 'utf-8');
console.log('Schema cleaned successfully!');
