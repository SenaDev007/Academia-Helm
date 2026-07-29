/// ============================================================================
/// INLINE SPINNER — Academia Hub Mobile
/// ============================================================================
///
/// Inline spinner matching the web app's InlineSpinner:
/// - 5 sizes (xs/sm/md/lg/xl)
/// - 5 colors (navy/blue/gold/white/muted)
/// - Orbital ring spinner
/// - BouncingDots component
/// - LinearProgress component
///
/// Uses AHColors: Navy (#0B2F73), Gold (#F5B335), Blue (#1D4FA5)
/// ============================================================================

import 'dart:math';

import 'package:flutter/material.dart';

import '../../theme/ah_colors.dart';

// ─── Spinner Size ────────────────────────────────────────────────────────────

enum SpinnerSize {
  xs(12),
  sm(18),
  md(24),
  lg(36),
  xl(48);

  final double value;
  const SpinnerSize(this.value);
}

// ─── Spinner Color ───────────────────────────────────────────────────────────

enum SpinnerColor {
  navy(AHColors.navy),
  blue(AHColors.blue),
  gold(AHColors.gold),
  white(Colors.white),
  muted(AHColors.muted);

  final Color value;
  const SpinnerColor(this.value);
}

// ─── Orbital Spinner ─────────────────────────────────────────────────────────

/// Orbital ring spinner — a rotating arc with a leading dot.
class OrbitalSpinner extends StatefulWidget {
  final SpinnerSize size;
  final SpinnerColor color;
  final String? semanticsLabel;

  const OrbitalSpinner({
    super.key,
    this.size = SpinnerSize.md,
    this.color = SpinnerColor.navy,
    this.semanticsLabel,
  });

  @override
  State<OrbitalSpinner> createState() => _OrbitalSpinnerState();
}

class _OrbitalSpinnerState extends State<OrbitalSpinner>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final size = widget.size.value;

    return Semantics(
      label: widget.semanticsLabel ?? 'Chargement en cours',
      child: SizedBox(
        width: size,
        height: size,
        child: AnimatedBuilder(
          animation: _controller,
          builder: (context, child) {
            return CustomPaint(
              size: Size(size, size),
              painter: _OrbitalSpinnerPainter(
                rotation: _controller.value * 2 * pi,
                color: widget.color.value,
                strokeWidth: size / 8,
              ),
            );
          },
        ),
      ),
    );
  }
}

class _OrbitalSpinnerPainter extends CustomPainter {
  final double rotation;
  final Color color;
  final double strokeWidth;

  _OrbitalSpinnerPainter({
    required this.rotation,
    required this.color,
    required this.strokeWidth,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2 - strokeWidth;

    canvas.save();
    canvas.translate(center.dx, center.dy);
    canvas.rotate(rotation);

    // Arc (270 degrees)
    final arcPaint = Paint()
      ..color = color.withOpacity(0.4)
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round;

    canvas.drawArc(
      Rect.fromCircle(radius: radius, center: Offset.zero),
      0,
      4.712,
      false,
      arcPaint,
    );

    // Leading dot
    final dotAngle = 4.712;
    final dotX = radius * cos(dotAngle);
    final dotY = radius * sin(dotAngle);

    final dotPaint = Paint()
      ..color = color
      ..style = PaintingStyle.fill;

    canvas.drawCircle(Offset(dotX, dotY), strokeWidth * 0.8, dotPaint);

    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant _OrbitalSpinnerPainter oldDelegate) {
    return rotation != oldDelegate.rotation;
  }
}

// ─── Bouncing Dots ───────────────────────────────────────────────────────────

/// 3 bouncing dots animation.
class BouncingDots extends StatefulWidget {
  final SpinnerSize size;
  final SpinnerColor color;

  const BouncingDots({
    super.key,
    this.size = SpinnerSize.md,
    this.color = SpinnerColor.navy,
  });

  @override
  State<BouncingDots> createState() => _BouncingDotsState();
}

class _BouncingDotsState extends State<BouncingDots>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final dotSize = widget.size.value * 0.35;
    final colors = _getDotColors();

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(3, (index) {
        return Padding(
          padding: EdgeInsets.symmetric(horizontal: dotSize * 0.3),
          child: AnimatedBuilder(
            animation: _controller,
            builder: (context, child) {
              final delay = index * 0.15;
              final t = (_controller.value - delay) % 1.0;
              final bounce = sin(t * 2 * pi) * 0.5 + 0.5;
              final yOffset = -bounce * dotSize * 1.2;

              return Transform.translate(
                offset: Offset(0, yOffset),
                child: Container(
                  width: dotSize,
                  height: dotSize,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: colors[index],
                  ),
                ),
              );
            },
          ),
        );
      }),
    );
  }

  List<Color> _getDotColors() {
    switch (widget.color) {
      case SpinnerColor.navy:
        return [AHColors.navyLight, AHColors.blue, AHColors.navy];
      case SpinnerColor.blue:
        return [AHColors.blueLight, AHColors.blue, AHColors.navy];
      case SpinnerColor.gold:
        return [AHColors.goldLight, AHColors.gold, AHColors.goldDark];
      case SpinnerColor.white:
        return [
          Colors.white.withOpacity(0.7),
          Colors.white.withOpacity(0.9),
          Colors.white,
        ];
      case SpinnerColor.muted:
        return [
          AHColors.muted.withOpacity(0.5),
          AHColors.muted.withOpacity(0.7),
          AHColors.muted,
        ];
    }
  }
}

// ─── Linear Progress ─────────────────────────────────────────────────────────

/// Linear progress indicator matching the web app's style.
class LinearProgress extends StatefulWidget {
  /// Progress from 0.0 to 1.0. If null, shows indeterminate.
  final double? progress;
  final double height;
  final SpinnerColor color;

  const LinearProgress({
    super.key,
    this.progress,
    this.height = 4,
    this.color = SpinnerColor.navy,
  });

  @override
  State<LinearProgress> createState() => _LinearProgressState();
}

class _LinearProgressState extends State<LinearProgress>
    with SingleTickerProviderStateMixin {
  AnimationController? _indeterminateController;

  @override
  void initState() {
    super.initState();
    if (widget.progress == null) {
      _indeterminateController = AnimationController(
        vsync: this,
        duration: const Duration(milliseconds: 1500),
      )..repeat();
    }
  }

  @override
  void didUpdateWidget(LinearProgress oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.progress == null && _indeterminateController == null) {
      _indeterminateController = AnimationController(
        vsync: this,
        duration: const Duration(milliseconds: 1500),
      )..repeat();
    } else if (widget.progress != null && _indeterminateController != null) {
      _indeterminateController?.dispose();
      _indeterminateController = null;
    }
  }

  @override
  void dispose() {
    _indeterminateController?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final trackColor = widget.color.value.withOpacity(0.15);
    final fillColor = widget.color.value;

    if (widget.progress != null) {
      // Determinate
      final progress = widget.progress!.clamp(0.0, 1.0);
      return ClipRRect(
        borderRadius: BorderRadius.circular(widget.height / 2),
        child: SizedBox(
          height: widget.height,
          child: Stack(
            children: [
              Container(
                decoration: BoxDecoration(
                  color: trackColor,
                  borderRadius: BorderRadius.circular(widget.height / 2),
                ),
              ),
              FractionallySizedBox(
                widthFactor: progress,
                child: Container(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [AHColors.navy, fillColor],
                    ),
                    borderRadius: BorderRadius.circular(widget.height / 2),
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }

    // Indeterminate
    return ClipRRect(
      borderRadius: BorderRadius.circular(widget.height / 2),
      child: SizedBox(
        height: widget.height,
        child: AnimatedBuilder(
          animation: _indeterminateController!,
          builder: (context, child) {
            final value = _indeterminateController!.value;
            final start = value - 0.3;
            final end = value + 0.1;

            return Stack(
              children: [
                Container(
                  decoration: BoxDecoration(
                    color: trackColor,
                    borderRadius: BorderRadius.circular(widget.height / 2),
                  ),
                ),
                FractionallySizedBox(
                  widthFactor: 0.4,
                  alignment: Alignment(-1.0 + value * 2, 0),
                  child: Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [AHColors.navy, fillColor, AHColors.gold],
                      ),
                      borderRadius: BorderRadius.circular(widget.height / 2),
                    ),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

// ─── Inline Spinner Convenience Widget ───────────────────────────────────────

/// Convenience widget that combines an orbital spinner with optional label.
class InlineSpinner extends StatelessWidget {
  final SpinnerSize size;
  final SpinnerColor color;
  final String? label;
  final double spacing;

  const InlineSpinner({
    super.key,
    this.size = SpinnerSize.md,
    this.color = SpinnerColor.navy,
    this.label,
    this.spacing = 8,
  });

  @override
  Widget build(BuildContext context) {
    if (label == null) {
      return OrbitalSpinner(size: size, color: color);
    }

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        OrbitalSpinner(size: size, color: color),
        SizedBox(width: spacing),
        Text(
          label!,
          style: TextStyle(
            color: color.value,
            fontSize: size.value * 0.6,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }
}
