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
  { pattern: /\/api\/settings\/identity/, store: 'tenantidentityprofile' },
  { pattern: /\/api\/settings\/bilingual/, store: 'settingsbilingual' },
  { pattern: /\/api\/settings\/academic/, store: 'schoolacademicsettings' },
  { pattern: /\/api\/settings\/communication/, store: 'settingscommunication' },
  { pattern: /\/api\/settings\/security/, store: 'securitysettings' },
  { pattern: /\/api\/settings\/features/, store: 'tenantfeature' },
  { pattern: /\/api\/settings\/history/, store: 'settingshistory' },
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

  // ─── RH (routes non couvertes) ───
  { pattern: /\/api\/hr\/positions/, store: 'position' },
  { pattern: /\/api\/hr\/collaborators/, store: 'staff' },
  { pattern: /\/api\/hr\/planning/, store: 'staffplanning' },
  { pattern: /\/api\/hr\/reporting/, store: 'orion_cache' },
  { pattern: /\/api\/hr\/cnss/, store: 'orion_cache' },
  { pattern: /\/api\/hr\/taxes/, store: 'orion_cache' },

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
  { pattern: /\/api\/modules-complementaires\/shop\/products/, store: 'shopproduct' },
  { pattern: /\/api\/modules-complementaires\/shop\/categories/, store: 'shopcategory' },
  { pattern: /\/api\/modules-complementaires\/shop\/orders/, store: 'shoporder' },
  { pattern: /\/api\/modules-complementaires\/shop\/sales/, store: 'shopsale' },
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
