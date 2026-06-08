/**
 * Script pour corriger les dernières relations manquantes
 */

import * as fs from 'fs';
import * as path from 'path';

const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf-8');

// Corrections spécifiques
const fixes = [
  // QhsDecisionLog - incident
  {
    pattern: /(incident\s+QhsIncident\s+@relation\()([^)]+)(\))/,
    replacement: 'incident QhsIncident @relation("QhsDecisionLogIncident", $2)',
    model: 'QhsDecisionLog'
  },
  // QhsCorrectiveAction - incident
  {
    pattern: /(incident\s+QhsIncident\s+@relation\()([^)]+)(\))/,
    replacement: 'incident QhsIncident @relation("QhsCorrectiveActionIncident", $2)',
    model: 'QhsCorrectiveAction'
  },
  // NationalExam - tenant
  {
    pattern: /(model NationalExam[^}]*?tenant\s+Tenant\s+@relation\()([^)]+)(\))/s,
    replacement: (match: string) => match.replace(/@relation\(([^)]+)\)/, '@relation("NationalExamTenant", $1)')
  },
  // ExamCenter - tenant
  {
    pattern: /(model ExamCenter[^}]*?tenant\s+Tenant\s+@relation\()([^)]+)(\))/s,
    replacement: (match: string) => match.replace(/@relation\(([^)]+)\)/, '@relation("ExamCenterTenant", $1)')
  },
  // QuestionBankResource - tenant
  {
    pattern: /(model QuestionBankResource[^}]*?tenant\s+Tenant\s+@relation\()([^)]+)(\))/s,
    replacement: (match: string) => match.replace(/@relation\(([^)]+)\)/, '@relation("QuestionBankTenant", $1)')
  },
  // ExamCandidate - exam
  {
    pattern: /(model ExamCandidate[^}]*?exam\s+NationalExam\s+@relation\("NationalExamCenters",)/s,
    replacement: 'exam NationalExam @relation("NationalExamCandidates",'
  },
];

let fixed = 0;

// Appliquer les corrections
fixes.forEach(({ pattern, replacement, model }) => {
  if (model) {
    // Correction spécifique à un modèle
    const modelRegex = new RegExp(`(model ${model}[^}]*?)(\\s*@@map|\\s*})`, 's');
    const match = schema.match(modelRegex);
    if (match) {
      const modelContent = match[1];
      if (pattern.test(modelContent)) {
        const newContent = modelContent.replace(pattern, replacement);
        schema = schema.replace(modelRegex, `${newContent}$2`);
        fixed++;
        console.log(`✓ Corrigé: ${model}`);
      }
    }
  } else {
    // Correction globale
    if (typeof replacement === 'function') {
      schema = schema.replace(pattern, replacement);
      fixed++;
    } else {
      schema = schema.replace(pattern, replacement);
      fixed++;
    }
  }
});

fs.writeFileSync(schemaPath, schema, 'utf-8');
console.log(`✓ ${fixed} corrections appliquées`);
