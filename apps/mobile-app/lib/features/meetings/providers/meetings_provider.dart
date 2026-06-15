/// ============================================================================
/// MEETINGS PROVIDER — Academia Hub Mobile
/// ============================================================================
///
/// Riverpod providers for the Meetings (Réunions) module.
/// Uses [MeetingsService] for CRUD operations and returns [AsyncValue] states
/// that integrate seamlessly with [AsyncValueWidget] and [ModuleLoadingWrapper].
///
/// Providers:
/// - meetingsServiceProvider            → Singleton for [MeetingsService]
/// - upcomingMeetingsProvider           → List of upcoming meetings
/// - allMeetingsProvider                → List of all meetings
/// - meetingDetailProvider              → Family by id
/// - meetingAgendaProvider              → Family by meetingId
/// - meetingMinutesProvider             → Family by meetingId
/// - meetingParticipantsProvider        → Family by meetingId
/// - meetingDecisionsProvider           → Family by meetingId
/// - MeetingsMutationNotifier           → create/update/delete mutations
///
/// ============================================================================

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_result.dart';
import '../../../data/services/meetings_service.dart';

// ─── Service Provider ────────────────────────────────────────────────────────

/// Singleton provider for [MeetingsService].
final meetingsServiceProvider = Provider<MeetingsService>((ref) {
  return MeetingsService();
});

// ─── Upcoming Meetings Provider ──────────────────────────────────────────────

/// Fetches the list of upcoming meetings.
final upcomingMeetingsProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final service = ref.read(meetingsServiceProvider);
  final result = await service.getUpcoming();

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => [],
  );
});

// ─── All Meetings Provider ───────────────────────────────────────────────────

/// Fetches the list of all meetings.
final allMeetingsProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final service = ref.read(meetingsServiceProvider);
  final result = await service.getAll();

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => [],
  );
});

// ─── Meeting Detail Provider ─────────────────────────────────────────────────

/// Fetches a single meeting by ID.
///
/// Usage:
/// ```dart
/// final meetingAsync = ref.watch(meetingDetailProvider(meetingId));
/// ```
final meetingDetailProvider =
    FutureProvider.family<Map<String, dynamic>, String>((ref, id) async {
  final service = ref.read(meetingsServiceProvider);
  final result = await service.getById(id);

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => <String, dynamic>{},
  );
});

// ─── Meeting Agenda Provider ─────────────────────────────────────────────────

/// Fetches the agenda for a given meeting.
///
/// Usage:
/// ```dart
/// final agendaAsync = ref.watch(meetingAgendaProvider(meetingId));
/// ```
final meetingAgendaProvider =
    FutureProvider.family<List<Map<String, dynamic>>, String>(
        (ref, meetingId) async {
  final service = ref.read(meetingsServiceProvider);
  final result = await service.getAgenda(meetingId);

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => [],
  );
});

// ─── Meeting Minutes Provider ────────────────────────────────────────────────

/// Fetches the minutes for a given meeting.
///
/// Usage:
/// ```dart
/// final minutesAsync = ref.watch(meetingMinutesProvider(meetingId));
/// ```
final meetingMinutesProvider =
    FutureProvider.family<Map<String, dynamic>, String>(
        (ref, meetingId) async {
  final service = ref.read(meetingsServiceProvider);
  final result = await service.getMinutes(meetingId);

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => <String, dynamic>{},
  );
});

// ─── Meeting Participants Provider ───────────────────────────────────────────

/// Fetches the participants for a given meeting.
///
/// Usage:
/// ```dart
/// final participantsAsync = ref.watch(meetingParticipantsProvider(meetingId));
/// ```
final meetingParticipantsProvider =
    FutureProvider.family<List<Map<String, dynamic>>, String>(
        (ref, meetingId) async {
  final service = ref.read(meetingsServiceProvider);
  final result = await service.getParticipants(meetingId);

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => [],
  );
});

// ─── Meeting Decisions Provider ──────────────────────────────────────────────

/// Fetches the decisions for a given meeting.
///
/// Usage:
/// ```dart
/// final decisionsAsync = ref.watch(meetingDecisionsProvider(meetingId));
/// ```
final meetingDecisionsProvider =
    FutureProvider.family<List<Map<String, dynamic>>, String>(
        (ref, meetingId) async {
  final service = ref.read(meetingsServiceProvider);
  final result = await service.getDecisions(meetingId);

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => [],
  );
});

// ─── Mutation Notifier ───────────────────────────────────────────────────────

/// Notifier for meetings CRUD mutations that automatically invalidates
/// relevant providers on success.
class MeetingsMutationNotifier extends StateNotifier<AsyncValue<void>> {
  final Ref _ref;
  final MeetingsService _service;

  MeetingsMutationNotifier(this._ref, this._service)
      : super(const AsyncValue.data(null));

  /// Creates a meeting and refreshes the lists.
  Future<bool> createMeeting(Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.createMeeting(data);
      return result.when(
        success: (_) {
          _ref.invalidate(allMeetingsProvider);
          _ref.invalidate(upcomingMeetingsProvider);
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

  /// Updates a meeting and refreshes the lists.
  Future<bool> updateMeeting(String id, Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.updateMeeting(id, data);
      return result.when(
        success: (_) {
          _ref.invalidate(allMeetingsProvider);
          _ref.invalidate(upcomingMeetingsProvider);
          _ref.invalidate(meetingDetailProvider(id));
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

  /// Deletes a meeting and refreshes the lists.
  Future<bool> deleteMeeting(String id) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.deleteMeeting(id);
      return result.when(
        success: (_) {
          _ref.invalidate(allMeetingsProvider);
          _ref.invalidate(upcomingMeetingsProvider);
          _ref.invalidate(meetingDetailProvider(id));
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

  /// Updates the agenda for a meeting.
  Future<bool> updateAgenda(
      String meetingId, List<Map<String, dynamic>> items) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.updateAgenda(meetingId, items);
      return result.when(
        success: (_) {
          _ref.invalidate(meetingAgendaProvider(meetingId));
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

  /// Generates minutes for a meeting.
  Future<bool> generateMinutes(
      String meetingId, Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.generateMinutes(meetingId, data);
      return result.when(
        success: (_) {
          _ref.invalidate(meetingMinutesProvider(meetingId));
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

  /// Adds a participant to a meeting.
  Future<bool> addParticipant(
      String meetingId, Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.addParticipant(meetingId, data);
      return result.when(
        success: (_) {
          _ref.invalidate(meetingParticipantsProvider(meetingId));
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

  /// Removes a participant from a meeting.
  Future<bool> removeParticipant(
      String meetingId, String participantId) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.removeParticipant(meetingId, participantId);
      return result.when(
        success: (_) {
          _ref.invalidate(meetingParticipantsProvider(meetingId));
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

  /// Creates a decision for a meeting.
  Future<bool> createDecision(
      String meetingId, Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.createDecision(meetingId, data);
      return result.when(
        success: (_) {
          _ref.invalidate(meetingDecisionsProvider(meetingId));
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

/// Provider for meetings mutation operations.
final meetingsMutationProvider =
    StateNotifierProvider<MeetingsMutationNotifier, AsyncValue<void>>((ref) {
  final service = ref.read(meetingsServiceProvider);
  return MeetingsMutationNotifier(ref, service);
});
