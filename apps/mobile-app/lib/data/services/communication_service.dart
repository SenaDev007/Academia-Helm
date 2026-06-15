/// ============================================================================
/// COMMUNICATION SERVICE — Academia Hub Mobile
/// ============================================================================
///
/// Service CRUD pour le module Communication.
/// Miroir des services communication du web app.
///
/// Méthodes :
/// - getMessages, sendMessage, getMessageById (Messages internes)
/// - getAnnouncements, createAnnouncement (Annonces)
/// - sendEmail, getSmsHistory (Emails & SMS)
/// - createCampaign, getCampaigns (Campagnes)
/// ============================================================================

import '../../core/crud/base_crud_service.dart';
import '../../core/network/api_config.dart';
import '../../core/network/api_result.dart';
import '../../core/network/api_client.dart';
import '../../core/offline/offline_service.dart';

class CommunicationService extends BaseCrudService {
  CommunicationService()
      : super(
          endpoint: ApiConfig.communication,
          collection: 'messages',
          entityType: SyncEntityType.message,
        );

  // ─── Messages internes ───────────────────────────────────────────────────

  /// Récupère la liste des messages (boîte de réception).
  Future<ApiResult<List<Map<String, dynamic>>>> getMessages({
    Map<String, dynamic>? params,
  }) async {
    return apiGetWithFallback(
      ApiConfig.communicationMessages,
      params: params,
      localCollection: 'messages',
    );
  }

  /// Récupère un message par ID.
  Future<ApiResult<Map<String, dynamic>>> getMessageById(String id) async {
    try {
      return ApiClient.instance.getRaw(
        ApiConfig.communicationMessageById(id),
      );
    } catch (e) {
      // Fallback local
      final local = await getById(id);
      return local;
    }
  }

  /// Envoie un message.
  Future<ApiResult<Map<String, dynamic>>> sendMessage(
    Map<String, dynamic> data,
  ) async {
    return apiPostWithOfflineFallback(
      ApiConfig.communicationMessages,
      data,
      offlineEntityType: SyncEntityType.message,
    );
  }

  // ─── Annonces ────────────────────────────────────────────────────────────

  /// Récupère la liste des annonces.
  Future<ApiResult<List<Map<String, dynamic>>>> getAnnouncements({
    Map<String, dynamic>? params,
  }) async {
    return apiGetWithFallback(
      ApiConfig.communicationAnnouncements,
      params: params,
      localCollection: 'announcements',
    );
  }

  /// Crée une annonce.
  Future<ApiResult<Map<String, dynamic>>> createAnnouncement(
    Map<String, dynamic> data,
  ) async {
    return apiPostWithOfflineFallback(
      ApiConfig.communicationAnnouncements,
      data,
      offlineEntityType: SyncEntityType.announcement,
    );
  }

  /// Met à jour une annonce.
  Future<ApiResult<Map<String, dynamic>>> updateAnnouncement(
    String id,
    Map<String, dynamic> data,
  ) async {
    return apiUpdateWithOfflineFallback(
      ApiConfig.communicationAnnouncementById(id),
      id,
      data,
      offlineEntityType: SyncEntityType.announcement,
    );
  }

  // ─── Emails ──────────────────────────────────────────────────────────────

  /// Envoie un email.
  Future<ApiResult<Map<String, dynamic>>> sendEmail(
    Map<String, dynamic> data,
  ) async {
    return ApiClient.instance.postRaw(
      ApiConfig.communicationEmails,
      data: data,
    );
  }

  // ─── SMS ─────────────────────────────────────────────────────────────────

  /// Envoie un SMS.
  Future<ApiResult<Map<String, dynamic>>> sendSms(
    Map<String, dynamic> data,
  ) async {
    return ApiClient.instance.postRaw(
      ApiConfig.communicationSms,
      data: data,
    );
  }

  /// Récupère l'historique SMS.
  Future<ApiResult<List<Map<String, dynamic>>>> getSmsHistory({
    Map<String, dynamic>? params,
  }) async {
    try {
      final result = await ApiClient.instance.getRaw(
        ApiConfig.communicationSms,
        queryParameters: params,
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

  // ─── WhatsApp ────────────────────────────────────────────────────────────

  /// Envoie un message WhatsApp.
  Future<ApiResult<Map<String, dynamic>>> sendWhatsApp(
    Map<String, dynamic> data,
  ) async {
    return ApiClient.instance.postRaw(
      ApiConfig.communicationWhatsApp,
      data: data,
    );
  }

  // ─── Campagnes ───────────────────────────────────────────────────────────

  /// Récupère la liste des campagnes.
  Future<ApiResult<List<Map<String, dynamic>>>> getCampaigns({
    Map<String, dynamic>? params,
  }) async {
    try {
      final result = await ApiClient.instance.getRaw(
        ApiConfig.communicationCampaigns,
        queryParameters: params,
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

  /// Crée une campagne de communication.
  Future<ApiResult<Map<String, dynamic>>> createCampaign(
    Map<String, dynamic> data,
  ) async {
    return apiPostWithOfflineFallback(
      ApiConfig.communicationCampaigns,
      data,
      offlineEntityType: SyncEntityType.campaign,
    );
  }

  // ─── Templates ───────────────────────────────────────────────────────────

  /// Récupère les templates de communication.
  Future<ApiResult<List<Map<String, dynamic>>>> getTemplates({
    Map<String, dynamic>? params,
  }) async {
    try {
      final result = await ApiClient.instance.getRaw(
        ApiConfig.communicationTemplates,
        queryParameters: params,
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
}
