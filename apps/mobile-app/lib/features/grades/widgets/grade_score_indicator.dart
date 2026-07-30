import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';

/// A circular progress indicator showing the score percentage.
///
/// Animated from 0 to the target percentage with color coding:
/// - Gold (>=80%): Excellent
/// - Green (>=50%): Passing
/// - Red (<50%): Failing
class GradeScoreIndicator extends StatefulWidget {
  const GradeScoreIndicator({
    super.key,
    required this.score,
    required this.maxScore,
    this.size = 100,
    this.strokeWidth = 8,
    this.showLabel = true,
  });

  final double score;
  final double maxScore;
  final double size;
  final double strokeWidth;
  final bool showLabel;

  @override
  State<GradeScoreIndicator> createState() => _GradeScoreIndicatorState();
}

class _GradeScoreIndicatorState extends State<GradeScoreIndicator>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    );
    _animation = CurvedAnimation(
      parent: _controller,
      curve: Curves.easeOutCubic,
    );
    _controller.forward();
  }

  @override
  void didUpdateWidget(covariant GradeScoreIndicator oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.score != widget.score || oldWidget.maxScore != widget.maxScore) {
      _controller.reset();
      _controller.forward();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  double get _percentage =>
      widget.maxScore > 0 ? (widget.score / widget.maxScore) * 100 : 0.0;

  Color get _progressColor {
    if (_percentage >= 80) return AHColors.gold;
    if (_percentage >= 50) return AHColors.success;
    return AHColors.error;
  }

  Color get _trackColor {
    if (_percentage >= 80) return AHColors.goldLight.withOpacity(0.3);
    if (_percentage >= 50) return AHColors.successLight.withOpacity(0.3);
    return AHColors.errorLight.withOpacity(0.3);
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _animation,
      builder: (context, child) {
        final animatedPercentage = _percentage * _animation.value;
        return SizedBox(
          width: widget.size,
          height: widget.size,
          child: CustomPaint(
            painter: _CircularProgressPainter(
              progress: (animatedPercentage / 100).clamp(0.0, 1.0),
              color: _progressColor,
              trackColor: _trackColor,
              strokeWidth: widget.strokeWidth,
            ),
            child: Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    '${animatedPercentage.toStringAsFixed(1)}%',
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: widget.size * 0.22,
                      fontWeight: FontWeight.w700,
                      color: _progressColor,
                      height: 1,
                    ),
                  ),
                  if (widget.showLabel) ...[
                    const SizedBox(height: 2),
                    Text(
                      '${widget.score.toStringAsFixed(1)}/${widget.maxScore.toStringAsFixed(0)}',
                      style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: widget.size * 0.12,
                        fontWeight: FontWeight.w500,
                        color: AHColors.grey500,
                        height: 1,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

class _CircularProgressPainter extends CustomPainter {
  _CircularProgressPainter({
    required this.progress,
    required this.color,
    required this.trackColor,
    required this.strokeWidth,
  });

  final double progress;
  final Color color;
  final Color trackColor;
  final double strokeWidth;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = (size.width - strokeWidth) / 2;

    // Track circle
    final trackPaint = Paint()
      ..color = trackColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round;
    canvas.drawCircle(center, radius, trackPaint);

    // Progress arc
    if (progress > 0) {
      final progressPaint = Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = strokeWidth
        ..strokeCap = StrokeCap.round;

      const startAngle = -math.pi / 2;
      final sweepAngle = 2 * math.pi * progress.clamp(0.0, 1.0);
      canvas.drawArc(
        Rect.fromCircle(center: center, radius: radius),
        startAngle,
        sweepAngle,
        false,
        progressPaint,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _CircularProgressPainter oldDelegate) {
    return oldDelegate.progress != progress || oldDelegate.color != color;
  }
}
