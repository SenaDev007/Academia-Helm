/// ============================================================================
/// COMMUNICATION SERVICE — Academia Hub Mobile
/// ============================================================================
///
/// Service CRUD pour le module Communication, miroir du web app
/// (communication.service.ts).
///
/// Étend [BaseCrudService] et fournit les méthodes spécifiques au module :
/// - CRUD de base (getAll, create, update, delete)
/// - Messages internes (Internal Messages) avec CRUD
/// - Annonces (Announcements) avec CRUD
/// - Emails
/// - SMS
/// - WhatsApp
/// - Templates
/// - Campagnes (Campaigns)
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

class CommunicationService extends BaseCrudService {
  // ─── Singleton ────────────────────────────────────────────────────────────

  static CommunicationService? _instance;

  /// Instance singleton du service.
  static CommunicationService get instance =>
      _instance ??= CommunicationService._();

  CommunicationService._() : super(
    endpoint: ApiConfig.communication,
    collection: 'communication',
    entityType: SyncEntityType.message,
  );

  // ─── CRUD de base ────────────────────────────────────────────────────────

  /// Récupère toutes les entités communication avec filtres optionnels.
  ///
  /// Miroir de `communicationService.getAll()` du web app.
  Future<ApiResult<List<Map<String, dynamic>>>> getAll({
    Map<String, dynamic>? params,
  }) => super.getAll(params: params);

  /// Crée une nouvelle entité communication.
  ///
  /// Miroir de `communicationService.create(data)` du web app.
  /// Hors ligne → outbox pattern (SyncEntityType.message).
  Future<ApiResult<Map<String, dynamic>>> create(
    Map<String, dynamic> data,
  ) => super.create(data);

  /// Met à jour une entité communication existante.
  ///
  /// Miroir de `communicationService.update(id, data)` du web app.
  /// Hors ligne → outbox pattern.
  Future<ApiResult<Map<String, dynamic>>> update(
    String id,
    Map<String, dynamic> data,
  ) => super.update(id, data);

  /// Supprime une entité communication.
  ///
  /// Miroir de `communicationService.delete(id)` du web app.
  /// Hors ligne → soft delete + outbox pattern.
  Future<ApiResult<void>> delete(String id) => super.delete(id);

  // ─── Messages internes ───────────────────────────────────────────────────

  /// Récupère tous les messages internes.
  ///
  /// Miroir de `communicationService.getMessages()` du web app.
  Future<ApiResult<List<Map<String, dynamic>>>> getMessages({
    Map<String, dynamic>? params,
  }) =>
      apiGetWithFallback<List<Map<String, dynamic>>>(
        ApiConfig.communicationMessages,
        params: params,
        localCollection: 'communication',
        localFilters: {'type': 'message'},
      );

  /// Crée un nouveau message interne.
  ///
  /// Miroir de `communicationService.createMessage(data)` du web app.
  /// Hors ligne → outbox pattern.
  Future<ApiResult<Map<String, dynamic>>> createMessage(
    Map<String, dynamic> data,
  ) =>
      apiPostWithOfflineFallback<Map<String, dynamic>>(
        ApiConfig.communicationMessages,
        data,
        offlineEntityType: SyncEntityType.message,
      );

  // ─── Annonces (Announcements) ────────────────────────────────────────────

  /// Récupère toutes les annonces.
  ///
  /// Miroir de `communicationService.getAnnouncements()` du web app.
  Future<ApiResult<List<Map<String, dynamic>>>> getAnnouncements({
    Map<String, dynamic>? params,
  }) =>
      apiGetWithFallback<List<Map<String, dynamic>>>(
        ApiConfig.communicationAnnouncements,
        params: params,
        localCollection: 'communication',
        localFilters: {'type': 'announcement'},
      );

  /// Crée une nouvelle annonce.
  ///
  /// Miroir de `communicationService.createAnnouncement(data)` du web app.
  /// Hors ligne → outbox pattern.
  Future<ApiResult<Map<String, dynamic>>> createAnnouncement(
    Map<String, dynamic> data,
  ) =>
      apiPostWithOfflineFallback<Map<String, dynamic>>(
        ApiConfig.communicationAnnouncements,
        data,
        offlineEntityType: SyncEntityType.announcement,
      );

  // ─── Emails ──────────────────────────────────────────────────────────────

  /// Récupère tous les emails.
  ///
  /// Miroir de `communicationService.getEmails()` du web app.
  Future<ApiResult<List<Map<String, dynamic>>>> getEmails({
    Map<String, dynamic>? params,
  }) =>
      apiGetWithFallback<List<Map<String, dynamic>>>(
        ApiConfig.communicationEmails,
        params: params,
        localCollection: 'communication',
        localFilters: {'type': 'email'},
      );

  // ─── SMS ─────────────────────────────────────────────────────────────────

  /// Récupère tous les SMS.
  ///
  /// Miroir de `communicationService.getSms()` du web app.
  Future<ApiResult<List<Map<String, dynamic>>>> getSms({
    Map<String, dynamic>? params,
  }) =>
      apiGetWithFallback<List<Map<String, dynamic>>>(
        ApiConfig.communicationSms,
        params: params,
        localCollection: 'communication',
        localFilters: {'type': 'sms'},
      );

  // ─── WhatsApp ────────────────────────────────────────────────────────────

  /// Récupère tous les messages WhatsApp.
  ///
  /// Miroir de `communicationService.getWhatsApp()` du web app.
  Future<ApiResult<List<Map<String, dynamic>>>> getWhatsApp({
    Map<String, dynamic>? params,
  }) =>
      apiGetWithFallback<List<Map<String, dynamic>>>(
        ApiConfig.communicationWhatsApp,
        params: params,
        localCollection: 'communication',
        localFilters: {'type': 'whatsapp'},
      );

  // ─── Templates ───────────────────────────────────────────────────────────

  /// Récupère tous les templates de communication.
  ///
  /// Miroir de `communicationService.getTemplates()` du web app.
  Future<ApiResult<List<Map<String, dynamic>>>> getTemplates({
    Map<String, dynamic>? params,
  }) =>
      apiGetWithFallback<List<Map<String, dynamic>>>(
        ApiConfig.communicationTemplates,
        params: params,
        localCollection: 'communication',
        localFilters: {'type': 'template'},
      );

  // ─── Campagnes (Campaigns) ───────────────────────────────────────────────

  /// Récupère toutes les campagnes de communication.
  ///
  /// Miroir de `communicationService.getCampaigns()` du web app.
  Future<ApiResult<List<Map<String, dynamic>>>> getCampaigns({
    Map<String, dynamic>? params,
  }) =>
      apiGetWithFallback<List<Map<String, dynamic>>>(
        ApiConfig.communicationCampaigns,
        params: params,
        localCollection: 'communication',
        localFilters: {'type': 'campaign'},
      );
}
