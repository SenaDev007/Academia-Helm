import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';

/// Compact banner that shows at the top of a module page if there are
/// active ORION alerts. Shows alert count with severity color.
/// Tappable → expands to show alert details.
/// Has a "Voir tout" button that navigates to the Orion module.
class OrionAlertBanner extends ConsumerStatefulWidget {
  const OrionAlertBanner({
    super.key,
    required this.alertsAsync,
    this.moduleName,
  });

  final AsyncValue<List<Map<String, dynamic>>> alertsAsync;
  final String? moduleName;

  @override
  ConsumerState<OrionAlertBanner> createState() => _OrionAlertBannerState();
}

class _OrionAlertBannerState extends ConsumerState<OrionAlertBanner> {
  bool _expanded = false;

  Color _severityColor(String? level) {
    if (level == null) return AHColors.info;
    final l = level.toString().toUpperCase();
    if (l.contains('CRITIQUE') || l.contains('CRITICAL') || l.contains('ERROR')) {
      return AHColors.error;
    }
    if (l.contains('WARNING') || l.contains('ATTENTION') || l.contains('WARN')) {
      return AHColors.warning;
    }
    return AHColors.info;
  }

  IconData _severityIcon(String? level) {
    if (level == null) return Icons.info_outline;
    final l = level.toString().toUpperCase();
    if (l.contains('CRITIQUE') || l.contains('CRITICAL') || l.contains('ERROR')) {
      return Icons.error;
    }
    if (l.contains('WARNING') || l.contains('ATTENTION') || l.contains('WARN')) {
      return Icons.warning_amber;
    }
    return Icons.info_outline;
  }

  @override
  Widget build(BuildContext context) {
    return widget.alertsAsync.when(
      data: (alerts) {
        if (alerts.isEmpty) return const SizedBox.shrink();

        // Determine the most severe alert for the banner color
        String? maxSeverity;
        for (final a in alerts) {
          final level = a['level'] as String?;
          if (level != null &&
              (level.toUpperCase().contains('CRITIQUE') ||
                  level.toUpperCase().contains('CRITICAL'))) {
            maxSeverity = level;
            break;
          }
          if (level != null && maxSeverity == null) {
            maxSeverity = level;
          }
        }

        final bannerColor = _severityColor(maxSeverity);
        final icon = _severityIcon(maxSeverity);

        return Container(
          margin: const EdgeInsets.symmetric(
            horizontal: AHSpacing.md,
            vertical: AHSpacing.xs,
          ),
          decoration: BoxDecoration(
            color: bannerColor.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(AHRadius.lg),
            border: Border.all(
              color: bannerColor.withValues(alpha: 0.3),
            ),
          ),
          child: Column(
            children: [
              // ── Banner Header ─────────────────────────────────────
              InkWell(
                onTap: () => setState(() => _expanded = !_expanded),
                borderRadius: BorderRadius.circular(AHRadius.lg),
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AHSpacing.md,
                    vertical: AHSpacing.sm,
                  ),
                  child: Row(
                    children: [
                      Icon(icon, color: bannerColor, size: 20),
                      const SizedBox(width: AHSpacing.sm),
                      Expanded(
                        child: Text(
                          'ORION — ${alerts.length} alerte${alerts.length > 1 ? 's' : ''} active${alerts.length > 1 ? 's' : ''}',
                          style: TextStyle(
                            fontFamily: 'Inter',
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: bannerColor,
                          ),
                        ),
                      ),
                      TextButton(
                        onPressed: () => context.go('/orion'),
                        style: TextButton.styleFrom(
                          padding: const EdgeInsets.symmetric(
                            horizontal: AHSpacing.sm,
                          ),
                          minimumSize: Size.zero,
                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        ),
                        child: Text(
                          'Voir tout',
                          style: TextStyle(
                            fontFamily: 'Inter',
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: bannerColor,
                          ),
                        ),
                      ),
                      Icon(
                        _expanded
                            ? Icons.keyboard_arrow_up
                            : Icons.keyboard_arrow_down,
                        color: bannerColor,
                        size: 20,
                      ),
                    ],
                  ),
                ),
              ),

              // ── Expanded Alert Details ─────────────────────────────
              if (_expanded)
                Padding(
                  padding: const EdgeInsets.only(
                    left: AHSpacing.md,
                    right: AHSpacing.md,
                    bottom: AHSpacing.sm,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: alerts.take(5).map((alert) {
                      final level = alert['level'] as String?;
                      final color = _severityColor(level);
                      return Padding(
                        padding: const EdgeInsets.only(
                            bottom: AHSpacing.xs),
                        child: Row(
                          children: [
                            Container(
                              width: 8,
                              height: 8,
                              decoration: BoxDecoration(
                                color: color,
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(width: AHSpacing.sm),
                            Expanded(
                              child: Text(
                                alert['title'] ?? alert['description'] ?? 'Alerte',
                                style: const TextStyle(
                                  fontFamily: 'Inter',
                                  fontSize: 12,
                                  color: AHColors.gray700,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      );
                    }).toList(),
                  ),
                ),
            ],
          ),
        );
      },
      loading: () => const SizedBox.shrink(),
      error: (_, __) => const SizedBox.shrink(),
    );
  }
}
