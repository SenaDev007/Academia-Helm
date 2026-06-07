/**
 * Script pour corriger automatiquement toutes les relations Prisma manquantes
 */

import * as fs from 'fs';
import * as path from 'path';

const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf-8');

// Liste des corrections à appliquer
const fixes: Array<{ model: string; relation: string; relationName?: string }> = [
  // User relations
  { model: 'User', relation: 'validatedDailyLogs DailyLog[] @relation("DailyLogValidator")' },
  { model: 'User', relation: 'createdQhsIncidents QhsIncident[] @relation("QhsIncidentCreatedBy")' },
  { model: 'User', relation: 'validatedQhsIncidents QhsIncident[] @relation("QhsIncidentValidatedBy")' },
  { model: 'User', relation: 'qhsDecisionLogs QhsDecisionLog[] @relation("QhsDecisionLogDecidedBy")' },
  { model: 'User', relation: 'qhsCorrectiveActionOwners QhsCorrectiveAction[] @relation("QhsCorrectiveActionOwner")' },
  { model: 'User', relation: 'qhsRiskRegisterOwners QhsRiskRegister[] @relation("QhsRiskRegisterOwner")' },
  { model: 'User', relation: 'patronatUsers PatronatUser[] @relation("PatronatUserUser")' },
  { model: 'User', relation: 'patronatSchoolCreators PatronatSchool[] @relation("PatronatSchoolCreator")' },
  { model: 'User', relation: 'patronatSchoolSuspenders PatronatSchool[] @relation("PatronatSchoolSuspender")' },
  
  // ClassSubject relations
  { model: 'ClassSubject', relation: 'classDiaries ClassDiary[] @relation("ClassDiaryClassSubject")' },
  
  // AcademicYear relations
  { model: 'AcademicYear', relation: 'homeworkSubmissions HomeworkSubmission[] @relation("HomeworkSubmissionAcademicYear")' },
  { model: 'AcademicYear', relation: 'councilDecisions CouncilDecision[] @relation("CouncilDecisionAcademicYear")' },
  { model: 'AcademicYear', relation: 'councilMinutes CouncilMinute[] @relation("CouncilMinuteAcademicYear")' },
  { model: 'AcademicYear', relation: 'inspections Inspection[] @relation("InspectionAcademicYear")' },
  { model: 'AcademicYear', relation: 'qhsIncidents QhsIncident[] @relation("QhsIncidentAcademicYear")' },
  { model: 'AcademicYear', relation: 'qhsDecisionLogs QhsDecisionLog[] @relation("QhsDecisionLogAcademicYear")' },
  { model: 'AcademicYear', relation: 'qhsCorrectiveActions QhsCorrectiveAction[] @relation("QhsCorrectiveActionAcademicYear")' },
  { model: 'AcademicYear', relation: 'qhsAudits QhsAudit[] @relation("QhsAuditAcademicYear")' },
  { model: 'AcademicYear', relation: 'qhsRiskRegisters QhsRiskRegister[] @relation("QhsRiskRegisterAcademicYear")' },
  { model: 'AcademicYear', relation: 'kpiObjectives KpiObjective[] @relation("KpiObjectiveAcademicYear")' },
  { model: 'AcademicYear', relation: 'automationRules AutomationRule[] @relation("AutomationRuleAcademicYear")' },
  { model: 'AcademicYear', relation: 'examCenters ExamCenter[] @relation("ExamCenterAcademicYear")' },
  { model: 'AcademicYear', relation: 'examCandidates ExamCandidate[] @relation("ExamCandidateAcademicYear")' },
  { model: 'AcademicYear', relation: 'nationalExamSubjects NationalExamSubject[] @relation("NationalExamSubjectAcademicYear")' },
  { model: 'AcademicYear', relation: 'examDocuments ExamDocument[] @relation("ExamDocumentAcademicYear")' },
  { model: 'AcademicYear', relation: 'questionBankResources QuestionBankResource[] @relation("QuestionBankAcademicYear")' },
  { model: 'AcademicYear', relation: 'feeDefinitions FeeDefinition[] @relation("FeeDefinitionAcademicYear")' },
  { model: 'AcademicYear', relation: 'feeRegimes FeeRegime[] @relation("FeeRegimeAcademicYear")' },
  { model: 'AcademicYear', relation: 'patronatSchools PatronatSchool[] @relation("PatronatSchoolAcademicYear")' },
  
  // SchoolLevel relations
  { model: 'SchoolLevel', relation: 'councilDecisions CouncilDecision[] @relation("CouncilDecisionSchoolLevel")' },
  { model: 'SchoolLevel', relation: 'councilMinutes CouncilMinute[] @relation("CouncilMinuteSchoolLevel")' },
  { model: 'SchoolLevel', relation: 'inspections Inspection[] @relation("InspectionSchoolLevel")' },
  { model: 'SchoolLevel', relation: 'qhsIncidents QhsIncident[] @relation("QhsIncidentSchoolLevel")' },
  { model: 'SchoolLevel', relation: 'qhsDecisionLogs QhsDecisionLog[] @relation("QhsDecisionLogSchoolLevel")' },
  { model: 'SchoolLevel', relation: 'qhsCorrectiveActions QhsCorrectiveAction[] @relation("QhsCorrectiveActionSchoolLevel")' },
  { model: 'SchoolLevel', relation: 'qhsAudits QhsAudit[] @relation("QhsAuditSchoolLevel")' },
  { model: 'SchoolLevel', relation: 'qhsRiskRegisters QhsRiskRegister[] @relation("QhsRiskRegisterSchoolLevel")' },
  { model: 'SchoolLevel', relation: 'homeworkSubmissions HomeworkSubmission[] @relation("HomeworkSubmissionSchoolLevel")' },
  { model: 'SchoolLevel', relation: 'feeDefinitions FeeDefinition[] @relation("FeeDefinitionSchoolLevel")' },
  { model: 'SchoolLevel', relation: 'feeRegimes FeeRegime[] @relation("FeeRegimeSchoolLevel")' },
  
  // Room relations
  { model: 'Room', relation: 'examSubjects ExamSubject[] @relation("ExamSubjectRoom")' },
  
  // Student relations
  { model: 'Student', relation: 'gradeCalculations GradeCalculation[] @relation("GradeCalculationStudent")' },
  
  // Class relations
  { model: 'Class', relation: 'feeDefinitions FeeDefinition[] @relation("FeeDefinitionClass")' },
  
  // FeeCategory relations
  { model: 'FeeCategory', relation: 'feeDefinitions FeeDefinition[] @relation("FeeDefinitionFeeCategory")' },
  
  // FeeRegimeRule relations
  { model: 'FeeRegimeRule', relation: 'feeDefinition FeeDefinition @relation("FeeRegimeRuleFeeDefinition", fields: [feeDefinitionId], references: [id], onDelete: Restrict)' },
  
  // StudentFeeProfile relations
  { model: 'StudentFeeProfile', relation: 'feeDefinition FeeDefinition @relation("StudentFeeProfileFeeDefinition", fields: [feeDefinitionId], references: [id], onDelete: Restrict)' },
  
  // Incident relations
  { model: 'Incident', relation: 'correctiveActions CorrectiveAction[] @relation("CorrectiveActionIncident")' },
  
  // Tenant relations
  { model: 'Tenant', relation: 'qhsIncidents QhsIncident[] @relation("QhsIncidentTenant")' },
  { model: 'Tenant', relation: 'qhsDecisionLogs QhsDecisionLog[] @relation("QhsDecisionLogTenant")' },
  { model: 'Tenant', relation: 'qhsCorrectiveActions QhsCorrectiveAction[] @relation("QhsCorrectiveActionTenant")' },
  { model: 'Tenant', relation: 'qhsAudits QhsAudit[] @relation("QhsAuditTenant")' },
  { model: 'Tenant', relation: 'qhsRiskRegisters QhsRiskRegister[] @relation("QhsRiskRegisterTenant")' },
  { model: 'Tenant', relation: 'kpiObjectives KpiObjective[] @relation("KpiObjectiveTenant")' },
  { model: 'Tenant', relation: 'automationRules AutomationRule[] @relation("AutomationRuleTenant")' },
  { model: 'Tenant', relation: 'patronatSchools PatronatSchool[] @relation("SchoolTenants")' },
  
  // NationalExam relations
  { model: 'NationalExam', relation: 'examCenters ExamCenter[] @relation("NationalExamCenters", fields: [id], references: [id])' },
  { model: 'NationalExam', relation: 'examCandidates ExamCandidate[] @relation("NationalExamCandidates", fields: [id], references: [id])' },
  { model: 'NationalExam', relation: 'nationalExamSubjects NationalExamSubject[] @relation("NationalExamSubjects", fields: [id], references: [id])' },
  { model: 'NationalExam', relation: 'examResults ExamResult[] @relation("NationalExamResults", fields: [id], references: [id])' },
  { model: 'NationalExam', relation: 'examDocuments ExamDocument[] @relation("NationalExamDocuments", fields: [id], references: [id])' },
  
  // ExamCenter relations
  { model: 'ExamCenter', relation: 'examRooms ExamRoom[] @relation("ExamCenterRooms")' },
  { model: 'ExamCenter', relation: 'examCandidates ExamCandidate[] @relation("ExamCandidateExamCenter")' },
  
  // Patronat relations
  { model: 'Patronat', relation: 'patronatUsers PatronatUser[] @relation("PatronatUserPatronat", fields: [id], references: [id])' },
  { model: 'Patronat', relation: 'patronatSchools PatronatSchool[] @relation("PatronatSchoolPatronat", fields: [id], references: [id])' },
  { model: 'Patronat', relation: 'nationalExams NationalExam[] @relation("NationalExamPatronat", fields: [id], references: [id])' },
  { model: 'Patronat', relation: 'questionBankResources QuestionBankResource[] @relation("QuestionBankPatronat", fields: [id], references: [id])' },
];

// Appliquer les corrections
fixes.forEach(({ model, relation }) => {
  const modelRegex = new RegExp(`(model ${model}\\s*\\{[^}]*?)(\\s*@@map|\\s*\\})`, 's');
  const match = schema.match(modelRegex);
  
  if (match) {
    // Vérifier si la relation existe déjà
    if (!schema.includes(relation.split(' ')[0])) {
      schema = schema.replace(
        modelRegex,
        `$1\n  ${relation}\n$2`
      );
      console.log(`✓ Ajouté: ${model}.${relation.split(' ')[0]}`);
    } else {
      console.log(`- Déjà présent: ${model}.${relation.split(' ')[0]}`);
    }
  } else {
    console.log(`✗ Modèle non trouvé: ${model}`);
  }
});

// Corriger les relations Patronat qui manquent fields/references
schema = schema.replace(
  /patronat\s+Patronat\?/g,
  'patronat Patronat? @relation(fields: [patronatId], references: [id], onDelete: SetNull)'
);

// Ajouter les champs patronatId manquants
const modelsWithPatronat = [
  'PatronatUser',
  'PatronatSchool',
  'NationalExam',
  'QuestionBankResource',
];

modelsWithPatronat.forEach(modelName => {
  const modelRegex = new RegExp(`(model ${modelName}\\s*\\{[^}]*?)(\\s*tenantId)`, 's');
  if (schema.match(modelRegex) && !schema.includes(`${modelName}.*patronatId`)) {
    schema = schema.replace(
      modelRegex,
      `$1\n  patronatId String?\n$2`
    );
    console.log(`✓ Ajouté patronatId dans ${modelName}`);
  }
});

fs.writeFileSync(schemaPath, schema, 'utf-8');
console.log('\n✓ Schema corrigé avec succès!');
