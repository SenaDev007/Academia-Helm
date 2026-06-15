import 'package:flutter/material.dart';

import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../../../core/utils/formatters.dart';
import '../providers/absences_provider.dart';

/// A card for an absence/tardiness item.
///
/// Shows type icon, date, time (for tardiness), subject name,
/// justification status badge, and reporter name.
class AbsenceCard extends StatelessWidget {
  const AbsenceCard({
    super.key,
    required this.record,
  });

  final AbsenceRecord record;

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
      child: Padding(
        padding: const EdgeInsets.all(AHSpacing.md),
        child: Row(
          children: [
            // ── Type Icon ─────────────────────────────────────────────
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: record.type.color.withOpacity(0.1),
                borderRadius: BorderRadius.circular(AHSpacing.r8),
              ),
              child: Icon(
                record.type.icon,
                color: record.type.color,
                size: 24,
              ),
            ),

            const SizedBox(width: AHSpacing.md),

            // ── Details ───────────────────────────────────────────────
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Subject name
                  if (record.subjectName != null)
                    Text(
                      record.subjectName!,
                      style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: AHColors.grey900,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    )
                  else
                    Text(
                      record.type == AbsenceType.absence
                          ? 'Absence complète'
                          : 'Retard',
                      style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: AHColors.grey900,
                      ),
                    ),
                  const SizedBox(height: AHSpacing.xs),

                  // Date and time row
                  Row(
                    children: [
                      Icon(
                        Icons.calendar_today_outlined,
                        size: 13,
                        color: AHColors.grey500,
                      ),
                      const SizedBox(width: AHSpacing.xs),
                      Text(
                        AHFormatters.formatDateDisplay(record.date),
                        style: const TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 12,
                          fontWeight: FontWeight.w400,
                          color: AHColors.grey500,
                        ),
                      ),
                      if (record.time != null) ...[
                        const SizedBox(width: AHSpacing.md),
                        Icon(
                          Icons.access_time,
                          size: 13,
                          color: AHColors.grey500,
                        ),
                        const SizedBox(width: AHSpacing.xs),
                        Text(
                          '${record.time!.hour.toString().padLeft(2, '0')}:${record.time!.minute.toString().padLeft(2, '0')}',
                          style: const TextStyle(
                            fontFamily: 'Inter',
                            fontSize: 12,
                            fontWeight: FontWeight.w400,
                            color: AHColors.grey500,
                          ),
                        ),
                      ],
                      if (record.durationLabel.isNotEmpty) ...[
                        const SizedBox(width: AHSpacing.md),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: AHSpacing.sm,
                            vertical: 1,
                          ),
                          decoration: BoxDecoration(
                            color: AHColors.lightSurfaceVariant,
                            borderRadius: BorderRadius.circular(AHSpacing.r4),
                          ),
                          child: Text(
                            record.durationLabel,
                            style: const TextStyle(
                              fontFamily: 'Inter',
                              fontSize: 10,
                              fontWeight: FontWeight.w500,
                              color: AHColors.grey600,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),

                  // Reporter
                  if (record.reporterName != null) ...[
                    const SizedBox(height: AHSpacing.xs),
                    Row(
                      children: [
                        Icon(
                          Icons.person_outline,
                          size: 13,
                          color: AHColors.grey500,
                        ),
                        const SizedBox(width: AHSpacing.xs),
                        Text(
                          record.reporterName!,
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

                  // Justification reason
                  if (record.justificationReason != null &&
                      record.justificationStatus == JustificationStatus.justified) ...[
                    const SizedBox(height: AHSpacing.xs),
                    Text(
                      record.justificationReason!,
                      style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 12,
                        fontWeight: FontWeight.w400,
                        color: AHColors.grey600,
                        fontStyle: FontStyle.italic,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ],
              ),
            ),

            const SizedBox(width: AHSpacing.sm),

            // ── Justification Badge ───────────────────────────────────
            Container(
              padding: const EdgeInsets.symmetric(
                horizontal: AHSpacing.sm,
                vertical: 4,
              ),
              decoration: BoxDecoration(
                color: record.justificationStatus.backgroundColor,
                borderRadius: BorderRadius.circular(AHSpacing.r8),
              ),
              child: Text(
                record.justificationStatus.label,
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                  color: record.justificationStatus.color,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
