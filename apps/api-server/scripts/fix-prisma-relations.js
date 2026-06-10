const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
let content = fs.readFileSync(schemaPath, 'utf8');

// Liste des relations inverses à ajouter
const relationsToAdd = {
  'AcademicYear': [
    'rooms Room[]',
    'gedDocuments GedDocument[]',
    'attendanceRecords AttendanceRecord[]',
    'disciplineRecords DisciplineRecord[]',
    'gedDocumentVersions GedDocumentVersion[]',
    'pedagogicalDocuments PedagogicalDocument[]',
    'pedagogicalDocumentVersions PedagogicalDocumentVersion[]',
    'pedagogicalDocumentReviews PedagogicalDocumentReview[]',
    'pedagogicalDocumentComments PedagogicalDocumentComment[]',
    'pedagogicalDocumentNotifications PedagogicalDocumentNotification[]',
    'weeklyDutyAssignments WeeklyDutyAssignment[]',
    'weeklySemainiers WeeklySemainier[]',
    'weeklySemainierDailyEntries WeeklySemainierDailyEntry[]',
    'weeklySemainierIncidents WeeklySemainierIncident[]',
    'kpiObjectives KpiObjective[]',
    'automationRules AutomationRule[]',
    'patronatSchools PatronatSchool[]',
    'nationalExams NationalExam[]',
    'examCenters ExamCenter[]',
    'examCandidates ExamCandidate[]',
    'examRooms ExamRoom[]',
    'examSupervisors ExamSupervisor[]',
    'nationalExamSubjects NationalExamSubject[]',
    'examResults ExamResult[]',
    'examDocuments ExamDocument[]',
    'questionBankResources QuestionBankResource[]',
    'feeDefinitions FeeDefinition[]',
    'feeRegimes FeeRegime[]',
    'studentFeeProfiles StudentFeeProfile[]',
    'studentFees StudentFee[]',
    'paymentSummaries PaymentSummary[]',
    'dailyClosures DailyClosure[]',
    'feeArrears FeeArrear[]',
    'studentArrearsFromYear StudentArrear[] @relation("StudentArrearFromYear")',
    'studentArrearsToYear StudentArrear[] @relation("StudentArrearToYear")',
  ],
  'SchoolLevel': [
    'gedDocuments GedDocument[]',
    'tuitionInstallments TuitionInstallment[]',
    'overtimeRecords OvertimeRecord[]',
    'staffTrainings StaffTraining[]',
    'pedagogicalDocuments PedagogicalDocument[]',
    'pedagogicalDocumentVersions PedagogicalDocumentVersion[]',
    'pedagogicalDocumentReviews PedagogicalDocumentReview[]',
    'pedagogicalDocumentComments PedagogicalDocumentComment[]',
    'pedagogicalDocumentNotifications PedagogicalDocumentNotification[]',
    'weeklyDutyAssignments WeeklyDutyAssignment[]',
    'weeklySemainiers WeeklySemainier[]',
    'weeklySemainierDailyEntries WeeklySemainierDailyEntry[]',
    'weeklySemainierIncidents WeeklySemainierIncident[]',
    'kpiObjectives KpiObjective[]',
    'automationRules AutomationRule[]',
    'questionBankResources QuestionBankResource[]',
    'dailyClosures DailyClosure[]',
  ],
  'Student': [
    'meetings Meeting[] @relation("MeetingStudent")',
    'transferRequests TransferRequest[]',
    'classTransfers ClassTransfer[]',
    'attendanceRecords AttendanceRecord[]',
    'disciplineRecords DisciplineRecord[]',
    'libraryLoans LibraryLoan[]',
    'educastAccesses EducastAccess[]',
    'educastSessions EducastSession[]',
  ],
  'Tenant': [
    'gedDocuments GedDocument[]',
    'attendanceRecords AttendanceRecord[]',
    'disciplineRecords DisciplineRecord[]',
    'automationExecutions AutomationExecution[]',
    'taxWithholdings TaxWithholding[]',
    'weeklySemainierDailyEntries WeeklySemainierDailyEntry[]',
    'weeklySemainierIncidents WeeklySemainierIncident[]',
    'patronatUsers PatronatUser[]',
    'patronatSchools PatronatSchool[] @relation("SchoolTenants")',
    'feeCategories FeeCategory[]',
    'studentArrears StudentArrear[]',
    'libraryLoans LibraryLoan[]',
  ],
  'User': [
    'gedDocumentsCreated GedDocument[] @relation("GedDocumentCreatedBy")',
    'gedDocumentsValidated GedDocument[] @relation("GedDocumentValidatedBy")',
    'gedDocumentVersions GedDocumentVersion[]',
    'kpiObjectivesCreated KpiObjective[]',
    'automationRulesCreated AutomationRule[] @relation("AutomationRuleCreatedBy")',
    'automationRulesApproved AutomationRule[] @relation("AutomationRuleApprovedBy")',
    'dailyClosuresValidated DailyClosure[] @relation("DailyClosureValidator")',
  ],
  'Class': [
    'feeDefinitions FeeDefinition[]',
    'pedagogicalDocuments PedagogicalDocument[]',
  ],
  'Subject': [
    'staffAssignments StaffAssignment[]',
    'pedagogicalDocuments PedagogicalDocument[]',
  ],
  'Subscription': [
    'paymentFlows PaymentFlow[] @relation("SubscriptionPaymentFlow")',
  ],
  'PaymentFlow': [
    'subscription Subscription? @relation("SubscriptionPaymentFlow")',
  ],
  'FeeCategory': [
    'feeDefinitions FeeDefinition[]',
  ],
  'FeeDefinition': [
    'feeRegimeRules FeeRegimeRule[]',
    'studentFeeProfiles StudentFeeProfile[]',
  ],
  'FeeRegime': [
    'rules FeeRegimeRule[]',
  ],
  'StudentFee': [
    'paymentAllocations PaymentAllocation[]',
    'paymentSummaries PaymentSummary[]',
  ],
  'StudentArrear': [
    'paymentAllocations PaymentAllocation[] @relation("PaymentAllocationArrear")',
  ],
  'PaymentAllocation': [
    'studentFee StudentFee?',
    'studentArrear StudentArrear? @relation("PaymentAllocationArrear")',
  ],
  'NationalExam': [
    'examCenters ExamCenter[]',
    'examCandidates ExamCandidate[]',
    'examRooms ExamRoom[] @relation("ExamRoomExam")',
    'examSupervisors ExamSupervisor[] @relation("ExamSupervisorExam")',
    'nationalExamSubjects NationalExamSubject[]',
    'examResults ExamResult[]',
    'examDocuments ExamDocument[]',
  ],
  'ExamCenter': [
    'examRooms ExamRoom[]',
    'examSupervisors ExamSupervisor[]',
  ],
  'Patronat': [
    'users PatronatUser[]',
    'schools PatronatSchool[]',
    'exams NationalExam[]',
    'questionBankResources QuestionBankResource[]',
  ],
  'KpiDefinition': [
    'kpiObjectives KpiObjective[]',
  ],
  'PedagogicalDocument': [
    'versions PedagogicalDocumentVersion[]',
    'reviews PedagogicalDocumentReview[]',
    'comments PedagogicalDocumentComment[]',
    'notifications PedagogicalDocumentNotification[]',
  ],
  'AtlasMessage': [
    'feedbacks AtlasFeedback[]',
  ],
  'AtlasConversation': [
    'feedbacks AtlasFeedback[]',
  ],
  'ExpenseCategory': [
    'expenses Expense[]',
  ],
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
for (const [modelName, relations] of Object.entries(relationsToAdd)) {
  const insertionPoint = findInsertionPoint(content, modelName);
  if (insertionPoint !== null) {
    const relationsText = relations.map(r => `  ${r}`).join('\n') + '\n';
    content = content.slice(0, insertionPoint) + relationsText + content.slice(insertionPoint);
    console.log(`✅ Relations ajoutées à ${modelName}`);
  } else {
    console.log(`⚠️  Modèle ${modelName} non trouvé ou structure inattendue`);
  }
}

fs.writeFileSync(schemaPath, content);
console.log('\n✅ Toutes les relations inverses ont été ajoutées!');
