/// ============================================================================
/// STUDENTS SERVICE — Academia Hub Mobile
/// ============================================================================
///
/// Service CRUD pour le module Élèves, miroir du web app (students.service.ts).
///
/// Étend [BaseCrudService] et fournit les méthodes spécifiques au module :
/// - CRUD de base (getAll, getById, create, update, delete)
/// - Admissions (CRUD + submit, decide, convert)
/// - Inscriptions / Enrollments
/// - Pré-inscription
/// - Dossier & Historique
/// - Statistiques & Orion (KPIs, Alertes)
/// - Photos & Gardiens
/// - Identifiants (Matricules, Cartes d'identité)
/// - Recherche par matricule
///
/// Pattern offline-first :
/// - Lectures → apiGetWithFallback (API avec fallback local)
/// - Écritures → apiPostWithOfflineFallback / apiUpdateWithOfflineFallback
///   (API avec outbox pattern hors ligne)
/// ============================================================================

import '../../../core/crud/base_crud_service.dart';
import '../../../core/network/api_config.dart';
import '../../../core/network/api_result.dart';
import '../../../core/offline/offline_service.dart';

class StudentsService extends BaseCrudService {
  // ─── Singleton ────────────────────────────────────────────────────────────

  static StudentsService? _instance;

  /// Instance singleton du service.
  static StudentsService get instance => _instance ??= StudentsService._();

  StudentsService._() : super(
    endpoint: ApiConfig.students,
    collection: 'students',
    entityType: SyncEntityType.student,
  );

  // ─── CRUD de base ────────────────────────────────────────────────────────

  /// Récupère tous les élèves avec filtres optionnels.
  ///
  /// Miroir de `studentsService.getAll()` du web app.
  Future<ApiResult<List<Map<String, dynamic>>>> getAll({
    Map<String, dynamic>? params,
  }) => super.getAll(params: params);

  /// Récupère un élève par son identifiant.
  ///
  /// Miroir de `studentsService.getById(id)` du web app.
  Future<ApiResult<Map<String, dynamic>>> getById(String id) =>
      super.getById(id);

  /// Crée un nouvel élève.
  ///
  /// Miroir de `studentsService.create(data)` du web app.
  /// Hors ligne → outbox pattern (SyncEntityType.student).
  Future<ApiResult<Map<String, dynamic>>> create(
    Map<String, dynamic> data,
  ) => super.create(data);

  /// Met à jour un élève existant.
  ///
  /// Miroir de `studentsService.update(id, data)` du web app.
  /// Hors ligne → outbox pattern.
  Future<ApiResult<Map<String, dynamic>>> update(
    String id,
    Map<String, dynamic> data,
  ) => super.update(id, data);

  /// Supprime un élève.
  ///
  /// Miroir de `studentsService.delete(id)` du web app.
  /// Hors ligne → soft delete + outbox pattern.
  Future<ApiResult<void>> delete(String id) => super.delete(id);

  // ─── Admissions ──────────────────────────────────────────────────────────

  /// Récupère toutes les admissions.
  ///
  /// Miroir de `studentsService.getAdmissions()` du web app.
  Future<ApiResult<List<Map<String, dynamic>>>> getAdmissions({
    Map<String, dynamic>? params,
  }) =>
      apiGetWithFallback<List<Map<String, dynamic>>>(
        ApiConfig.studentAdmissions,
        params: params,
        localCollection: 'students',
        localFilters: {'type': 'admission'},
      );

  /// Récupère une admission par son identifiant.
  ///
  /// Miroir de `studentsService.getAdmissionById(id)` du web app.
  Future<ApiResult<Map<String, dynamic>>> getAdmissionById(String id) =>
      apiGetWithFallback<Map<String, dynamic>>(
        ApiConfig.studentAdmissionById(id),
        localCollection: 'students',
        localFilters: {'type': 'admission', 'id': id},
      );

  /// Crée une nouvelle admission.
  ///
  /// Miroir de `studentsService.createAdmission(data)` du web app.
  /// Hors ligne → outbox pattern.
  Future<ApiResult<Map<String, dynamic>>> createAdmission(
    Map<String, dynamic> data,
  ) =>
      apiPostWithOfflineFallback<Map<String, dynamic>>(
        ApiConfig.studentAdmissions,
        data,
      );

  /// Met à jour une admission existante.
  ///
  /// Miroir de `studentsService.updateAdmission(id, data)` du web app.
  /// Hors ligne → outbox pattern.
  Future<ApiResult<Map<String, dynamic>>> updateAdmission(
    String id,
    Map<String, dynamic> data,
  ) =>
      apiUpdateWithOfflineFallback<Map<String, dynamic>>(
        ApiConfig.studentAdmissionById(id),
        id,
        data,
      );

  /// Soumet une admission pour validation.
  ///
  /// Miroir de `studentsService.submitAdmission(id)` du web app.
  Future<ApiResult<Map<String, dynamic>>> submitAdmission(String id) =>
      apiPostWithOfflineFallback<Map<String, dynamic>>(
        ApiConfig.studentAdmissionSubmit(id),
        {'id': id},
      );

  /// Prend une décision sur une admission (accepter / refuser).
  ///
  /// Miroir de `studentsService.decideAdmission(id, data)` du web app.
  Future<ApiResult<Map<String, dynamic>>> decideAdmission(
    String id,
    Map<String, dynamic> data,
  ) =>
      apiPostWithOfflineFallback<Map<String, dynamic>>(
        ApiConfig.studentAdmissionDecide(id),
        data,
      );

  /// Convertit une admission en inscription définitive.
  ///
  /// Miroir de `studentsService.convertAdmission(id)` du web app.
  Future<ApiResult<Map<String, dynamic>>> convertAdmission(String id) =>
      apiPostWithOfflineFallback<Map<String, dynamic>>(
        ApiConfig.studentAdmissionConvert(id),
        {'id': id},
      );

  // ─── Enrollments / Inscriptions ──────────────────────────────────────────

  /// Récupère toutes les inscriptions.
  ///
  /// Miroir de `studentsService.getEnrollments()` du web app.
  Future<ApiResult<List<Map<String, dynamic>>>> getEnrollments({
    Map<String, dynamic>? params,
  }) =>
      apiGetWithFallback<List<Map<String, dynamic>>>(
        ApiConfig.studentEnrollments,
        params: params,
        localCollection: 'students',
        localFilters: {'type': 'enrollment'},
      );

  /// Crée une nouvelle inscription.
  ///
  /// Miroir de `studentsService.createEnrollment(data)` du web app.
  Future<ApiResult<Map<String, dynamic>>> createEnrollment(
    Map<String, dynamic> data,
  ) =>
      apiPostWithOfflineFallback<Map<String, dynamic>>(
        ApiConfig.studentEnrollments,
        data,
      );

  /// Pré-inscrit un élève.
  ///
  /// Miroir de `studentsService.preRegister(data)` du web app.
  Future<ApiResult<Map<String, dynamic>>> preRegister(
    Map<String, dynamic> data,
  ) =>
      apiPostWithOfflineFallback<Map<String, dynamic>>(
        ApiConfig.studentPreRegister,
        data,
      );

  // ─── Dossier & Historique ────────────────────────────────────────────────

  /// Récupère le dossier complet d'un élève.
  ///
  /// Miroir de `studentsService.getDossier(id)` du web app.
  Future<ApiResult<Map<String, dynamic>>> getDossier(String id) =>
      apiGetWithFallback<Map<String, dynamic>>(
        ApiConfig.studentDossier(id),
        localCollection: 'students',
        localFilters: {'id': id},
      );

  /// Récupère l'historique d'un élève.
  ///
  /// Miroir de `studentsService.getHistory(id)` du web app.
  Future<ApiResult<Map<String, dynamic>>> getHistory(String id) =>
      apiGetWithFallback<Map<String, dynamic>>(
        ApiConfig.studentHistory(id),
        localCollection: 'students',
        localFilters: {'id': id},
      );

  // ─── Statistiques & Orion ────────────────────────────────────────────────

  /// Récupère les statistiques des élèves pour une année et niveau.
  ///
  /// Miroir de `studentsService.getStatistics(academicYearId, schoolLevelId)`
  /// du web app.
  Future<ApiResult<Map<String, dynamic>>> getStatistics(
    String academicYearId,
    String schoolLevelId,
  ) =>
      apiGetWithFallback<Map<String, dynamic>>(
        ApiConfig.studentStatistics(academicYearId, schoolLevelId),
      );

  /// Récupère les KPIs Orion pour une année académique.
  ///
  /// Miroir de `studentsService.getOrionKpis(academicYearId)` du web app.
  Future<ApiResult<Map<String, dynamic>>> getOrionKpis(
    String academicYearId,
  ) =>
      apiGetWithFallback<Map<String, dynamic>>(
        ApiConfig.studentOrionKpis(academicYearId),
      );

  /// Récupère les alertes Orion pour une année académique.
  ///
  /// Miroir de `studentsService.getOrionAlerts(academicYearId)` du web app.
  Future<ApiResult<List<Map<String, dynamic>>>> getOrionAlerts(
    String academicYearId,
  ) =>
      apiGetWithFallback<List<Map<String, dynamic>>>(
        ApiConfig.studentOrionAlerts(academicYearId),
        localCollection: 'students',
        localFilters: {'type': 'orionAlert'},
      );

  // ─── Photo & Gardiens ────────────────────────────────────────────────────

  /// Upload la photo d'un élève.
  ///
  /// Miroir de `studentsService.uploadPhoto(id, file)` du web app.
  Future<ApiResult<Map<String, dynamic>>> uploadPhoto(
    String id,
    Map<String, dynamic> data,
  ) =>
      apiPostWithOfflineFallback<Map<String, dynamic>>(
        ApiConfig.studentUploadPhoto(id),
        data,
      );

  /// Ajoute des gardiens (parents) à un élève.
  ///
  /// Miroir de `studentsService.addGuardians(id, data)` du web app.
  Future<ApiResult<Map<String, dynamic>>> addGuardians(
    String id,
    Map<String, dynamic> data,
  ) =>
      apiPostWithOfflineFallback<Map<String, dynamic>>(
        ApiConfig.studentGuardians(id),
        data,
      );

  // ─── Identifiants & Cartes ───────────────────────────────────────────────

  /// Récupère les statistiques des cartes d'identité.
  ///
  /// Miroir de `studentsService.getIdCardStats()` du web app.
  Future<ApiResult<Map<String, dynamic>>> getIdCardStats() =>
      apiGetWithFallback<Map<String, dynamic>>(
        ApiConfig.studentIdCardStats,
      );

  /// Génère des cartes d'identité en masse.
  ///
  /// Miroir de `studentsService.generateBulkIdCards(data)` du web app.
  Future<ApiResult<Map<String, dynamic>>> generateBulkIdCards(
    Map<String, dynamic> data,
  ) =>
      apiPostWithOfflineFallback<Map<String, dynamic>>(
        ApiConfig.studentGenerateBulkIdCards,
        data,
      );

  /// Récupère les statistiques des matricules.
  ///
  /// Miroir de `studentsService.getMatriculeStats()` du web app.
  Future<ApiResult<Map<String, dynamic>>> getMatriculeStats() =>
      apiGetWithFallback<Map<String, dynamic>>(
        ApiConfig.studentIdentifiersStats,
      );

  /// Génère des matricules en masse.
  ///
  /// Miroir de `studentsService.generateBulkMatricules(data)` du web app.
  Future<ApiResult<Map<String, dynamic>>> generateBulkMatricules(
    Map<String, dynamic> data,
  ) =>
      apiPostWithOfflineFallback<Map<String, dynamic>>(
        ApiConfig.studentGenerateBulkMatricules,
        data,
      );

  /// Recherche un élève par matricule.
  ///
  /// Miroir de `studentsService.searchByMatricule(matricule)` du web app.
  Future<ApiResult<Map<String, dynamic>>> searchByMatricule(
    String matricule,
  ) =>
      apiGetWithFallback<Map<String, dynamic>>(
        ApiConfig.studentSearchByMatricule(matricule),
        localCollection: 'students',
        localFilters: {'matricule': matricule},
      );
}
