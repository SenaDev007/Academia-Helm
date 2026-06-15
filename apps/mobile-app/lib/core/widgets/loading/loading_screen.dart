/// ============================================================================
/// LOADING SCREEN — Academia Hub Mobile
/// ============================================================================
///
/// Full-screen branded loading screen matching the web app:
/// - Logo in circle with gold halo + rotating gold ring
/// - Progress bar (gradient navy→gold)
/// - Percentage display
/// - 3 bouncing dots with brand colors
/// - Message display (title + subtitle)
/// - Animated orbital ring spinner
///
/// Uses AHColors: Navy (#0B2F73), Gold (#F5B335), Blue (#1D4FA5)
/// ============================================================================

import 'dart:math';

import 'package:flutter/material.dart';

import '../../theme/ah_colors.dart';

// ─── Loading Screen ──────────────────────────────────────────────────────────

/// Full-screen branded loading screen.
class LoadingScreen extends StatefulWidget {
  /// Main loading message.
  final String title;

  /// Secondary loading message.
  final String subtitle;

  /// Progress value from 0.0 to 100.0. If null, shows indeterminate.
  final double? progress;

  /// Whether to show the percentage display.
  final bool showPercentage;

  /// Whether to show the bouncing dots.
  final bool showDots;

  /// Whether to show the orbital ring spinner.
  final bool showOrbitalRing;

  /// Custom logo widget. If null, shows default "AH" text.
  final Widget? logo;

  const LoadingScreen({
    super.key,
    this.title = 'Chargement',
    this.subtitle = '',
    this.progress,
    this.showPercentage = true,
    this.showDots = true,
    this.showOrbitalRing = true,
    this.logo,
  });

  @override
  State<LoadingScreen> createState() => _LoadingScreenState();
}

class _LoadingScreenState extends State<LoadingScreen>
    with TickerProviderStateMixin {
  late final AnimationController _ringController;
  late final AnimationController _haloController;
  late final AnimationController _dotsController;

  @override
  void initState() {
    super.initState();
    _ringController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat();

    _haloController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat(reverse: true);

    _dotsController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat();
  }

  @override
  void dispose() {
    _ringController.dispose();
    _haloController.dispose();
    _dotsController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AHColors.navy,
      child: SafeArea(
        child: Column(
          children: [
            const Spacer(flex: 2),

            // ─── Logo with Halo + Rotating Ring ────────────────────────────
            _buildLogoSection(),

            const SizedBox(height: 40),

            // ─── Progress Bar ──────────────────────────────────────────────
            if (widget.progress != null) _buildProgressBar(),

            const SizedBox(height: 16),

            // ─── Percentage ────────────────────────────────────────────────
            if (widget.progress != null && widget.showPercentage)
              _buildPercentage(),

            const SizedBox(height: 24),

            // ─── Message ───────────────────────────────────────────────────
            _buildMessage(),

            const SizedBox(height: 16),

            // ─── Bouncing Dots ─────────────────────────────────────────────
            if (widget.showDots) _buildBouncingDots(),

            const Spacer(flex: 1),
          ],
        ),
      ),
    );
  }

  Widget _buildLogoSection() {
    return SizedBox(
      width: 140,
      height: 140,
      child: Stack(
        alignment: Alignment.center,
        children: [
          // Orbital ring spinner
          if (widget.showOrbitalRing)
            AnimatedBuilder(
              animation: _ringController,
              builder: (context, child) {
                return CustomPaint(
                  size: const Size(140, 140),
                  painter: _OrbitalRingPainter(
                    rotation: _ringController.value * 2 * pi,
                    color: AHColors.gold,
                  ),
                );
              },
            ),

          // Gold halo (pulsing)
          AnimatedBuilder(
            animation: _haloController,
            builder: (context, child) {
              final scale = 1.0 + (_haloController.value * 0.08);
              final opacity = 0.3 + (_haloController.value * 0.2);
              return Transform.scale(
                scale: scale,
                child: Container(
                  width: 100,
                  height: 100,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: RadialGradient(
                      colors: [
                        AHColors.gold.withOpacity(opacity),
                        AHColors.gold.withOpacity(opacity * 0.3),
                        Colors.transparent,
                      ],
                      stops: const [0.5, 0.8, 1.0],
                    ),
                  ),
                ),
              );
            },
          ),

          // Logo circle
          Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: Colors.white,
              boxShadow: [
                BoxShadow(
                  color: AHColors.gold.withOpacity(0.4),
                  blurRadius: 20,
                  spreadRadius: 2,
                ),
              ],
            ),
            child: Center(
              child: widget.logo ??
                  Text(
                    'AH',
                    style: TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.bold,
                      color: AHColors.navy,
                      letterSpacing: 2,
                    ),
                  ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildProgressBar() {
    final progress = (widget.progress ?? 0).clamp(0.0, 100.0) / 100.0;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 48),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(4),
        child: SizedBox(
          height: 6,
          child: Stack(
            children: [
              // Background track
              Container(
                decoration: BoxDecoration(
                  color: AHColors.navyLight,
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
              // Progress fill
              FractionallySizedBox(
                widthFactor: progress,
                child: Container(
                  decoration: BoxDecoration(
                    gradient: AHColors.navyToGold,
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildPercentage() {
    final percent = (widget.progress ?? 0).clamp(0.0, 100.0).round();
    return Text(
      '$percent%',
      style: const TextStyle(
        color: AHColors.gold,
        fontSize: 16,
        fontWeight: FontWeight.w600,
      ),
    );
  }

  Widget _buildMessage() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32),
      child: Column(
        children: [
          Text(
            widget.title,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 18,
              fontWeight: FontWeight.w600,
            ),
          ),
          if (widget.subtitle.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              widget.subtitle,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Colors.white.withOpacity(0.7),
                fontSize: 14,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildBouncingDots() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        _BouncingDot(
          controller: _dotsController,
          delay: 0,
          color: AHColors.navyLight,
        ),
        const SizedBox(width: 8),
        _BouncingDot(
          controller: _dotsController,
          delay: 0.2,
          color: AHColors.blue,
        ),
        const SizedBox(width: 8),
        _BouncingDot(
          controller: _dotsController,
          delay: 0.4,
          color: AHColors.gold,
        ),
      ],
    );
  }
}

// ─── Bouncing Dot ────────────────────────────────────────────────────────────

class _BouncingDot extends StatelessWidget {
  final AnimationController controller;
  final double delay;
  final Color color;

  const _BouncingDot({
    required this.controller,
    required this.delay,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: controller,
      builder: (context, child) {
        // Calculate bounce using sine wave with delay
        final t = (controller.value - delay) % 1.0;
        final bounce = sin(t * 2 * pi) * 0.5 + 0.5;
        final yOffset = -bounce * 8;

        return Transform.translate(
          offset: Offset(0, yOffset),
          child: Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: color,
            ),
          ),
        );
      },
    );
  }
}

// ─── Orbital Ring Painter ────────────────────────────────────────────────────

class _OrbitalRingPainter extends CustomPainter {
  final double rotation;
  final Color color;

  _OrbitalRingPainter({
    required this.rotation,
    required this.color,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2 - 4;

    canvas.save();
    canvas.translate(center.dx, center.dy);
    canvas.rotate(rotation);

    // Draw orbital arc (270 degrees)
    final paint = Paint()
      ..color = color.withOpacity(0.6)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.5
      ..strokeCap = StrokeCap.round;

    const startAngle = 0.0;
    const sweepAngle = 4.712; // ~270 degrees

    canvas.drawArc(
      Rect.fromCircle(radius: radius, center: Offset.zero),
      startAngle,
      sweepAngle,
      false,
      paint,
    );

    // Draw a brighter dot at the leading edge
    final dotAngle = startAngle + sweepAngle;
    final dotX = radius * cos(dotAngle);
    final dotY = radius * sin(dotAngle);

    final dotPaint = Paint()
      ..color = color
      ..style = PaintingStyle.fill;

    canvas.drawCircle(Offset(dotX, dotY), 4, dotPaint);

    // Draw a secondary smaller ring
    final innerRadius = radius * 0.7;
    final innerPaint = Paint()
      ..color = color.withOpacity(0.2)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;

    canvas.drawArc(
      Rect.fromCircle(radius: innerRadius, center: Offset.zero),
      startAngle + pi,
      sweepAngle * 0.6,
      false,
      innerPaint,
    );

    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant _OrbitalRingPainter oldDelegate) {
    return rotation != oldDelegate.rotation;
  }
}
