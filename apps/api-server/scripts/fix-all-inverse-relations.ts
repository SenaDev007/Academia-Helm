/**
 * Script pour ajouter toutes les relations inverses manquantes dans schema.prisma
 */

import * as fs from 'fs';
import * as path from 'path';

const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf-8');

// Liste complète des relations inverses à ajouter
const inverseRelations = [
  // Tenant relations
  { model: 'Patronat', field: 'tenant', relation: 'tenant Tenant @relation("PatronatTenant", fields: [tenantId], references: [id], onDelete: Cascade)' },
  { model: 'NationalExam', field: 'tenant', relation: 'tenant Tenant @relation("NationalExamTenant", fields: [tenantId], references: [id], onDelete: Cascade)' },
  { model: 'QuestionBankResource', field: 'tenant', relation: 'tenant Tenant @relation("QuestionBankTenant", fields: [tenantId], references: [id], onDelete: Cascade)' },
  { model: 'QhsIncident', field: 'tenant', relation: 'tenant Tenant @relation("QhsIncidentTenant", fields: [tenantId], references: [id], onDelete: Cascade)' },
  { model: 'QhsDecisionLog', field: 'tenant', relation: 'tenant Tenant @relation("QhsDecisionLogTenant", fields: [tenantId], references: [id], onDelete: Cascade)' },
  { model: 'QhsCorrectiveAction', field: 'tenant', relation: 'tenant Tenant @relation("QhsCorrectiveActionTenant", fields: [tenantId], references: [id], onDelete: Cascade)' },
  { model: 'QhsAudit', field: 'tenant', relation: 'tenant Tenant @relation("QhsAuditTenant", fields: [tenantId], references: [id], onDelete: Cascade)' },
  { model: 'QhsRiskRegister', field: 'tenant', relation: 'tenant Tenant @relation("QhsRiskRegisterTenant", fields: [tenantId], references: [id], onDelete: Cascade)' },
  { model: 'KpiObjective', field: 'tenant', relation: 'tenant Tenant @relation("KpiObjectiveTenant", fields: [tenantId], references: [id], onDelete: Cascade)' },
  { model: 'AutomationRule', field: 'tenant', relation: 'tenant Tenant @relation("AutomationRuleTenant", fields: [tenantId], references: [id], onDelete: Cascade)' },
  { model: 'ExamCenter', field: 'tenant', relation: 'tenant Tenant @relation("ExamCenterTenant", fields: [tenantId], references: [id], onDelete: Cascade)' },
  { model: 'PatronatSchool', field: 'schoolTenant', relation: 'schoolTenant Tenant @relation("SchoolTenants", fields: [schoolTenantId], references: [id], onDelete: Restrict)' },
  
  // AcademicYear relations
  { model: 'HomeworkSubmission', field: 'academicYear', relation: 'academicYear AcademicYear @relation("HomeworkSubmissionAcademicYear", fields: [academicYearId], references: [id], onDelete: Restrict)' },
  { model: 'CouncilDecision', field: 'academicYear', relation: 'academicYear AcademicYear @relation("CouncilDecisionAcademicYear", fields: [academicYearId], references: [id], onDelete: Restrict)' },
  { model: 'CouncilMinute', field: 'academicYear', relation: 'academicYear AcademicYear @relation("CouncilMinuteAcademicYear", fields: [academicYearId], references: [id], onDelete: Restrict)' },
  { model: 'Inspection', field: 'academicYear', relation: 'academicYear AcademicYear? @relation("InspectionAcademicYear", fields: [academicYearId], references: [id], onDelete: SetNull)' },
  { model: 'QhsIncident', field: 'academicYear', relation: 'academicYear AcademicYear @relation("QhsIncidentAcademicYear", fields: [academicYearId], references: [id], onDelete: Restrict)' },
  { model: 'QhsDecisionLog', field: 'academicYear', relation: 'academicYear AcademicYear @relation("QhsDecisionLogAcademicYear", fields: [academicYearId], references: [id], onDelete: Restrict)' },
  { model: 'QhsCorrectiveAction', field: 'academicYear', relation: 'academicYear AcademicYear @relation("QhsCorrectiveActionAcademicYear", fields: [academicYearId], references: [id], onDelete: Restrict)' },
  { model: 'QhsAudit', field: 'academicYear', relation: 'academicYear AcademicYear @relation("QhsAuditAcademicYear", fields: [academicYearId], references: [id], onDelete: Restrict)' },
  { model: 'QhsRiskRegister', field: 'academicYear', relation: 'academicYear AcademicYear @relation("QhsRiskRegisterAcademicYear", fields: [academicYearId], references: [id], onDelete: Restrict)' },
  { model: 'QuestionBankResource', field: 'academicYear', relation: 'academicYear AcademicYear @relation("QuestionBankAcademicYear", fields: [academicYearId], references: [id], onDelete: Restrict)' },
  { model: 'FeeDefinition', field: 'academicYear', relation: 'academicYear AcademicYear @relation("FeeDefinitionAcademicYear", fields: [academicYearId], references: [id], onDelete: Restrict)' },
  { model: 'FeeRegime', field: 'academicYear', relation: 'academicYear AcademicYear @relation("FeeRegimeAcademicYear", fields: [academicYearId], references: [id], onDelete: Restrict)' },
  { model: 'PatronatSchool', field: 'academicYear', relation: 'academicYear AcademicYear @relation("PatronatSchoolAcademicYear", fields: [academicYearId], references: [id], onDelete: Restrict)' },
  { model: 'AutomationRule', field: 'academicYear', relation: 'academicYear AcademicYear? @relation("AutomationRuleAcademicYear", fields: [academicYearId], references: [id], onDelete: SetNull)' },
  { model: 'KpiObjective', field: 'academicYear', relation: 'academicYear AcademicYear @relation("KpiObjectiveAcademicYear", fields: [academicYearId], references: [id], onDelete: Restrict)' },
  
  // SchoolLevel relations
  { model: 'CouncilDecision', field: 'schoolLevel', relation: 'schoolLevel SchoolLevel @relation("CouncilDecisionSchoolLevel", fields: [schoolLevelId], references: [id], onDelete: Restrict)' },
  { model: 'CouncilMinute', field: 'schoolLevel', relation: 'schoolLevel SchoolLevel @relation("CouncilMinuteSchoolLevel", fields: [schoolLevelId], references: [id], onDelete: Restrict)' },
  { model: 'Inspection', field: 'schoolLevel', relation: 'schoolLevel SchoolLevel? @relation("InspectionSchoolLevel", fields: [schoolLevelId], references: [id], onDelete: SetNull)' },
  { model: 'QhsIncident', field: 'schoolLevel', relation: 'schoolLevel SchoolLevel? @relation("QhsIncidentSchoolLevel", fields: [schoolLevelId], references: [id], onDelete: SetNull)' },
  { model: 'QhsDecisionLog', field: 'schoolLevel', relation: 'schoolLevel SchoolLevel? @relation("QhsDecisionLogSchoolLevel", fields: [schoolLevelId], references: [id], onDelete: SetNull)' },
  { model: 'QhsCorrectiveAction', field: 'schoolLevel', relation: 'schoolLevel SchoolLevel? @relation("QhsCorrectiveActionSchoolLevel", fields: [schoolLevelId], references: [id], onDelete: SetNull)' },
  { model: 'QhsAudit', field: 'schoolLevel', relation: 'schoolLevel SchoolLevel? @relation("QhsAuditSchoolLevel", fields: [schoolLevelId], references: [id], onDelete: SetNull)' },
  { model: 'QhsRiskRegister', field: 'schoolLevel', relation: 'schoolLevel SchoolLevel? @relation("QhsRiskRegisterSchoolLevel", fields: [schoolLevelId], references: [id], onDelete: SetNull)' },
  { model: 'FeeDefinition', field: 'schoolLevel', relation: 'schoolLevel SchoolLevel @relation("FeeDefinitionSchoolLevel", fields: [schoolLevelId], references: [id], onDelete: Restrict)' },
  { model: 'FeeRegime', field: 'schoolLevel', relation: 'schoolLevel SchoolLevel @relation("FeeRegimeSchoolLevel", fields: [schoolLevelId], references: [id], onDelete: Restrict)' },
  { model: 'HomeworkSubmission', field: 'schoolLevel', relation: 'schoolLevel SchoolLevel @relation("HomeworkSubmissionSchoolLevel", fields: [schoolLevelId], references: [id], onDelete: Restrict)' },
  
  // User relations
  { model: 'QhsDecisionLog', field: 'decidedBy', relation: 'decidedBy User? @relation("QhsDecisionLogDecidedBy", fields: [decidedById], references: [id], onDelete: SetNull)' },
  { model: 'QhsCorrectiveAction', field: 'owner', relation: 'owner User? @relation("QhsCorrectiveActionOwner", fields: [ownerId], references: [id], onDelete: SetNull)' },
  { model: 'QhsRiskRegister', field: 'owner', relation: 'owner User? @relation("QhsRiskRegisterOwner", fields: [ownerId], references: [id], onDelete: SetNull)' },
  { model: 'PatronatUser', field: 'user', relation: 'user User @relation("PatronatUserUser", fields: [userId], references: [id], onDelete: Cascade)' },
  { model: 'PatronatSchool', field: 'creator', relation: 'creator User? @relation("PatronatSchoolCreator", fields: [createdBy], references: [id], onDelete: SetNull)' },
  { model: 'PatronatSchool', field: 'suspender', relation: 'suspender User? @relation("PatronatSchoolSuspender", fields: [suspendedBy], references: [id], onDelete: SetNull)' },
  
  // Student relations
  { model: 'GradeCalculation', field: 'student', relation: 'student Student @relation("GradeCalculationStudent", fields: [studentId], references: [id], onDelete: Cascade)' },
  
  // Class relations
  { model: 'FeeDefinition', field: 'class', relation: 'class Class? @relation("FeeDefinitionClass", fields: [classId], references: [id], onDelete: SetNull)' },
  
  // Room relations
  { model: 'ExamSubject', field: 'room', relation: 'room Room? @relation("ExamSubjectRoom", fields: [roomId], references: [id], onDelete: SetNull)' },
  
  // FeeCategory relations
  { model: 'FeeDefinition', field: 'feeCategory', relation: 'feeCategory FeeCategory @relation("FeeDefinitionFeeCategory", fields: [feeCategoryId], references: [id], onDelete: Restrict)' },
  
  // FeeRegime relations
  { model: 'FeeRegimeRule', field: 'feeRegime', relation: 'feeRegime FeeRegime @relation("FeeRegimeRuleFeeRegime", fields: [feeRegimeId], references: [id], onDelete: Cascade)' },
  { model: 'FeeRegime', field: 'tenant', relation: 'tenant Tenant @relation("FeeRegimeTenant", fields: [tenantId], references: [id], onDelete: Cascade)' },
  { model: 'FeeRegime', field: 'academicYear', relation: 'academicYear AcademicYear @relation("FeeRegimeAcademicYear", fields: [academicYearId], references: [id], onDelete: Restrict)' },
  { model: 'FeeRegime', field: 'schoolLevel', relation: 'schoolLevel SchoolLevel @relation("FeeRegimeSchoolLevel", fields: [schoolLevelId], references: [id], onDelete: Restrict)' },
  
  // Incident relations
  { model: 'CorrectiveAction', field: 'incident', relation: 'incident Incident? @relation("CorrectiveActionIncident", fields: [incidentId], references: [id], onDelete: SetNull)' },
  
  // QHS relations
  { model: 'QhsDecisionLog', field: 'incident', relation: 'incident QhsIncident @relation("QhsDecisionLogIncident", fields: [incidentId], references: [id], onDelete: Cascade)' },
  { model: 'QhsCorrectiveAction', field: 'incident', relation: 'incident QhsIncident @relation("QhsCorrectiveActionIncident", fields: [incidentId], references: [id], onDelete: Cascade)' },
  
  // Patronat relations
  { model: 'PatronatUser', field: 'patronat', relation: 'patronat Patronat? @relation("PatronatUserPatronat", fields: [patronatId], references: [id], onDelete: SetNull)' },
  { model: 'PatronatSchool', field: 'patronat', relation: 'patronat Patronat? @relation("PatronatSchoolPatronat", fields: [patronatId], references: [id], onDelete: SetNull)' },
  { model: 'NationalExam', field: 'patronat', relation: 'patronat Patronat? @relation("NationalExamPatronat", fields: [patronatId], references: [id], onDelete: SetNull)' },
  { model: 'QuestionBankResource', field: 'patronat', relation: 'patronat Patronat? @relation("QuestionBankPatronat", fields: [patronatId], references: [id], onDelete: SetNull)' },
  
  // NationalExam relations
  { model: 'ExamCandidate', field: 'exam', relation: 'exam NationalExam @relation("NationalExamCandidates", fields: [examId], references: [id], onDelete: Cascade)' },
  
  // ExamCenter relations
  { model: 'ExamRoom', field: 'center', relation: 'center ExamCenter @relation("ExamCenterRooms", fields: [centerId], references: [id], onDelete: Cascade)' },
  { model: 'ExamCandidate', field: 'center', relation: 'center ExamCenter? @relation("ExamCandidateExamCenter", fields: [centerId], references: [id], onDelete: SetNull)' },
  { model: 'ExamCenter', field: 'academicYear', relation: 'academicYear AcademicYear @relation("ExamCenterAcademicYear", fields: [academicYearId], references: [id], onDelete: Restrict)' },
  { model: 'ExamCandidate', field: 'academicYear', relation: 'academicYear AcademicYear @relation("ExamCandidateAcademicYear", fields: [academicYearId], references: [id], onDelete: Restrict)' },
];

// Fonction pour ajouter une relation si elle n'existe pas
function addInverseRelationIfMissing(modelName: string, relationLine: string) {
  const modelRegex = new RegExp(`(model ${modelName}\\s*\\{[^}]*?)(\\s*@@map|\\s*\\})`, 's');
  const match = schema.match(modelRegex);
  
  if (match) {
    const relationName = relationLine.split(' ')[0];
    // Vérifier si la relation existe déjà
    const existingRelationRegex = new RegExp(`\\s+${relationName}\\s+`, 's');
    if (!existingRelationRegex.test(match[1])) {
      // Trouver où insérer (après les champs, avant les index)
      const beforeIndex = match[1].lastIndexOf('@@');
      if (beforeIndex > 0) {
        const before = match[1].substring(0, beforeIndex);
        const after = match[1].substring(beforeIndex);
        schema = schema.replace(
          modelRegex,
          `${before}\n  ${relationLine}\n${after}$2`
        );
      } else {
        schema = schema.replace(
          modelRegex,
          `$1\n  ${relationLine}\n$2`
        );
      }
      console.log(`✓ Ajouté: ${modelName}.${relationName}`);
      return true;
    }
  }
  return false;
}

// Appliquer toutes les corrections
let added = 0;
inverseRelations.forEach(({ model, field, relation }) => {
  if (addInverseRelationIfMissing(model, relation)) {
    added++;
  }
});

console.log(`\n✓ ${added} relations inverses ajoutées`);

fs.writeFileSync(schemaPath, schema, 'utf-8');
console.log('✓ Schema corrigé avec succès!');
