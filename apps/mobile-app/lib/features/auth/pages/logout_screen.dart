import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/ah_theme.dart';
import '../../../core/auth/logout_state.dart';
import '../../../core/auth/secure_logout_service.dart';

/// Logout screen that displays a progress indicator during the 5-step
/// secure logout process.
///
/// On completion, auto-navigates to `/portal-select`.
/// On error, shows a retry option.
class LogoutScreen extends ConsumerStatefulWidget {
  const LogoutScreen({super.key});

  @override
  ConsumerState<LogoutScreen> createState() => _LogoutScreenState();
}

class _LogoutScreenState extends ConsumerState<LogoutScreen> {
  LogoutProgress _progress = LogoutProgress.initial;
  LogoutResult? _result;
  bool _isRunning = false;

  @override
  void initState() {
    super.initState();
    // Start the logout process on first build.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _startLogout();
    });
  }

  Future<void> _startLogout() async {
    if (_isRunning) return;
    _isRunning = true;

    final logoutService = SecureLogoutService(ref: ref);

    _result = await logoutService.logout(
      onProgress: (progress) {
        if (mounted) {
          setState(() {
            _progress = progress;
          });
        }
      },
    );

    _isRunning = false;

    if (!mounted) return;

    if (_result!.success) {
      // Small delay so the user sees "Déconnexion terminée".
      await Future.delayed(const Duration(milliseconds: 800));
      if (mounted) {
        context.go('/portal-select');
      }
    } else {
      // Show error state with retry option.
      setState(() {});
    }
  }

  @override
  Widget build(BuildContext context) {
    final hasError = _result != null && !_result!.success;
    final stepIndex = _progress.currentStep.index;
    final overallProgress = _progress.progress;

    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [AHColors.navyDark, AHColors.navy],
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
          ),
        ),
        child: SafeArea(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(AHSpacing.xl),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // ── Icon ────────────────────────────────────────────
                  if (!hasError)
                    Container(
                      width: 72,
                      height: 72,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(18),
                      ),
                      child: const Icon(
                        Icons.logout,
                        color: AHColors.gold,
                        size: 40,
                      ),
                    )
                  else
                    Container(
                      width: 72,
                      height: 72,
                      decoration: BoxDecoration(
                        color: AHColors.error.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(18),
                      ),
                      child: const Icon(
                        Icons.error_outline,
                        color: AHColors.errorLight,
                        size: 40,
                      ),
                    ),
                  const SizedBox(height: AHSpacing.xl),

                  // ── Title ───────────────────────────────────────────
                  const Text(
                    'Déconnexion',
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 24,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: AHSpacing.sm),

                  // ── Current Step Message ────────────────────────────
                  Text(
                    hasError
                        ? _result!.error ?? 'Une erreur est survenue'
                        : _progress.message,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 14,
                      color: hasError
                          ? AHColors.errorLight
                          : Colors.white.withValues(alpha: 0.7),
                    ),
                  ),
                  const SizedBox(height: AHSpacing.xxl),

                  // ── Progress Bar ────────────────────────────────────
                  if (!hasError) ...[
                    ClipRRect(
                      borderRadius: BorderRadius.circular(AHSpacing.r8),
                      child: LinearProgressIndicator(
                        value: overallProgress,
                        backgroundColor: Colors.white.withValues(alpha: 0.15),
                        valueColor: const AlwaysStoppedAnimation<Color>(
                          AHColors.gold,
                        ),
                        minHeight: 8,
                      ),
                    ),
                    const SizedBox(height: AHSpacing.lg),

                    // ── Step Indicators ────────────────────────────────
                    _buildStepIndicators(stepIndex),
                  ],

                  // ── Error / Retry ───────────────────────────────────
                  if (hasError) ...[
                    const SizedBox(height: AHSpacing.xl),
                    ElevatedButton(
                      onPressed: () {
                        setState(() {
                          _result = null;
                          _progress = LogoutProgress.initial;
                          _isRunning = false;
                        });
                        _startLogout();
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AHColors.gold,
                        foregroundColor: AHColors.navyDark,
                      ),
                      child: const Text('Réessayer'),
                    ),
                    const SizedBox(height: AHSpacing.sm),
                    TextButton(
                      onPressed: () {
                        // Force navigate to portal-select even on error.
                        context.go('/portal-select');
                      },
                      child: Text(
                        'Forcer la déconnexion',
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.6),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  // ── Step Indicators ─────────────────────────────────────────────────

  Widget _buildStepIndicators(int currentStepIndex) {
    final steps = LogoutStep.values;

    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(steps.length, (index) {
        final isCompleted = index < currentStepIndex;
        final isCurrent = index == currentStepIndex;
        final isPending = index > currentStepIndex;

        return Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            _StepDot(
              isCompleted: isCompleted,
              isCurrent: isCurrent,
              isPending: isPending,
              stepIndex: index,
            ),
            if (index < steps.length - 1)
              Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: AHSpacing.xxs,
                ),
                child: Container(
                  width: 24,
                  height: 2,
                  color: isCompleted
                      ? AHColors.gold
                      : Colors.white.withValues(alpha: 0.2),
                ),
              ),
          ],
        );
      }),
    );
  }
}

/// A single step indicator dot.
class _StepDot extends StatelessWidget {
  const _StepDot({
    required this.isCompleted,
    required this.isCurrent,
    required this.isPending,
    required this.stepIndex,
  });

  final bool isCompleted;
  final bool isCurrent;
  final bool isPending;
  final int stepIndex;

  @override
  Widget build(BuildContext context) {
    if (isCompleted) {
      return Container(
        width: 24,
        height: 24,
        decoration: const BoxDecoration(
          color: AHColors.gold,
          shape: BoxShape.circle,
        ),
        child: const Icon(
          Icons.check,
          color: AHColors.navyDark,
          size: 16,
        ),
      );
    }

    if (isCurrent) {
      return Container(
        width: 24,
        height: 24,
        decoration: BoxDecoration(
          color: AHColors.gold.withValues(alpha: 0.3),
          shape: BoxShape.circle,
          border: Border.all(color: AHColors.gold, width: 2),
        ),
        child: Center(
          child: SizedBox(
            width: 8,
            height: 8,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              color: AHColors.gold,
            ),
          ),
        ),
      );
    }

    // Pending
    return Container(
      width: 24,
      height: 24,
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.1),
        shape: BoxShape.circle,
        border: Border.all(
          color: Colors.white.withValues(alpha: 0.2),
          width: 1,
        ),
      ),
      child: Center(
        child: Text(
          '${stepIndex + 1}',
          style: TextStyle(
            fontFamily: 'Inter',
            fontSize: 10,
            fontWeight: FontWeight.w600,
            color: Colors.white.withValues(alpha: 0.4),
          ),
        ),
      ),
    );
  }
}
