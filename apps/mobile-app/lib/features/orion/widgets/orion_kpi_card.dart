import 'package:flutter/material.dart';

import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';

/// A small card showing an ORION KPI (value + trend + label).
/// Used in module dashboards to show AI-driven metrics.
/// Shows trend arrow (up=good, down=bad) with color.
class OrionKpiCard extends StatelessWidget {
  const OrionKpiCard({
    super.key,
    required this.label,
    required this.value,
    this.trend,
    this.trendValue,
    this.icon,
  });

  final String label;
  final String value;
  /// 'up' = positive trend, 'down' = negative trend, null = no trend
  final String? trend;
  /// Optional numeric trend value like '+5%' or '-2%'
  final String? trendValue;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final bool isPositive = trend == 'up';
    final bool isNegative = trend == 'down';
    final Color trendColor = isPositive
        ? AHColors.success
        : isNegative
            ? AHColors.error
            : AHColors.gray400;
    final IconData trendIcon = isPositive
        ? Icons.trending_up
        : isNegative
            ? Icons.trending_down
            : Icons.trending_flat;

    return Container(
      padding: const EdgeInsets.all(AHSpacing.md),
      decoration: BoxDecoration(
        color: AHColors.white,
        borderRadius: BorderRadius.circular(AHRadius.lg),
        border: Border.all(color: AHColors.gray200),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          // ── Header row: icon + label ───────────────────────────
          Row(
            children: [
              if (icon != null) ...[
                Icon(icon, size: 16, color: AHColors.gray400),
                const SizedBox(width: AHSpacing.xs),
              ],
              const Icon(Icons.auto_awesome, size: 14, color: AHColors.gold),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  label,
                  style: const TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                    color: AHColors.gray500,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: AHSpacing.sm),

          // ── Value ──────────────────────────────────────────────
          Text(
            value,
            style: const TextStyle(
              fontFamily: 'Inter',
              fontSize: 20,
              fontWeight: FontWeight.w700,
              color: AHColors.navy,
            ),
          ),

          // ── Trend indicator ────────────────────────────────────
          if (trend != null || trendValue != null) ...[
            const SizedBox(height: AHSpacing.xxs),
            Row(
              children: [
                Icon(trendIcon, size: 14, color: trendColor),
                const SizedBox(width: 2),
                if (trendValue != null)
                  Text(
                    trendValue!,
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: trendColor,
                    ),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
