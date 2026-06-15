import 'package:flutter/material.dart';

import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../../../core/utils/formatters.dart';
import '../providers/grades_provider.dart';

/// A card widget for displaying a grade in a list.
///
/// Shows subject name, score with color background, evaluation type chip,
/// date, and coefficient. Tapping navigates to the grade detail.
class GradeCard extends StatelessWidget {
  const GradeCard({
    super.key,
    required this.grade,
    this.onTap,
  });

  final Grade grade;
  final VoidCallback? onTap;

  Color get _scoreColor {
    if (grade.isExcellent) return AHColors.gold;
    if (grade.isPassing) return AHColors.success;
    return AHColors.error;
  }

  Color get _scoreBackgroundColor {
    if (grade.isExcellent) return AHColors.goldLight.withOpacity(0.2);
    if (grade.isPassing) return AHColors.successLight.withOpacity(0.3);
    return AHColors.errorLight.withOpacity(0.3);
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(
        horizontal: AHSpacing.lg,
        vertical: AHSpacing.xs,
      ),
      elevation: AHSpacing.elevationNone,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AHSpacing.r12),
        side: BorderSide(
          color: AHColors.lightOutline.withOpacity(0.5),
          width: 0.5,
        ),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AHSpacing.r12),
        child: Padding(
          padding: const EdgeInsets.all(AHSpacing.md),
          child: Row(
            children: [
              // ── Score Circle ────────────────────────────────────────
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  color: _scoreBackgroundColor,
                  shape: BoxShape.circle,
                ),
                child: Center(
                  child: Text(
                    grade.score.toStringAsFixed(1),
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: _scoreColor,
                    ),
                  ),
                ),
              ),

              const SizedBox(width: AHSpacing.md),

              // ── Subject & Details ───────────────────────────────────
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Subject name
                    Text(
                      grade.subjectName,
                      style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: AHColors.grey900,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: AHSpacing.xs),

                    // Evaluation type + date row
                    Row(
                      children: [
                        // Evaluation type chip
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: AHSpacing.sm,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: AHColors.lightSurfaceVariant,
                            borderRadius: BorderRadius.circular(AHSpacing.r4),
                          ),
                          child: Text(
                            grade.evaluationType.label,
                            style: const TextStyle(
                              fontFamily: 'Inter',
                              fontSize: 10,
                              fontWeight: FontWeight.w500,
                              color: AHColors.grey600,
                            ),
                          ),
                        ),
                        const SizedBox(width: AHSpacing.sm),

                        // Date
                        Text(
                          AHFormatters.formatDateDisplay(grade.date),
                          style: const TextStyle(
                            fontFamily: 'Inter',
                            fontSize: 12,
                            fontWeight: FontWeight.w400,
                            color: AHColors.grey500,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              const SizedBox(width: AHSpacing.sm),

              // ── Coefficient & Max ───────────────────────────────────
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    '/${grade.maxScore.toStringAsFixed(0)}',
                    style: const TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 12,
                      fontWeight: FontWeight.w400,
                      color: AHColors.grey500,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AHSpacing.sm,
                      vertical: 2,
                    ),
                    decoration: BoxDecoration(
                      color: AHColors.navy.withOpacity(0.08),
                      borderRadius: BorderRadius.circular(AHSpacing.r4),
                    ),
                    child: Text(
                      'Coef. ${grade.coefficient.toStringAsFixed(0)}',
                      style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 10,
                        fontWeight: FontWeight.w500,
                        color: AHColors.navy,
                      ),
                    ),
                  ),
                ],
              ),

              // ── Chevron ─────────────────────────────────────────────
              const SizedBox(width: AHSpacing.xs),
              Icon(
                Icons.chevron_right,
                color: AHColors.grey400,
                size: AHSpacing.icon20,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
