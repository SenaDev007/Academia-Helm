const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
let content = fs.readFileSync(schemaPath, 'utf8');

// Toutes les relations inverses à ajouter (plus complètes)
const relationsToAdd = {
  'GedDocumentVersion': ['academicYear AcademicYear?'],
  'NationalExam': ['academicYear AcademicYear @relation("NationalExamAcademicYear")'],
  'ExamCenter': ['academicYear AcademicYear @relation("ExamCenterAcademicYear")', 'exam NationalExam @relation("NationalExamCenters")'],
  'ExamCandidate': ['academicYear AcademicYear @relation("ExamCandidateAcademicYear")', 'exam NationalExam @relation("NationalExamCandidates")'],
  'ExamRoom': ['academicYear AcademicYear @relation("ExamRoomAcademicYear")', 'exam NationalExam @relation("ExamRoomExam")', 'center ExamCenter @relation("ExamCenterRooms")'],
  'ExamSupervisor': ['academicYear AcademicYear @relation("ExamSupervisorAcademicYear")', 'exam NationalExam @relation("ExamSupervisorExam")'],
  'NationalExamSubject': ['academicYear AcademicYear @relation("NationalExamSubjectAcademicYear")', 'exam NationalExam @relation("NationalExamSubjects")'],
  'ExamResult': ['academicYear AcademicYear @relation("ExamResultAcademicYear")', 'exam NationalExam @relation("NationalExamResults")'],
  'ExamDocument': ['academicYear AcademicYear @relation("ExamDocumentAcademicYear")', 'exam NationalExam @relation("NationalExamDocuments")'],
  'QuestionBankResource': ['academicYear AcademicYear @relation("QuestionBankAcademicYear")'],
  'Expense': ['schoolLevel SchoolLevel', 'category ExpenseCategory'],
  'ExpenseCategory': ['expenses Expense[]'],
  'TaxWithholding': ['academicYear AcademicYear'],
  'TeacherSubject': ['subject Subject', 'academicYear AcademicYear'],
  'ClassSubject': ['subject Subject', 'academicYear AcademicYear'],
  'TeacherClassAssignment': ['academicYear AcademicYear'],
  'DailyLog': ['academicYear AcademicYear', 'schoolLevel SchoolLevel', 'validator User?'],
  'ClassDiary': ['academicYear AcademicYear', 'schoolLevel SchoolLevel', 'classSubject ClassSubject'],
  'HomeworkSubmission': ['academicYear AcademicYear'],
  'ExamSubject': ['room Room?'],
  'GradeCalculation': ['student Student'],
  'ReportCardItem': ['academicYear AcademicYear'],
  'CouncilDecision': ['academicYear AcademicYear', 'schoolLevel SchoolLevel'],
  'CouncilMinute': ['academicYear AcademicYear', 'schoolLevel SchoolLevel'],
  'Inspection': ['academicYear AcademicYear?', 'schoolLevel SchoolLevel?'],
  'CorrectiveAction': ['incident Incident?'],
  'QhsIncident': ['tenant Tenant', 'academicYear AcademicYear', 'schoolLevel SchoolLevel?', 'createdBy User? @relation("QhsIncidentCreatedBy")', 'validatedBy User? @relation("QhsIncidentValidatedBy")'],
  'QhsDecisionLog': ['tenant Tenant', 'academicYear AcademicYear', 'schoolLevel SchoolLevel?', 'decidedBy User?'],
  'QhsCorrectiveAction': ['tenant Tenant', 'academicYear AcademicYear', 'schoolLevel SchoolLevel?', 'owner User?'],
  'QhsAudit': ['tenant Tenant', 'academicYear AcademicYear', 'schoolLevel SchoolLevel?'],
  'QhsRiskRegister': ['tenant Tenant', 'academicYear AcademicYear', 'schoolLevel SchoolLevel?', 'owner User?'],
  'KpiObjective': ['tenant Tenant', 'academicYear AcademicYear'],
  'AutomationRule': ['tenant Tenant', 'academicYear AcademicYear?'],
  'PatronatUser': ['patronat Patronat', 'user User'],
  'PatronatSchool': ['patronat Patronat', 'schoolTenant Tenant @relation("SchoolTenants")', 'academicYear AcademicYear', 'creator User? @relation("PatronatSchoolCreator")', 'suspender User? @relation("PatronatSchoolSuspender")'],
  'NationalExam': ['patronat Patronat?'],
  'QuestionBankResource': ['patronat Patronat?'],
  'FeeDefinition': ['schoolLevel SchoolLevel', 'class Class?', 'feeCategory FeeCategory', 'feeRegimeRules FeeRegimeRule[]', 'studentFeeProfiles StudentFeeProfile[]'],
  'FeeRegime': ['tenant Tenant', 'academicYear AcademicYear', 'schoolLevel SchoolLevel', 'rules FeeRegimeRule[]'],
  'StudentFee': ['paymentAllocations PaymentAllocation[]'],
  'PaymentAllocation': ['studentFee StudentFee?', 'studentArrear StudentArrear? @relation("PaymentAllocationArrear")'],
};

// Fonction pour trouver la position où insérer les relations dans un modèle
function findInsertionPoint(content, modelName) {
  const modelRegex = new RegExp(`model ${modelName} \\{[\\s\\S]*?\\n\\}`, 'm');
  const match = content.match(modelRegex);
  if (!match) return null;
  
  const modelContent = match[0];
  // Trouver la dernière relation avant @@
  const lastRelationMatch = modelContent.match(/([a-zA-Z_][a-zA-Z0-9_]*\\s+(?:[A-Z][a-zA-Z0-9_]*|\\[\\])[^@]*@relation[^\\n]*\\n)/g);
  if (lastRelationMatch && lastRelationMatch.length > 0) {
    const lastRelation = lastRelationMatch[lastRelationMatch.length - 1];
    const lastRelationIndex = modelContent.lastIndexOf(lastRelation);
    return match.index + lastRelationIndex + lastRelation.length;
  }
  
  // Sinon, trouver le premier @@
  const firstAtAt = modelContent.indexOf('\n  @@');
  if (firstAtAt !== -1) {
    return match.index + firstAtAt + 1;
  }
  
  return null;
}

// Ajouter les relations
let addedCount = 0;
for (const [modelName, relations] of Object.entries(relationsToAdd)) {
  const insertionPoint = findInsertionPoint(content, modelName);
  if (insertionPoint !== null) {
    // Vérifier si les relations existent déjà
    const modelRegex = new RegExp(`model ${modelName} \\{[\\s\\S]*?\\n\\}`, 'm');
    const modelMatch = content.match(modelRegex);
    if (modelMatch) {
      const modelContent = modelMatch[0];
      const relationsToAddFiltered = relations.filter(rel => {
        const relName = rel.split(' ')[0];
        return !modelContent.includes(`${relName} `);
      });
      
      if (relationsToAddFiltered.length > 0) {
        const relationsText = relationsToAddFiltered.map(r => `  ${r}`).join('\n') + '\n';
        content = content.slice(0, insertionPoint) + relationsText + content.slice(insertionPoint);
        addedCount += relationsToAddFiltered.length;
        console.log(`✅ ${relationsToAddFiltered.length} relation(s) ajoutée(s) à ${modelName}`);
      }
    }
  } else {
    console.log(`⚠️  Modèle ${modelName} non trouvé ou structure inattendue`);
  }
}

fs.writeFileSync(schemaPath, content);
console.log(`\n✅ ${addedCount} relations inverses ajoutées au total!`);
