/// ============================================================================
/// SESSION MANAGER — Academia Hub Mobile
/// ============================================================================
///
/// Session manager matching the web app's SessionManagerContext.
/// Tracks idle time, monitors app lifecycle, and enforces session policies:
///   - 15-minute idle → show warning with 30-second countdown
///   - 45-minute idle → lock session
///   - 60-minute idle → force logout
///   - Proactive token refresh every 4 minutes when active
/// ============================================================================

import 'dart:async';

import 'package:flutter/scheduler.dart';
import 'package:flutter/widgets.dart';

import 'token_storage.dart';

// ─── Session Event ───────────────────────────────────────────────────────────

/// Events emitted by the session manager.
enum SessionEvent {
  /// User is still active — no action needed.
  active,

  /// Approaching idle threshold — show warning.
  idleWarning,

  /// Session is now locked due to extended idle.
  locked,

  /// Session has expired — force logout.
  expired,

  /// Token was proactively refreshed.
  tokenRefreshed,
}

// ─── Session Callbacks ───────────────────────────────────────────────────────

/// Callbacks for session events.
class SessionCallbacks {
  /// Called when idle warning should be shown.
  final void Function(Duration idleDuration, Duration countdown)? onIdleWarning;

  /// Called when the session should be locked.
  final void Function()? onLock;

  /// Called when the session has expired and user must log out.
  final void Function()? onExpire;

  /// Called when the token was proactively refreshed.
  final void Function()? onTokenRefreshed;

  /// Called on every activity tick (for UI updates).
  final void Function(Duration idleDuration)? onActivityUpdate;

  const SessionCallbacks({
    this.onIdleWarning,
    this.onLock,
    this.onExpire,
    this.onTokenRefreshed,
    this.onActivityUpdate,
  });
}

// ─── Session Manager ─────────────────────────────────────────────────────────

/// Manages session idle timeouts, lifecycle events, and proactive token refresh.
///
/// Usage:
/// ```dart
/// final manager = SessionManager(tokenStorage: tokenStorage, callbacks: callbacks);
/// // Attach to widget tree via WidgetsBindingObserver
/// manager.start();
/// ```
class SessionManager with WidgetsBindingObserver {
  SessionManager({
    required TokenStorage tokenStorage,
    SessionCallbacks callbacks = const SessionCallbacks(),
    Duration idleWarningThreshold = const Duration(minutes: 15),
    Duration idleLockThreshold = const Duration(minutes: 45),
    Duration idleExpireThreshold = const Duration(minutes: 60),
    Duration warningCountdown = const Duration(seconds: 30),
    Duration proactiveRefreshInterval = const Duration(minutes: 4),
    Duration checkInterval = const Duration(seconds: 15),
  })  : _tokenStorage = tokenStorage,
        _callbacks = callbacks,
        _idleWarningThreshold = idleWarningThreshold,
        _idleLockThreshold = idleLockThreshold,
        _idleExpireThreshold = idleExpireThreshold,
        _warningCountdown = warningCountdown,
        _proactiveRefreshInterval = proactiveRefreshInterval,
        _checkInterval = checkInterval;

  final TokenStorage _tokenStorage;
  final SessionCallbacks _callbacks;

  // ─── Thresholds ───────────────────────────────────────────────────────────

  final Duration _idleWarningThreshold;
  final Duration _idleLockThreshold;
  final Duration _idleExpireThreshold;
  final Duration _warningCountdown;
  final Duration _proactiveRefreshInterval;
  final Duration _checkInterval;

  // ─── State ────────────────────────────────────────────────────────────────

  DateTime _lastActivity = DateTime.now();
  DateTime? _lastTokenRefresh;
  Timer? _checkTimer;
  Timer? _refreshTimer;
  bool _isStarted = false;
  bool _isLocked = false;
  bool _warningShown = false;

  /// The current session event based on idle time.
  SessionEvent _currentEvent = SessionEvent.active;

  // ─── Getters ──────────────────────────────────────────────────────────────

  /// When the user was last active.
  DateTime get lastActivity => _lastActivity;

  /// How long the user has been idle.
  Duration get idleDuration => DateTime.now().difference(_lastActivity);

  /// Whether the session manager is actively monitoring.
  bool get isStarted => _isStarted;

  /// Whether the session is currently locked.
  bool get isLocked => _isLocked;

  /// The current session event.
  SessionEvent get currentEvent => _currentEvent;

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  /// Starts monitoring session activity.
  void start() {
    if (_isStarted) return;
    _isStarted = true;
    _isLocked = false;
    _warningShown = false;
    _currentEvent = SessionEvent.active;
    _lastActivity = DateTime.now();

    // Attach observer for app lifecycle
    WidgetsBinding.instance.addObserver(this);

    // Start periodic idle check
    _checkTimer = Timer.periodic(_checkInterval, (_) => _checkIdle());

    // Start proactive token refresh
    _startProactiveRefresh();

    // Record activity in secure storage
    _tokenStorage.updateLastActivity();
  }

  /// Stops monitoring session activity.
  void stop() {
    if (!_isStarted) return;
    _isStarted = false;

    WidgetsBinding.instance.removeObserver(this);

    _checkTimer?.cancel();
    _checkTimer = null;

    _refreshTimer?.cancel();
    _refreshTimer = null;
  }

  /// Records user activity, resetting idle timers.
  void recordActivity() {
    if (!_isStarted || _isLocked) return;

    final wasWarning = _warningShown;
    _lastActivity = DateTime.now();
    _warningShown = false;

    if (_currentEvent != SessionEvent.active) {
      _currentEvent = SessionEvent.active;
      _callbacks.onActivityUpdate?.call(idleDuration);
    }

    // Persist last activity
    _tokenStorage.updateLastActivity();

    // If we were in warning, clear it
    if (wasWarning) {
      _callbacks.onActivityUpdate?.call(Duration.zero);
    }
  }

  // ─── WidgetsBindingObserver ───────────────────────────────────────────────

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    super.didChangeAppLifecycleState(state);

    switch (state) {
      case AppLifecycleState.resumed:
        // App came to foreground — check idle time
        _onAppResumed();
        break;
      case AppLifecycleState.paused:
        // App went to background — save current activity
        _tokenStorage.updateLastActivity();
        break;
      case AppLifecycleState.inactive:
      case AppLifecycleState.detached:
      case AppLifecycleState.hidden:
        // No specific action needed
        break;
    }
  }

  /// Called when the app resumes from background.
  void _onAppResumed() {
    if (!_isStarted) return;

    // Check how long we've been away
    final idle = idleDuration;

    if (idle >= _idleExpireThreshold) {
      // Too long — force logout
      _handleExpire();
    } else if (idle >= _idleLockThreshold) {
      // Long idle — lock session
      _handleLock();
    } else if (idle >= _idleWarningThreshold) {
      // Approaching idle — show warning
      _handleWarning();
    } else {
      // Still within safe range — record activity
      recordActivity();
    }
  }

  // ─── Idle Check ───────────────────────────────────────────────────────────

  void _checkIdle() {
    if (!_isStarted || _isLocked) return;

    final idle = idleDuration;

    // Notify activity update
    _callbacks.onActivityUpdate?.call(idle);

    if (idle >= _idleExpireThreshold) {
      _handleExpire();
    } else if (idle >= _idleLockThreshold) {
      _handleLock();
    } else if (idle >= _idleWarningThreshold) {
      _handleWarning();
    }
  }

  void _handleWarning() {
    if (_warningShown) return;
    _warningShown = true;
    _currentEvent = SessionEvent.idleWarning;

    // Calculate countdown (time until lock threshold)
    final timeUntilLock = _idleLockThreshold - idleDuration;
    final countdown = timeUntilLock < _warningCountdown
        ? timeUntilLock
        : _warningCountdown;

    _callbacks.onIdleWarning?.call(idleDuration, countdown);
  }

  void _handleLock() {
    if (_isLocked) return;
    _isLocked = true;
    _currentEvent = SessionEvent.locked;
    _callbacks.onLock?.call();
  }

  void _handleExpire() {
    _currentEvent = SessionEvent.expired;
    stop();
    _callbacks.onExpire?.call();
  }

  // ─── Proactive Token Refresh ──────────────────────────────────────────────

  void _startProactiveRefresh() {
    _refreshTimer?.cancel();
    _refreshTimer = Timer.periodic(_proactiveRefreshInterval, (_) {
      _proactiveRefreshToken();
    });
  }

  /// Proactively refreshes the token if the session is active.
  /// This is called every 4 minutes when the user is active.
  Future<void> _proactiveRefreshToken() async {
    if (!_isStarted || _isLocked) return;

    // Only refresh if user has been active recently
    final idle = idleDuration;
    if (idle > _idleWarningThreshold) return;

    // Check if token is near expiration
    final isExpired = await _tokenStorage.isTokenExpired();
    if (!isExpired) {
      // Token is still valid, but refresh proactively
      _lastTokenRefresh = DateTime.now();
      _currentEvent = SessionEvent.tokenRefreshed;
      _callbacks.onTokenRefreshed?.call();
      _currentEvent = SessionEvent.active;
    }
  }

  // ─── Lock / Unlock ────────────────────────────────────────────────────────

  /// Locks the session manually.
  void lock() {
    _handleLock();
  }

  /// Unlocks the session after successful re-authentication.
  void unlock() {
    _isLocked = false;
    _warningShown = false;
    _currentEvent = SessionEvent.active;
    _lastActivity = DateTime.now();
    _tokenStorage.updateLastActivity();
    _callbacks.onActivityUpdate?.call(Duration.zero);
  }

  // ─── Dispose ──────────────────────────────────────────────────────────────

  /// Dispose of all resources.
  void dispose() {
    stop();
  }
}

// ─── Session Activity Detector ───────────────────────────────────────────────

/// A widget that detects user activity (taps, scrolls, etc.)
/// and reports it to the SessionManager.
///
/// Wrap your MaterialApp or main scaffold with this:
/// ```dart
/// SessionActivityDetector(
///   sessionManager: manager,
///   child: MyApp(),
/// )
/// ```
class SessionActivityDetector extends StatelessWidget {
  final SessionManager sessionManager;
  final Widget child;

  const SessionActivityDetector({
    super.key,
    required this.sessionManager,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return Listener(
      onPointerDown: (_) => sessionManager.recordActivity(),
      onPointerMove: (_) => sessionManager.recordActivity(),
      onPointerUp: (_) => sessionManager.recordActivity(),
      onPointerScroll: (_) => sessionManager.recordActivity(),
      child: child,
    );
  }
}
