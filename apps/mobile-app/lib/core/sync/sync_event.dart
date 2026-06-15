/// ============================================================================
/// SYNC EVENT TYPES — Academia Hub Mobile
/// ============================================================================
///
/// Defines the event types used by the real-time synchronization system.
/// These events are dispatched when the backend pushes configuration changes,
/// and consumed by the ConfigService to refresh the local state.
///
/// Event flow:
///   Backend → WebSocket/SSE → RealtimeSync → SyncEvent → ConfigService → UI
/// ============================================================================

// ─── Sync Event Type ─────────────────────────────────────────────────────────

/// The type of synchronization event received from the backend.
enum SyncEventType {
  /// Feature flags have been updated (enabled/disabled).
  featuresUpdated,

  /// User roles or permissions have changed.
  rolesUpdated,

  /// Module configuration has changed (added, removed, reordered).
  modulesUpdated,

  /// Tenant-level settings have been updated (school info, colors, locale).
  tenantUpdated,

  /// The active academic year has changed.
  academicYearChanged,

  /// Offline sync has completed — queued mutations have been replayed.
  offlineSyncComplete,

  /// Connection to the real-time sync service has been established.
  connected,

  /// Connection to the real-time sync service has been lost.
  disconnected,

  /// A full configuration refresh is needed (e.g., after reconnection).
  fullSyncRequired,
}

// ─── Sync Event ──────────────────────────────────────────────────────────────

/// Represents a single synchronization event from the backend.
///
/// Events carry an optional [data] payload with details about what changed.
/// For example, a [featuresUpdated] event might include the list of newly
/// enabled feature codes.
class SyncEvent {
  /// The type of event.
  final SyncEventType type;

  /// Optional data payload from the backend.
  /// Structure depends on the event type:
  ///   - featuresUpdated: { "codes": ["FINANCE", "MESSAGING"] }
  ///   - rolesUpdated: { "roleCodes": ["SCHOOL_ADMIN"] }
  ///   - modulesUpdated: { "moduleIds": ["students", "grades"] }
  ///   - tenantUpdated: { "tenantId": "..." }
  ///   - academicYearChanged: { "yearId": "...", "label": "..." }
  ///   - offlineSyncComplete: { "replayed": 5, "failed": 0 }
  final Map<String, dynamic>? data;

  /// Timestamp when the event was received locally.
  final DateTime timestamp;

  /// Optional message describing the event (for logging / debugging).
  final String? message;

  const SyncEvent({
    required this.type,
    this.data,
    DateTime? timestamp,
    this.message,
  }) : timestamp = timestamp ?? _defaultTimestamp;

  static final DateTime _defaultTimestamp = DateTime(2000, 1, 1);

  /// Creates a SyncEvent from a WebSocket/SSE JSON payload.
  factory SyncEvent.fromJson(Map<String, dynamic> json) {
    return SyncEvent(
      type: _parseEventType(json['type'] as String? ?? ''),
      data: json['data'] as Map<String, dynamic>?,
      message: json['message'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'type': type.name,
        'data': data,
        'timestamp': timestamp.toIso8601String(),
        'message': message,
      };

  @override
  String toString() =>
      'SyncEvent(type: $type, message: $message, timestamp: $timestamp)';

  // ─── Event Type Parsing ────────────────────────────────────────────────────

  /// Parses the event type string from the backend into a SyncEventType.
  ///
  /// The backend sends events with string identifiers like:
  ///   - "settings:features-updated"
  ///   - "settings:roles-updated"
  ///   - "settings:modules-updated"
  ///   - "tenant:updated"
  ///   - "academic-year:changed"
  static SyncEventType _parseEventType(String type) {
    // Normalize: remove prefix, convert hyphens to camelCase
    final normalized = type
        .split(':')
        .last
        .split('-')
        .asMap()
        .map((i, part) => MapEntry(
            i, i == 0 ? part : '${part[0].toUpperCase()}${part.substring(1)}'))
        .values
        .join('');

    switch (normalized) {
      case 'featuresUpdated':
        return SyncEventType.featuresUpdated;
      case 'rolesUpdated':
        return SyncEventType.rolesUpdated;
      case 'modulesUpdated':
        return SyncEventType.modulesUpdated;
      case 'tenantUpdated':
        return SyncEventType.tenantUpdated;
      case 'academicYearChanged':
        return SyncEventType.academicYearChanged;
      case 'offlineSyncComplete':
        return SyncEventType.offlineSyncComplete;
      case 'connected':
        return SyncEventType.connected;
      case 'disconnected':
        return SyncEventType.disconnected;
      case 'fullSyncRequired':
        return SyncEventType.fullSyncRequired;
      default:
        // Unknown event type — default to full sync to be safe
        return SyncEventType.fullSyncRequired;
    }
  }
}

// ─── Sync Connection State ───────────────────────────────────────────────────

/// The current state of the real-time synchronization connection.
enum SyncConnectionState {
  /// Not connected and not attempting to connect.
  disconnected,

  /// Currently attempting to connect.
  connecting,

  /// Connected and receiving events.
  connected,

  /// Connection was lost, waiting before reconnect attempt.
  reconnecting,

  /// Falling back to polling because WebSocket is unavailable.
  polling,
}

// ─── Sync Status ─────────────────────────────────────────────────────────────

/// Overall status of the synchronization system, exposed to the UI layer.
class SyncStatus {
  final SyncConnectionState connectionState;
  final DateTime? lastSyncTime;
  final bool isOffline;
  final int pendingMutations;
  final String? lastError;

  const SyncStatus({
    this.connectionState = SyncConnectionState.disconnected,
    this.lastSyncTime,
    this.isOffline = false,
    this.pendingMutations = 0,
    this.lastError,
  });

  /// Whether the app is currently synced with the backend.
  bool get isSynced =>
      connectionState == SyncConnectionState.connected && !isOffline;

  /// Human-readable description of the current sync state (en français).
  String get description {
    if (isOffline) return 'Mode hors ligne';
    switch (connectionState) {
      case SyncConnectionState.disconnected:
        return 'Déconnecté';
      case SyncConnectionState.connecting:
        return 'Connexion en cours…';
      case SyncConnectionState.connected:
        return 'Synchronisé';
      case SyncConnectionState.reconnecting:
        return 'Reconnexion en cours…';
      case SyncConnectionState.polling:
        return 'Synchronisation par interrogation';
    }
  }

  SyncStatus copyWith({
    SyncConnectionState? connectionState,
    DateTime? lastSyncTime,
    bool? isOffline,
    int? pendingMutations,
    String? lastError,
  }) {
    return SyncStatus(
      connectionState: connectionState ?? this.connectionState,
      lastSyncTime: lastSyncTime ?? this.lastSyncTime,
      isOffline: isOffline ?? this.isOffline,
      pendingMutations: pendingMutations ?? this.pendingMutations,
      lastError: lastError ?? this.lastError,
    );
  }
}
