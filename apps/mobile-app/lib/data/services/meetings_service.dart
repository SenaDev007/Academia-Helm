/// ============================================================================
/// MEETINGS SERVICE — Academia Hub Mobile
/// ============================================================================
///
/// Service CRUD pour le module Réunions.
/// Miroir des services meetings du web app.
///
/// Méthodes :
/// - getUpcoming, getAll, createMeeting, updateMeeting, deleteMeeting
/// - getAgenda, updateAgenda (Ordre du jour)
/// - getMinutes, generateMinutes (Procès-verbal)
/// - getParticipants, addParticipant, removeParticipant (Participants)
/// - getDecisions, createDecision (Décisions)
/// ============================================================================

import '../../core/crud/base_crud_service.dart';
import '../../core/network/api_config.dart';
import '../../core/network/api_result.dart';
import '../../core/network/api_client.dart';
import '../../core/offline/offline_service.dart';

class MeetingsService extends BaseCrudService {
  MeetingsService()
      : super(
          endpoint: ApiConfig.meetings,
          collection: 'meetings',
          entityType: SyncEntityType.meeting,
        );

  // ─── Réunions ────────────────────────────────────────────────────────────

  /// Récupère les réunions à venir.
  Future<ApiResult<List<Map<String, dynamic>>>> getUpcoming({
    Map<String, dynamic>? params,
  }) async {
    return apiGetWithFallback(
      ApiConfig.meetings,
      params: {'status': 'UPCOMING', ...?params},
      localCollection: 'meetings',
    );
  }

  /// Récupère toutes les réunions.
  Future<ApiResult<List<Map<String, dynamic>>>> getAll({
    Map<String, dynamic>? params,
  }) async {
    return apiGetWithFallback(
      ApiConfig.meetings,
      params: params,
      localCollection: 'meetings',
    );
  }

  /// Récupère une réunion par ID.
  Future<ApiResult<Map<String, dynamic>>> getById(String id) async {
    try {
      return ApiClient.instance.getRaw(
        ApiConfig.meetingById(id),
      );
    } catch (e) {
      // Fallback local
      final local = await super.getById(id);
      return local;
    }
  }

  /// Crée une réunion.
  Future<ApiResult<Map<String, dynamic>>> createMeeting(
    Map<String, dynamic> data,
  ) async {
    return apiPostWithOfflineFallback(
      ApiConfig.meetings,
      data,
      offlineEntityType: SyncEntityType.meeting,
    );
  }

  /// Met à jour une réunion.
  Future<ApiResult<Map<String, dynamic>>> updateMeeting(
    String id,
    Map<String, dynamic> data,
  ) async {
    return apiUpdateWithOfflineFallback(
      ApiConfig.meetingById(id),
      id,
      data,
      offlineEntityType: SyncEntityType.meeting,
    );
  }

  /// Supprime une réunion.
  Future<ApiResult<void>> deleteMeeting(String id) async {
    return apiDeleteWithOfflineFallback(
      ApiConfig.meetingById(id),
      id,
      offlineEntityType: SyncEntityType.meeting,
    );
  }

  // ─── Ordre du jour ───────────────────────────────────────────────────────

  /// Récupère l'ordre du jour d'une réunion.
  Future<ApiResult<List<Map<String, dynamic>>>> getAgenda(
    String meetingId,
  ) async {
    try {
      final result = await ApiClient.instance.getRaw(
        ApiConfig.meetingAgenda(meetingId),
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

  /// Met à jour l'ordre du jour d'une réunion.
  Future<ApiResult<Map<String, dynamic>>> updateAgenda(
    String meetingId,
    List<Map<String, dynamic>> items,
  ) async {
    return ApiClient.instance.put(
      ApiConfig.meetingAgenda(meetingId),
      data: {'items': items},
      fromJson: (json) => json,
    );
  }

  // ─── Procès-verbal ───────────────────────────────────────────────────────

  /// Récupère le procès-verbal d'une réunion.
  Future<ApiResult<Map<String, dynamic>>> getMinutes(
    String meetingId,
  ) async {
    return ApiClient.instance.getRaw(
      ApiConfig.meetingMinutes(meetingId),
    );
  }

  /// Génère le procès-verbal d'une réunion.
  Future<ApiResult<Map<String, dynamic>>> generateMinutes(
    String meetingId,
    Map<String, dynamic> data,
  ) async {
    return ApiClient.instance.postRaw(
      ApiConfig.meetingMinutes(meetingId),
      data: data,
    );
  }

  // ─── Participants ────────────────────────────────────────────────────────

  /// Récupère les participants d'une réunion.
  Future<ApiResult<List<Map<String, dynamic>>>> getParticipants(
    String meetingId,
  ) async {
    try {
      final result = await ApiClient.instance.getRaw(
        ApiConfig.meetingParticipants(meetingId),
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

  /// Ajoute un participant à une réunion.
  Future<ApiResult<Map<String, dynamic>>> addParticipant(
    String meetingId,
    Map<String, dynamic> data,
  ) async {
    return ApiClient.instance.postRaw(
      ApiConfig.meetingParticipants(meetingId),
      data: data,
    );
  }

  /// Retire un participant d'une réunion.
  Future<ApiResult<void>> removeParticipant(
    String meetingId,
    String participantId,
  ) async {
    try {
      final result = await ApiClient.instance.delete(
        '${ApiConfig.meetingParticipants(meetingId)}/$participantId',
        fromJson: (json) => json,
      );
      return result.when(
        success: (_) => const ApiSuccess(null),
        failure: (error) => ApiFailure(error),
        loading: () => const ApiResult.loading(),
      );
    } catch (e) {
      return ApiFailure(ApiError.fromDioException(e));
    }
  }

  // ─── Décisions ───────────────────────────────────────────────────────────

  /// Récupère les décisions d'une réunion.
  Future<ApiResult<List<Map<String, dynamic>>>> getDecisions(
    String meetingId,
  ) async {
    try {
      final result = await ApiClient.instance.getRaw(
        ApiConfig.meetingDecisions(meetingId),
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

  /// Crée une décision pour une réunion.
  Future<ApiResult<Map<String, dynamic>>> createDecision(
    String meetingId,
    Map<String, dynamic> data,
  ) async {
    return ApiClient.instance.postRaw(
      ApiConfig.meetingDecisions(meetingId),
      data: data,
    );
  }
}
