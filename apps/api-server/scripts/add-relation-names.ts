/**
 * Script pour ajouter les noms de relation explicites à toutes les relations Prisma
 */

import * as fs from 'fs';
import * as path from 'path';

const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf-8');

// Mapping des relations à corriger (modèle -> champ -> nom de relation)
const relationMappings: Record<string, Record<string, string>> = {
  'QhsDecisionLog': {
    'tenant': 'QhsDecisionLogTenant',
    'academicYear': 'QhsDecisionLogAcademicYear',
    'schoolLevel': 'QhsDecisionLogSchoolLevel',
    'decidedBy': 'QhsDecisionLogDecidedBy',
    'incident': 'QhsDecisionLogIncident',
  },
  'QhsCorrectiveAction': {
    'tenant': 'QhsCorrectiveActionTenant',
    'academicYear': 'QhsCorrectiveActionAcademicYear',
    'schoolLevel': 'QhsCorrectiveActionSchoolLevel',
    'owner': 'QhsCorrectiveActionOwner',
    'incident': 'QhsCorrectiveActionIncident',
  },
  'QhsAudit': {
    'tenant': 'QhsAuditTenant',
    'academicYear': 'QhsAuditAcademicYear',
    'schoolLevel': 'QhsAuditSchoolLevel',
  },
  'QhsRiskRegister': {
    'tenant': 'QhsRiskRegisterTenant',
    'academicYear': 'QhsRiskRegisterAcademicYear',
    'schoolLevel': 'QhsRiskRegisterSchoolLevel',
    'owner': 'QhsRiskRegisterOwner',
  },
  'KpiObjective': {
    'tenant': 'KpiObjectiveTenant',
    'academicYear': 'KpiObjectiveAcademicYear',
  },
  'AutomationRule': {
    'tenant': 'AutomationRuleTenant',
    'academicYear': 'AutomationRuleAcademicYear',
  },
  'Patronat': {
    'tenant': 'PatronatTenant',
  },
  'PatronatUser': {
    'tenant': 'PatronatUserTenant',
    'user': 'PatronatUserUser',
    'patronat': 'PatronatUserPatronat',
  },
  'PatronatSchool': {
    'tenant': 'PatronatSchools',
    'schoolTenant': 'SchoolTenants',
    'academicYear': 'PatronatSchoolAcademicYear',
    'creator': 'PatronatSchoolCreator',
    'suspender': 'PatronatSchoolSuspender',
    'patronat': 'PatronatSchoolPatronat',
  },
  'NationalExam': {
    'tenant': 'NationalExamTenant',
    'academicYear': 'NationalExamAcademicYear',
    'patronat': 'NationalExamPatronat',
  },
  'ExamCenter': {
    'tenant': 'ExamCenterTenant',
    'academicYear': 'ExamCenterAcademicYear',
    'exam': 'NationalExamCenters',
  },
  'ExamCandidate': {
    'exam': 'NationalExamCandidates',
    'center': 'ExamCandidateExamCenter',
    'academicYear': 'ExamCandidateAcademicYear',
    'schoolTenant': 'ExamCandidateSchoolTenant',
  },
  'ExamRoom': {
    'exam': 'ExamRoomExam',
    'center': 'ExamCenterRooms',
    'academicYear': 'ExamRoomAcademicYear',
  },
  'QuestionBankResource': {
    'tenant': 'QuestionBankTenant',
    'academicYear': 'QuestionBankAcademicYear',
    'patronat': 'QuestionBankPatronat',
  },
  'HomeworkSubmission': {
    'academicYear': 'HomeworkSubmissionAcademicYear',
    'schoolLevel': 'HomeworkSubmissionSchoolLevel',
  },
  'CouncilDecision': {
    'academicYear': 'CouncilDecisionAcademicYear',
    'schoolLevel': 'CouncilDecisionSchoolLevel',
  },
  'CouncilMinute': {
    'academicYear': 'CouncilMinuteAcademicYear',
    'schoolLevel': 'CouncilMinuteSchoolLevel',
  },
  'Inspection': {
    'academicYear': 'InspectionAcademicYear',
    'schoolLevel': 'InspectionSchoolLevel',
  },
  'ExamSubject': {
    'room': 'ExamSubjectRoom',
  },
  'GradeCalculation': {
    'student': 'GradeCalculationStudent',
  },
  'FeeDefinition': {
    'academicYear': 'FeeDefinitionAcademicYear',
    'schoolLevel': 'FeeDefinitionSchoolLevel',
    'class': 'FeeDefinitionClass',
    'feeCategory': 'FeeDefinitionFeeCategory',
  },
  'FeeRegime': {
    'tenant': 'FeeRegimeTenant',
    'academicYear': 'FeeRegimeAcademicYear',
    'schoolLevel': 'FeeRegimeSchoolLevel',
  },
  'FeeRegimeRule': {
    'feeRegime': 'FeeRegimeRuleFeeRegime',
  },
  'CorrectiveAction': {
    'incident': 'CorrectiveActionIncident',
  },
};

let fixed = 0;

// Pour chaque modèle
Object.entries(relationMappings).forEach(([modelName, fields]) => {
  Object.entries(fields).forEach(([fieldName, relationName]) => {
    // Pattern pour trouver la relation sans nom explicite
    const pattern = new RegExp(
      `(model ${modelName}[^}]*?)\\s+${fieldName}\\s+([^@\\n]+?)\\s+@relation\\(([^)]*?)\\)`,
      's'
    );
    
    // Pattern pour trouver la relation sans @relation du tout
    const patternNoRelation = new RegExp(
      `(model ${modelName}[^}]*?)\\s+${fieldName}\\s+([^@\\n]+?)\\s+(@relation|@@|\\})`,
      's'
    );
    
    // Essayer d'abord avec @relation existant mais sans nom
    if (schema.match(pattern)) {
      schema = schema.replace(
        pattern,
        (match, modelDef, type, existingRelation) => {
          // Si la relation n'a pas de nom explicite, l'ajouter
          if (!existingRelation.includes('"') && !existingRelation.includes("'")) {
            fixed++;
            return `${modelDef}\n  ${fieldName} ${type.trim()} @relation("${relationName}", ${existingRelation})`;
          }
          return match;
        }
      );
    } else if (schema.match(patternNoRelation)) {
      // Si pas de @relation du tout, l'ajouter
      schema = schema.replace(
        patternNoRelation,
        (match, modelDef, type, next) => {
          fixed++;
          const fieldsPart = type.includes('fields:') ? type : '';
          const refPart = type.includes('references:') ? type : '';
          return `${modelDef}\n  ${fieldName} ${type.trim()} @relation("${relationName}"${fieldsPart ? `, ${fieldsPart}` : ''}${refPart ? `, ${refPart}` : ''})\n${next}`;
        }
      );
    }
  });
});

fs.writeFileSync(schemaPath, schema, 'utf-8');
console.log(`✓ ${fixed} relations corrigées`);
