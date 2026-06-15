/// ============================================================================
/// REAL-TIME SYNC SERVICE — Academia Hub Mobile
/// ============================================================================
///
/// WebSocket-based real-time synchronization service.
/// Listens for configuration change events from the backend and dispatches
/// them to the ConfigService for processing.
///
/// Features:
///   - WebSocket connection for live updates
///   - Auto-reconnect with exponential backoff
///   - Graceful degradation: falls back to HTTP polling if WebSocket fails
///   - Event types: features, roles, modules, tenant, academic year changes
///   - Connection state monitoring via Stream
///
/// Event flow:
///   Backend pushes event → WebSocket → RealtimeSync → SyncEvent → ConfigService
///
/// All user-facing strings are in FRENCH.
/// ============================================================================

import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:connectivity_plus/connectivity_plus.dart';

import 'config_service.dart';
import 'sync_event.dart';

// ─── Constants ───────────────────────────────────────────────────────────────

/// WebSocket endpoint path (appended to the API base URL).
const _wsPath = '/ws/sync';

/// Maximum number of reconnection attempts before falling back to polling.
const _maxReconnectAttempts = 5;

/// Initial reconnection delay in milliseconds.
const _initialReconnectDelayMs = 1000;

/// Maximum reconnection delay in milliseconds (cap for exponential backoff).
const _maxReconnectDelayMs = 30000;

/// Polling interval when WebSocket is unavailable.
const _pollingIntervalMs = 30000; // 30 seconds

/// Backoff multiplier for exponential backoff.
const _backoffMultiplier = 2;

// ─── Realtime Sync Service ───────────────────────────────────────────────────

/// Real-time synchronization service using WebSocket with polling fallback.
///
/// Lifecycle:
///   1. Call [connect()] after the user logs in.
///   2. The service maintains a WebSocket connection and forwards events.
///   3. If the WebSocket fails, it falls back to HTTP polling.
///   4. Call [disconnect()] when the user logs out.
///
/// Usage:
///   final sync = RealtimeSyncService.instance;
///   await sync.connect();
///   sync.events.listen((event) => handleEvent(event));
///   await sync.disconnect();
class RealtimeSyncService with ChangeNotifier {
  static RealtimeSyncService? _instance;

  /// Singleton instance.
  static RealtimeSyncService get instance =>
      _instance ??= RealtimeSyncService._();

  RealtimeSyncService._();

  // ─── State ──────────────────────────────────────────────────────────────

  /// The current WebSocket connection (null if not connected).
  WebSocket? _webSocket;

  /// Whether the service is currently connected.
  bool _isConnected = false;

  /// Whether the service is currently in polling mode.
  bool _isPolling = false;

  /// The current reconnection attempt count.
  int _reconnectAttempts = 0;

  /// Timer for reconnection attempts.
  Timer? _reconnectTimer;

  /// Timer for polling fallback.
  Timer? _pollingTimer;

  /// Stream controller for sync events.
  final StreamController<SyncEvent> _eventController =
      StreamController<SyncEvent>.broadcast();

  /// Subscription to connectivity changes.
  StreamSubscription<ConnectivityResult>? _connectivitySub;

  /// Subscription to the WebSocket stream.
  StreamSubscription? _wsSubscription;

  /// The API base URL for WebSocket connections.
  String? _wsBaseUrl;

  /// Whether the service has been explicitly disconnected.
  bool _manuallyDisconnected = false;

  // ─── Getters ────────────────────────────────────────────────────────────

  /// Whether the service is currently connected via WebSocket.
  bool get isConnected => _isConnected;

  /// Whether the service is in polling fallback mode.
  bool get isPolling => _isPolling;

  /// The current connection state.
  SyncConnectionState get connectionState {
    if (_isConnected) return SyncConnectionState.connected;
    if (_isPolling) return SyncConnectionState.polling;
    if (_reconnectTimer != null) return SyncConnectionState.reconnecting;
    return SyncConnectionState.disconnected;
  }

  /// Stream of sync events from the backend.
  Stream<SyncEvent> get events => _eventController.stream;

  // ─── Connect ────────────────────────────────────────────────────────────

  /// Connects to the WebSocket sync endpoint.
  ///
  /// Must be called after the user is authenticated (token available).
  /// On failure, automatically falls back to HTTP polling.
  Future<void> connect() async {
    _manuallyDisconnected = false;

    // Read the API base URL from secure storage
    const secureStorage = FlutterSecureStorage();
    final token = await secureStorage.read(key: 'auth_token');
    if (token == null) {
      debugPrint('[RealtimeSync] Pas de token — connexion impossible');
      return;
    }

    // Determine WebSocket URL
    await _resolveWsUrl();
    if (_wsBaseUrl == null) {
      debugPrint('[RealtimeSync] URL WebSocket non résolue — mode polling');
      _startPolling();
      return;
    }

    _tryWebSocketConnect(token);
  }

  /// Resolves the WebSocket URL from the API base URL.
  Future<void> _resolveWsUrl() async {
    try {
      const secureStorage = FlutterSecureStorage();
      final apiUrl = await secureStorage.read(key: 'api_base_url');
      final baseUrl = apiUrl ?? 'https://api.academiahelm.com';

      // Convert HTTP(S) URL to WS(S) URL
      if (baseUrl.startsWith('https://')) {
        _wsBaseUrl = 'wss://${baseUrl.substring(8)}';
      } else if (baseUrl.startsWith('http://')) {
        _wsBaseUrl = 'ws://${baseUrl.substring(7)}';
      } else {
        _wsBaseUrl = 'wss://$baseUrl';
      }
    } catch (e) {
      debugPrint('[RealtimeSync] Erreur résolution URL : $e');
      _wsBaseUrl = null;
    }
  }

  /// Attempts to establish a WebSocket connection.
  Future<void> _tryWebSocketConnect(String token) async {
    if (_manuallyDisconnected) return;

    try {
      final uri = Uri.parse('$_wsBaseUrl$_wsPath?token=$token');
      _webSocket = await WebSocket.connect(uri.toString());

      _isConnected = true;
      _reconnectAttempts = 0;
      _stopPolling(); // Stop polling if we were in fallback mode

      _emitEvent(SyncEvent(
        type: SyncEventType.connected,
        message: 'Connexion temps réel établie',
      ));

      // Listen for incoming messages
      _wsSubscription = _webSocket!.listen(
        _onWebSocketMessage,
        onError: _onWebSocketError,
        onDone: _onWebSocketDone,
      );

      debugPrint('[RealtimeSync] Connecté au WebSocket');
      notifyListeners();
    } catch (e) {
      debugPrint('[RealtimeSync] Échec connexion WebSocket : $e');
      _isConnected = false;
      _scheduleReconnect(token);
    }
  }

  // ─── WebSocket Event Handlers ───────────────────────────────────────────

  /// Handles an incoming WebSocket message.
  void _onWebSocketMessage(dynamic message) {
    try {
      final json = jsonDecode(message as String) as Map<String, dynamic>;
      final event = SyncEvent.fromJson(json);

      debugPrint('[RealtimeSync] Événement reçu : ${event.type}');
      _emitEvent(event);

      // Forward to ConfigService for processing
      ConfigService.instance.handleSyncEvent(event);
    } catch (e) {
      debugPrint('[RealtimeSync] Erreur traitement message : $e');
    }
  }

  /// Handles a WebSocket error.
  void _onWebSocketError(dynamic error) {
    debugPrint('[RealtimeSync] Erreur WebSocket : $error');
    _isConnected = false;
    _emitEvent(SyncEvent(
      type: SyncEventType.disconnected,
      message: 'Connexion temps réel perdue',
    ));
    notifyListeners();
    _scheduleReconnect();
  }

  /// Handles WebSocket connection closure.
  void _onWebSocketDone() {
    debugPrint('[RealtimeSync] WebSocket fermé');
    _isConnected = false;
    _wsSubscription?.cancel();
    _wsSubscription = null;
    _webSocket = null;

    _emitEvent(SyncEvent(
      type: SyncEventType.disconnected,
      message: 'Connexion temps réel fermée',
    ));
    notifyListeners();

    if (!_manuallyDisconnected) {
      _scheduleReconnect();
    }
  }

  // ─── Reconnection ──────────────────────────────────────────────────────

  /// Schedules a reconnection attempt with exponential backoff.
  void _scheduleReconnect([String? token]) async {
    if (_manuallyDisconnected) return;
    if (_reconnectAttempts >= _maxReconnectAttempts) {
      debugPrint(
          '[RealtimeSync] Tentatives max atteintes — passage en mode polling');
      _startPolling();
      return;
    }

    _reconnectAttempts++;
    final delayMs = (_initialReconnectDelayMs *
        (_backoffMultiplier ^ (_reconnectAttempts - 1)))
        .clamp(_initialReconnectDelayMs, _maxReconnectDelayMs)
        .toInt();

    debugPrint(
        '[RealtimeSync] Reconnexion dans ${delayMs}ms (tentative $_reconnectAttempts/$_maxReconnectAttempts)');

    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(Duration(milliseconds: delayMs), () async {
      if (_manuallyDisconnected) return;

      final effectiveToken = token ??
          await const FlutterSecureStorage().read(key: 'auth_token');
      if (effectiveToken != null) {
        _tryWebSocketConnect(effectiveToken);
      } else {
        debugPrint('[RealtimeSync] Pas de token — reconnexion impossible');
        _startPolling();
      }
    });

    _emitEvent(SyncEvent(
      type: SyncEventType.disconnected,
      message:
          'Reconnexion dans ${delayMs ~/ 1000} secondes (tentative $_reconnectAttempts/$_maxReconnectAttempts)',
    ));

    notifyListeners();
  }

  // ─── Polling Fallback ──────────────────────────────────────────────────

  /// Starts HTTP polling as a fallback when WebSocket is unavailable.
  void _startPolling() {
    if (_isPolling) return;

    _isPolling = true;
    debugPrint(
        '[RealtimeSync] Mode polling activé (intervalle : ${_pollingIntervalMs}ms)');

    _emitEvent(SyncEvent(
      type: SyncEventType.disconnected,
      message: 'Mode synchronisation par interrogation activé',
    ));

    // Perform first poll immediately
    _performPoll();

    // Schedule periodic polls
    _pollingTimer?.cancel();
    _pollingTimer = Timer.periodic(
      const Duration(milliseconds: _pollingIntervalMs),
      (_) => _performPoll(),
    );

    // Also listen for connectivity changes to retry WebSocket
    _connectivitySub?.cancel();
    _connectivitySub = Connectivity().onConnectivityChanged.listen((result) {
      if (result != ConnectivityResult.none && !_isConnected) {
        debugPrint('[RealtimeSync] Connexion réseau restaurée — '
            'tentative WebSocket');
        _stopPolling();
        connect();
      }
    });

    notifyListeners();
  }

  /// Stops the polling fallback.
  void _stopPolling() {
    _isPolling = false;
    _pollingTimer?.cancel();
    _pollingTimer = null;
    _connectivitySub?.cancel();
    _connectivitySub = null;
  }

  /// Performs a single poll by fetching the latest config.
  Future<void> _performPoll() async {
    try {
      await ConfigService.instance.fetchAndApplyConfig();
    } catch (e) {
      debugPrint('[RealtimeSync] Erreur polling : $e');
    }
  }

  // ─── Disconnect ─────────────────────────────────────────────────────────

  /// Disconnects from the WebSocket and stops polling.
  Future<void> disconnect() async {
    _manuallyDisconnected = true;

    // Close WebSocket
    await _webSocket?.close();
    _webSocket = null;
    _wsSubscription?.cancel();
    _wsSubscription = null;

    // Stop polling
    _stopPolling();

    // Cancel reconnect timer
    _reconnectTimer?.cancel();
    _reconnectTimer = null;

    _isConnected = false;
    _reconnectAttempts = 0;

    debugPrint('[RealtimeSync] Déconnecté');
    notifyListeners();
  }

  // ─── Send (for future bidirectional sync) ──────────────────────────────

  /// Sends a message to the WebSocket server.
  ///
  /// Currently unused, but available for future features like:
  ///   - Acknowledging events
  ///   - Requesting specific config updates
  ///   - Sending client-side analytics
  void send(Map<String, dynamic> data) {
    if (_isConnected && _webSocket != null) {
      _webSocket!.add(jsonEncode(data));
    }
  }

  // ─── Helpers ───────────────────────────────────────────────────────────

  void _emitEvent(SyncEvent event) {
    if (!_eventController.isClosed) {
      _eventController.add(event);
    }
  }

  // ─── Dispose ───────────────────────────────────────────────────────────

  @override
  void dispose() {
    disconnect();
    _eventController.close();
    super.dispose();
  }
}
