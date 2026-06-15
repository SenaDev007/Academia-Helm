const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
let content = fs.readFileSync(schemaPath, 'utf8');

// Liste des relations à supprimer (doublons ajoutés par le script précédent)
const duplicatesToRemove = [
  'patronatUsers PatronatUser[]',
  'patronatSchools PatronatSchool[] @relation("SchoolTenants")',
  'questionBankResources QuestionBankResource[]',
  'subscription Subscription? @relation("SubscriptionPaymentFlow")',
  'paymentFlows PaymentFlow[] @relation("SubscriptionPaymentFlow")',
  'expenses Expense[]',
  'versions PedagogicalDocumentVersion[]',
  'reviews PedagogicalDocumentReview[]',
  'comments PedagogicalDocumentComment[]',
  'notifications PedagogicalDocumentNotification[]',
  'users PatronatUser[]',
  'schools PatronatSchool[]',
  'exams NationalExam[]',
  'questionBankResources QuestionBankResource[]',
  'feeDefinitions FeeDefinition[]',
  'feeRegimeRules FeeRegimeRule[]',
  'studentFeeProfiles StudentFeeProfile[]',
  'rules FeeRegimeRule[]',
  'paymentAllocations PaymentAllocation[]',
  'studentFee StudentFee?',
  'studentArrear StudentArrear? @relation("PaymentAllocationArrear")',
];

// Supprimer les doublons ligne par ligne
for (const duplicate of duplicatesToRemove) {
  // Trouver toutes les occurrences
  const regex = new RegExp(`\\s+${duplicate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\n`, 'g');
  const matches = content.match(regex);
  
  if (matches && matches.length > 1) {
    // Garder seulement la première occurrence, supprimer les autres
    let firstFound = false;
    content = content.replace(regex, (match) => {
      if (!firstFound) {
        firstFound = true;
        return match;
      }
      return ''; // Supprimer les doublons
    });
    console.log(`✅ Doublons supprimés pour: ${duplicate}`);
  }
}

fs.writeFileSync(schemaPath, content);
console.log('\n✅ Tous les doublons ont été supprimés!');
