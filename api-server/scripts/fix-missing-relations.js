// Script pour analyser et suggérer les corrections de relations manquantes
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SCHEMA_PATH = path.join(__dirname, '../prisma/schema.prisma');

try {
  // Exécuter prisma validate et capturer les erreurs
  const output = execSync('npx prisma validate 2>&1', { 
    cwd: path.dirname(SCHEMA_PATH),
    encoding: 'utf8'
  });
  
  // Extraire les erreurs de relations manquantes
  const missingRelations = [];
  const lines = output.split('\n');
  
  for (const line of lines) {
    const match = line.match(/field `([^`]+)` in model `([^`]+)`.*missing an opposite relation field on the model `([^`]+)`/);
    if (match) {
      const [, fieldName, sourceModel, targetModel] = match;
      missingRelations.push({
        sourceModel,
        fieldName,
        targetModel
      });
    }
  }
  
  console.log(`Found ${missingRelations.length} missing relations`);
  console.log('\nSuggestions to add:');
  
  // Grouper par modèle cible
  const byTarget = {};
  for (const rel of missingRelations) {
    if (!byTarget[rel.targetModel]) {
      byTarget[rel.targetModel] = [];
    }
    byTarget[rel.targetModel].push({
      sourceModel: rel.sourceModel,
      fieldName: rel.fieldName
    });
  }
  
  // Afficher les suggestions
  for (const [targetModel, relations] of Object.entries(byTarget)) {
    console.log(`\n// Add to model ${targetModel}:`);
    for (const rel of relations) {
      // Déterminer le type de relation (array ou single)
      const isArray = rel.fieldName.endsWith('s') || rel.fieldName.includes('[]');
      const relationName = rel.sourceModel.charAt(0).toLowerCase() + rel.sourceModel.slice(1) + (isArray ? 's' : '');
      console.log(`  ${relationName} ${rel.sourceModel}${isArray ? '[]' : '?'}`);
    }
  }
  
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
