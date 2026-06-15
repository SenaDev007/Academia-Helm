import 'package:flutter/material.dart';

import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../providers/schedule_provider.dart';

/// A card for a schedule entry.
///
/// Shows time display on left, subject, room, teacher info,
/// type chip (COURS/TD/TP), and subject color indicator on left border.
class ScheduleEntryCard extends StatelessWidget {
  const ScheduleEntryCard({
    super.key,
    required this.entry,
  });

  final ScheduleEntry entry;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(
        horizontal: AHSpacing.lg,
        vertical: AHSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: AHColors.white,
        borderRadius: BorderRadius.circular(AHSpacing.r12),
        boxShadow: [
          BoxShadow(
            color: AHColors.navy.withOpacity(0.04),
            offset: const Offset(0, 1),
            blurRadius: 4,
          ),
        ],
      ),
      child: IntrinsicHeight(
        child: Row(
          children: [
            // ── Subject color indicator ───────────────────────────────
            Container(
              width: 5,
              decoration: BoxDecoration(
                color: entry.subjectColor,
                borderRadius: const BorderRadius.only(
                  topLeft: Radius.circular(AHSpacing.r12),
                  bottomLeft: Radius.circular(AHSpacing.r12),
                ),
              ),
            ),

            // ── Time Column ───────────────────────────────────────────
            Container(
              width: 64,
              padding: const EdgeInsets.symmetric(
                horizontal: AHSpacing.sm,
                vertical: AHSpacing.md,
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    entry.startTimeLabel,
                    style: const TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AHColors.grey900,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    entry.endTimeLabel,
                    style: const TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 11,
                      fontWeight: FontWeight.w400,
                      color: AHColors.grey500,
                    ),
                  ),
                ],
              ),
            ),

            // ── Vertical Divider ──────────────────────────────────────
            VerticalDivider(
              width: 1,
              thickness: 1,
              color: AHColors.lightOutline.withOpacity(0.5),
              indent: AHSpacing.md,
              endIndent: AHSpacing.md,
            ),

            // ── Content ──────────────────────────────────────────────
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(AHSpacing.md),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Subject name + Type chip
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            entry.subjectName,
                            style: const TextStyle(
                              fontFamily: 'Inter',
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                              color: AHColors.grey900,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: AHSpacing.sm),
                        // Type chip
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: AHSpacing.sm,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: entry.type.color.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(AHSpacing.r4),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(entry.type.icon, size: 12, color: entry.type.color),
                              const SizedBox(width: 3),
                              Text(
                                entry.type.label,
                                style: TextStyle(
                                  fontFamily: 'Inter',
                                  fontSize: 10,
                                  fontWeight: FontWeight.w600,
                                  color: entry.type.color,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: AHSpacing.sm),

                    // Room and Teacher
                    Row(
                      children: [
                        if (entry.room != null) ...[
                          Icon(Icons.room_outlined, size: 14, color: AHColors.grey500),
                          const SizedBox(width: AHSpacing.xs),
                          Text(
                            entry.room!,
                            style: const TextStyle(
                              fontFamily: 'Inter',
                              fontSize: 12,
                              fontWeight: FontWeight.w400,
                              color: AHColors.grey600,
                            ),
                          ),
                          const SizedBox(width: AHSpacing.md),
                        ],
                        if (entry.teacherName != null) ...[
                          Icon(Icons.person_outline, size: 14, color: AHColors.grey500),
                          const SizedBox(width: AHSpacing.xs),
                          Flexible(
                            child: Text(
                              entry.teacherName!,
                              style: const TextStyle(
                                fontFamily: 'Inter',
                                fontSize: 12,
                                fontWeight: FontWeight.w400,
                                color: AHColors.grey600,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
