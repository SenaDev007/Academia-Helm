const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
let content = fs.readFileSync(schemaPath, 'utf8');

// Extraire toutes les relations existantes pour éviter les doublons
const existingRelations = new Map();

// Parser le schéma pour trouver tous les modèles et leurs relations
const modelRegex = /model\s+(\w+)\s+\{([\s\S]*?)\n\}/g;
let match;

while ((match = modelRegex.exec(content)) !== null) {
  const modelName = match[1];
  const modelContent = match[2];
  const relations = [];
  
  // Extraire les relations (lignes avec @relation)
  const relationLines = modelContent.match(/^\s+(\w+)\s+([A-Z]\w+)(\[\])?\s*@relation[^\n]*/gm);
  if (relationLines) {
    relationLines.forEach(line => {
      const relMatch = line.match(/^\s+(\w+)\s+([A-Z]\w+)/);
      if (relMatch) {
        relations.push(relMatch[1]);
      }
    });
  }
  
  existingRelations.set(modelName, new Set(relations));
}

// Extraire toutes les foreign keys pour déterminer les relations à ajouter
const fkRegex = /@relation\([^)]*fields:\s*\[([^\]]+)\][^)]*references:\s*\[([^\]]+)\]/g;
const relationsToAdd = new Map();

while ((match = fkRegex.exec(content)) !== null) {
  const fieldName = match[1].trim();
  const referencedField = match[2].trim();
  
  // Trouver le modèle qui contient cette relation
  const beforeMatch = content.substring(0, match.index);
  const modelMatch = beforeMatch.match(/model\s+(\w+)\s+\{[\s\S]*$/);
  if (modelMatch) {
    const sourceModel = modelMatch[1];
    
    // Trouver le modèle référencé
    const refModelMatch = content.match(new RegExp(`model\\s+(${referencedField.replace('id', '')}\\w*|\\w*${referencedField.replace('id', '')})\\s+\\{`, 'i'));
    if (refModelMatch) {
      const targetModel = refModelMatch[1];
      
      // Déterminer le nom de la relation inverse
      let inverseFieldName = sourceModel.charAt(0).toLowerCase() + sourceModel.slice(1);
      if (sourceModel.endsWith('s')) {
        inverseFieldName = inverseFieldName + 'es';
      } else {
        inverseFieldName = inverseFieldName + 's';
      }
      
      // Vérifier si la relation existe déjà
      if (!existingRelations.has(targetModel) || !existingRelations.get(targetModel).has(inverseFieldName)) {
        if (!relationsToAdd.has(targetModel)) {
          relationsToAdd.set(targetModel, []);
        }
        
        // Déterminer si c'est one-to-many ou many-to-one
        const isArray = fieldName.includes('Id') && !fieldName.includes('@unique');
        const relationType = isArray ? '[]' : '?';
        
        relationsToAdd.get(targetModel).push(`${inverseFieldName} ${sourceModel}${relationType}`);
      }
    }
  }
}

// Ajouter les relations
let totalAdded = 0;
for (const [targetModel, relations] of relationsToAdd.entries()) {
  const modelRegex = new RegExp(`(model ${targetModel} \\{[\\s\\S]*?)(\\n  @@)`, 'm');
  const match = content.match(modelRegex);
  
  if (match) {
    const relationsText = '\n' + relations.map(r => `  ${r}`).join('\n');
    content = content.replace(modelRegex, `$1${relationsText}$2`);
    totalAdded += relations.length;
    console.log(`✅ ${relations.length} relation(s) ajoutée(s) à ${targetModel}`);
  }
}

fs.writeFileSync(schemaPath, content);
console.log(`\n✅ ${totalAdded} relations inverses ajoutées au total!`);
