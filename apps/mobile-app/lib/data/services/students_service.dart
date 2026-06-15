/// ============================================================================
/// STUDENTS SERVICE — Academia Hub Mobile
/// ============================================================================
///
/// Service CRUD pour le module Scolarité (Élèves).
/// Miroir de students.service.ts du web app.
///
/// Méthodes :
/// - getAll, create, update, delete (CRUD de base)
/// - getDossier, getHistory (Dossier & historique)
/// - getAdmissions, createAdmission, updateAdmission, submitAdmission,
///   decideAdmission, convertAdmission (Admissions)
/// - getEnrollments, createEnrollment, enrollStudent (Inscriptions)
/// - preRegister, addGuardians (Pré-inscription & tuteurs)
/// - getIdCardStats, generateBulkIdCards, revokeIdCard (Cartes d'identité)
/// - getMatriculeStats, generateBulkMatricules, generateMatricule,
///   searchByMatricule (Matricules)
/// - getStatistics, getOrionKpis, getOrionAlerts (Statistiques & ORION)
/// - uploadPhoto (Photo)
/// ============================================================================

import '../../core/crud/base_crud_service.dart';
import '../../core/network/api_config.dart';
import '../../core/network/api_result.dart';
import '../../core/network/api_client.dart';
import '../../core/offline/offline_service.dart';

class StudentsService extends BaseCrudService {
  StudentsService()
      : super(
          endpoint: ApiConfig.students,
          collection: 'students',
          entityType: SyncEntityType.student,
        );

  // ─── Admissions ──────────────────────────────────────────────────────────

  /// Récupère la liste des admissions.
  Future<ApiResult<List<Map<String, dynamic>>>> getAdmissions({
    Map<String, dynamic>? params,
  }) async {
    return apiGetWithFallback(
      ApiConfig.studentAdmissions,
      params: params,
      localFilters: {'type': 'admission'},
    );
  }

  /// Récupère une admission par ID.
  Future<ApiResult<Map<String, dynamic>>> getAdmissionById(String id) async {
    return getById(id);
  }

  /// Crée une nouvelle admission.
  Future<ApiResult<Map<String, dynamic>>> createAdmission(
    Map<String, dynamic> data,
  ) async {
    return apiPostWithOfflineFallback(
      ApiConfig.studentAdmissions,
      {...data, 'admissionStatus': 'PENDING'},
    );
  }

  /// Met à jour une admission.
  Future<ApiResult<Map<String, dynamic>>> updateAdmission(
    String id,
    Map<String, dynamic> data,
  ) async {
    return apiUpdateWithOfflineFallback(
      ApiConfig.studentAdmissionById(id),
      id,
      data,
    );
  }

  /// Soumet une admission pour validation.
  Future<ApiResult<Map<String, dynamic>>> submitAdmission(String id) async {
    try {
      final response = await ApiClient.instance.post(
        ApiConfig.studentAdmissionSubmit(id),
      );
      return ApiSuccess(response.data as Map<String, dynamic>);
    } catch (e) {
      return ApiFailure(ApiError.fromDioException(e));
    }
  }

  /// Prend une décision sur une admission (ACCEPTED / REJECTED).
  Future<ApiResult<Map<String, dynamic>>> decideAdmission(
    String id, {
    required String decision,
    required String comment,
  }) async {
    try {
      final response = await ApiClient.instance.post(
        ApiConfig.studentAdmissionDecide(id),
        data: {'decision': decision, 'comment': comment},
      );
      return ApiSuccess(response.data as Map<String, dynamic>);
    } catch (e) {
      return ApiFailure(ApiError.fromDioException(e));
    }
  }

  /// Convertit une admission en inscription.
  Future<ApiResult<Map<String, dynamic>>> convertAdmission(String id) async {
    try {
      final response = await ApiClient.instance.post(
        ApiConfig.studentAdmissionConvert(id),
      );
      return ApiSuccess(response.data as Map<String, dynamic>);
    } catch (e) {
      return ApiFailure(ApiError.fromDioException(e));
    }
  }

  // ─── Inscriptions ────────────────────────────────────────────────────────

  /// Récupère la liste des inscriptions.
  Future<ApiResult<List<Map<String, dynamic>>>> getEnrollments({
    Map<String, dynamic>? params,
  }) async {
    return apiGetWithFallback(
      ApiConfig.studentEnrollments,
      params: params,
      localFilters: {'enrollmentStatus': 'ENROLLED'},
    );
  }

  /// Crée une inscription.
  Future<ApiResult<Map<String, dynamic>>> createEnrollment(
    Map<String, dynamic> data,
  ) async {
    return apiPostWithOfflineFallback(
      ApiConfig.studentEnrollments,
      {...data, 'type': 'enrollment'},
    );
  }

  /// Pré-inscription.
  Future<ApiResult<Map<String, dynamic>>> preRegister(
    Map<String, dynamic> data,
  ) async {
    try {
      final response = await ApiClient.instance.post(
        ApiConfig.studentPreRegister,
        data: data,
      );
      return ApiSuccess(response.data as Map<String, dynamic>);
    } catch (e) {
      return ApiFailure(ApiError.fromDioException(e));
    }
  }

  /// Ajoute des tuteurs à un élève.
  Future<ApiResult<Map<String, dynamic>>> addGuardians(
    String studentId,
    List<Map<String, dynamic>> guardians,
  ) async {
    try {
      final response = await ApiClient.instance.post(
        ApiConfig.studentGuardians(studentId),
        data: {'guardians': guardians},
      );
      return ApiSuccess(response.data as Map<String, dynamic>);
    } catch (e) {
      return ApiFailure(ApiError.fromDioException(e));
    }
  }

  /// Finalise l'inscription d'un élève.
  Future<ApiResult<Map<String, dynamic>>> enrollStudent(
    String studentId,
    Map<String, dynamic> data,
  ) async {
    try {
      final response = await ApiClient.instance.post(
        ApiConfig.studentEnroll(studentId),
        data: data,
      );
      return ApiSuccess(response.data as Map<String, dynamic>);
    } catch (e) {
      return ApiFailure(ApiError.fromDioException(e));
    }
  }

  // ─── Cartes d'identité ──────────────────────────────────────────────────

  /// Statistiques des cartes d'identité.
  Future<ApiResult<Map<String, dynamic>>> getIdCardStats(
    String academicYearId,
  ) async {
    try {
      final response = await ApiClient.instance.get(
        ApiConfig.studentIdCardStats,
        queryParameters: {'academicYearId': academicYearId},
      );
      return ApiSuccess(response.data as Map<String, dynamic>);
    } catch (e) {
      return ApiFailure(ApiError.fromDioException(e));
    }
  }

  /// Génération par lot de cartes d'identité.
  Future<ApiResult<Map<String, dynamic>>> generateBulkIdCards({
    required String academicYearId,
    required String schoolLevelId,
  }) async {
    try {
      final response = await ApiClient.instance.post(
        ApiConfig.studentGenerateBulkIdCards,
        data: {
          'academicYearId': academicYearId,
          'schoolLevelId': schoolLevelId,
        },
      );
      return ApiSuccess(response.data as Map<String, dynamic>);
    } catch (e) {
      return ApiFailure(ApiError.fromDioException(e));
    }
  }

  /// Révoque une carte d'identité.
  Future<ApiResult<Map<String, dynamic>>> revokeIdCard(
    String id,
    String reason,
  ) async {
    try {
      final response = await ApiClient.instance.put(
        ApiConfig.studentRevokeIdCard(id),
        data: {'reason': reason},
      );
      return ApiSuccess(response.data as Map<String, dynamic>);
    } catch (e) {
      return ApiFailure(ApiError.fromDioException(e));
    }
  }

  // ─── Matricules ─────────────────────────────────────────────────────────

  /// Statistiques des matricules.
  Future<ApiResult<Map<String, dynamic>>> getMatriculeStats() async {
    try {
      final response = await ApiClient.instance.get(
        ApiConfig.studentIdentifiersStats,
      );
      return ApiSuccess(response.data as Map<String, dynamic>);
    } catch (e) {
      return ApiFailure(ApiError.fromDioException(e));
    }
  }

  /// Génération par lot de matricules.
  Future<ApiResult<Map<String, dynamic>>> generateBulkMatricules({
    required String academicYearId,
    required String schoolLevelId,
    String? status,
  }) async {
    try {
      final response = await ApiClient.instance.post(
        ApiConfig.studentGenerateBulkMatricules,
        data: {
          'academicYearId': academicYearId,
          'schoolLevelId': schoolLevelId,
          if (status != null) 'status': status,
        },
        queryParameters: {'countryCode': 'BJ'},
      );
      return ApiSuccess(response.data as Map<String, dynamic>);
    } catch (e) {
      return ApiFailure(ApiError.fromDioException(e));
    }
  }

  /// Génère un matricule individuel.
  Future<ApiResult<Map<String, dynamic>>> generateMatricule(
    String studentId,
  ) async {
    try {
      final response = await ApiClient.instance.post(
        ApiConfig.studentGenerateMatricule(studentId),
        queryParameters: {'countryCode': 'BJ'},
      );
      return ApiSuccess(response.data as Map<String, dynamic>);
    } catch (e) {
      return ApiFailure(ApiError.fromDioException(e));
    }
  }

  /// Recherche par matricule.
  Future<ApiResult<Map<String, dynamic>>> searchByMatricule(
    String matricule,
  ) async {
    try {
      final response = await ApiClient.instance.get(
        ApiConfig.studentSearchByMatricule(matricule),
      );
      return ApiSuccess(response.data as Map<String, dynamic>);
    } catch (e) {
      return ApiFailure(ApiError.fromDioException(e));
    }
  }

  // ─── Dossier & Historique ────────────────────────────────────────────────

  /// Récupère le dossier complet d'un élève.
  Future<ApiResult<Map<String, dynamic>>> getDossier(
    String id, {
    String? academicYearId,
  }) async {
    try {
      final response = await ApiClient.instance.get(
        ApiConfig.studentDossier(id),
        queryParameters: academicYearId != null
            ? {'academicYearId': academicYearId}
            : null,
      );
      return ApiSuccess(response.data as Map<String, dynamic>);
    } catch (e) {
      return ApiFailure(ApiError.fromDioException(e));
    }
  }

  /// Récupère l'historique d'un élève.
  Future<ApiResult<List<Map<String, dynamic>>>> getHistory(String id) async {
    try {
      final response = await ApiClient.instance.get(
        ApiConfig.studentHistory(id),
      );
      return ApiSuccess(
        (response.data as List).map((e) => e as Map<String, dynamic>).toList(),
      );
    } catch (e) {
      return ApiFailure(ApiError.fromDioException(e));
    }
  }

  /// Récupère le QR code de vérification.
  Future<ApiResult<Map<String, dynamic>>> getVerificationQR(
    String id,
    String academicYearId,
  ) async {
    try {
      final response = await ApiClient.instance.get(
        ApiConfig.studentVerificationQR(id),
        queryParameters: {'academicYearId': academicYearId},
      );
      return ApiSuccess(response.data as Map<String, dynamic>);
    } catch (e) {
      return ApiFailure(ApiError.fromDioException(e));
    }
  }

  /// Régénère le token de vérification.
  Future<ApiResult<Map<String, dynamic>>> regenerateVerificationQR(
    String id,
    String academicYearId,
  ) async {
    try {
      final response = await ApiClient.instance.post(
        ApiConfig.studentRegenerateQR(id),
        data: {'academicYearId': academicYearId},
      );
      return ApiSuccess(response.data as Map<String, dynamic>);
    } catch (e) {
      return ApiFailure(ApiError.fromDioException(e));
    }
  }

  // ─── Statistiques ───────────────────────────────────────────────────────

  /// Statistiques générales des élèves.
  Future<ApiResult<Map<String, dynamic>>> getStatistics(
    String academicYearId,
    String schoolLevelId,
  ) async {
    try {
      final response = await ApiClient.instance.get(
        ApiConfig.studentStatistics(academicYearId, schoolLevelId),
      );
      return ApiSuccess(response.data as Map<String, dynamic>);
    } catch (e) {
      return ApiFailure(ApiError.fromDioException(e));
    }
  }

  /// KPIs ORION pour les élèves.
  Future<ApiResult<Map<String, dynamic>>> getOrionKpis(
    String academicYearId,
  ) async {
    try {
      final response = await ApiClient.instance.get(
        ApiConfig.studentOrionKpis(academicYearId),
      );
      return ApiSuccess(response.data as Map<String, dynamic>);
    } catch (e) {
      return ApiFailure(ApiError.fromDioException(e));
    }
  }

  /// Alertes ORION pour les élèves.
  Future<ApiResult<List<Map<String, dynamic>>>> getOrionAlerts(
    String academicYearId,
  ) async {
    try {
      final response = await ApiClient.instance.get(
        ApiConfig.studentOrionAlerts(academicYearId),
      );
      return ApiSuccess(
        (response.data as List).map((e) => e as Map<String, dynamic>).toList(),
      );
    } catch (e) {
      return ApiFailure(ApiError.fromDioException(e));
    }
  }

  // ─── Photo ───────────────────────────────────────────────────────────────

  /// Upload la photo d'un élève.
  Future<ApiResult<Map<String, dynamic>>> uploadPhoto(
    String studentId,
    FormData formData,
  ) async {
    try {
      final response = await ApiClient.instance.post(
        ApiConfig.studentUploadPhoto(studentId),
        data: formData,
        options: Options(headers: {'Content-Type': 'multipart/form-data'}),
      );
      return ApiSuccess(response.data as Map<String, dynamic>);
    } catch (e) {
      return ApiFailure(ApiError.fromDioException(e));
    }
  }
}
