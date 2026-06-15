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
      final response = await ApiClient.instance.get(
        ApiConfig.communicationMessageById(id),
      );
      return ApiSuccess(response.data as Map<String, dynamic>);
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
    try {
      final response = await ApiClient.instance.post(
        ApiConfig.communicationEmails,
        data: data,
      );
      return ApiSuccess(response.data as Map<String, dynamic>);
    } catch (e) {
      return ApiFailure(ApiError.fromDioException(e));
    }
  }

  // ─── SMS ─────────────────────────────────────────────────────────────────

  /// Envoie un SMS.
  Future<ApiResult<Map<String, dynamic>>> sendSms(
    Map<String, dynamic> data,
  ) async {
    try {
      final response = await ApiClient.instance.post(
        ApiConfig.communicationSms,
        data: data,
      );
      return ApiSuccess(response.data as Map<String, dynamic>);
    } catch (e) {
      return ApiFailure(ApiError.fromDioException(e));
    }
  }

  /// Récupère l'historique SMS.
  Future<ApiResult<List<Map<String, dynamic>>>> getSmsHistory({
    Map<String, dynamic>? params,
  }) async {
    try {
      final response = await ApiClient.instance.get(
        ApiConfig.communicationSms,
        queryParameters: params,
      );
      return ApiSuccess(
        (response.data as List).map((e) => e as Map<String, dynamic>).toList(),
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
    try {
      final response = await ApiClient.instance.post(
        ApiConfig.communicationWhatsApp,
        data: data,
      );
      return ApiSuccess(response.data as Map<String, dynamic>);
    } catch (e) {
      return ApiFailure(ApiError.fromDioException(e));
    }
  }

  // ─── Campagnes ───────────────────────────────────────────────────────────

  /// Récupère la liste des campagnes.
  Future<ApiResult<List<Map<String, dynamic>>>> getCampaigns({
    Map<String, dynamic>? params,
  }) async {
    try {
      final response = await ApiClient.instance.get(
        ApiConfig.communicationCampaigns,
        queryParameters: params,
      );
      return ApiSuccess(
        (response.data as List).map((e) => e as Map<String, dynamic>).toList(),
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
      final response = await ApiClient.instance.get(
        ApiConfig.communicationTemplates,
        queryParameters: params,
      );
      return ApiSuccess(
        (response.data as List).map((e) => e as Map<String, dynamic>).toList(),
      );
    } catch (e) {
      return ApiFailure(ApiError.fromDioException(e));
    }
  }
}
