/**
 * ============================================================================
 * STORE NAMES — Mapping centralisé URL API → store IndexedDB
 * ============================================================================
 *
 * Source unique de vérité pour le mapping entre les endpoints API et les
 * stores IndexedDB correspondants. Utilisé par :
 *   - global-fetch-interceptor.ts (intercepte TOUS les fetch GET /api/*)
 *   - finance-fetch.ts (module finance)
 *   - hr-client.ts (module RH)
 *   - sync-engine.service.ts (pull write path)
 *
 * Convention : les noms de stores correspondent à ceux déclarés dans
 * local-db.service.ts (lowercase, sans séparateurs, singulier pour
 * la plupart des entités Prisma).
 * ============================================================================
 */

/**
 * Mapping URL pattern → store IDB.
 * Le premier match gagne. Les URLs non listées n'ont pas de fallback IDB.
 */
const URL_TO_STORE: Array<{ pattern: RegExp; store: string }> = [
  // ─── Élèves & Scolarité ───
  { pattern: /\/api\/students(?!\/)(?!.*statistic)/, store: 'student' },
  { pattern: /\/api\/students\/.*\/guardians/, store: 'guardian' },
  { pattern: /\/api\/all-classes/, store: 'class' },
  { pattern: /\/api\/classes/, store: 'class' },
  { pattern: /\/api\/class-students/, store: 'classstudent' },
  { pattern: /\/api\/class-subjects/, store: 'classsubject' },
  { pattern: /\/api\/subjects/, store: 'subject' },
  { pattern: /\/api\/school-levels/, store: 'schoollevel' },
  { pattern: /\/api\/attendance/, store: 'attendance' },
  { pattern: /\/api\/absences/, store: 'absence' },
  { pattern: /\/api\/disciplinary/, store: 'disciplinaryincident' },
  { pattern: /\/api\/incidents/, store: 'incident' },
  { pattern: /\/api\/homeworks/, store: 'homework' },
  { pattern: /\/api\/homework-entries/, store: 'homeworkentry' },

  // ─── Personnel, RH & Paie ───
  { pattern: /\/api\/hr\/staff(?!.*recruit)/, store: 'staff' },
  { pattern: /\/api\/hr\/teachers/, store: 'teacher' },
  { pattern: /\/api\/teachers/, store: 'teacher' },
  { pattern: /\/api\/hr\/contracts/, store: 'contract' },
  { pattern: /\/api\/hr\/leaves/, store: 'leaverequest' },
  { pattern: /\/api\/hr\/allowances/, store: 'staffallowance' },
  { pattern: /\/api\/hr\/overtime/, store: 'overtimerecord' },
  { pattern: /\/api\/hr\/attendance/, store: 'staffattendance' },
  { pattern: /\/api\/hr\/evaluations/, store: 'staffevaluation' },
  { pattern: /\/api\/hr\/documents/, store: 'staffdocument' },
  { pattern: /\/api\/hr\/school-directors/, store: 'schooldirectors' },
  { pattern: /\/api\/hr\/payroll/, store: 'salaryslip' },
  { pattern: /\/api\/hr\/salary-payments/, store: 'salarypayment' },

  // ─── Finances & Économat ───
  { pattern: /\/api\/finance\/fee-structures\/overrides/, store: 'feeoverride' },
  { pattern: /\/api\/finance\/fee-structures/, store: 'feestructure' },
  { pattern: /\/api\/finance\/fee-configurations/, store: 'feeconfiguration' },
  { pattern: /\/api\/finance\/fee-definitions/, store: 'feedefinition' },
  { pattern: /\/api\/finance\/fee-regimes/, store: 'feeregime' },
  { pattern: /\/api\/finance\/payments/, store: 'payment' },
  { pattern: /\/api\/finance\/invoices/, store: 'invoice' },
  { pattern: /\/api\/finance\/expenses/, store: 'financeexpense' },
  { pattern: /\/api\/finance\/transactions/, store: 'financetransaction' },
  { pattern: /\/api\/finance\/student-accounts/, store: 'studentaccount' },
  { pattern: /\/api\/finance\/treasury/, store: 'treasurymovement' },
  { pattern: /\/api\/finance\/tuition-installments/, store: 'tuitioninstallment' },
  { pattern: /\/api\/finance\/tuition-payments/, store: 'tuitionpayment' },
  { pattern: /\/api\/finance\/payment-plans/, store: 'paymentplan' },

  // ─── Organisation Pédagogique ───
  { pattern: /\/api\/pedagogy\/teacher-profiles/, store: 'teacheracademicprofile' },
  { pattern: /\/api\/pedagogy\/teacher-availabilities/, store: 'teacheravailability' },
  { pattern: /\/api\/pedagogy\/teacher-class-assignments/, store: 'teacherclassassignment' },
  { pattern: /\/api\/pedagogy\/academic-structure/, store: 'academicclass' },
  { pattern: /\/api\/pedagogy-space\/my-classes/, store: 'teacherclassassignment' },
  { pattern: /\/api\/class-diaries/, store: 'classdiary' },
  { pattern: /\/api\/lesson-plans/, store: 'lessonplan' },
  { pattern: /\/api\/lesson-journals/, store: 'lessonjournal' },
  { pattern: /\/api\/pedagogical-files/, store: 'pedagogicalfile' },
  { pattern: /\/api\/timetables/, store: 'timetable' },
  { pattern: /\/api\/pedagogy\/materials/, store: 'pedagogicalmaterial' },

  // ─── Examens, Notes & Bulletins ───
  { pattern: /\/api\/exams(?!\/.*bulletin)/, store: 'exam' },
  { pattern: /\/api\/grades/, store: 'grade' },
  { pattern: /\/api\/exam-candidates/, store: 'examcandidate' },
  { pattern: /\/api\/exam-results/, store: 'examresult' },
  { pattern: /\/api\/exam-scores/, store: 'examscore' },
  { pattern: /\/api\/exam-sessions/, store: 'examsession' },
  { pattern: /\/api\/exam-compositions/, store: 'examcomposition' },
  { pattern: /\/api\/exam-deliberations/, store: 'examdeliberation' },
  { pattern: /\/api\/report-cards/, store: 'reportcard' },
  { pattern: /\/api\/evaluations/, store: 'evaluation' },
  { pattern: /\/api\/student-period-averages/, store: 'studentperiodaverage' },
  { pattern: /\/api\/student-subject-averages/, store: 'studentsubjectaverage' },

  // ⭐ 2026-10-14 — AUDIT EXAMENS : routes manquantes (miroir sw.js v4.13.0).
  //    Avant : tombaient dans le fallback 'api_cache' → pas d'écriture
  //    optimiste offline (création d'une évaluation, d'un verrou de
  //    notes, d'une décision de promotion, d'un incident de fraude, d'un
  //    bloc de préparation, d'un PV, d'une distinction, d'un bulletin,
  //    etc. n'apparaissaient pas avant reconnexion).
  // /api/institutional-exams/* — sous-modules principaux (V10 mirror)
  //    Ordre IMPORTANT : sous-chemins AVANT catch-all /institutional-exams/*.
  { pattern: /\/api\/institutional-exams\/audit/, store: 'api_cache' },
  { pattern: /\/api\/institutional-exams\/bulletins/, store: 'reportcard' },
  { pattern: /\/api\/institutional-exams\/config/, store: 'api_cache' },
  { pattern: /\/api\/institutional-exams\/councils/, store: 'classcouncil' },
  { pattern: /\/api\/institutional-exams\/dashboard/, store: 'api_cache' },
  { pattern: /\/api\/institutional-exams\/distinctions/, store: 'honorroll' },
  { pattern: /\/api\/institutional-exams\/evaluations/, store: 'evaluation' },
  { pattern: /\/api\/institutional-exams\/grades/, store: 'grade' },
  { pattern: /\/api\/institutional-exams\/pv-stats-promotion/, store: 'api_cache' },
  { pattern: /\/api\/institutional-exams\/unlock-requests/, store: 'examlock' },
  { pattern: /\/api\/institutional-exams\/validation/, store: 'gradevalidationbatch' },
  // /api/institutional-exams/* (catch-all après les sous-routes)
  { pattern: /\/api\/institutional-exams/, store: 'exam' },
  // /api/honor-rolls (different prefix — distinctions)
  { pattern: /\/api\/honor-rolls/, store: 'honorroll' },
  // /api/public/distinctions (public certificates — read-only)
  { pattern: /\/api\/public\/distinctions/, store: 'api_cache' },
  // /api/council-decisions — councils.controller.ts
  { pattern: /\/api\/council-decisions/, store: 'councildecision' },
  // /api/exam-frauds — exam-fraud.controller.ts
  { pattern: /\/api\/exam-frauds/, store: 'examfraud' },
  // /api/exam-preparation — exam-preparation.controller.ts (blocks + sheets)
  { pattern: /\/api\/exam-preparation/, store: 'exampreparation' },
  // /api/exams/locks — exams-lock.controller.ts
  { pattern: /\/api\/exams\/locks/, store: 'examlock' },
  // /api/exams/promotion — promotion.controller.ts
  { pattern: /\/api\/exams\/promotion/, store: 'exampromotion' },
  // /api/exams/settings — exams-config.controller.ts (settings — read-only)
  { pattern: /\/api\/exams\/settings/, store: 'api_cache' },
  // /api/exams/spec-config — exams-spec-config.controller.ts (settings)
  { pattern: /\/api\/exams\/spec-config/, store: 'api_cache' },

  // ─── Communication ───
  { pattern: /\/api\/messages/, store: 'message' },
  { pattern: /\/api\/announcements/, store: 'announcement' },
  { pattern: /\/api\/notifications/, store: 'notification' },
  { pattern: /\/api\/alerts/, store: 'alert' },
  { pattern: /\/api\/meetings/, store: 'meeting' },

  // ─── Réunions ───
  { pattern: /\/api\/meeting-participants/, store: 'meetingparticipant' },
  { pattern: /\/api\/meeting-agenda-items/, store: 'meetingagendaitem' },

  // ─── Paramètres / Settings ───
  // ⭐ 2026-10-14 — AUDIT PARAMÈTRES : 11 routes manquantes ajoutées (miroir
  //    sw.js ROUTE_TABLES v4.15.0). Avant : tombaient dans le fallback
  //    'api_cache' → pas d'écriture optimiste offline. Maintenant : chaque
  //    route résout vers le store IDB métier (tous les stores existaient
  //    déjà dans local-db.service.ts).
  //    Ordre IMPORTANT : sous-chemins AVANT catch-all /settings/.
  { pattern: /\/api\/settings\/identity/, store: 'tenantidentityprofile' },
  { pattern: /\/api\/settings\/bilingual/, store: 'settingsbilingual' },
  { pattern: /\/api\/settings\/academic/, store: 'schoolacademicsettings' },
  { pattern: /\/api\/settings\/communication/, store: 'settingscommunication' },
  { pattern: /\/api\/settings\/security/, store: 'securitysettings' },
  { pattern: /\/api\/settings\/features/, store: 'tenantfeature' },
  { pattern: /\/api\/settings\/history/, store: 'settingshistory' },
  // ⭐ Nouvelles routes Paramètres (audit 2026-10-14) :
  { pattern: /\/api\/settings\/general/, store: 'tenantsetting' },
  { pattern: /\/api\/settings\/orion/, store: 'orionsettings' },
  { pattern: /\/api\/settings\/atlas/, store: 'atlassettings' },
  { pattern: /\/api\/settings\/offline-sync/, store: 'offlinesyncsettings' },
  { pattern: /\/api\/settings\/administrative-seals/, store: 'administrativeseal' },
  { pattern: /\/api\/settings\/stamps/, store: 'tenantstamp' },
  { pattern: /\/api\/settings\/signature/, store: 'tenantsignature' },
  { pattern: /\/api\/settings\/electronic-signatures/, store: 'electronicsignature' },
  { pattern: /\/api\/settings\/pedagogical-structure/, store: 'schoolacademicsettings' },
  { pattern: /\/api\/settings\/school-calendar-config/, store: 'schoolcalendarconfig' },
  // /api/settings (catch-all)
  { pattern: /\/api\/settings/, store: 'tenantsetting' },
  { pattern: /\/api\/academic-years/, store: 'academicyear' },

  // ─── ORION ───
  { pattern: /\/api\/orion\/alerts/, store: 'orion_alerts' },
  { pattern: /\/api\/orion\/insights/, store: 'orion_cache' },
  { pattern: /\/api\/orion\/forecasts/, store: 'orion_cache' },

  // ─── Cantine ───
  { pattern: /\/api\/canteen\/menus/, store: 'canteenmenu' },
  { pattern: /\/api\/canteen\/settings/, store: 'canteensetting' },
  { pattern: /\/api\/canteen\/subscriptions/, store: 'canteensubscription' },
  { pattern: /\/api\/canteen\/payments/, store: 'canteenpayment' },
  { pattern: /\/api\/canteen\/attendance/, store: 'canteenattendance' },

  // ─── Transport ───
  { pattern: /\/api\/transport\/vehicles/, store: 'vehicle' },
  { pattern: /\/api\/transport\/routes/, store: 'route' },
  { pattern: /\/api\/transport\/drivers/, store: 'transportdriver' },
  { pattern: /\/api\/transport\/assignments/, store: 'transportassignment' },
  { pattern: /\/api\/transport\/trips/, store: 'transporttrip' },
  { pattern: /\/api\/transport\/settings/, store: 'transportsetting' },

  // ─── Infirmerie ───
  { pattern: /\/api\/infirmary\/visits/, store: 'infirmaryvisit' },
  { pattern: /\/api\/infirmary\/medical-records/, store: 'infirmarymedicalrecord' },
  { pattern: /\/api\/infirmary\/medication-stocks/, store: 'infirmarymedicationstock' },
  { pattern: /\/api\/infirmary\/settings/, store: 'infirmarysetting' },

  // ─── QHSE ───
  { pattern: /\/api\/qhse\/audits/, store: 'qhseaudit' },
  { pattern: /\/api\/qhse\/incidents/, store: 'qhseincident' },
  { pattern: /\/api\/qhse\/risks/, store: 'qhserisk' },
  { pattern: /\/api\/qhse\/action-plans/, store: 'qhseactionplan' },

  // ─── EduCast ───
  { pattern: /\/api\/educast\/contents/, store: 'educastcontent' },
  { pattern: /\/api\/educast\/channels/, store: 'educastchannel' },
  { pattern: /\/api\/educast\/playlists/, store: 'educastplaylist' },

  // ─── Boutique / Shop ───
  { pattern: /\/api\/shop\/products/, store: 'shopproduct' },
  { pattern: /\/api\/shop\/categories/, store: 'shopcategory' },
  { pattern: /\/api\/shop\/orders/, store: 'shoporder' },
  { pattern: /\/api\/shop\/sales/, store: 'shopsale' },

  // ─── Bibliothèque ───
  { pattern: /\/api\/library\/books/, store: 'librarybook' },
  { pattern: /\/api\/library\/loans/, store: 'libraryloan' },
  { pattern: /\/api\/library\/reservations/, store: 'libraryreservation' },

  // ⭐ Routes manquantes identifiées par l'audit offline-first
  // ─── Pédagogie (routes non couvertes) ───
  { pattern: /\/api\/pedagogy-space\//, store: 'pedagogicalworkspace' },
  { pattern: /\/api\/pedagogy\/daily-logs/, store: 'dailylog' },
  { pattern: /\/api\/pedagogy\/class-logs/, store: 'classlog' },
  { pattern: /\/api\/pedagogy\/subjects/, store: 'subject' },
  { pattern: /\/api\/pedagogy\/teachers/, store: 'teacher' },
  { pattern: /\/api\/pedagogy\/timetables/, store: 'timetable' },
  { pattern: /\/api\/pedagogy\/academic-levels/, store: 'academiclevel' },
  { pattern: /\/api\/pedagogy\/academic-series/, store: 'academicseries' },
  { pattern: /\/api\/pedagogy\/academic-cycles/, store: 'academiccycle' },
  { pattern: /\/api\/pedagogy\/rooms/, store: 'room' },
  { pattern: /\/api\/pedagogy\/control/, store: 'pedagogicalcontrol' },
  { pattern: /\/api\/pedagogy\/weekly-reports/, store: 'weeklyreport' },

  // ─── Communication (routes non couvertes) ───
  { pattern: /\/api\/communication\/templates/, store: 'communicationtemplate' },
  { pattern: /\/api\/communication\/automations/, store: 'automationrule' },
  { pattern: /\/api\/communication\/campaigns/, store: 'communicationcampaign' },
  { pattern: /\/api\/communication\/scheduled/, store: 'scheduledemail' },
  { pattern: /\/api\/communication\/channels/, store: 'communicationchannel' },
  { pattern: /\/api\/communication\/inbox/, store: 'inboundemail' },

  // ─── Dashboard (routes non couvertes) ───
  { pattern: /\/api\/dashboard\/overview/, store: 'orion_cache' },
  { pattern: /\/api\/dashboard\/finance-overview/, store: 'orion_cache' },
  { pattern: /\/api\/dashboard\/age-distribution/, store: 'orion_cache' },
  { pattern: /\/api\/dashboard\/grade-analytics/, store: 'orion_cache' },
  { pattern: /\/api\/dashboard\/hr-overview/, store: 'orion_cache' },
  { pattern: /\/api\/dashboard\/tuition-personalizations/, store: 'orion_cache' },
  { pattern: /\/api\/dashboard\/grade-evolution/, store: 'orion_cache' },

  // ─── ORION (routes non couvertes) ───
  { pattern: /\/api\/orion\/kpis/, store: 'orion_cache' },
  { pattern: /\/api\/orion\/dashboard/, store: 'orion_cache' },
  { pattern: /\/api\/orion\/audit/, store: 'orion_cache' },
  { pattern: /\/api\/orion\/intelligence/, store: 'orion_cache' },
  { pattern: /\/api\/orion\/bilingual/, store: 'orion_cache' },

  // ─── Finance (routes non couvertes) ───
  { pattern: /\/api\/finance\/cash-registers/, store: 'cashregister' },
  { pattern: /\/api\/finance\/collection-summary/, store: 'orion_cache' },
  { pattern: /\/api\/finance\/collection-cases/, store: 'collectioncase' },
  { pattern: /\/api\/finance\/collection-reminders/, store: 'collectionreminder' },
  { pattern: /\/api\/finance\/arrears/, store: 'feearrear' },
  { pattern: /\/api\/finance\/recovery/, store: 'orion_cache' },

  // ⭐ 2026-10-14 — AUDIT FINANCE : routes supplémentaires manquantes
  //    (miroir sw.js ROUTE_TABLES v4.12.0). Avant : toutes ces routes
  //    tombaient dans le fallback 'api_cache' → pas d'écriture optimiste
  //    offline. Désormais : chaque route résout vers le store IDB métier.
  //    Ordre IMPORTANT : les routes SPÉCIFIQUES (sous-chemins) doivent
  //    venir AVANT les routes GÉNÉRIQUES (préfixe seul), car URL_TO_STORE
  //    est first-match-wins.
  // /api/finance/fees/* — fees-prisma.controller.ts
  { pattern: /\/api\/finance\/fees\/categories/, store: 'feecategory' },
  { pattern: /\/api\/finance\/fees\/definitions/, store: 'feedefinition' },
  { pattern: /\/api\/finance\/fees\/student-fees/, store: 'feedefinition' },
  { pattern: /\/api\/finance\/fees/, store: 'feedefinition' },
  // /api/fees/installments — fee-installment.controller.ts (different prefix!)
  { pattern: /\/api\/fees\/installments/, store: 'feeinstallment' },
  // /api/finance/collection/* — collection-prisma.controller.ts
  { pattern: /\/api\/finance\/collection\/promises/, store: 'paymentpromise' },
  { pattern: /\/api\/finance\/collection\/actions/, store: 'collectionaction' },
  { pattern: /\/api\/finance\/collection\/arrears/, store: 'feearrear' },
  { pattern: /\/api\/finance\/collection\/reminders/, store: 'collectionreminder' },
  { pattern: /\/api\/finance\/collection\/cases/, store: 'collectioncase' },
  { pattern: /\/api\/finance\/collection/, store: 'collectioncase' },
  // /api/finance/recovery-reminders — recovery-reminder.controller.ts
  { pattern: /\/api\/finance\/recovery-reminders/, store: 'collectionreminder' },
  // /api/finance/student-fee-profiles — student-fee-profile.controller.ts
  { pattern: /\/api\/finance\/student-fee-profiles/, store: 'studentfeeprofile' },
  // /api/finance/student-arrears — student-arrear.controller.ts
  { pattern: /\/api\/finance\/student-arrears/, store: 'studentarrear' },
  // /api/finance/arrears-import — import endpoints (preview/run/template)
  { pattern: /\/api\/finance\/arrears-import/, store: 'api_cache' },
  // /api/finance/daily-closures — finance-daily-closure.controller.ts
  { pattern: /\/api\/finance\/daily-closures/, store: 'dailyclosure' },
  // /api/finance/payment-config — tenant-payment-config.controller.ts
  { pattern: /\/api\/finance\/payment-config/, store: 'tenantpaymentconfig' },
  // /api/finance/accounts (student-account.controller.ts — backend direct URL)
  { pattern: /\/api\/finance\/accounts/, store: 'studentaccount' },
  // /api/payments/allocation — payment-allocation.controller.ts (different prefix!)
  { pattern: /\/api\/payments\/allocation/, store: 'paymentallocation' },
  // /api/payments/enhanced — payments-enhanced.controller.ts (different prefix!)
  { pattern: /\/api\/payments\/enhanced/, store: 'payment' },
  // /api/payments — legacy payments.controller.ts
  { pattern: /\/api\/payments(?!\/(allocation|enhanced))/, store: 'payment' },
  // /api/expenses — legacy expenses.controller.ts
  { pattern: /\/api\/expenses/, store: 'financeexpense' },
  // /api/receipts — receipt-generation (server-side, no offline entity)
  { pattern: /\/api\/receipts\/notifications/, store: 'api_cache' },
  { pattern: /\/api\/receipts/, store: 'api_cache' },
  // Routes READ-ONLY ou agrégats → api_cache ou orion_cache
  { pattern: /\/api\/finance\/reports/, store: 'api_cache' },
  { pattern: /\/api\/finance\/settings/, store: 'api_cache' },
  { pattern: /\/api\/finance\/audit/, store: 'api_cache' },
  { pattern: /\/api\/finance\/orion/, store: 'orion_cache' },
  { pattern: /\/api\/finance\/exports/, store: 'api_cache' },
  { pattern: /\/api\/finance\/promoter-eligibility/, store: 'api_cache' },
  { pattern: /\/api\/finance\/expenses-v2/, store: 'api_cache' },
  { pattern: /\/api\/payment-flows/, store: 'api_cache' },
  { pattern: /\/api\/finances/, store: 'api_cache' },

  // ⭐ 2026-10-14 — AUDIT PEDAGOGIE : routes manquantes (miroir sw.js v4.12.0).
  //    Avant : tombaient dans le fallback 'api_cache' → pas d'écriture
  //    optimiste offline (création de plan annuel, plan mensuel, retour
  //    de matériel, notification enseignant, tâche pédagogique, mouvement
  //    de stock, etc. n'apparaissaient pas avant reconnexion).
  // /api/pedagogy/pedagogical-materials — pedagogical-materials-prisma.controller.ts
  { pattern: /\/api\/pedagogy\/pedagogical-materials/, store: 'pedagogicalmaterial' },
  // /api/pedagogy/material-stocks
  { pattern: /\/api\/pedagogy\/material-stocks/, store: 'materialstock' },
  // /api/pedagogy/material-movements
  { pattern: /\/api\/pedagogy\/material-movements/, store: 'materialmovement' },
  // /api/pedagogy/material-returns
  { pattern: /\/api\/pedagogy\/material-returns/, store: 'materialreturn' },
  // /api/pedagogy/teacher-material-assignments
  { pattern: /\/api\/pedagogy\/teacher-material-assignments/, store: 'teachermaterialassignment' },
  // /api/pedagogy/annual-plans
  { pattern: /\/api\/pedagogy\/annual-plans/, store: 'annualplan' },
  // /api/pedagogy/annual-teacher-supplies
  { pattern: /\/api\/pedagogy\/annual-teacher-supplies/, store: 'annualteachersupply' },
  // /api/pedagogy/monthly-plans
  { pattern: /\/api\/pedagogy\/monthly-plans/, store: 'monthlyplan' },
  // /api/pedagogy/assignments (pedagogical tasks)
  { pattern: /\/api\/pedagogy\/assignments/, store: 'pedagogicaltask' },
  // /api/pedagogy/teacher-notifications
  { pattern: /\/api\/pedagogy\/teacher-notifications/, store: 'pedagogicalnotification' },
  // /api/pedagogy/global-library
  { pattern: /\/api\/pedagogy\/global-library/, store: 'globalpedagogicalresource' },
  // /api/pedagogy/director (validation direction)
  { pattern: /\/api\/pedagogy\/director/, store: 'pedagogicalcontrol' },
  // /api/timetable-engine (different prefix!)
  { pattern: /\/api\/timetable-engine/, store: 'timetable' },
  // /api/rooms (different prefix!)
  { pattern: /\/api\/rooms/, store: 'room' },
  // /api/saisiemaster (LLM saisie rapide — read-only)
  { pattern: /\/api\/saisiemaster/, store: 'api_cache' },
  // /api/pedagogy/ia (LLM features — read-only)
  { pattern: /\/api\/pedagogy\/ia/, store: 'api_cache' },
  // /api/pedagogy/orion-advanced (agrégats Orion)
  { pattern: /\/api\/pedagogy\/orion-advanced/, store: 'orion_cache' },
  // /api/pedagogy/teacher (singular — pedagogical-teacher.controller.ts)
  { pattern: /\/api\/pedagogy\/teacher(?!s)\b/, store: 'teacher' },

  // ─── RH (routes non couvertes) ───
  { pattern: /\/api\/hr\/positions/, store: 'position' },
  { pattern: /\/api\/hr\/collaborators/, store: 'staff' },
  { pattern: /\/api\/hr\/planning/, store: 'staffplanning' },
  { pattern: /\/api\/hr\/reporting/, store: 'orion_cache' },
  // ⭐ 2026-10-14 — AUDIT RH : /cnss + /taxes désormais mappés vers les
  //    stores métiers dédiés (au lieu de orion_cache read-only) pour
  //    permettre l'écriture optimiste offline des déclarations.
  { pattern: /\/api\/hr\/cnss/, store: 'cnssdeclaration' },
  { pattern: /\/api\/hr\/taxes/, store: 'taxdeclaration' },

  // ⭐ 2026-10-14 — AUDIT RH/PERSONNEL : routes manquantes (miroir sw.js v4.14.0).
  //    Avant : tombaient dans le fallback 'api_cache' → pas d'écriture
  //    optimiste offline (création d'un job, candidature, entretien, test,
  //    stagiaire, déclaration CNSS, déclaration fiscale, nœud d'organi-
  //    gramme, planning hebdomadaire, etc. n'apparaissaient pas avant
  //    reconnexion). Désormais : chaque route résout vers le store métier.
  // /api/hr/contracts-public — contract-public-sign.controller.ts (e-signature)
  { pattern: /\/api\/hr\/contracts-public/, store: 'contract' },
  // /api/hr/internships — internships.controller.ts (HrInternship + convention)
  { pattern: /\/api\/hr\/internships/, store: 'hrinternship' },
  // /api/hr/recruitment/* — recruitment.controller.ts (sous-chemins)
  //    Ordre IMPORTANT : sous-chemins AVANT catch-all /recruitment/.
  { pattern: /\/api\/hr\/recruitment\/jobs/, store: 'hrjob' },
  { pattern: /\/api\/hr\/recruitment\/candidates/, store: 'hrcandidate' },
  { pattern: /\/api\/hr\/recruitment\/applications/, store: 'hrapplication' },
  { pattern: /\/api\/hr\/recruitment\/interviews/, store: 'hrinterview' },
  { pattern: /\/api\/hr\/recruitment\/tests/, store: 'hrtest' },
  { pattern: /\/api\/hr\/recruitment\/test-results/, store: 'hrtestresult' },
  { pattern: /\/api\/hr\/recruitment\/talent-pool/, store: 'hrtalentpool' },
  { pattern: /\/api\/hr\/recruitment\/recruiter-profile/, store: 'recruiterprofile' },
  { pattern: /\/api\/hr\/recruitment\/document-upload/, store: 'api_cache' },
  // /api/hr/recruitment (catch-all — upload-apply, debug endpoints)
  { pattern: /\/api\/hr\/recruitment/, store: 'api_cache' },
  // /api/hr/organigram — organigram-prisma.controller.ts (nodes, stats)
  { pattern: /\/api\/hr\/organigram/, store: 'organigramnode' },
  // /api/hr/schedules — schedules-prisma.controller.ts (planning hebdo)
  { pattern: /\/api\/hr\/schedules/, store: 'staffschedule' },
  // /api/hr/ia — ia-prisma.controller.ts (LLM RH — read-only)
  { pattern: /\/api\/hr\/ia/, store: 'api_cache' },
  // /api/hr/overview — hr-overview.controller.ts (dashboard KPIs — read-only)
  { pattern: /\/api\/hr\/overview/, store: 'api_cache' },
  // /api/hr/cleanup — cleanup.controller.ts (maintenance — read-only)
  { pattern: /\/api\/hr\/cleanup/, store: 'api_cache' },
  // /api/hr/payroll/documents — payroll-documents.controller.ts (PDFs)
  //    ⭐ Doit venir AVANT /api/hr/payroll pour ne pas capturer documents.
  { pattern: /\/api\/hr\/payroll\/documents/, store: 'api_cache' },
  // /api/staff-card — staff-card.controller.ts (génération cartes PDF)
  { pattern: /\/api\/staff-card/, store: 'api_cache' },
  // /api/documents-public — document-upload.controller.ts (public docs)
  { pattern: /\/api\/documents-public/, store: 'api_cache' },
  // /api/tests-public — test-questionnaire.controller.ts (public tests)
  { pattern: /\/api\/tests-public/, store: 'api_cache' },

  // ─── Students (routes non couvertes) ───
  { pattern: /\/api\/students\/transfers/, store: 'studenttransfer' },
  { pattern: /\/api\/students\/documents/, store: 'studentdocument' },
  { pattern: /\/api\/students\/id-cards/, store: 'studentidcard' },
  { pattern: /\/api\/students\/admissions/, store: 'admission' },
  { pattern: /\/api\/students\/movements/, store: 'studentmovement' },
  { pattern: /\/api\/students\/abandons/, store: 'student' },

  // ─── Billing ───
  { pattern: /\/api\/billing\/subscriptions/, store: 'subscription' },
  { pattern: /\/api\/billing\/invoices/, store: 'billinginvoice' },

  // ⭐ 2026-10-14 — AUDIT ACADEMIA SHOP : routes directes /api/shop/*
  //    (le frontend utilise surtout /api/modules-complementaires/shop/*
  //    via BFF, mais le controller expose aussi /api/shop/* directement).
  //    Miroir des patterns du BFF pour les routes directes backend.
  { pattern: /\/api\/shop\/products/, store: 'shopproduct' },
  { pattern: /\/api\/shop\/categories/, store: 'shopcategory' },
  { pattern: /\/api\/shop\/orders/, store: 'shoporder' },
  { pattern: /\/api\/shop\/sales/, store: 'shopsale' },
  { pattern: /\/api\/shop\/stocks/, store: 'shopstock' },
  { pattern: /\/api\/shop\/stock-movements/, store: 'shopstockmovement' },
  { pattern: /\/api\/shop\/suppliers/, store: 'shopsupplier' },
  { pattern: /\/api\/shop\/purchase-orders/, store: 'shoppurchaseorder' },
  { pattern: /\/api\/shop\/kits/, store: 'shopschoolkit' },
  { pattern: /\/api\/shop\/returns/, store: 'shopreturn' },
  { pattern: /\/api\/shop\/discounts/, store: 'shopdiscount' },
  { pattern: /\/api\/shop\/deliveries/, store: 'shopdelivery' },
  { pattern: /\/api\/shop\/loyalty-card/, store: 'shoployaltycard' },
  { pattern: /\/api\/shop\/wallet/, store: 'shopwallettransaction' },
  // ⭐ Routes Shop read-only → api_cache (PDFs, stats, settings)
  { pattern: /\/api\/shop\/stats/, store: 'api_cache' },
  { pattern: /\/api\/shop\/catalogue/, store: 'api_cache' },
  { pattern: /\/api\/shop\/payments\/history/, store: 'api_cache' },
  { pattern: /\/api\/shop\/settings/, store: 'api_cache' },

  // ─── Meetings (routes non couvertes) ───
  { pattern: /\/api\/meetings\/minutes/, store: 'meetingminutes' },
  { pattern: /\/api\/meetings\/decisions/, store: 'meetingdecision' },

  // ⭐ FALLBACK GÉNÉRIQUE pour les routes /api/* non mappées ci-dessus.
  //    Avant : si aucune pattern ne matchait, deriveStoreName retournait undefined
  //    → l'intercepteur ne cachait pas la réponse → en offline, le composant
  //    affichait "pas de données" au lieu de lire le cache local.
  //    Maintenant : on utilise un store générique 'api_cache' pour toutes les
  //    routes GET /api/* non mappées. Les données seront cachées en online et
  //    servies depuis le cache en offline (même si le store n'est pas "idéal",
  //    c'est mieux que rien — l'utilisateur voit les données au lieu d'une page vide).
  { pattern: /\/api\/.+/, store: 'api_cache' },
];

// ⭐ V18 — ROUTES MODULES COMPLÉMENTAIRES : les 8 modules (Shop, Cantine,
//    Transport, Bibliothèque, Infirmerie, EduCast, QHSE…) appellent le BFF via
//    le préfixe /api/modules-complementaires/<module>/<entité> (client axios →
//    désormais adapté fetch → intercepteur offline). Ces patterns doivent
//    résoudre vers les MÊMES stores que idbStoreForEntityType déduit du type
//    d'entité (inferEntityTypeFromUrl matche le suffixe 'shop/products' etc.)
//    pour que les écritures optimistes offline fusionnent dans les lectures.
const MODULES_COMPLEMENTAIRES_STORES: Array<{ pattern: RegExp; store: string }> = [
  // ─── Academia Shop ───
  // ⭐ 2026-10-14 — AUDIT SHOP : 11 nouvelles routes Shop BFF miroir
  //    ajoutées pour couvrir TOUS les endpoints du controller Shop.
  //    Avant : /stocks, /suppliers, /purchase-orders, /kits, /returns,
  //    /discounts, /deliveries, /loyalty-card, /wallet, /stock-movements,
  //    /settings tombaient dans le fallback 'api_cache' générique → pas
  //    d'écriture optimiste offline. Maintenant : chaque route résout
  //    vers le store IDB métier (tous les stores Shop existaient déjà).
  { pattern: /\/api\/modules-complementaires\/shop\/products/, store: 'shopproduct' },
  { pattern: /\/api\/modules-complementaires\/shop\/categories/, store: 'shopcategory' },
  { pattern: /\/api\/modules-complementaires\/shop\/orders/, store: 'shoporder' },
  { pattern: /\/api\/modules-complementaires\/shop\/sales/, store: 'shopsale' },
  // ⭐ Nouvelles routes Shop BFF mirror (audit 2026-10-14) :
  { pattern: /\/api\/modules-complementaires\/shop\/stocks/, store: 'shopstock' },
  { pattern: /\/api\/modules-complementaires\/shop\/stock-movements/, store: 'shopstockmovement' },
  { pattern: /\/api\/modules-complementaires\/shop\/suppliers/, store: 'shopsupplier' },
  { pattern: /\/api\/modules-complementaires\/shop\/purchase-orders/, store: 'shoppurchaseorder' },
  { pattern: /\/api\/modules-complementaires\/shop\/kits/, store: 'shopschoolkit' },
  { pattern: /\/api\/modules-complementaires\/shop\/returns/, store: 'shopreturn' },
  { pattern: /\/api\/modules-complementaires\/shop\/discounts/, store: 'shopdiscount' },
  { pattern: /\/api\/modules-complementaires\/shop\/deliveries/, store: 'shopdelivery' },
  { pattern: /\/api\/modules-complementaires\/shop\/loyalty-card/, store: 'shoployaltycard' },
  { pattern: /\/api\/modules-complementaires\/shop\/wallet/, store: 'shopwallettransaction' },
  // ⭐ Routes Shop read-only BFF mirror → api_cache (PDFs, stats, settings)
  { pattern: /\/api\/modules-complementaires\/shop\/stats/, store: 'api_cache' },
  { pattern: /\/api\/modules-complementaires\/shop\/catalogue/, store: 'api_cache' },
  { pattern: /\/api\/modules-complementaires\/shop\/payments\/history/, store: 'api_cache' },
  { pattern: /\/api\/modules-complementaires\/shop\/settings/, store: 'api_cache' },
  // ─── Cantine ───
  { pattern: /\/api\/modules-complementaires\/canteen\/menus/, store: 'canteenmenu' },
  { pattern: /\/api\/modules-complementaires\/canteen\/subscriptions/, store: 'canteensubscription' },
  { pattern: /\/api\/modules-complementaires\/canteen\/payments/, store: 'canteenpayment' },
  { pattern: /\/api\/modules-complementaires\/canteen\/attendance/, store: 'canteenattendance' },
  { pattern: /\/api\/modules-complementaires\/canteen\/settings/, store: 'canteensetting' },
  // ─── Transport ───
  { pattern: /\/api\/modules-complementaires\/transport\/vehicles/, store: 'vehicle' },
  { pattern: /\/api\/modules-complementaires\/transport\/routes/, store: 'route' },
  // ─── Bibliothèque ───
  { pattern: /\/api\/modules-complementaires\/library\/books/, store: 'librarybook' },
  { pattern: /\/api\/modules-complementaires\/library\/loans/, store: 'libraryloan' },
  // ─── Infirmerie (medical) ───
  { pattern: /\/api\/modules-complementaires\/medical\/visits/, store: 'infirmaryvisit' },
  // ─── EduCast ───
  { pattern: /\/api\/modules-complementaires\/educast\/contents/, store: 'educastcontent' },
  { pattern: /\/api\/modules-complementaires\/educast\/channels/, store: 'educastchannel' },
];

// Insérer AVANT le fallback générique (le premier match gagne)
URL_TO_STORE.splice(
  URL_TO_STORE.length - 1,
  0,
  ...MODULES_COMPLEMENTAIRES_STORES
);

/**
 * Résout le store IndexedDB à partir d'une URL API.
 * Retourne undefined si l'URL ne correspond à aucun store connu.
 */
export function deriveStoreName(url: string): string | undefined {
  // Normaliser l'URL (retirer query params)
  const path = url.split('?')[0].split('#')[0];

  for (const { pattern, store } of URL_TO_STORE) {
    if (pattern.test(path)) {
      return store;
    }
  }

  return undefined;
}

/**
 * ⭐ Résout le nom du store IndexedDB pour un SyncEntityType.
 *
 * Convention des object stores de local-db.service.ts (générés depuis
 * schema.prisma) : SINGULIER, minuscules, sans séparateur
 *   STUDENT → student, TEACHER_CLASS_ASSIGNMENT → teacherclassassignment,
 *   FINANCE_TRANSACTION → financetransaction.
 *
 * ⚠️ AVANT (bug, sept. 2026) : offline-business.service et sync-engine
 *    écrivaient dans des stores PLURIELS (« students ») tandis que le chemin
 *    de lecture (deriveStoreName / intercepteur global) lit les stores
 *    SINGULIERS (« student ») → un enregistrement créé hors ligne
 *    n'apparaissait jamais dans l'interface. Cette fonction partagée est
 *    la source unique de vérité pour aligner écriture et lecture.
 *
 * Règles de singularisation (miroir de normalizeToIdbStoreName du sync-engine) :
 *   "ies" → "y"  (categories → category)
 *   "ses" → "s"  (classes → class)
 *   "xes" → "x"  (boxes → box)
 *   "s" final (non "ss") → retiré (students → student)
 *   pas de "s" final → inchangé (staff, data)
 */
export function idbStoreForEntityType(entityType: string): string {
  let name = entityType.toLowerCase();

  // Retirer les séparateurs (underscore, tiret, espace)
  name = name.replace(/[_\-\s]+/g, '');

  if (name.endsWith('ies') && name.length > 3) {
    name = name.slice(0, -3) + 'y';       // categories → category
  } else if (name.endsWith('ses') && name.length > 3) {
    name = name.slice(0, -2);              // classes → class
  } else if (name.endsWith('xes') && name.length > 3) {
    name = name.slice(0, -2);              // boxes → box
  } else if (name.endsWith('s') && !name.endsWith('ss') && name.length > 1) {
    name = name.slice(0, -1);              // students → student
  }

  return name;
}

/**
 * Récupère le tenantId depuis les cookies ou localStorage.
 *
 * ⭐ FIX Task 74 : le cookie `x-tenant-id` (posé par setServerSession à CHAQUE
 *    login — source fraîche et fiable) est désormais consulté EN PREMIER.
 *    La clé localStorage 'session' n'est jamais écrite par l'app actuelle et
 *    ne peut contenir qu'un résidu d'une ancienne version (tenant périmé) :
 *    elle reste en fallback ultime uniquement.
 */
export function getTenantIdForOffline(): string | undefined {
  if (typeof window === 'undefined') return undefined;

  // 1. Cookie x-tenant-id — source canonique (rafraîchie à chaque login)
  const match = document.cookie.match(/(?:^|.*;\s*)x-tenant-id\s*=\s*([^;]*).*$/);
  if (match && match[1] && decodeURIComponent(match[1]).length > 0) {
    return decodeURIComponent(match[1]);
  }

  // 2. Fallback : localStorage session (anciennes versions de l'app)
  try {
    const session = localStorage.getItem('session');
    if (session) {
      const parsed = JSON.parse(session);
      return parsed.tenantId || parsed.tenant?.id || undefined;
    }
  } catch {}

  return undefined;
}
