/// ============================================================================
/// USER ROLE & PORTAL TYPE ENUMS — Academia Hub Mobile
/// ============================================================================
///
/// Canonical role and portal definitions for the mobile app.
/// 5 Portals: PLATFORM, SCHOOL, TEACHER, PARENT, PUBLIC
/// No Federis — Academia Federis is a separate application.
/// ============================================================================

// ─── PortalType ──────────────────────────────────────────────────────────────

/// The 5 portal types in Academia Hub.
/// Each portal maps to a distinct user experience and module set.
enum PortalType {
  platform,
  school,
  teacher,
  parent,
  public;

  /// Human-readable display name for each portal.
  String get displayName {
    switch (this) {
      case PortalType.platform:
        return 'Plateforme';
      case PortalType.school:
        return 'École';
      case PortalType.teacher:
        return 'Enseignant';
      case PortalType.parent:
        return 'Parent / Élève';
      case PortalType.public:
        return 'Public';
    }
  }

  /// Route prefix used for navigation within each portal.
  String get routePrefix {
    switch (this) {
      case PortalType.platform:
        return '/platform';
      case PortalType.school:
        return '/school';
      case PortalType.teacher:
        return '/teacher';
      case PortalType.parent:
        return '/parent';
      case PortalType.public:
        return '/public';
    }
  }
}

// ─── UserRole ────────────────────────────────────────────────────────────────

/// All user roles in Academia Hub Mobile.
/// The mobile app only exposes a subset relevant to parents and students,
/// but the full set is defined here for compatibility with the API.
enum UserRole {
  // Platform roles (7)
  platformOwner,
  platformSuperAdmin,
  platformAdmin,
  billingManager,
  supportAgent,
  technicalOperator,
  platformAuditor,

  // School roles (45)
  schoolOwner,
  boardPresident,
  directorGeneral,
  schoolDirector,
  deputyDirector,
  schoolAdmin,
  adminAgent,
  respScolarite,
  dataManager,
  internalAuditor,
  respMaternelle,
  pedagogicCoordinator,
  examManager,
  secretary,
  monitor,
  teachingAssistant,
  activitiesManager,
  respPrimaire,
  respSecondaire,
  censor,
  generalMonitor,
  orientationManager,
  cfo,
  financeManager,
  accountant,
  cashier,
  recoveryManager,
  pedagogicDirector,
  schoolLifeManager,
  communicationManager,
  communicationAgent,
  hrManager,
  payrollManager,
  itManager,
  librarian,
  canteenManager,
  transportManager,
  boardingManager,
  healthManager,
  securityManager,
  settingsManager,

  // Teacher roles (11)
  teacher,
  headTeacher,
  substituteTeacher,
  teacherAssistant,
  departmentCoordinator,
  pedagogicAdvisor,
  teacherResp,
  teacherInternship,
  tutor,
  mentor,
  examiner,

  // Parent / Student roles (9)
  parent,
  parentPrimary,
  parentSecondary,
  legalGuardian,
  financialResponsible,
  guardian,
  student,
  classDelegate,
  alumni,

  // Public roles (5)
  visitor,
  prospectParent,
  applicant,
  sponsor,
  ambassador;

  /// Lookup map for parsing role strings from the API.
  static final Map<String, UserRole> _roleNameMap = {
    for (final role in UserRole.values) role.name: role
  };

  /// Maps this role to its portal.
  PortalType get portal {
    switch (this) {
      // Platform
      case UserRole.platformOwner:
      case UserRole.platformSuperAdmin:
      case UserRole.platformAdmin:
      case UserRole.billingManager:
      case UserRole.supportAgent:
      case UserRole.technicalOperator:
      case UserRole.platformAuditor:
        return PortalType.platform;

      // School
      case UserRole.schoolOwner:
      case UserRole.boardPresident:
      case UserRole.directorGeneral:
      case UserRole.schoolDirector:
      case UserRole.deputyDirector:
      case UserRole.schoolAdmin:
      case UserRole.adminAgent:
      case UserRole.respScolarite:
      case UserRole.dataManager:
      case UserRole.internalAuditor:
      case UserRole.respMaternelle:
      case UserRole.pedagogicCoordinator:
      case UserRole.examManager:
      case UserRole.secretary:
      case UserRole.monitor:
      case UserRole.teachingAssistant:
      case UserRole.activitiesManager:
      case UserRole.respPrimaire:
      case UserRole.respSecondaire:
      case UserRole.censor:
      case UserRole.generalMonitor:
      case UserRole.orientationManager:
      case UserRole.cfo:
      case UserRole.financeManager:
      case UserRole.accountant:
      case UserRole.cashier:
      case UserRole.recoveryManager:
      case UserRole.pedagogicDirector:
      case UserRole.schoolLifeManager:
      case UserRole.communicationManager:
      case UserRole.communicationAgent:
      case UserRole.hrManager:
      case UserRole.payrollManager:
      case UserRole.itManager:
      case UserRole.librarian:
      case UserRole.canteenManager:
      case UserRole.transportManager:
      case UserRole.boardingManager:
      case UserRole.healthManager:
      case UserRole.securityManager:
      case UserRole.settingsManager:
        return PortalType.school;

      // Teacher
      case UserRole.teacher:
      case UserRole.headTeacher:
      case UserRole.substituteTeacher:
      case UserRole.teacherAssistant:
      case UserRole.departmentCoordinator:
      case UserRole.pedagogicAdvisor:
      case UserRole.teacherResp:
      case UserRole.teacherInternship:
      case UserRole.tutor:
      case UserRole.mentor:
      case UserRole.examiner:
        return PortalType.teacher;

      // Parent / Student
      case UserRole.parent:
      case UserRole.parentPrimary:
      case UserRole.parentSecondary:
      case UserRole.legalGuardian:
      case UserRole.financialResponsible:
      case UserRole.guardian:
      case UserRole.student:
      case UserRole.classDelegate:
      case UserRole.alumni:
        return PortalType.parent;

      // Public
      case UserRole.visitor:
      case UserRole.prospectParent:
      case UserRole.applicant:
      case UserRole.sponsor:
      case UserRole.ambassador:
        return PortalType.public;
    }
  }

  /// Human-readable display name for each role.
  String get displayName {
    switch (this) {
      // Platform
      case UserRole.platformOwner:
        return 'Platform Owner';
      case UserRole.platformSuperAdmin:
        return 'Super Admin Plateforme';
      case UserRole.platformAdmin:
        return 'Admin Plateforme';
      case UserRole.billingManager:
        return 'Billing Manager';
      case UserRole.supportAgent:
        return 'Support Agent';
      case UserRole.technicalOperator:
        return 'Technical Operator';
      case UserRole.platformAuditor:
        return 'Auditeur Plateforme';

      // School
      case UserRole.schoolOwner:
        return 'Promoteur / Fondateur';
      case UserRole.boardPresident:
        return 'Président CA';
      case UserRole.directorGeneral:
        return 'Directeur Général';
      case UserRole.schoolDirector:
        return "Directeur d'Établissement";
      case UserRole.deputyDirector:
        return 'Directeur Adjoint';
      case UserRole.schoolAdmin:
        return 'Secrétaire Général';
      case UserRole.adminAgent:
        return 'Agent Administratif';
      case UserRole.respScolarite:
        return 'Responsable Scolarité';
      case UserRole.dataManager:
        return 'Data Manager';
      case UserRole.internalAuditor:
        return 'Auditeur Interne';
      case UserRole.respMaternelle:
        return 'Responsable Maternelle';
      case UserRole.pedagogicCoordinator:
        return 'Coordinateur Pédagogique';
      case UserRole.examManager:
        return 'Responsable Examens';
      case UserRole.secretary:
        return 'Secrétaire';
      case UserRole.monitor:
        return 'Surveillant';
      case UserRole.teachingAssistant:
        return 'Assistant(e) Maternelle';
      case UserRole.activitiesManager:
        return 'Responsable Activités';
      case UserRole.respPrimaire:
        return 'Responsable Primaire';
      case UserRole.respSecondaire:
        return 'Responsable Secondaire';
      case UserRole.censor:
        return 'Censeur';
      case UserRole.generalMonitor:
        return 'Surveillant Général';
      case UserRole.orientationManager:
        return 'Responsable Orientation';
      case UserRole.cfo:
        return 'Directeur Administratif et Financier';
      case UserRole.financeManager:
        return 'Responsable Financier';
      case UserRole.accountant:
        return 'Comptable';
      case UserRole.cashier:
        return 'Caissier';
      case UserRole.recoveryManager:
        return 'Responsable Recouvrement';
      case UserRole.pedagogicDirector:
        return 'Responsable Pédagogique';
      case UserRole.schoolLifeManager:
        return 'Responsable Vie Scolaire';
      case UserRole.communicationManager:
        return 'Responsable Communication';
      case UserRole.communicationAgent:
        return 'Chargé de Communication';
      case UserRole.hrManager:
        return 'Responsable RH';
      case UserRole.payrollManager:
        return 'Gestionnaire de Paie';
      case UserRole.itManager:
        return 'Responsable Informatique';
      case UserRole.librarian:
        return 'Bibliothécaire';
      case UserRole.canteenManager:
        return 'Responsable Cantine';
      case UserRole.transportManager:
        return 'Responsable Transport';
      case UserRole.boardingManager:
        return 'Responsable Internat';
      case UserRole.healthManager:
        return 'Responsable Santé';
      case UserRole.securityManager:
        return 'Responsable Sécurité';
      case UserRole.settingsManager:
        return 'Responsable Paramètres';

      // Teacher
      case UserRole.teacher:
        return 'Enseignant';
      case UserRole.headTeacher:
        return 'Professeur Principal';
      case UserRole.substituteTeacher:
        return 'Enseignant Remplaçant';
      case UserRole.teacherAssistant:
        return 'Assistant Enseignant';
      case UserRole.departmentCoordinator:
        return 'Coordinateur de Département';
      case UserRole.pedagogicAdvisor:
        return 'Conseiller Pédagogique';
      case UserRole.teacherResp:
        return 'Enseignant Responsable';
      case UserRole.teacherInternship:
        return 'Enseignant Stagiaire';
      case UserRole.tutor:
        return 'Tuteur';
      case UserRole.mentor:
        return 'Mentor';
      case UserRole.examiner:
        return 'Examinateur';

      // Parent / Student
      case UserRole.parent:
        return 'Parent Principal';
      case UserRole.parentPrimary:
        return 'Parent Principal (v2)';
      case UserRole.parentSecondary:
        return 'Parent Secondaire';
      case UserRole.legalGuardian:
        return 'Tuteur Légal';
      case UserRole.financialResponsible:
        return 'Responsable Financier Élève';
      case UserRole.guardian:
        return 'Tuteur';
      case UserRole.student:
        return 'Élève';
      case UserRole.classDelegate:
        return 'Élève Délégué';
      case UserRole.alumni:
        return 'Ancien Élève';

      // Public
      case UserRole.visitor:
        return 'Visiteur';
      case UserRole.prospectParent:
        return 'Parent Prospect';
      case UserRole.applicant:
        return 'Candidat Élève';
      case UserRole.sponsor:
        return 'Sponsor';
      case UserRole.ambassador:
        return 'Ambassadeur';
    }
  }

  /// Parse a role string from the API (e.g. "PLATFORM_OWNER") into a UserRole.
  static UserRole? fromString(String role) {
    // Convert SNAKE_CASE to camelCase
    final camel = role
        .toLowerCase()
        .split('_')
        .asMap()
        .map((i, part) =>
            MapEntry(i, i == 0 ? part : '${part[0].toUpperCase()}${part.substring(1)}'))
        .values
        .join('');
    return _roleNameMap[camel];
  }
}
