import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/error_widget.dart' as ah_error;
import '../providers/grades_provider.dart';
import '../widgets/grade_score_indicator.dart';

/// Screen showing the full details of a single grade.
///
/// Features:
/// - Large score display with animated circular progress indicator
/// - Subject, evaluation type, date, coefficient, teacher, comment
/// - Color coding based on score performance
/// - Share button (placeholder)
class GradeDetailScreen extends ConsumerWidget {
  const GradeDetailScreen({super.key, required this.gradeId});

  final String gradeId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final gradeAsync = ref.watch(gradeDetailProvider(gradeId));

    return Scaffold(
      backgroundColor: AHColors.lightBackground,
      body: gradeAsync.when(
        loading: () => const Center(
          child: CircularProgressIndicator(color: AHColors.navy),
        ),
        error: (error, _) => ah_error.AHErrorWidget(
          message: 'Impossible de charger le détail de la note.',
          onRetry: () => ref.invalidate(gradeDetailProvider(gradeId)),
        ),
        data: (grade) => _GradeDetailContent(grade: grade),
      ),
    );
  }
}

class _GradeDetailContent extends StatelessWidget {
  const _GradeDetailContent({required this.grade});

  final Grade grade;

  Color get _accentColor {
    if (grade.isExcellent) return AHColors.gold;
    if (grade.isPassing) return AHColors.success;
    return AHColors.error;
  }

  Color get _accentLightColor {
    if (grade.isExcellent) return AHColors.goldLight;
    if (grade.isPassing) return AHColors.successLight;
    return AHColors.errorLight;
  }

  String get _performanceLabel {
    if (grade.percentage >= 90) return 'Exceptionnel';
    if (grade.percentage >= 80) return 'Excellent';
    if (grade.percentage >= 70) return 'Très bien';
    if (grade.percentage >= 60) return 'Bien';
    if (grade.percentage >= 50) return 'Passable';
    if (grade.percentage >= 40) return 'Insuffisant';
    return 'Très insuffisant';
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      child: Column(
        children: [
          // ── Header with gradient ────────────────────────────────────
          _DetailHeader(grade: grade, accentColor: _accentColor),

          // ── Score Indicator ─────────────────────────────────────────
          Container(
            margin: const EdgeInsets.all(AHSpacing.lg),
            padding: const EdgeInsets.all(AHSpacing.xl),
            decoration: BoxDecoration(
              color: AHColors.white,
              borderRadius: BorderRadius.circular(AHSpacing.r16),
              boxShadow: [
                BoxShadow(
                  color: AHColors.navy.withOpacity(0.06),
                  offset: const Offset(0, 2),
                  blurRadius: 8,
                ),
              ],
            ),
            child: Column(
              children: [
                GradeScoreIndicator(
                  score: grade.score,
                  maxScore: grade.maxScore,
                  size: 140,
                  strokeWidth: 10,
                ),
                const SizedBox(height: AHSpacing.lg),
                Text(
                  _performanceLabel,
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: _accentColor,
                  ),
                ),
                const SizedBox(height: AHSpacing.xs),
                Text(
                  'Coefficient : ${grade.coefficient.toStringAsFixed(0)}',
                  style: const TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 13,
                    fontWeight: FontWeight.w400,
                    color: AHColors.grey500,
                  ),
                ),
              ],
            ),
          ),

          // ── Details Section ─────────────────────────────────────────
          Container(
            margin: const EdgeInsets.symmetric(horizontal: AHSpacing.lg),
            padding: const EdgeInsets.all(AHSpacing.lg),
            decoration: BoxDecoration(
              color: AHColors.white,
              borderRadius: BorderRadius.circular(AHSpacing.r16),
              boxShadow: [
                BoxShadow(
                  color: AHColors.navy.withOpacity(0.06),
                  offset: const Offset(0, 2),
                  blurRadius: 8,
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Détails',
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: AHColors.grey900,
                  ),
                ),
                const SizedBox(height: AHSpacing.md),
                const Divider(height: 1, color: AHColors.lightOutline),
                const SizedBox(height: AHSpacing.md),

                _DetailRow(
                  icon: Icons.menu_book_outlined,
                  label: 'Matière',
                  value: grade.subjectName,
                ),
                _DetailRow(
                  icon: Icons.assignment_outlined,
                  label: 'Type d\'évaluation',
                  value: grade.evaluationType.label,
                ),
                _DetailRow(
                  icon: Icons.calendar_today_outlined,
                  label: 'Date',
                  value: AHFormatters.formatDateDisplay(grade.date),
                ),
                _DetailRow(
                  icon: Icons.scale_outlined,
                  label: 'Coefficient',
                  value: grade.coefficient.toStringAsFixed(0),
                ),
                if (grade.teacherName != null)
                  _DetailRow(
                    icon: Icons.person_outline,
                    label: 'Enseignant',
                    value: grade.teacherName!,
                  ),
                if (grade.periodName != null)
                  _DetailRow(
                    icon: Icons.event_outlined,
                    label: 'Période',
                    value: grade.periodName!,
                  ),

                if (grade.comment != null && grade.comment!.isNotEmpty) ...[
                  const SizedBox(height: AHSpacing.md),
                  const Divider(height: 1, color: AHColors.lightOutline),
                  const SizedBox(height: AHSpacing.md),
                  const Text(
                    'Commentaire',
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: AHColors.grey900,
                    ),
                  ),
                  const SizedBox(height: AHSpacing.sm),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(AHSpacing.md),
                    decoration: BoxDecoration(
                      color: _accentLightColor.withOpacity(0.3),
                      borderRadius: BorderRadius.circular(AHSpacing.r8),
                      border: Border.all(
                        color: _accentColor.withOpacity(0.2),
                      ),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(Icons.chat_bubble_outline, color: _accentColor, size: 18),
                        const SizedBox(width: AHSpacing.sm),
                        Expanded(
                          child: Text(
                            grade.comment!,
                            style: TextStyle(
                              fontFamily: 'Inter',
                              fontSize: 13,
                              fontWeight: FontWeight.w400,
                              color: AHColors.grey700,
                              height: 1.4,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),

          const SizedBox(height: AHSpacing.lg),

          // ── Share Button ────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: AHSpacing.lg),
            child: SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () {
                  Share.share(
                    'Note de ${grade.subjectName} : ${grade.score}/${grade.maxScore} (${grade.evaluationType.label}) du ${AHFormatters.formatDateDisplay(grade.date)}',
                    subject: 'Note — ${grade.subjectName}',
                  );
                },
                icon: const Icon(Icons.share_outlined, size: 18),
                label: const Text('Partager'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AHColors.navy,
                  side: const BorderSide(color: AHColors.navy, width: 1.5),
                  padding: const EdgeInsets.symmetric(vertical: AHSpacing.md),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AHSpacing.r8),
                  ),
                  textStyle: const TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
          ),

          const SizedBox(height: AHSpacing.xxl),
        ],
      ),
    );
  }
}

// ── Detail Header ─────────────────────────────────────────────────────

class _DetailHeader extends StatelessWidget {
  const _DetailHeader({required this.grade, required this.accentColor});

  final Grade grade;
  final Color accentColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(
        AHSpacing.xl,
        AHSpacing.xl + 12,
        AHSpacing.xl,
        AHSpacing.xl,
      ),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [accentColor.withOpacity(0.9), accentColor],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: const BorderRadius.only(
          bottomLeft: Radius.circular(AHSpacing.r24),
          bottomRight: Radius.circular(AHSpacing.r24),
        ),
      ),
      child: SafeArea(
        bottom: false,
        child: Row(
          children: [
            IconButton(
              icon: const Icon(Icons.arrow_back, color: AHColors.white),
              onPressed: () => context.pop(),
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(),
            ),
            const SizedBox(width: AHSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Détail de la note',
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 20,
                      fontWeight: FontWeight.w700,
                      color: AHColors.white,
                    ),
                  ),
                  const SizedBox(height: AHSpacing.xs),
                  Text(
                    grade.subjectName,
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                      color: AHColors.white.withOpacity(0.85),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Detail Row ────────────────────────────────────────────────────────

class _DetailRow extends StatelessWidget {
  const _DetailRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AHSpacing.md),
      child: Row(
        children: [
          Icon(icon, size: 20, color: AHColors.grey500),
          const SizedBox(width: AHSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                    color: AHColors.grey500,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: const TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                    color: AHColors.grey900,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
