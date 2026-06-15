/// Logout state models for the 5-step secure logout process.
///
/// The 5 steps match the web app's logout flow:
/// 1. Confirmation utilisateur
/// 2. Invalidation session serveur
/// 3. Préservation données hors-ligne
/// 4. Nettoyage contexte applicatif
/// 5. Redirection contrôlée

// ── Logout Step ───────────────────────────────────────────────────────

/// Enum representing each step in the secure logout process.
enum LogoutStep {
  confirmation,
  serverInvalidation,
  offlinePreservation,
  contextCleanup,
  redirect,
}

/// Extension providing French display messages for [LogoutStep].
extension LogoutStepX on LogoutStep {
  /// French display message for the logout step.
  String get message {
    switch (this) {
      case LogoutStep.confirmation:
        return 'Confirmation de déconnexion…';
      case LogoutStep.serverInvalidation:
        return 'Invalidation de la session serveur…';
      case LogoutStep.offlinePreservation:
        return 'Préservation des données hors-ligne…';
      case LogoutStep.contextCleanup:
        return 'Nettoyage du contexte applicatif…';
      case LogoutStep.redirect:
        return 'Redirection en cours…';
    }
  }

  /// Step index (0-based).
  int get index {
    switch (this) {
      case LogoutStep.confirmation:
        return 0;
      case LogoutStep.serverInvalidation:
        return 1;
      case LogoutStep.offlinePreservation:
        return 2;
      case LogoutStep.contextCleanup:
        return 3;
      case LogoutStep.redirect:
        return 4;
    }
  }

  /// Total number of logout steps.
  static const int totalSteps = 5;
}

// ── Logout Progress ───────────────────────────────────────────────────

/// Tracks the progress of a secure logout operation.
class LogoutProgress {
  const LogoutProgress({
    required this.currentStep,
    required this.progress,
    required this.message,
  });

  /// The current step being executed.
  final LogoutStep currentStep;

  /// Overall progress from 0.0 to 1.0.
  final double progress;

  /// Human-readable message for the current step.
  final String message;

  /// Convenience factory for the initial state.
  static const LogoutProgress initial = LogoutProgress(
    currentStep: LogoutStep.confirmation,
    progress: 0.0,
    message: 'Confirmation de déconnexion…',
  );

  LogoutProgress copyWith({
    LogoutStep? currentStep,
    double? progress,
    String? message,
  }) {
    return LogoutProgress(
      currentStep: currentStep ?? this.currentStep,
      progress: progress ?? this.progress,
      message: message ?? this.message,
    );
  }
}

// ── Logout Result ─────────────────────────────────────────────────────

/// The result of a secure logout operation.
class LogoutResult {
  const LogoutResult({
    required this.success,
    this.error,
    this.completedSteps = const {},
  });

  /// Whether the logout completed successfully.
  final bool success;

  /// Error message if the logout failed.
  final String? error;

  /// The steps that were completed before the result.
  final Set<LogoutStep> completedSteps;

  /// Convenience factory for a successful logout.
  static const LogoutResult success = LogoutResult(success: true);

  /// Convenience factory for a failed logout.
  factory LogoutResult.failure(String error, {Set<LogoutStep>? completedSteps}) {
    return LogoutResult(
      success: false,
      error: error,
      completedSteps: completedSteps ?? const {},
    );
  }
}
