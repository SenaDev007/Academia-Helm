import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/auth/auth_notifier.dart';
import '../../../core/auth/auth_state.dart';
import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../../../core/widgets/ah_logo_circle.dart';

/// Branded splash screen matching the web app's AcademiaLoader.
///
/// Design (1:1 with web):
/// - Royal Blue background (#1A237E)
/// - Logo with pulsing gold halo
/// - "Academia" (white) + "Helm" (gold) wordmark
/// - Subtitle: "PLATEFORME DE PILOTAGE ÉDUCATIF"
/// - Animated loading dots
/// - Auto-navigates after 2 seconds based on auth state
class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen>
    with TickerProviderStateMixin {
  late AnimationController _haloController;
  late AnimationController _logoController;
  late Animation<double> _haloAnimation;
  late Animation<double> _logoScale;

  @override
  void initState() {
    super.initState();

    // Halo pulse animation (3s loop, matching web's academiaPulse)
    _haloController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 3000),
    );
    _haloAnimation = Tween<double>(begin: 0.6, end: 1.0).animate(
      CurvedAnimation(parent: _haloController, curve: Curves.easeInOut),
    );
    _haloController.repeat(reverse: true);

    // Logo entrance animation
    _logoController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );
    _logoScale = Tween<double>(begin: 0.5, end: 1.0).animate(
      CurvedAnimation(parent: _logoController, curve: Curves.easeOutBack),
    );
    _logoController.forward();

    // Auto-navigate after 2 seconds.
    Future.delayed(const Duration(seconds: 2), _navigate);
  }

  void _navigate() {
    if (!mounted) return;
    final authState = ref.read(authNotifierProvider).valueOrNull;
    final isAuthenticated = authState?.isAuthenticated ?? false;
    final hasTenant = authState?.hasTenant ?? false;

    if (isAuthenticated && hasTenant) {
      context.go('/dashboard');
    } else if (isAuthenticated) {
      context.go('/tenant-select');
    } else {
      context.go('/portal-select');
    }
  }

  @override
  void dispose() {
    _haloController.dispose();
    _logoController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        color: const Color(0xFF1A237E), // Royal Blue (web AcademiaLoader bg)
        child: SafeArea(
          child: Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // ── Logo (matches web LogoCircle) ───────────────────────
                ScaleTransition(
                  scale: _logoScale,
                  child: const AHLogoCircle(size: 96),
                ),
                const SizedBox(height: AHSpacing.xl),

                // ── Wordmark: "Academia" + "Helm" ────────────────────
                const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      'Academia',
                      style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 28,
                        fontWeight: FontWeight.w800,
                        color: Colors.white,
                        letterSpacing: -0.5,
                      ),
                    ),
                    SizedBox(width: 6),
                    Text(
                      'Helm',
                      style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 28,
                        fontWeight: FontWeight.w800,
                        color: AHColors.gold,
                        letterSpacing: -0.5,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AHSpacing.sm),

                // ── Subtitle ──────────────────────────────────────────
                const Text(
                  'PLATEFORME DE PILOTAGE ÉDUCATIF',
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 10,
                    fontWeight: FontWeight.w400,
                    letterSpacing: 2.5,
                    color: Color(0xFFBBDEFB),
                  ),
                ),
                const SizedBox(height: AHSpacing.xxl),

                // ── Animated loading dots ─────────────────────────────
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    _LoadingDot(
                      color: const Color(0xFF3F51B5).withOpacity(0.7),
                      size: 6,
                      delay: 0,
                    ),
                    const SizedBox(width: 8),
                    _LoadingDot(
                      color: const Color(0xFF3F51B5),
                      size: 8,
                      delay: 200,
                    ),
                    const SizedBox(width: 8),
                    _LoadingDot(
                      color: AHColors.gold,
                      size: 6,
                      delay: 400,
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Animated bouncing dot for the loading indicator.
class _LoadingDot extends StatefulWidget {
  const _LoadingDot({
    required this.color,
    required this.size,
    required this.delay,
  });

  final Color color;
  final double size;
  final int delay;

  @override
  State<_LoadingDot> createState() => _LoadingDotState();
}

class _LoadingDotState extends State<_LoadingDot>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    Future.delayed(Duration(milliseconds: widget.delay), () {
      if (mounted) _controller.repeat(reverse: true);
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        return Transform.translate(
          offset: Offset(0, -4 * _controller.value),
          child: Container(
            width: widget.size,
            height: widget.size,
            decoration: BoxDecoration(
              color: widget.color,
              shape: BoxShape.circle,
            ),
          ),
        );
      },
    );
  }
}
