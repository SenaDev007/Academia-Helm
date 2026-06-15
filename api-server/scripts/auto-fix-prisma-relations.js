const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
let content = fs.readFileSync(schemaPath, 'utf8');

// Exécuter prisma validate et extraire les erreurs
try {
  const output = execSync('npx prisma validate 2>&1', { encoding: 'utf8', cwd: path.dirname(schemaPath) });
  const errors = output.match(/Error validating field `([^`]+)` in model `([^`]+)`: The relation field `[^`]+` on model `[^`]+` is missing an opposite relation field on the model `([^`]+)`/g);
  
  if (!errors || errors.length === 0) {
    console.log('✅ Aucune erreur de relation manquante trouvée!');
    process.exit(0);
  }
  
  console.log(`📋 ${errors.length} erreur(s) de relation manquante trouvée(s)\n`);
  
  // Parser les erreurs
  const relationsToAdd = {};
  for (const error of errors) {
    const match = error.match(/Error validating field `([^`]+)` in model `([^`]+)`: The relation field `[^`]+` on model `[^`]+` is missing an opposite relation field on the model `([^`]+)`/);
    if (match) {
      const [, fieldName, sourceModel, targetModel] = match;
      if (!relationsToAdd[targetModel]) {
        relationsToAdd[targetModel] = [];
      }
      // Déterminer le type de relation (one-to-many ou many-to-one)
      const relationType = fieldName.endsWith('[]') ? '[]' : '?';
      const relationName = fieldName.replace('[]', '');
      relationsToAdd[targetModel].push(`${relationName} ${sourceModel}${relationType}`);
    }
  }
  
  // Ajouter les relations
  for (const [targetModel, relations] of Object.entries(relationsToAdd)) {
    const modelRegex = new RegExp(`(model ${targetModel} \\{[\\s\\S]*?)(\\n  @@)`, 'm');
    const match = content.match(modelRegex);
    
    if (match) {
      const modelStart = match[1];
      const modelEnd = match[2];
      
      // Vérifier quelles relations n'existent pas déjà
      const existingRelations = modelStart.match(/\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+[A-Z][a-zA-Z0-9_]*(\[\])?/g) || [];
      const existingRelationNames = existingRelations.map(r => r.trim().split(/\s+/)[0]);
      
      const relationsToAddFiltered = relations.filter(rel => {
        const relName = rel.split(' ')[0];
        return !existingRelationNames.includes(relName);
      });
      
      if (relationsToAddFiltered.length > 0) {
        const relationsText = '\n' + relationsToAddFiltered.map(r => `  ${r}`).join('\n');
        content = content.replace(modelRegex, `$1${relationsText}$2`);
        console.log(`✅ ${relationsToAddFiltered.length} relation(s) ajoutée(s) à ${targetModel}`);
      }
    } else {
      console.log(`⚠️  Modèle ${targetModel} non trouvé`);
    }
  }
  
  fs.writeFileSync(schemaPath, content);
  console.log('\n✅ Relations inverses ajoutées!');
  
} catch (error) {
  console.error('❌ Erreur lors de la validation:', error.message);
  process.exit(1);
}
