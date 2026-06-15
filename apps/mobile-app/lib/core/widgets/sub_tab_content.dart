/// ============================================================================
/// SUB TAB CONTENT — Academia Hub Mobile
/// ============================================================================
///
/// Reusable content widgets for module sub-tab screens.
/// Provides:
///   - SubTabContentWrapper: Scrollable wrapper with padding
///   - StatCard: Dashboard statistic card
///   - SectionHeader: Section title with optional action
///   - ListItemCard: Card for list items with leading/trailing widgets
///   - PlaceholderContent: Placeholder for unimplemented sub-tabs
///   - StatusBadge: Colored status indicator
///   - AHProgressBar: Custom progress bar with brand colors
/// ============================================================================

import 'package:flutter/material.dart';
import '../theme/ah_colors.dart';
import '../theme/ah_spacing.dart';

// ─── SubTabContentWrapper ─────────────────────────────────────────────────

/// Scrollable content wrapper with consistent padding.
class SubTabContentWrapper extends StatelessWidget {
  final List<Widget> children;
  final EdgeInsets padding;
  final CrossAxisAlignment crossAxisAlignment;

  const SubTabContentWrapper({
    super.key,
    required this.children,
    this.padding = const EdgeInsets.all(AHSpacing.lg),
    this.crossAxisAlignment = CrossAxisAlignment.stretch,
  });

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: padding,
      child: Column(
        crossAxisAlignment: crossAxisAlignment,
        children: children,
      ),
    );
  }
}

// ─── StatCard ─────────────────────────────────────────────────────────────

/// A dashboard statistic card showing a value, label, and optional icon/trend.
class StatCard extends StatelessWidget {
  final String title;
  final String value;
  final IconData icon;
  final Color? iconColor;
  final Color? iconBgColor;
  final String? subtitle;
  final VoidCallback? onTap;

  const StatCard({
    super.key,
    required this.title,
    required this.value,
    required this.icon,
    this.iconColor,
    this.iconBgColor,
    this.subtitle,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: AHSpacing.cardElevation,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AHSpacing.cardBorderRadius),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AHSpacing.cardBorderRadius),
        child: Padding(
          padding: const EdgeInsets.all(AHSpacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(AHSpacing.sm),
                    decoration: BoxDecoration(
                      color: iconBgColor ?? AHColors.navy.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(AHSpacing.radiusSM),
                    ),
                    child: Icon(
                      icon,
                      size: AHSpacing.iconSM,
                      color: iconColor ?? AHColors.navy,
                    ),
                  ),
                  const Spacer(),
                  if (subtitle != null)
                    Text(
                      subtitle!,
                      style: const TextStyle(
                        fontSize: 11,
                        color: AHColors.muted,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                ],
              ),
              const SizedBox(height: AHSpacing.md),
              Text(
                value,
                style: const TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  color: AHColors.textPrimary,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                title,
                style: const TextStyle(
                  fontSize: 12,
                  color: AHColors.textSecondary,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── SectionHeader ────────────────────────────────────────────────────────

/// Section title with optional action button.
class SectionHeader extends StatelessWidget {
  final String title;
  final String? actionLabel;
  final VoidCallback? onAction;
  final IconData? actionIcon;

  const SectionHeader({
    super.key,
    required this.title,
    this.actionLabel,
    this.onAction,
    this.actionIcon,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(
        top: AHSpacing.lg,
        bottom: AHSpacing.sm,
      ),
      child: Row(
        children: [
          Text(
            title,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: AHColors.textPrimary,
            ),
          ),
          const Spacer(),
          if (actionLabel != null && onAction != null)
            TextButton.icon(
              onPressed: onAction,
              icon: Icon(actionIcon ?? Icons.arrow_forward, size: 16),
              label: Text(actionLabel!),
              style: TextButton.styleFrom(
                foregroundColor: AHColors.navy,
                textStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                padding: const EdgeInsets.symmetric(horizontal: 8),
              ),
            ),
        ],
      ),
    );
  }
}

// ─── ListItemCard ─────────────────────────────────────────────────────────

/// A card for list items with leading icon, title, subtitle, and trailing.
class ListItemCard extends StatelessWidget {
  final String title;
  final String? subtitle;
  final IconData? leadingIcon;
  final Color? leadingIconColor;
  final Color? leadingIconBgColor;
  final Widget? trailing;
  final VoidCallback? onTap;
  final StatusBadge? badge;

  const ListItemCard({
    super.key,
    required this.title,
    this.subtitle,
    this.leadingIcon,
    this.leadingIconColor,
    this.leadingIconBgColor,
    this.trailing,
    this.onTap,
    this.badge,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: AHSpacing.cardElevation,
      margin: const EdgeInsets.only(bottom: AHSpacing.sm),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AHSpacing.cardBorderRadius),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AHSpacing.cardBorderRadius),
        child: Padding(
          padding: const EdgeInsets.all(AHSpacing.md),
          child: Row(
            children: [
              if (leadingIcon != null)
                Container(
                  padding: const EdgeInsets.all(AHSpacing.sm),
                  decoration: BoxDecoration(
                    color: leadingIconBgColor ??
                        AHColors.navy.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(AHSpacing.radiusSM),
                  ),
                  child: Icon(
                    leadingIcon,
                    size: AHSpacing.iconSM,
                    color: leadingIconColor ?? AHColors.navy,
                  ),
                ),
              if (leadingIcon != null) const SizedBox(width: AHSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            title,
                            style: const TextStyle(
                              fontWeight: FontWeight.w600,
                              fontSize: 14,
                              color: AHColors.textPrimary,
                            ),
                          ),
                        ),
                        if (badge != null) badge!,
                      ],
                    ),
                    if (subtitle != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        subtitle!,
                        style: const TextStyle(
                          fontSize: 12,
                          color: AHColors.textSecondary,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              if (trailing != null) ...[
                const SizedBox(width: AHSpacing.sm),
                trailing!,
              ] else ...[
                const SizedBox(width: AHSpacing.xs),
                const Icon(
                  Icons.chevron_right,
                  size: 20,
                  color: AHColors.muted,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

// ─── PlaceholderContent ───────────────────────────────────────────────────

/// Placeholder for unimplemented sub-tabs.
class PlaceholderContent extends StatelessWidget {
  final String title;
  final IconData icon;
  final String? description;

  const PlaceholderContent({
    super.key,
    required this.title,
    this.icon = Icons.construction,
    this.description,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AHSpacing.xxl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 56, color: AHColors.muted.withValues(alpha: 0.5)),
            const SizedBox(height: AHSpacing.lg),
            Text(
              title,
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: AHColors.textSecondary,
              ),
              textAlign: TextAlign.center,
            ),
            if (description != null) ...[
              const SizedBox(height: AHSpacing.sm),
              Text(
                description!,
                style: const TextStyle(
                  fontSize: 14,
                  color: AHColors.textMuted,
                ),
                textAlign: TextAlign.center,
              ),
            ],
            const SizedBox(height: AHSpacing.lg),
            Container(
              padding: const EdgeInsets.symmetric(
                horizontal: AHSpacing.lg,
                vertical: AHSpacing.sm,
              ),
              decoration: BoxDecoration(
                color: AHColors.gold.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(AHSpacing.radiusFull),
              ),
              child: const Text(
                'Bientôt disponible',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: AHColors.goldDark,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── StatusBadge ──────────────────────────────────────────────────────────

/// Colored status indicator badge.
class StatusBadge extends StatelessWidget {
  final String label;
  final StatusBadgeType type;

  const StatusBadge({
    super.key,
    required this.label,
    this.type = StatusBadgeType.info,
  });

  @override
  Widget build(BuildContext context) {
    final colors = _getColors();
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: colors.$1,
        borderRadius: BorderRadius.circular(AHSpacing.radiusFull),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: colors.$2,
        ),
      ),
    );
  }

  (Color, Color) _getColors() {
    switch (type) {
      case StatusBadgeType.success:
        return (AHColors.success.withValues(alpha: 0.12), AHColors.success);
      case StatusBadgeType.warning:
        return (AHColors.warning.withValues(alpha: 0.12), AHColors.warning);
      case StatusBadgeType.error:
        return (AHColors.error.withValues(alpha: 0.12), AHColors.error);
      case StatusBadgeType.info:
        return (AHColors.info.withValues(alpha: 0.12), AHColors.info);
      case StatusBadgeType.neutral:
        return (AHColors.muted.withValues(alpha: 0.12), AHColors.mutedForeground);
      case StatusBadgeType.gold:
        return (AHColors.gold.withValues(alpha: 0.12), AHColors.goldDark);
    }
  }
}

enum StatusBadgeType { success, warning, error, info, neutral, gold }

// ─── AHProgressBar ───────────────────────────────────────────────────────

/// Custom progress bar with brand colors.
class AHProgressBar extends StatelessWidget {
  final double progress; // 0.0 to 1.0
  final Color? activeColor;
  final Color? backgroundColor;
  final double height;
  final String? label;
  final String? valueLabel;

  const AHProgressBar({
    super.key,
    required this.progress,
    this.activeColor,
    this.backgroundColor,
    this.height = 8,
    this.label,
    this.valueLabel,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (label != null || valueLabel != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 4),
            child: Row(
              children: [
                if (label != null)
                  Expanded(
                    child: Text(
                      label!,
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: AHColors.textSecondary,
                      ),
                    ),
                  ),
                if (valueLabel != null)
                  Text(
                    valueLabel!,
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: AHColors.navy,
                    ),
                  ),
              ],
            ),
          ),
        ClipRRect(
          borderRadius: BorderRadius.circular(AHSpacing.radiusFull),
          child: LinearProgressIndicator(
            value: progress.clamp(0.0, 1.0),
            minHeight: height,
            backgroundColor: backgroundColor ?? AHColors.divider,
            valueColor: AlwaysStoppedAnimation<Color>(
              activeColor ?? AHColors.navy,
            ),
          ),
        ),
      ],
    );
  }
}
