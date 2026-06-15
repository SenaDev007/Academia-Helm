/// ============================================================================
/// COMMUNICATION PROVIDER — Academia Hub Mobile
/// ============================================================================
///
/// Riverpod providers for the Communication module.
/// Uses [CommunicationService] for CRUD operations and returns [AsyncValue] states
/// that integrate seamlessly with [AsyncValueWidget] and [ModuleLoadingWrapper].
///
/// Providers:
/// - communicationServiceProvider     → Singleton for [CommunicationService]
/// - messagesProvider                 → List of messages
/// - messageDetailProvider            → Family by id
/// - announcementsProvider            → List of announcements
/// - smsHistoryProvider               → List of SMS history
/// - campaignsProvider                → List of campaigns
/// - templatesProvider                → List of templates
/// - CommunicationMutationNotifier    → send/create/update mutations
///
/// ============================================================================

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_result.dart';
import '../../../data/services/communication_service.dart';

// ─── Service Provider ────────────────────────────────────────────────────────

/// Singleton provider for [CommunicationService].
final communicationServiceProvider = Provider<CommunicationService>((ref) {
  return CommunicationService();
});

// ─── Messages Provider ───────────────────────────────────────────────────────

/// Fetches the list of messages (inbox).
final messagesProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final service = ref.read(communicationServiceProvider);
  final result = await service.getMessages();

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => [],
  );
});

// ─── Message Detail Provider ─────────────────────────────────────────────────

/// Fetches a single message by ID.
///
/// Usage:
/// ```dart
/// final messageAsync = ref.watch(messageDetailProvider(messageId));
/// ```
final messageDetailProvider =
    FutureProvider.family<Map<String, dynamic>, String>((ref, id) async {
  final service = ref.read(communicationServiceProvider);
  final result = await service.getMessageById(id);

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => <String, dynamic>{},
  );
});

// ─── Announcements Provider ──────────────────────────────────────────────────

/// Fetches the list of announcements.
final announcementsProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final service = ref.read(communicationServiceProvider);
  final result = await service.getAnnouncements();

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => [],
  );
});

// ─── SMS History Provider ────────────────────────────────────────────────────

/// Fetches the SMS history.
final smsHistoryProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final service = ref.read(communicationServiceProvider);
  final result = await service.getSmsHistory();

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => [],
  );
});

// ─── Campaigns Provider ──────────────────────────────────────────────────────

/// Fetches the list of campaigns.
final campaignsProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final service = ref.read(communicationServiceProvider);
  final result = await service.getCampaigns();

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => [],
  );
});

// ─── Templates Provider ──────────────────────────────────────────────────────

/// Fetches the list of communication templates.
final templatesProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final service = ref.read(communicationServiceProvider);
  final result = await service.getTemplates();

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => [],
  );
});

// ─── Mutation Notifier ───────────────────────────────────────────────────────

/// Notifier for communication CRUD mutations that automatically invalidates
/// relevant providers on success.
class CommunicationMutationNotifier extends StateNotifier<AsyncValue<void>> {
  final Ref _ref;
  final CommunicationService _service;

  CommunicationMutationNotifier(this._ref, this._service)
      : super(const AsyncValue.data(null));

  /// Sends a message and refreshes the list.
  Future<bool> sendMessage(Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.sendMessage(data);
      return result.when(
        success: (_) {
          _ref.invalidate(messagesProvider);
          state = const AsyncValue.data(null);
          return true;
        },
        failure: (error) {
          state = AsyncValue.error(
              Exception(error.displayMessage), StackTrace.current);
          return false;
        },
        loading: () => false,
      );
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }

  /// Creates an announcement and refreshes the list.
  Future<bool> createAnnouncement(Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.createAnnouncement(data);
      return result.when(
        success: (_) {
          _ref.invalidate(announcementsProvider);
          state = const AsyncValue.data(null);
          return true;
        },
        failure: (error) {
          state = AsyncValue.error(
              Exception(error.displayMessage), StackTrace.current);
          return false;
        },
        loading: () => false,
      );
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }

  /// Updates an announcement and refreshes the list.
  Future<bool> updateAnnouncement(
      String id, Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.updateAnnouncement(id, data);
      return result.when(
        success: (_) {
          _ref.invalidate(announcementsProvider);
          state = const AsyncValue.data(null);
          return true;
        },
        failure: (error) {
          state = AsyncValue.error(
              Exception(error.displayMessage), StackTrace.current);
          return false;
        },
        loading: () => false,
      );
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }

  /// Sends an email.
  Future<bool> sendEmail(Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.sendEmail(data);
      return result.when(
        success: (_) {
          state = const AsyncValue.data(null);
          return true;
        },
        failure: (error) {
          state = AsyncValue.error(
              Exception(error.displayMessage), StackTrace.current);
          return false;
        },
        loading: () => false,
      );
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }

  /// Sends an SMS.
  Future<bool> sendSms(Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.sendSms(data);
      return result.when(
        success: (_) {
          _ref.invalidate(smsHistoryProvider);
          state = const AsyncValue.data(null);
          return true;
        },
        failure: (error) {
          state = AsyncValue.error(
              Exception(error.displayMessage), StackTrace.current);
          return false;
        },
        loading: () => false,
      );
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }

  /// Sends a WhatsApp message.
  Future<bool> sendWhatsApp(Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.sendWhatsApp(data);
      return result.when(
        success: (_) {
          state = const AsyncValue.data(null);
          return true;
        },
        failure: (error) {
          state = AsyncValue.error(
              Exception(error.displayMessage), StackTrace.current);
          return false;
        },
        loading: () => false,
      );
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }

  /// Creates a campaign and refreshes the list.
  Future<bool> createCampaign(Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.createCampaign(data);
      return result.when(
        success: (_) {
          _ref.invalidate(campaignsProvider);
          state = const AsyncValue.data(null);
          return true;
        },
        failure: (error) {
          state = AsyncValue.error(
              Exception(error.displayMessage), StackTrace.current);
          return false;
        },
        loading: () => false,
      );
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }
}

/// Provider for communication mutation operations.
final communicationMutationProvider =
    StateNotifierProvider<CommunicationMutationNotifier, AsyncValue<void>>(
        (ref) {
  final service = ref.read(communicationServiceProvider);
  return CommunicationMutationNotifier(ref, service);
});
