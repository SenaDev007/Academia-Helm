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

import 'package:dio/dio.dart';

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
    return ApiClient.instance.postRaw(
      ApiConfig.studentAdmissionSubmit(id),
    );
  }

  /// Prend une décision sur une admission (ACCEPTED / REJECTED).
  Future<ApiResult<Map<String, dynamic>>> decideAdmission(
    String id, {
    required String decision,
    required String comment,
  }) async {
    return ApiClient.instance.postRaw(
      ApiConfig.studentAdmissionDecide(id),
      data: {'decision': decision, 'comment': comment},
    );
  }

  /// Convertit une admission en inscription.
  Future<ApiResult<Map<String, dynamic>>> convertAdmission(String id) async {
    return ApiClient.instance.postRaw(
      ApiConfig.studentAdmissionConvert(id),
    );
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
    return ApiClient.instance.postRaw(
      ApiConfig.studentPreRegister,
      data: data,
    );
  }

  /// Ajoute des tuteurs à un élève.
  Future<ApiResult<Map<String, dynamic>>> addGuardians(
    String studentId,
    List<Map<String, dynamic>> guardians,
  ) async {
    return ApiClient.instance.postRaw(
      ApiConfig.studentGuardians(studentId),
      data: {'guardians': guardians},
    );
  }

  /// Finalise l'inscription d'un élève.
  Future<ApiResult<Map<String, dynamic>>> enrollStudent(
    String studentId,
    Map<String, dynamic> data,
  ) async {
    return ApiClient.instance.postRaw(
      ApiConfig.studentEnroll(studentId),
      data: data,
    );
  }

  // ─── Cartes d'identité ──────────────────────────────────────────────────

  /// Statistiques des cartes d'identité.
  Future<ApiResult<Map<String, dynamic>>> getIdCardStats(
    String academicYearId,
  ) async {
    return ApiClient.instance.getRaw(
      ApiConfig.studentIdCardStats,
      queryParameters: {'academicYearId': academicYearId},
    );
  }

  /// Génération par lot de cartes d'identité.
  Future<ApiResult<Map<String, dynamic>>> generateBulkIdCards({
    required String academicYearId,
    required String schoolLevelId,
  }) async {
    return ApiClient.instance.postRaw(
      ApiConfig.studentGenerateBulkIdCards,
      data: {
        'academicYearId': academicYearId,
        'schoolLevelId': schoolLevelId,
      },
    );
  }

  /// Révoque une carte d'identité.
  Future<ApiResult<Map<String, dynamic>>> revokeIdCard(
    String id,
    String reason,
  ) async {
    return ApiClient.instance.put(
      ApiConfig.studentRevokeIdCard(id),
      data: {'reason': reason},
      fromJson: (json) => json,
    );
  }

  // ─── Matricules ─────────────────────────────────────────────────────────

  /// Statistiques des matricules.
  Future<ApiResult<Map<String, dynamic>>> getMatriculeStats() async {
    return ApiClient.instance.getRaw(
      ApiConfig.studentIdentifiersStats,
    );
  }

  /// Génération par lot de matricules.
  Future<ApiResult<Map<String, dynamic>>> generateBulkMatricules({
    required String academicYearId,
    required String schoolLevelId,
    String? status,
  }) async {
    return ApiClient.instance.postRaw(
      ApiConfig.studentGenerateBulkMatricules,
      data: {
        'academicYearId': academicYearId,
        'schoolLevelId': schoolLevelId,
        if (status != null) 'status': status,
      },
      queryParameters: {'countryCode': 'BJ'},
    );
  }

  /// Génère un matricule individuel.
  Future<ApiResult<Map<String, dynamic>>> generateMatricule(
    String studentId,
  ) async {
    return ApiClient.instance.postRaw(
      ApiConfig.studentGenerateMatricule(studentId),
      queryParameters: {'countryCode': 'BJ'},
    );
  }

  /// Recherche par matricule.
  Future<ApiResult<Map<String, dynamic>>> searchByMatricule(
    String matricule,
  ) async {
    return ApiClient.instance.getRaw(
      ApiConfig.studentSearchByMatricule(matricule),
    );
  }

  // ─── Dossier & Historique ────────────────────────────────────────────────

  /// Récupère le dossier complet d'un élève.
  Future<ApiResult<Map<String, dynamic>>> getDossier(
    String id, {
    String? academicYearId,
  }) async {
    return ApiClient.instance.getRaw(
      ApiConfig.studentDossier(id),
      queryParameters: academicYearId != null
          ? {'academicYearId': academicYearId}
          : null,
    );
  }

  /// Récupère l'historique d'un élève.
  Future<ApiResult<List<Map<String, dynamic>>>> getHistory(String id) async {
    try {
      final result = await ApiClient.instance.getRaw(
        ApiConfig.studentHistory(id),
      );
      return result.when(
        success: (data) {
          if (data.containsKey('data') && data['data'] is List) {
            return ApiSuccess(
              (data['data'] as List)
                  .map((e) => e as Map<String, dynamic>)
                  .toList(),
            );
          }
          return ApiSuccess([data]);
        },
        failure: (error) => ApiFailure(error),
        loading: () => const ApiResult.loading(),
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
    return ApiClient.instance.getRaw(
      ApiConfig.studentVerificationQR(id),
      queryParameters: {'academicYearId': academicYearId},
    );
  }

  /// Régénère le token de vérification.
  Future<ApiResult<Map<String, dynamic>>> regenerateVerificationQR(
    String id,
    String academicYearId,
  ) async {
    return ApiClient.instance.postRaw(
      ApiConfig.studentRegenerateQR(id),
      data: {'academicYearId': academicYearId},
    );
  }

  // ─── Statistiques ───────────────────────────────────────────────────────

  /// Statistiques générales des élèves.
  Future<ApiResult<Map<String, dynamic>>> getStatistics(
    String academicYearId,
    String schoolLevelId,
  ) async {
    return ApiClient.instance.getRaw(
      ApiConfig.studentStatistics(academicYearId, schoolLevelId),
    );
  }

  /// KPIs ORION pour les élèves.
  Future<ApiResult<Map<String, dynamic>>> getOrionKpis(
    String academicYearId,
  ) async {
    return ApiClient.instance.getRaw(
      ApiConfig.studentOrionKpis(academicYearId),
    );
  }

  /// Alertes ORION pour les élèves.
  Future<ApiResult<List<Map<String, dynamic>>>> getOrionAlerts(
    String academicYearId,
  ) async {
    try {
      final result = await ApiClient.instance.getRaw(
        ApiConfig.studentOrionAlerts(academicYearId),
      );
      return result.when(
        success: (data) {
          if (data.containsKey('data') && data['data'] is List) {
            return ApiSuccess(
              (data['data'] as List)
                  .map((e) => e as Map<String, dynamic>)
                  .toList(),
            );
          }
          return ApiSuccess([data]);
        },
        failure: (error) => ApiFailure(error),
        loading: () => const ApiResult.loading(),
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
    return ApiClient.instance.postRaw(
      ApiConfig.studentUploadPhoto(studentId),
      data: formData,
    );
  }
}
