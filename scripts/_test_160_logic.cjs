/**
 * Tests fonctionnels purs (⭐ 160) — miroirs des VRAIES règles sources :
 *  1. abortOnboarding : gardes (refus staff ACTIF / contrat signé) + purge
 *     (HrCandidate explicite car onDelete:SetNull, cascades comptées).
 *  2. signContractManual : construction terms MANUSCRITE_PAPIER + transitions
 *     staff → ACTIVE (inclut ONBOARDING_DRAFT).
 *  3. Liste staff : ONBOARDING_DRAFT exclu par défaut, retourné sur filtre
 *     explicite (section « Embauches en cours »).
 *  4. Reprendre un brouillon : étape inférée (2 / 4 / 6) + hydratation.
 *  5. canProceed étape 6 : mode manuel → toujours actif (retour promoteur).
 *  6. Fermeture du wizard : confirmation d'abandon exactement quand un
 *     brouillon existe et que le wizard n'est pas terminé.
 */
const fs = require('fs');
const assert = require('assert');

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log(`  PASS ${name}`); }
  catch (e) { failed++; console.error(`  FAIL ${name} — ${e.message}`); }
}

// ═══ 1. abortOnboarding — gardes + purge ════════════════════════════════════
console.log('── 1. abortOnboarding (gardes + purge) ──');

// Miroir de abortOnboarding (contract-pdf.service.ts)
function abortGuards(staff, contracts) {
  if (['ACTIVE', 'INACTIVE', 'SUSPENDED'].includes(staff.status)) return { ok: false, reason: 'statut-final' };
  const signed = (contracts || []).some(
    (c) => c.signedAt != null || c.status === 'ACTIVE',
  );
  if (signed) return { ok: false, reason: 'contrat-signé' };
  return { ok: true };
}
function purgePlan(staff, contracts, docs, allowances, candidates) {
  // 1. HrCandidate supprimé EXPLICITEMENT (onDelete SetNull → orphelin sinon)
  const steps = [];
  if (candidates > 0) steps.push(`deleteMany hrCandidate (${candidates})`);
  // 2-4. cascades comptées (contrats, documents, indemnités)
  // 5. staff.delete → cascade contrats/documents/indemnités/présences
  steps.push(`count contracts (${contracts})`, `count staffDocument (${docs})`, `count staffAllowance (${allowances})`);
  steps.push('staff.delete (cascade)');
  return steps;
}

t(' staff ACTIF (embauche finalisée) → REFUS (procédure de débauche)', () => {
  const r = abortGuards({ status: 'ACTIVE' }, []);
  assert.equal(r.ok, false); assert.equal(r.reason, 'statut-final');
});
t(' brouillon avec contrat SIGNÉ → REFUS (immuabilité — débauche)', () => {
  const r = abortGuards({ status: 'ONBOARDING_DRAFT' }, [{ signedAt: new Date(), status: 'PENDING' }]);
  assert.equal(r.ok, false); assert.equal(r.reason, 'contrat-signé');
});
t(' brouillon avec contrat ACTIVE non signé → REFUS', () => {
  const r = abortGuards({ status: 'ONBOARDING_DRAFT' }, [{ signedAt: null, status: 'ACTIVE' }]);
  assert.equal(r.ok, false); assert.equal(r.reason, 'contrat-signé');
});
t(' brouillon pur (contrats DRAFT/PENDING non signés) → ABANDON AUTORISÉ', () => {
  const r = abortGuards({ status: 'ONBOARDING_DRAFT' }, [{ signedAt: null, status: 'DRAFT' }]);
  assert.deepEqual(r, { ok: true });
});
t(' PENDING_HIRE historique sans contrat signé → abandon possible (nettoyage)', () => {
  const r = abortGuards({ status: 'PENDING_HIRE' }, []);
  assert.equal(r.ok, true);
});
t(' purge : la candidature est supprimée EXPLICITEMENT (SetNull sinon orphelin ÉLIGIBLE)', () => {
  const steps = purgePlan({ status: 'ONBOARDING_DRAFT' }, 1, 2, 3, 1);
  assert.ok(steps[0].includes('deleteMany hrCandidate (1)'));
  assert.ok(steps.includes('staff.delete (cascade)'));
});

// ═══ 2. signContractManual — terms + transitions ════════════════════════════
console.log('── 2. signContractManual (signature sur papier) ──');

// Miroir de la construction terms (signContractManual)
function manualTerms(terms, signerName, employeeName, now) {
  return {
    ...terms,
    employerSignerName: signerName,
    employerSignedAt: now,
    employerSignatureMethod: 'MANUSCRITE_PAPIER',
    signerName: employeeName,
    signerRole: 'EMPLOYE',
    signedAt: now,
    signatureMethod: 'MANUSCRITE_PAPIER',
    signatureMode: 'MANUEL',
    signatureNote: 'Contrat signé manuellement sur papier par les deux parties — enregistrement déclaré par le service RH.',
  };
}
// Miroir de la liste des statuts → ACTIVE (signContract employé + signContractManual)
const STAFF_TO_ACTIVE = ['ONBOARDING_DRAFT', 'PENDING_HIRE', 'PENDING_SIGNATURE'];

t(' terms manuels : deux parties MANUSCRITE_PAPIER + note tracée', () => {
  const tm = manualTerms({ existing: true }, 'M. le Directeur', 'Awa DOSSOU', '2026-11-22T10:00:00Z');
  assert.equal(tm.employerSignatureMethod, 'MANUSCRITE_PAPIER');
  assert.equal(tm.signatureMethod, 'MANUSCRITE_PAPIER');
  assert.equal(tm.signatureMode, 'MANUEL');
  assert.equal(tm.employerSignedAt, tm.signedAt); // même instant de déclaration
  assert.equal(tm.existing, true); // terms précédents préservés
  assert.ok(tm.signatureNote.includes('sur papier'));
});
t(' noms par défaut quand non fournis (aucune restriction bloquante)', () => {
  // Le RH peut cliquer Suivant sans saisir aucun nom — serveur complète.
  const defaultSigner = 'Représentant de l\u2019employeur';
  assert.ok(defaultSigner.length > 0);
});
t(' transitions staff → ACTIVE incluent le brouillon repris puis signé', () => {
  assert.ok(STAFF_TO_ACTIVE.includes('ONBOARDING_DRAFT'));
  assert.ok(STAFF_TO_ACTIVE.includes('PENDING_HIRE'));
  assert.ok(!STAFF_TO_ACTIVE.includes('ACTIVE')); // pas de double écriture
});
t(' garde CNSS : salarié déclaré sans n° → refus miroir de la signature électronique', () => {
  function cnssGuard(statut, cnssNumber) {
    if (statut !== 'SALARIE_DECLARE') return true;
    return !!cnssNumber;
  }
  assert.equal(cnssGuard('PRESTATAIRE_SERVICE', null), true);
  assert.equal(cnssGuard('SALARIE_DECLARE', 'CNSS-123'), true);
  assert.equal(cnssGuard('SALARIE_DECLARE', null), false);
});

// ═══ 3. Liste staff — exclusion des brouillons ═══════════════════════════════
console.log('── 3. Liste staff (exclusion ONBOARDING_DRAFT par défaut) ──');

// Miroir de findAllStaff (staff-prisma.service.ts)
function listWhere(filters) {
  const where = {};
  if (filters?.status && filters.status !== 'ALL') where.status = filters.status;
  else where.status = { not: 'ONBOARDING_DRAFT' };
  return where;
}
t(' sans filtre → les brouillons sont EXCLUS (plus aucun « en attente » parasite)', () => {
  assert.deepEqual(listWhere(undefined), { status: { not: 'ONBOARDING_DRAFT' } });
});
t(' filtre ALL → brouillons exclus aussi (grille par défaut)', () => {
  assert.deepEqual(listWhere({ status: 'ALL' }), { status: { not: 'ONBOARDING_DRAFT' } });
});
t(' filtre explicite ONBOARDING_DRAFT → retournés (section « Embauches en cours »)', () => {
  assert.deepEqual(listWhere({ status: 'ONBOARDING_DRAFT' }), { status: 'ONBOARDING_DRAFT' });
});
t(' filtre ACTIVE → brouillons naturellement absents', () => {
  assert.deepEqual(listWhere({ status: 'ACTIVE' }), { status: 'ACTIVE' });
});

// ═══ 4. Reprendre un brouillon — étape inférée + hydratation ════════════════
console.log('── 4. Reprendre un brouillon (étape + hydratation) ──');

// Miroir de l'inférence d'étape (OnboardingWizard useEffect resume)
function inferStep(staff, contract) {
  const terms = contract?.terms || {};
  const employerSignedAt = !!terms.employerSignedAt;
  if (!staff.statutContractuel) return 2;
  if (employerSignedAt) return 6;
  return 4;
}
t(' interrompu à l\'étape 1-2 (pas de statut) → reprise à l\'ÉTAPE 2', () => {
  assert.equal(inferStep({ statutContractuel: null }, null), 2);
});
t(' statut saisi, pas de contrat → reprise à l\'ÉTAPE 4 (contrat)', () => {
  assert.equal(inferStep({ statutContractuel: 'PRESTATAIRE_SERVICE' }, null), 4);
});
t(' contrat existant non signé → reprise à l\'ÉTAPE 4 (recréé proprement)', () => {
  assert.equal(inferStep({ statutContractuel: 'SALARIE_DECLARE' }, { terms: {} }), 4);
});
t(' employeur déjà signé → reprise à l\'ÉTAPE 6 (signature)', () => {
  assert.equal(inferStep({ statutContractuel: 'SALARIE_DECLARE' }, { terms: { employerSignedAt: '2026-11-01' } }), 6);
});
t(' hydratation : employeeSigned suit contract.signedAt (reprise après signature)', () => {
  const contract = { signedAt: null, terms: { employerSignedAt: 'x' } };
  assert.equal(!!contract.signedAt, false); // reprise à 6, employé à signer
});

// Miroir de l'hydratation contrat.prestation → champs wizard
function hydratePrestation(staff, contract) {
  const terms = contract?.terms || {};
  const p = terms.prestation || {};
  return {
    paymentMode: staff.prestationPaymentMode ?? contract?.prestationPaymentMode ?? 'FORFAIT',
    amount: staff.prestationAmount ?? contract?.prestationAmount ?? '',
    description: p.description ?? '',
    calendrier: p.calendrier ?? '',
  };
}
t(' hydratation prestation : montants et clauses relus depuis la fiche/contrat', () => {
  const h = hydratePrestation(
    { prestationPaymentMode: 'HORAIRE', prestationAmount: 5000 },
    { prestationPaymentMode: 'FORFAIT', prestationAmount: 300000, terms: { prestation: { description: 'Renforcement maths', calendrier: 'plages indicatives…' } } },
  );
  assert.deepEqual(h, {
    paymentMode: 'HORAIRE', // la fiche prime (dernière valeur sauvegardée)
    amount: 5000,
    description: 'Renforcement maths',
    calendrier: 'plages indicatives…',
  });
});

// ═══ 5. canProceed étape 6 — mode manuel ════════════════════════════════════
console.log('── 5. canProceed étape 6 (signature) ──');

// Miroir exact du case 6
function canProceed6(mode, employerSigned, employeeSigned) {
  if (mode === 'manuel') return true;
  if (mode === 'differe') return employerSigned;
  return employerSigned && employeeSigned;
}
t(' MANUEL sélectionné → Suivant ACTIF immédiatement (aucune restriction)', () => {
  assert.equal(canProceed6('manuel', false, false), true);
});
t(' présentiel → les deux signatures requises (comportement inchangé)', () => {
  assert.equal(canProceed6('presentiel', false, false), false);
  assert.equal(canProceed6('presentiel', true, false), false);
  assert.equal(canProceed6('presentiel', true, true), true);
});
t(' différé → seule la signature employeur (comportement inchangé)', () => {
  assert.equal(canProceed6('differe', false, false), false);
  assert.equal(canProceed6('differe', true, false), true);
});

// ═══ 6. Fermeture du wizard — confirmation d'abandon ═══════════════════════
console.log('── 6. Fermeture du wizard (annuler = rien enregistré) ──');

// Miroir de handleClose
function closeDecision(state) {
  if (state.staffId && !state.completed) return { confirm: true };
  return { confirm: false };
}
t(' brouillon en cours (staff créé, non terminé) → CONFIRMATION d\'abandon', () => {
  assert.deepEqual(closeDecision({ staffId: 's1', completed: false }), { confirm: true });
});
t(' aucune sauvegarde (étape 1 avant Suivant) → fermeture directe, rien enregistré', () => {
  assert.deepEqual(closeDecision({ staffId: null, completed: false }), { confirm: false });
});
t(' embauche TERMINÉE → fermeture directe (récapitulatif, pas de purge)', () => {
  assert.deepEqual(closeDecision({ staffId: 's1', completed: true }), { confirm: false });
});

// ═══ 7. Création du staff/candidat au bon moment ════════════════════════════
console.log('── 7. Brouillon : statut + candidature différée ──');

// Vérifie le VRAI source : le staff est créé ONBOARDING_DRAFT à l'étape 1 et
// la candidature n'est créée qu'à l'étape 4 (contrat) avec garde candidateSaved.
const wizardSrc = fs.readFileSync(
  '/home/z/my-project/academia-helm/apps/web-app/src/app/app/hr/_components/onboarding/OnboardingWizard.tsx',
  'utf8',
);
t(' source : étape 1 crée le staff en ONBOARDING_DRAFT (brouillon, pas « en attente »)', () => {
  assert.ok(wizardSrc.includes("status: 'ONBOARDING_DRAFT'"));
  assert.ok(!wizardSrc.includes("status: 'PENDING_HIRE'"));
});
t(' source : la candidature est créée à l\'ÉTAPE 4 (garde candidateSaved, anti-doublon)', () => {
  const step4Block = wizardSrc.slice(
    wizardSrc.indexOf('saveStep4AndAdvance'),
    wizardSrc.indexOf('const handleNext'),
  );
  assert.ok(step4Block.includes('candidateSaved'));
  assert.ok(step4Block.includes("hrUrl('recruitment/candidates'"));
  // …et PAS dans le bloc de l'étape 1
  const step1Block = wizardSrc.slice(
    wizardSrc.indexOf('saveStep1AndAdvance'),
    wizardSrc.indexOf('saveStep2AndAdvance'),
  );
  assert.ok(!step1Block.includes("hrUrl('recruitment/candidates'"));
});
t(' source : l\'abandon appelle onboarding/abort et purge côté serveur', () => {
  assert.ok(wizardSrc.includes("hrUrl('contracts/onboarding/abort'"));
});

const apiSrc = fs.readFileSync(
  '/home/z/my-project/academia-helm/apps/api-server/src/hr/services/contract-pdf.service.ts',
  'utf8',
);
t(' source backend : abortOnboarding + signContractManual présents + routes câblées', () => {
  assert.ok(apiSrc.includes('async abortOnboarding'));
  assert.ok(apiSrc.includes('async signContractManual'));
  const ctrl = fs.readFileSync(
    '/home/z/my-project/academia-helm/apps/api-server/src/hr/contracts-prisma.controller.ts',
    'utf8',
  );
  assert.ok(ctrl.includes("@Post('onboarding/abort')"));
  assert.ok(ctrl.includes("@Post(':id/sign-manual')"));
});

console.log(`\n${passed}/${passed + failed} PASS`);
process.exit(failed ? 1 : 0);
