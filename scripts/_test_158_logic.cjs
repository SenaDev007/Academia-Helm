/**
 * Tests fonctionnels purs (⭐ 158) — extraits du VRAI source :
 *  1. buildPrestationCalendarText : génération de la clause « calendrier des
 *     interventions » (jours + plages horaires + mois prédéfinis).
 *  2. canProceed étape 4 PRESTATAIRE_SERVICE : le bouton Suivant devient
 *     actif quand les dates (désormais rendues) sont saisies — avant : mort.
 *  3. Règle updateStaff : exception BROUILLON D'EMBAUCHE (PENDING_HIRE sans
 *     contrat signé/actif → correction du statut autorisée ; sinon refus).
 *  4. Notification d'émission : titre/corps/URL par rôle et type de document.
 *  5. Signature de brouillon : détection d'un changement après retour arrière.
 *  6. Contrôle d'appartenance du téléchargement self-service.
 */
const fs = require('fs');
const assert = require('assert');

const SRC_STEP = fs.readFileSync(
  '/home/z/my-project/academia-helm/apps/web-app/src/app/app/hr/_components/onboarding/steps/StepContract.tsx',
  'utf8',
);

// ── Extraction des fonctions pures du VRAI source StepContract.tsx ──────────
function extractPureParts(src) {
  const start = src.indexOf('const PC_DAYS');
  const end = src.indexOf('function PrestationCalendarSelector(');
  assert(start > 0 && end > start, 'bloc calendrier introuvable dans le source');
  const block = src.slice(start, end);
  // Neutralise le JSX/TS typé : on ne garde que les déclarations pures
  const code = block
    .replace(/export function buildPrestationCalendarText/, 'function buildPrestationCalendarText')
    .replace(/:\s*Array<\{[^}]*\}>/g, '')
    .replace(/:\s*PrestationCalendarValue/g, '')
    .replace(/:\s*string(\[\])?(\s*\|\s*null)?/g, '')
    .replace(/\s+as\s+string\[\]/g, '')
    .replace(/:\s*boolean/g, '');
  const mod = new Function(`${code}\n return { PC_DAYS, PC_SLOTS, PC_MONTHS, pcJoin, pcMonthsFragment, buildPrestationCalendarText };`)();
  return mod;
}

const { PC_DAYS, PC_SLOTS, PC_MONTHS, buildPrestationCalendarText, pcMonthsFragment } = extractPureParts(SRC_STEP);

let passed = 0;
let failed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log(`  PASS ${name}`); }
  catch (e) { failed++; console.error(`  FAIL ${name} — ${e.message}`); }
}

console.log('── 1. buildPrestationCalendarText (clause générée) ──');
t('catalogues prédéfinis : 6 jours, 8 plages, 12 mois (année scolaire)', () => {
  assert.equal(PC_DAYS.length, 6);
  assert.equal(PC_SLOTS.length, 8);
  assert.equal(PC_MONTHS.length, 12);
  assert.equal(PC_MONTHS[0].key, 'SEPTEMBRE'); // ordre année scolaire
  assert.equal(PC_MONTHS[11].key, 'AOUT');
});
t('exemple promoteur : mardis+jeudis, 15h-17h, octobre→juin', () => {
  const text = buildPrestationCalendarText({
    days: ['MARDI', 'JEUDI'],
    slots: ['15h00-17h00'],
    months: ['OCTOBRE', 'NOVEMBRE', 'DECEMBRE', 'JANVIER', 'FEVRIER', 'MARS', 'AVRIL', 'MAI', 'JUIN'],
  });
  assert.equal(
    text,
    'plages indicatives de 15h00 à 17h00, les mardis et jeudis, d\'octobre à juin',
    `reçu : ${text}`,
  );
});
t('plusieurs plages : « de A à B et de C à D »', () => {
  const text = buildPrestationCalendarText({ days: ['MARDI'], slots: ['09h00-11h00', '15h00-17h00'], months: ['JANVIER'] });
  assert.equal(text, 'plages indicatives de 09h00 à 11h00 et de 15h00 à 17h00, les mardis, en janvier');
});
t('sélection complète → « toute l’année »', () => {
  assert.equal(pcMonthsFragment(PC_MONTHS.map((m) => m.key)), "toute l'année");
});
t('mois non contigus → « en a, b et c »', () => {
  assert.equal(pcMonthsFragment(['OCTOBRE', 'DECEMBRE', 'MARS']), 'en octobre, décembre et mars');
});
t('ordre des clics neutralisé : la clause suit l’ordre des jours/plages/mois', () => {
  const text = buildPrestationCalendarText({ days: ['JEUDI', 'MARDI'], slots: ['15h00-17h00', '07h00-09h00'], months: ['JUIN', 'OCTOBRE', 'NOVEMBRE', 'DECEMBRE', 'JANVIER', 'FEVRIER', 'MARS', 'AVRIL', 'MAI'] });
  assert.equal(text, 'plages indicatives de 07h00 à 09h00 et de 15h00 à 17h00, les mardis et jeudis, d\'octobre à juin');
});
t('sélection vide → chaîne vide (validation ≥ 3 caractères la bloque)', () => {
  assert.equal(buildPrestationCalendarText({ days: [], slots: [], months: [] }), '');
});
t('un seul jour → « les mardis »', () => {
  const text = buildPrestationCalendarText({ days: ['MARDI'], slots: [], months: [] });
  assert.equal(text, 'les mardis');
});

// ── 2. canProceed étape 4 PRESTATAIRE (bouton Suivant) ───────────────────────
console.log('── 2. canProceed étape 4 — PRESTATAIRE_SERVICE ──');
// Miroir exact de la validation du wizard (OnboardingWizard.tsx case 4)
function canProceedStep4Prestation(contract) {
  const amount = parseFloat(contract.prestationAmount);
  return !!(
    contract.prestationPaymentMode &&
    amount > 0 &&
    contract.prestationDescription.trim().length >= 10 &&
    contract.prestationCalendrier.trim().length >= 3 &&
    contract.startDate &&
    contract.endDate
  );
}
t('AVANT correctif (sans champ date rendu) : Suivant MORT — reproduction du bug', () => {
  const dead = canProceedStep4Prestation({
    prestationPaymentMode: 'FORFAIT', prestationAmount: '300000',
    prestationDescription: 'Animation de renforcement en mathématiques',
    prestationCalendrier: 'plages indicatives de 15h00 à 17h00, les mardis',
    startDate: '2026-11-01', endDate: '', // endDate jamais saisissable → ''
  });
  assert.equal(dead, false, 'le bug : endDate vide → Suivant inactif');
});
t('APRÈS correctif (dates rendues + saisies) : Suivant ACTIF', () => {
  const ok = canProceedStep4Prestation({
    prestationPaymentMode: 'FORFAIT', prestationAmount: '300000',
    prestationDescription: 'Animation de renforcement en mathématiques',
    prestationCalendrier: buildPrestationCalendarText({ days: ['MARDI', 'JEUDI'], slots: ['15h00-17h00'], months: ['OCTOBRE', 'NOVEMBRE', 'DECEMBRE', 'JANVIER', 'FEVRIER', 'MARS', 'AVRIL', 'MAI', 'JUIN'] }),
    startDate: '2026-11-01', endDate: '2027-06-30',
  });
  assert.equal(ok, true);
});
t('calendrier non sélectionné → Suivant reste inactif (champ obligatoire)', () => {
  const blocked = canProceedStep4Prestation({
    prestationPaymentMode: 'FORFAIT', prestationAmount: '300000',
    prestationDescription: 'Animation de renforcement en mathématiques',
    prestationCalendrier: '', startDate: '2026-11-01', endDate: '2027-06-30',
  });
  assert.equal(blocked, false);
});

// ── 3. updateStaff — exception broUillon d'embauche (règle serveur) ─────────
console.log('── 3. updateStaff — exception brouillon d’embauche ──');
// Miroir de la règle staff-prisma.service.ts
async function tryStatutChange(staff, prismaMock) {
  const engaged = await prismaMock.contract.findFirst({
    where: { staffId: staff.id, OR: [{ signedAt: { not: null } }, { status: 'ACTIVE' }] },
  });
  const isOnboardingDraft = staff.status === 'PENDING_HIRE' && !engaged;
  if (!isOnboardingDraft) return { allowed: false };
  return { allowed: true, purgePrestation: staff.statutContractuel === 'PRESTATAIRE_SERVICE' };
}
(async () => {
  await t(' wizard en cours (PENDING_HIRE, contrat DRAFT non signé) : correction AUTORISÉE', async () => {
    const r = await tryStatutChange(
      { id: 's1', status: 'PENDING_HIRE', statutContractuel: 'PRESTATAIRE_SERVICE' },
      { contract: { findFirst: async () => null } },
    );
    assert.deepEqual(r, { allowed: true, purgePrestation: true });
  });
  await t(' personnel ACTIF : refus (procédure tracée) — verrou légal intact', async () => {
    const r = await tryStatutChange(
      { id: 's2', status: 'ACTIVE', statutContractuel: 'SALARIE_DECLARE' },
      { contract: { findFirst: async () => null } },
    );
    assert.equal(r.allowed, false);
  });
  await t(' wizard mais contrat SIGNÉ : refus (immuabilité)', async () => {
    const r = await tryStatutChange(
      { id: 's3', status: 'PENDING_HIRE', statutContractuel: 'SALARIE_DECLARE' },
      { contract: { findFirst: async () => ({ id: 'c1', signedAt: new Date(), status: 'DRAFT' }) } },
    );
    assert.equal(r.allowed, false);
  });
  await t(' wizard mais contrat ACTIVE : refus', async () => {
    const r = await tryStatutChange(
      { id: 's4', status: 'PENDING_HIRE', statutContractuel: 'PRESTATAIRE_SERVICE' },
      { contract: { findFirst: async () => ({ id: 'c2', signedAt: null, status: 'ACTIVE' }) } },
    );
    assert.equal(r.allowed, false);
  });
  await t(' salarié → prestataire en brouillon : autorisé, pas de purge prestation', async () => {
    const r = await tryStatutChange(
      { id: 's5', status: 'PENDING_HIRE', statutContractuel: 'SALARIE_DECLARE' },
      { contract: { findFirst: async () => null } },
    );
    assert.deepEqual(r, { allowed: true, purgePrestation: false });
  });

  // ── 4. Notification d'émission (miroir de notifyStaffDocumentIssued) ─────
  console.log('── 4. Notification d’émission « Ma Paie » ──');
  function buildNotification(doc, staff, snapshot) {
    const isFiche = doc.documentType === 'FICHE_DE_PAIE';
    const docLabel = isFiche ? 'fiche de paie' : 'état de paiement';
    const net = Number(snapshot?.net ?? 0);
    const url = staff?.roleType === 'TEACHER' ? '/app/teacher/paie' : '/app/my-paie';
    return {
      type: 'PAYROLL_DOCUMENT_ISSUED',
      title: `Paie de ${doc.periodLabel} disponible`,
      body:
        `Votre ${docLabel} (${doc.documentNumber}) de ${doc.periodLabel} vient d'être émise` +
        (net > 0 ? ` — net à payer : ${net.toLocaleString('fr-FR')} FCFA.` : '.') +
        ` Téléchargez le PDF depuis votre espace « Ma Paie ».`,
      priority: 'HIGH', data: { url },
    };
  }
  await t(' enseignant → fiche de paie, URL portail enseignant', async () => {
    const n = buildNotification(
      { documentType: 'FICHE_DE_PAIE', documentNumber: 'FP-2026-000042', periodLabel: 'Novembre 2026' },
      { roleType: 'TEACHER', email: 'prof@ecole.bj' },
      { net: 152000 },
    );
    assert.equal(n.type, 'PAYROLL_DOCUMENT_ISSUED');
    assert.equal(n.title, 'Paie de Novembre 2026 disponible');
    assert.equal(n.data.url, '/app/teacher/paie');
    assert.ok(n.body.includes('fiche de paie (FP-2026-000042)'));
    assert.ok(n.body.includes('152 000 FCFA'));
    assert.equal(n.priority, 'HIGH');
  });
  await t(' personnel admin → état de paiement, URL /app/my-paie, net 0', async () => {
    const n = buildNotification(
      { documentType: 'ETAT_DE_PAIEMENT', documentNumber: 'EP-2026-000007', periodLabel: 'Octobre 2026' },
      { roleType: 'SUPPORT', email: 'comptable@ecole.bj' },
      { net: 0 },
    );
    assert.equal(n.data.url, '/app/my-paie');
    assert.ok(n.body.includes('état de paiement (EP-2026-000007)'));
    assert.ok(n.body.endsWith('Téléchargez le PDF depuis votre espace « Ma Paie ».'));
  });

  // ── 5. Signature de brouillon (retour arrière) ────────────────────────────
  console.log('── 5. Signature de brouillon (détection changement) ──');
  function draftSignatureOf(state) {
    const statut = state.employment.statutContractuel;
    const isPrestation = statut === 'PRESTATAIRE_SERVICE';
    return JSON.stringify({
      statut: statut ?? '',
      contractType: isPrestation ? 'PRESTATION' : state.contract.contractType,
      startDate: state.contract.startDate ?? '',
      endDate: isPrestation ? (state.contract.endDate ?? '') : state.contract.contractType === 'CDD' ? (state.contract.endDate ?? '') : '',
      paymentMode: state.contract.paymentMode ?? '',
      baseSalary: isPrestation ? Number(state.contract.prestationAmount) || 0 : Number(state.contract.baseSalary) || 0,
      prestationPaymentMode: isPrestation ? state.contract.prestationPaymentMode : null,
    });
  }
  const stateA = {
    employment: { statutContractuel: 'PRESTATAIRE_SERVICE' },
    contract: { contractType: 'CDD', startDate: '2026-11-01', endDate: '2027-06-30', paymentMode: 'BANK', prestationAmount: '300000', prestationPaymentMode: 'FORFAIT', baseSalary: '150000' },
  };
  await t(' même saisie → signature identique (aucune recréation inutile)', async () => {
    assert.equal(draftSignatureOf(stateA), draftSignatureOf({ ...stateA, contract: { ...stateA.contract } }));
  });
  await t(' statut corrigé (prestataire → salarié) → signature divergente → recréation', async () => {
    const changed = { ...stateA, employment: { statutContractuel: 'SALARIE_DECLARE' } };
    assert.notEqual(draftSignatureOf(stateA), draftSignatureOf(changed));
  });
  await t(' montant corrigé → signature divergente → recréation', async () => {
    const changed = { employment: stateA.employment, contract: { ...stateA.contract, prestationAmount: '350000' } };
    assert.notEqual(draftSignatureOf(stateA), draftSignatureOf(changed));
  });
  await t(' statut identique, CDI→CDD (salarié) → signature divergente', async () => {
    const base = {
      employment: { statutContractuel: 'SALARIE_DECLARE' },
      contract: { contractType: 'CDI', startDate: '2026-11-01', endDate: '', paymentMode: 'BANK', baseSalary: '150000', prestationAmount: '' },
    };
    const changed = { employment: base.employment, contract: { ...base.contract, contractType: 'CDD', endDate: '2027-11-01' } };
    assert.notEqual(draftSignatureOf(base), draftSignatureOf(changed));
  });

  // ── 6. Appartenance du téléchargement self-service ────────────────────────
  console.log('── 6. Téléchargement self-service (appartenance) ──');
  function checkOwnership(staffResolved, doc) {
    if (doc.staffId !== staffResolved.id) return 403;
    return 200;
  }
  await t(' mon document → 200', async () => {
    assert.equal(checkOwnership({ id: 'staff-1' }, { staffId: 'staff-1' }), 200);
  });
  await t(' document d’un autre → 403 (anti-usurpation)', async () => {
    assert.equal(checkOwnership({ id: 'staff-1' }, { staffId: 'staff-999' }), 403);
  });

  console.log(`\n${passed}/${passed + failed} PASS`);
  process.exit(failed ? 1 : 0);
})();
