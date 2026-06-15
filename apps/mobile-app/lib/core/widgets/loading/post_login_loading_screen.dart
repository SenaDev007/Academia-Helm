/// ============================================================================
/// POST LOGIN LOADING SCREEN — Academia Hub Mobile
/// ============================================================================
///
/// PostLoginLoadingScreen that orchestrates the full post-login flow:
/// - Shows LoadingScreen with real progress
/// - Calls PostLoginFlow steps
/// - On complete → navigate to dashboard
/// - On error → navigate to appropriate error page
///
/// Uses AHColors: Navy (#0B2F73), Gold (#F5B335), Blue (#1D4FA5)
/// ============================================================================

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../auth/auth_state.dart';
import '../../auth/token_storage.dart';
import '../../loading/loading_messages.dart';
import '../../loading/post_login_flow.dart';
import '../../theme/ah_colors.dart';
import 'loading_screen.dart';

// ─── Post Login Result ───────────────────────────────────────────────────────

/// Result of the post-login loading flow.
enum PostLoginResult {
  /// Flow completed successfully.
  success,

  /// Flow failed due to auth error.
  authError,

  /// Flow failed due to network error.
  networkError,

  /// Flow failed due to tenant error.
  tenantError,

  /// Flow failed due to timeout.
  timeout,

  /// Generic error.
  error,
}

// ─── Post Login Loading Screen ───────────────────────────────────────────────

/// Full-screen loading screen that orchestrates the post-login flow.
///
/// Shows a branded LoadingScreen with real progress updates,
/// then navigates to the appropriate screen on completion.
class PostLoginLoadingScreen extends StatefulWidget {
  /// The authenticated user.
  final AuthUser user;

  /// The selected tenant (may be null for multi-tenant selection).
  final TenantInfo? tenant;

  /// Whether this is a fresh login (vs session restore).
  final bool isFreshLogin;

  /// Callback when the flow completes successfully.
  final VoidCallback? onSuccess;

  /// Callback when the flow fails.
  final void Function(PostLoginResult result, String? error)? onError;

  const PostLoginLoadingScreen({
    super.key,
    required this.user,
    this.tenant,
    this.isFreshLogin = true,
    this.onSuccess,
    this.onError,
  });

  @override
  State<PostLoginLoadingScreen> createState() => _PostLoginLoadingScreenState();
}

class _PostLoginLoadingScreenState extends State<PostLoginLoadingScreen> {
  late final PostLoginFlow _flow;

  String _title = 'Chargement';
  String _subtitle = 'Préparation de votre espace...';
  double _progress = 0.0;
  bool _isComplete = false;
  bool _hasError = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _flow = PostLoginFlow(
      tokenStorage: TokenStorage(),
      user: widget.user,
      tenant: widget.tenant,
    );
    _startFlow();
  }

  Future<void> _startFlow() async {
    // Add a small delay for the loading screen to render
    await Future.delayed(const Duration(milliseconds: 300));

    if (!mounted) return;

    final success = await _flow.run(
      onProgress: _onProgress,
      isFreshLogin: widget.isFreshLogin,
    );

    if (!mounted) return;

    if (success) {
      _onComplete();
    } else {
      _onFlowError();
    }
  }

  void _onProgress(FlowProgress progress) {
    if (!mounted) return;

    setState(() {
      _title = progress.title;
      _subtitle = progress.subtitle;
      _progress = progress.progress;
    });
  }

  void _onComplete() {
    setState(() {
      _isComplete = true;
      _title = 'Bienvenue, ${widget.user.displayName} !';
      _subtitle = 'Votre espace est prêt.';
      _progress = 100.0;
    });

    // Brief pause to show "welcome" message, then navigate
    Future.delayed(const Duration(milliseconds: 800), () {
      if (!mounted) return;
      widget.onSuccess?.call();

      // Navigate to dashboard
      try {
        final portal = widget.user.portal;
        switch (portal) {
          case PortalType.platform:
            context.go('/platform');
          case PortalType.school:
            context.go('/school');
          case PortalType.teacher:
            context.go('/teacher');
          case PortalType.parent:
            context.go('/parent');
          case PortalType.public:
            context.go('/dashboard');
        }
      } catch (_) {
        // Navigation failed — fallback
        context.go('/dashboard');
      }
    });
  }

  void _onFlowError() {
    setState(() {
      _hasError = true;
      _errorMessage = _errorMessage ?? LoadingErrorMessages.genericSubtitle;
    });

    // Determine error type
    PostLoginResult result = PostLoginResult.error;
    if (_errorMessage?.contains('Token') ?? false) {
      result = PostLoginResult.authError;
    } else if (_errorMessage?.contains('connexion') ?? false) {
      result = PostLoginResult.networkError;
    } else if (_errorMessage?.contains('établissement') ?? false) {
      result = PostLoginResult.tenantError;
    } else if (_errorMessage?.contains('délai') ?? false) {
      result = PostLoginResult.timeout;
    }

    widget.onError?.call(result, _errorMessage);

    // Navigate to error screen after a brief pause
    Future.delayed(const Duration(milliseconds: 1500), () {
      if (!mounted) return;

      // Show error dialog and redirect to login
      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (ctx) => AlertDialog(
          title: Text(
            _getErrorTitle(result),
            style: const TextStyle(color: AHColors.navy),
          ),
          content: Text(_errorMessage ?? LoadingErrorMessages.genericSubtitle),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.of(ctx).pop();
                context.go('/login');
              },
              child: const Text('Se reconnecter'),
            ),
            if (result == PostLoginResult.networkError)
              TextButton(
                onPressed: () {
                  Navigator.of(ctx).pop();
                  _startFlow(); // Retry
                },
                child: const Text('Réessayer'),
              ),
          ],
        ),
      );
    });
  }

  String _getErrorTitle(PostLoginResult result) {
    switch (result) {
      case PostLoginResult.authError:
        return LoadingErrorMessages.authTitle;
      case PostLoginResult.networkError:
        return LoadingErrorMessages.networkTitle;
      case PostLoginResult.tenantError:
        return LoadingErrorMessages.tenantTitle;
      case PostLoginResult.timeout:
        return LoadingErrorMessages.timeoutTitle;
      case PostLoginResult.success:
      case PostLoginResult.error:
        return LoadingErrorMessages.genericTitle;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_hasError) {
      return _buildErrorScreen();
    }

    return LoadingScreen(
      title: _title,
      subtitle: _subtitle,
      progress: _progress,
      showPercentage: true,
      showDots: !_isComplete,
      showOrbitalRing: !_isComplete,
    );
  }

  Widget _buildErrorScreen() {
    return Container(
      color: AHColors.navy,
      child: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Error icon
                Container(
                  width: 80,
                  height: 80,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: AHColors.error.withOpacity(0.1),
                    border: Border.all(
                      color: AHColors.error.withOpacity(0.3),
                      width: 2,
                    ),
                  ),
                  child: const Icon(
                    Icons.error_outline,
                    size: 40,
                    color: AHColors.error,
                  ),
                ),
                const SizedBox(height: 24),
                Text(
                  LoadingErrorMessages.genericTitle,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  _errorMessage ?? LoadingErrorMessages.genericSubtitle,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Colors.white.withOpacity(0.7),
                    fontSize: 14,
                  ),
                ),
                const SizedBox(height: 32),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () => context.go('/login'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AHColors.gold,
                      foregroundColor: AHColors.navy,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                    child: const Text(
                      'Se reconnecter',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
