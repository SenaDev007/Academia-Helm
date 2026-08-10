/**
 * Local Database Service
 * 
 * Service pour gérer la base de données locale SQLite (ou IndexedDB pour Web)
 * 
 * PRINCIPE : Base locale complète avec toutes les tables métier
 */

import type { SyncEntityType } from '@/types';

// Pour Web : utiliser IndexedDB via idb
// Pour Desktop : utiliser better-sqlite3
// Cette implémentation est une abstraction

interface LocalDbConfig {
  dbName: string;
  version: number;
}

class LocalDbService {
  private db: any; // IDBDatabase pour Web, Database pour Desktop
  private isInitialized: boolean = false;

  constructor(private config: LocalDbConfig) {}

  /**
   * Initialise la base de données locale
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Détection de l'environnement
    // Dans Next.js, on utilise toujours IndexedDB (côté client uniquement)
    // SQLite est uniquement pour l'app Desktop Electron
    if (typeof window !== 'undefined') {
      // Web/Next.js Client : IndexedDB
      await this.initializeIndexedDB();
    } else {
      // Next.js Server : ne pas initialiser (les services offline ne fonctionnent que côté client)
      // Desktop Electron : SQLite (mais cette partie ne sera jamais exécutée dans Next.js)
      throw new Error('Local database can only be initialized in browser/client environment');
    }

    this.isInitialized = true;
  }

  /**
   * Initialise IndexedDB (Web)
   */
  private async initializeIndexedDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.config.dbName, this.config.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        this.createObjectStores(db);
      };
    });
  }

  /**
   * Crée les object stores (IndexedDB)
   */
  private createObjectStores(db: IDBDatabase): void {
    // Object store pour chaque entité métier — couvre TOUS les modules de l'application
    // ⭐ TOUS les object stores miroir de Neon (590 tables Prisma)
    //    Généré automatiquement depuis schema.prisma — chaque table PostgreSQL
    //    a son équivalent IndexedDB pour le mode offline-first.
    const entities: string[] = [
      "absence",
      "academicauditlog",
      "academicclass",
      "academiccycle",
      "academiclevel",
      "academicperiod",
      "academicprofile",
      "academicscore",
      "academicseries",
      "academicsettingsauditlog",
      "academictrack",
      "academicyear",
      "academicyearclosure",
      "accountbreakdown",
      "activitylog",
      "administrativeseal",
      "administrativesealusage",
      "administrativesealversion",
      "admission",
      "admissiondocument",
      "admissioninterview",
      "allowancetype",
      "announcement",
      "annualteachersupply",
      "apprelease",
      "arreartransfer",
      "atlasconversation",
      "atlasfeedback",
      "atlasmessage",
      "atlassettings",
      "attendancerecord",
      "attendanceregister",
      "auditlog",
      "authauditlog",
      "automatedtrigger",
      "automationexecution",
      "automationrule",
      "billingevent",
      "billingreminderlog",
      "blogarticle",
      "bulletinsendingcriteria",
      "cnssdeclaration",
      "cnssdeclarationline",
      "cnssrate",
      "cahierdetest",
      "cahierjournal",
      "candidatedocument",
      "canteenallergy",
      "canteenattendance",
      "canteendiet",
      "canteenenrollment",
      "canteenfoodstock",
      "canteenincident",
      "canteenmealservice",
      "canteenmenu",
      "canteenpayment",
      "canteenpurchaseorder",
      "canteenreport",
      "canteensettings",
      "canteenstockmovement",
      "canteensubscription",
      "canteensupplier",
      "carddesigntemplate",
      "cashclosure",
      "cashregister",
      "certifiedelectronicsignature",
      "class",
      "classcouncil",
      "classdiary",
      "classlog",
      "classstudent",
      "classsubject",
      "classtransfer",
      "classroom",
      "climateacademiccorrelation",
      "climatescoresnapshot",
      "cmspage",
      "collectionaction",
      "collectioncase",
      "collectionreminder",
      "communicationchannel",
      "communicationstat",
      "compliancerecord",
      "compliancerequirement",
      "contract",
      "contractamendment",
      "contractsigntoken",
      "contracttemplate",
      "correctiveaction",
      "councildecision",
      "councilminute",
      "country",
      "dailyclosure",
      "dailylog",
      "dataconsent",
      "dataexport",
      "department",
      "devicesession",
      "disciplinaryaction",
      "discipline",
      "disciplinerecord",
      "discount",
      "documentseal",
      "documenttemplate",
      "educastannouncement",
      "educastchannelsubscriber",
      "educastcontentpack",
      "educastcontentpackitem",
      "educastengagement",
      "educastfavorite",
      "educastmediaitem",
      "educastpayoutrequest",
      "educastplaylist",
      "educastplaylistitem",
      "educastpurchase",
      "educastreport",
      "educastresource",
      "educastsetting",
      "educastsubscription",
      "educastteacherchannel",
      "educastwebinar",
      "educastaccess",
      "educastcontent",
      "educastsession",
      "educationcycle",
      "educationgrade",
      "educationlevel",
      "educationseries",
      "electronicsignature",
      "emaillog",
      "employeecnss",
      "evaluation",
      "evaluationtype",
      "exam",
      "examcalculationrule",
      "examcandidate",
      "examcenter",
      "examcomposition",
      "examdeliberation",
      "examdeliberationcase",
      "examdocument",
      "examincident",
      "examresult",
      "examroom",
      "examscore",
      "examsession",
      "examstaff",
      "examsubject",
      "examsubjectfile",
      "examsupervisor",
      "expense",
      "expensecategory",
      "federiscommunity",
      "federiscommunitymember",
      "federiscommunitypost",
      "federisconnectevent",
      "federisconnectprofile",
      "federisconversation",
      "federisconversationparticipant",
      "federiseventparticipant",
      "federisgroup",
      "federisgroupmember",
      "federisgrouppost",
      "federisinterpatronatconnection",
      "federisinvoice",
      "federismessage",
      "federismessageaction",
      "federismessageattachment",
      "federismessageread",
      "federisnoticerecipient",
      "federisofficialnotice",
      "federispayment",
      "federispoll",
      "federispolloption",
      "federispollvote",
      "federispostcomment",
      "federispostreaction",
      "feearrear",
      "feecategory",
      "feeconfiguration",
      "feedefinition",
      "feeinstallment",
      "feeoverride",
      "feeregime",
      "feeregimerule",
      "feestructure",
      "feestructureinstallment",
      "financebudget",
      "financedailyclosure",
      "financeexpense",
      "financetransaction",
      "financetransactionallocation",
      "financialanomaly",
      "financialauditlog",
      "financialnote",
      "financialreportexport",
      "financialreportheader",
      "financialsettings",
      "financialstatement",
      "geddocument",
      "geddocumentversion",
      "generateddocument",
      "globalpedagogicalresource",
      "globalresourceversion",
      "grade",
      "gradecalculation",
      "gradecorrectionrequest",
      "gradelock",
      "graderulesversion",
      "gradescale",
      "gradevalidationbatch",
      "gradingpolicy",
      "guardian",
      "helminvoice",
      "helmsubscription",
      "helmupgradeevent",
      "homeworkentry",
      "homeworksubmission",
      "honorroll",
      "hraireport",
      "hrapplication",
      "hrcandidate",
      "hrinterview",
      "hrjob",
      "hrtalentpool",
      "hrtest",
      "hrtestresult",
      "inappnotification",
      "inboundemail",
      "incident",
      "incidentaction",
      "incidentattachment",
      "infirmaryaccesslog",
      "infirmaryallergy",
      "infirmaryauthorization",
      "infirmarycheckup",
      "infirmarycontraindication",
      "infirmaryemergency",
      "infirmarymedicalrecord",
      "infirmarymedicationmovement",
      "infirmarymedicationstock",
      "infirmaryreport",
      "infirmarysetting",
      "infirmaryvisit",
      "inspection",
      "inspectionchecklist",
      "jobnumbersequence",
      "kpidefinition",
      "kpiobjective",
      "kpisnapshot",
      "lab",
      "labconsumable",
      "labequipment",
      "labincident",
      "labmaintenance",
      "labpurchaserequest",
      "labreport",
      "labreservation",
      "labsafetyrule",
      "labsession",
      "labstockmovement",
      "leaverequest",
      "legalpage",
      "lessonjournal",
      "lessonjournalentry",
      "lessonjournalvalidation",
      "lessonplan",
      "lessonplanassignment",
      "lessonplanvalidation",
      "lessonplanversion",
      "librarybook",
      "librarycategory",
      "librarycopy",
      "librarydigitalresource",
      "libraryfavorite",
      "libraryinventorycampaign",
      "libraryinventoryitem",
      "libraryloan",
      "librarypenalty",
      "libraryrecommendation",
      "libraryreport",
      "libraryreservation",
      "librarysetting",
      "materialmovement",
      "materialstock",
      "mediaasset",
      "mediacontent",
      "mediasession",
      "mediaview",
      "medicalalert",
      "medicalrecord",
      "medicalvisit",
      "medication",
      "meeting",
      "meetingagenda",
      "meetingattachment",
      "meetingdecision",
      "meetingminutes",
      "meetingminutestemplate",
      "meetingminutesversion",
      "meetingnotification",
      "meetingparticipant",
      "message",
      "messagelog",
      "messagerecipient",
      "messagetarget",
      "messagetemplate",
      "module",
      "monthlyevaluation",
      "monthlysummary",
      "multigradeassignment",
      "nationalexam",
      "nationalexamsubject",
      "nationalexportlog",
      "offlinesyncsettings",
      "onboardingdraft",
      "onboardingotp",
      "onboardingpayment",
      "onetimebonus",
      "onlinepayment",
      "order",
      "orderitem",
      "organigramnode",
      "orionaccesslog",
      "orionalert",
      "orionauditlog",
      "oriondisciplineprediction",
      "orionfeaturesnapshot",
      "orionforecast",
      "orioninsight",
      "orionmodelversion",
      "orionpedagogicalinsight",
      "orionreport",
      "orionriskflag",
      "orionsettings",
      "otpcode",
      "overtimerecord",
      "passwordreset",
      "patronat",
      "patronatbureaumember",
      "patronatmanualschool",
      "patronatschool",
      "patronatuser",
      "payment",
      "paymentallocation",
      "paymentflow",
      "paymentinitiation",
      "paymentnotification",
      "paymentplan",
      "paymentpromise",
      "paymentreceipt",
      "paymentsummary",
      "paymentwebhooklog",
      "payroll",
      "payrollitem",
      "payrollperiod",
      "payrollrate",
      "pedagogicalattachment",
      "pedagogicalauditlog",
      "pedagogicaldocument",
      "pedagogicaldocumentcomment",
      "pedagogicaldocumentnotification",
      "pedagogicaldocumentreview",
      "pedagogicaldocumentversion",
      "pedagogicalkpisnapshot",
      "pedagogicalmaterial",
      "pedagogicalsheet",
      "pedagogicalsheetvalidation",
      "pedagogicalsheetversion",
      "pedagogicalsignature",
      "pedagogicaltaskstudent",
      "pedagogicalweeklylog",
      "permission",
      "platformmarketingreview",
      "platformowneraccessrequest",
      "portalsession",
      "pricingconfig",
      "pricinggrouptier",
      "pricingoverride",
      "pricingplan",
      "primarypedagogicalfiche",
      "product",
      "publicverificationlog",
      "publicverificationtoken",
      "pushnotification",
      "pushsubscription",
      "qhseactionplan",
      "qhseactionplanitem",
      "qhsealert",
      "qhseaudit",
      "qhseauditfinding",
      "qhsecompliance",
      "qhsedocument",
      "qhsehealthvisit",
      "qhsehygienecheckitem",
      "qhsehygieneinspection",
      "qhseincident",
      "qhseincidentattachment",
      "qhseperiodiccontrol",
      "qhsereport",
      "qhserisk",
      "qhsesecuritycontrol",
      "qhsesetting",
      "qhsaudit",
      "qhscorrectiveaction",
      "qhsdecisionlog",
      "qhsincident",
      "qhsriskregister",
      "quarter",
      "questionbankresource",
      "ranking",
      "recoveryreminder",
      "recruiterprofile",
      "reportcard",
      "reportcarditem",
      "resourceaccesslog",
      "review",
      "revokedtoken",
      "riskalert",
      "role",
      "rolepermission",
      "room",
      "roomallocation",
      "roommaintenance",
      "roomreservation",
      "roomschedule",
      "route",
      "routestop",
      "saisiemasterprospect",
      "saisiemastersession",
      "saisiemastertestimonial",
      "salarypayment",
      "salarypolicy",
      "salaryslip",
      "scheduledmessage",
      "school",
      "schoolacademicsettings",
      "schoolcalendarconfig",
      "schoollevel",
      "schoolpaymentaccount",
      "schoolsearchlog",
      "schoolsettings",
      "schoolstrategicsnapshot",
      "securityevent",
      "securitysettings",
      "seometa",
      "seriessubject",
      "session",
      "settingsbilingual",
      "settingscommunication",
      "settingshistory",
      "settingspedagogicalstructure",
      "shopcategory",
      "shopdelivery",
      "shopdiscount",
      "shoployaltycard",
      "shoporder",
      "shoporderitem",
      "shopproduct",
      "shoppurchaseorder",
      "shoppurchaseorderitem",
      "shopreturn",
      "shopsale",
      "shopsaleitem",
      "shopschoolkit",
      "shopschoolkititem",
      "shopsettings",
      "shopstock",
      "shopstockmovement",
      "shopsupplier",
      "shopwallettransaction",
      "signeddocument",
      "smslog",
      "staff",
      "staffadminassignment",
      "staffallowance",
      "staffassignment",
      "staffattendance",
      "staffdocument",
      "staffevaluation",
      "staffnumbersequence",
      "staffphoto",
      "staffschedule",
      "stafftraining",
      "storepayment",
      "student",
      "studentacademicrecord",
      "studentacademictrack",
      "studentaccount",
      "studentarrear",
      "studentauditlog",
      "studentcouncildecision",
      "studentdisciplinarysummary",
      "studentdocument",
      "studentenrollment",
      "studentfee",
      "studentfeeprofile",
      "studentguardian",
      "studentidcard",
      "studentidentifier",
      "studentnumbersequence",
      "studentperiodaverage",
      "studentphoto",
      "studentsubjectaverage",
      "studenttransferdocument",
      "studenttransfermessage",
      "studenttransferrequest",
      "studenttransferstatushistory",
      "subject",
      "subjectassignment",
      "subscription",
      "subscriptioninvoice",
      "subscriptionplan",
      "syncconflict",
      "synclog",
      "syncoperation",
      "taxdeclaration",
      "taxpayrollperiod",
      "taxpayslip",
      "taxrate",
      "taxsettings",
      "taxwithholding",
      "teacher",
      "teacheracademicprofile",
      "teacheravailability",
      "teacherclassassignment",
      "teacherlevelauthorization",
      "teachermaterialassignment",
      "teachersubject",
      "teachersubjectqualification",
      "teachingassignment",
      "teachingcertification",
      "teachingjournal",
      "tenant",
      "tenantcontactmessage",
      "tenantdomain",
      "tenantevent",
      "tenantfaqitem",
      "tenantfeature",
      "tenantgalleryitem",
      "tenantidentityprofile",
      "tenantnewsarticle",
      "tenantpaymentconfig",
      "tenantresourceannotation",
      "tenantresourceusage",
      "tenantsetting",
      "tenantsignature",
      "tenantstamp",
      "tenanttestimonial",
      "tenantwebsite",
      "tenantwebsitelevelsection",
      "timeslot",
      "timetable",
      "timetableconfig",
      "timetableconstraint",
      "timetableentry",
      "timetablesolution",
      "timetableteacheravailability",
      "timetableversion",
      "trainingsession",
      "transferrequest",
      "transportassignment",
      "transportattendance",
      "transportattendant",
      "transportdriver",
      "transportincident",
      "transportschedule",
      "transportsetting",
      "transporttrip",
      "transporttripevent",
      "transportzone",
      "treasurymovement",
      "tuitioninstallment",
      "tuitionpayment",
      "user",
      "userdevice",
      "userrole",
      "usertenant",
      "vehicle",
      "vehicledocument",
      "vehiclemaintenance",
      "weeklydutyassignment",
      "weeklyjournalentry",
      "weeklylogdailyreport",
      "weeklylogsummary",
      "weeklyreport",
      "weeklysemainier",
      "weeklysemainierdailyentry",
      "weeklysemainierincident",
      "whatsapplog",
      // ⭐ Stores ajoutés en V13 (manquants détectés via diagnostic agent-browser) :
      //    school_directors, positions, et autres tables backend qui n'avaient
      //    pas de store IDB correspondant. Sans ces stores, la sync échouait
      //    silencieusement à ~32% (quand elle atteignait ces tables).
      "schooldirectors",
      "positions",
      "pedagogyacademiclevels",
      "pedagogyacademicseries",
      "pedagogyteacheracademicprofiles",
      "pedagogyteacheravailabilities",
      "rolepermissions",
      "scheduledemails",
      "taxsettings",
      "tenantfeatures",
      "schoolacademicsettings",
    ];

    entities.forEach(storeName => {
      if (!db.objectStoreNames.contains(storeName)) {
        const store = db.createObjectStore(storeName, { keyPath: 'id' });
        store.createIndex('tenant_id', 'tenantId', { unique: false });
        store.createIndex('sync_status', 'syncStatus', { unique: false });
        store.createIndex('_is_dirty', '_isDirty', { unique: false });
        store.createIndex('local_id', 'local_id', { unique: false });
      }
    });

    // Tables techniques offline (Section 9 du Cahier Technique)
    const technicalStores = [
      'user_profile_cache', 
      'roles_cache', 
      'permissions_cache', 
      'local_tenant_context', 
      'local_academic_year', 
      'local_academic_term',
      'local_audit_log',
      'search_indexes',
      'schema_version',
      'sync_operations',
      'sync_conflicts',
      'device_registry_local',
      'outbox_events',
      'sync_state'
    ];

    technicalStores.forEach(storeName => {
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, { keyPath: storeName === 'sync_state' ? 'tenantId' : 'id' });
      }
    });

  }

  /**
   * Initialise SQLite (Desktop)
   * 
   * ⚠️ DÉSACTIVÉ POUR NEXT.JS (WEB UNIQUEMENT)
   * 
   * Cette fonction est uniquement pour l'app Desktop Electron.
   * Dans Next.js (Web), cette fonction ne sera jamais appelée.
   * 
   * Pour Next.js, on utilise uniquement IndexedDB côté client.
   */
  private async initializeSQLite(): Promise<void> {
    // Next.js = Web uniquement, pas de SQLite
    if (typeof window !== 'undefined') {
      throw new Error('SQLite is not available in Next.js Web app. Use IndexedDB instead.');
    }
    throw new Error('SQLite initialization is only available in Electron desktop app');
  }

  /**
   * Exécute le schéma SQLite
   */
  private async executeSQLiteSchema(): Promise<void> {
    // Le schéma sera chargé depuis un fichier SQL
    // Pour l'instant, placeholder
  }

  /**
   * Exécute une requête (lecture)
   */
  async query<T>(storeName: string, query?: (store: IDBObjectStore) => IDBRequest<T[]>): Promise<T[]> {
    await this.ensureInitialized();

    if (typeof window !== 'undefined') {
      // IndexedDB
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        
        if (query) {
          const request = query(store);
          request.onsuccess = () => resolve(Array.from(request.result || []));
          request.onerror = () => reject(request.error);
        } else {
          const request = store.getAll();
          request.onsuccess = () => resolve(request.result || []);
          request.onerror = () => reject(request.error);
        }
      });
    } else {
      // SQLite (Desktop)
      // Implémentation à faire
      throw new Error('SQLite query not implemented yet');
    }
  }

  /**
   * Exécute une commande (écriture)
   */
  async execute(storeName: string, operation: 'add' | 'put' | 'delete', data: any): Promise<void> {
    await this.ensureInitialized();

    if (typeof window !== 'undefined') {
      // IndexedDB
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        
        let request: IDBRequest;
        switch (operation) {
          case 'add':
            request = store.add(data);
            break;
          case 'put':
            request = store.put(data);
            break;
          case 'delete':
            request = store.delete(data.id || data);
            break;
          default:
            reject(new Error('Invalid operation'));
            return;
          }

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } else {
      // SQLite (Desktop)
      throw new Error('SQLite execute not implemented yet');
    }
  }

  /**
   * Exécute plusieurs commandes en une seule transaction (bulk)
   */
  async executeBulk(storeName: string, operation: 'add' | 'put' | 'delete', dataArray: any[]): Promise<void> {
    if (dataArray.length === 0) return;
    await this.ensureInitialized();

    if (typeof window !== 'undefined') {
      // IndexedDB
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);

        dataArray.forEach(data => {
          switch (operation) {
            case 'add':
              store.add(data);
              break;
            case 'put':
              store.put(data);
              break;
            case 'delete':
              store.delete(data.id || data);
              break;
          }
        });
      });
    } else {
      throw new Error('SQLite executeBulk not implemented yet');
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }
  /**
   * Vide un store complet (Section 20.2)
   */
  async clearStore(storeName: string): Promise<void> {
    await this.ensureInitialized();
    if (!this.db.objectStoreNames.contains(storeName)) return;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

// Instance singleton
export const localDb = new LocalDbService({
  dbName: 'academia-helm-local',
  version: 13, // ⭐ bump 12 → 13 (ajout stores manquants : schooldirectors, positions, etc.)
});

/**
 * ⭐ Nettoyage automatique de l'ancienne base IndexedDB obsolète.
 *
 * Lors des premières itérations du projet, la base s'appelait `academia-helm-db`.
 * Elle a été renommée en `academia-helm-local` pour cohérence avec le desktop
 * (Tauri SQLite : `academia_helm.db`) et le mobile (Hive boxes).
 *
 * L'ancienne base reste présente chez les utilisateurs qui ont visité le site
 * avant le renommage — elle est vide (0 stores) mais occupe de l'espace et
 * peut prêter à confusion lors des diagnostics.
 *
 * Cette fonction la supprime automatiquement au chargement de l'app. Elle est
 * silencieuse (catch tous les erreurs) et non-bloquante.
 */
if (typeof window !== 'undefined' && typeof indexedDB !== 'undefined') {
  try {
    // deleteDatabase est asynchrone — on ne l'attend pas
    const deleteReq = indexedDB.deleteDatabase('academia-helm-db');
    deleteReq.onsuccess = () => {
      console.log('[LocalDb] Ancienne base "academia-helm-db" supprimée (nettoyage automatique)');
    };
    deleteReq.onerror = () => {
      // Silencieux — l'ancienne base n'existait peut-être pas
    };
    deleteReq.onblocked = () => {
      // Silencieux — une autre onglet l'utilise, on réessaiera au prochain chargement
    };
  } catch {
    // Silencieux — non-critique
  }
}
