
import fs from 'fs';

const schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

function findMissing(parentModel) {
  const modelMatch = schema.match(new RegExp(`model ${parentModel} \\{([\\s\\S]*?)\\}`));
  if (!modelMatch) return [];

  const content = modelMatch[1];
  const existingRelations = new Set();
  const relRegex = /(\w+)\s+(\w+)\[\]/g;
  let match;
  while ((match = relRegex.exec(content)) !== null) {
    existingRelations.add(match[2]);
  }

  const modelRegex = /model (\w+) \{([\s\S]*?)\}/g;
  const missing = [];

  while ((match = modelRegex.exec(schema)) !== null) {
    const modelName = match[1];
    const modelContent = match[2];
    if (modelName === parentModel) continue;

    const parentLow = parentModel.charAt(0).toLowerCase() + parentModel.slice(1);
    if (modelContent.match(new RegExp(`${parentLow}\\s+${parentModel}`))) {
      if (!existingRelations.has(modelName)) {
        missing.push(modelName);
      }
    }
  }
  return missing;
}

console.log('Missing in Tenant:');
findMissing('Tenant').forEach(m => console.log(m));
console.log('Missing in AcademicYear:');
findMissing('AcademicYear').forEach(m => console.log(m));
console.log('Missing in SchoolLevel:');
findMissing('SchoolLevel').forEach(m => console.log(m));
