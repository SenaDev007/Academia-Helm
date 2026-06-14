import 'package:flutter/material.dart';

import '../../../core/theme/ah_theme.dart';
import '../providers/dashboard_provider.dart';

/// Reusable stat card widget:
/// - Icon
/// - Value (large number)
/// - Label
/// - Trend indicator (up/down)
/// - AH styling
class StatCard extends StatelessWidget {
  const StatCard({super.key, required this.stat});

  final DashboardStat stat;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AHRadius.lg),
      ),
      elevation: 1,
      child: Padding(
        padding: const EdgeInsets.all(AHSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            // ── Icon Row ───────────────────────────────────────────
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: stat.color.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(AHRadius.md),
                  ),
                  child: Icon(stat.icon, color: stat.color, size: 22),
                ),
                if (stat.trend != null) _buildTrendBadge(),
              ],
            ),
            const SizedBox(height: AHSpacing.lg),

            // ── Value ──────────────────────────────────────────────
            Text(
              stat.value,
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 24,
                fontWeight: FontWeight.w800,
                color: AHColors.gray900,
                height: 1.0,
              ),
            ),
            const SizedBox(height: AHSpacing.xs),

            // ── Label ──────────────────────────────────────────────
            Text(
              stat.label,
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: AHColors.gray500,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTrendBadge() {
    final isUp = stat.trend == 'up';
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AHSpacing.sm,
        vertical: 2,
      ),
      decoration: BoxDecoration(
        color: (isUp ? AHColors.successLight : AHColors.errorLight)
            .withValues(alpha: 0.8),
        borderRadius: BorderRadius.circular(AHRadius.full),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            isUp ? Icons.trending_up : Icons.trending_down,
            size: 14,
            color: isUp ? AHColors.success : AHColors.error,
          ),
          const SizedBox(width: 2),
          Text(
            stat.trendValue ?? '',
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: isUp ? AHColors.success : AHColors.error,
            ),
          ),
        ],
      ),
    );
  }
}
