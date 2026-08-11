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
];

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
 * Récupère le tenantId depuis localStorage ou les cookies.
 */
export function getTenantIdForOffline(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const session = localStorage.getItem('session');
    if (session) {
      const parsed = JSON.parse(session);
      return parsed.tenantId || parsed.tenant?.id || undefined;
    }
  } catch {}
  const match = document.cookie.match(/(?:^|.*;\s*)x-tenant-id\s*=\s*([^;]*).*$/);
  if (match && match[1]) return decodeURIComponent(match[1]);
  return undefined;
}
