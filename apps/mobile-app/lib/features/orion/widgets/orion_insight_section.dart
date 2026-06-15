import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';

/// A section showing ORION AI insights for a module.
/// Shows a brief summary text + confidence level.
/// "Voir l'analyse complète" link.
/// Collapsible.
class OrionInsightSection extends StatefulWidget {
  const OrionInsightSection({
    super.key,
    required this.insightsAsync,
    this.moduleName,
  });

  final AsyncValue<List<Map<String, dynamic>>> insightsAsync;
  final String? moduleName;

  @override
  State<OrionInsightSection> createState() => _OrionInsightSectionState();
}

class _OrionInsightSectionState extends State<OrionInsightSection> {
  bool _expanded = true;

  double _parseConfidence(dynamic value) {
    if (value is num) return value.toDouble();
    if (value is String) {
      final parsed = double.tryParse(value.replaceAll('%', ''));
      return parsed ?? 0.0;
    }
    return 0.0;
  }

  Color _confidenceColor(double confidence) {
    if (confidence >= 80) return AHColors.success;
    if (confidence >= 60) return AHColors.warning;
    return AHColors.error;
  }

  @override
  Widget build(BuildContext context) {
    return widget.insightsAsync.when(
      data: (insights) {
        if (insights.isEmpty) return const SizedBox.shrink();

        return Container(
          margin: const EdgeInsets.symmetric(
            horizontal: AHSpacing.md,
            vertical: AHSpacing.sm,
          ),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [
                AHColors.navy.withValues(alpha: 0.04),
                AHColors.gold.withValues(alpha: 0.06),
              ],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(AHRadius.lg),
            border: Border.all(
              color: AHColors.navy.withValues(alpha: 0.1),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Header ───────────────────────────────────────────
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
                      const Icon(Icons.auto_awesome,
                          size: 18, color: AHColors.gold),
                      const SizedBox(width: AHSpacing.sm),
                      Expanded(
                        child: Text(
                          'Insights ORION${widget.moduleName != null ? ' — ${widget.moduleName}' : ''}',
                          style: const TextStyle(
                            fontFamily: 'Inter',
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: AHColors.navy,
                          ),
                        ),
                      ),
                      Icon(
                        _expanded
                            ? Icons.keyboard_arrow_up
                            : Icons.keyboard_arrow_down,
                        color: AHColors.navy,
                        size: 20,
                      ),
                    ],
                  ),
                ),
              ),

              // ── Expanded Content ─────────────────────────────────
              if (_expanded)
                Padding(
                  padding: const EdgeInsets.only(
                    left: AHSpacing.md,
                    right: AHSpacing.md,
                    bottom: AHSpacing.md,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Divider(height: 1, color: AHColors.gray200),
                      const SizedBox(height: AHSpacing.sm),
                      ...insights.take(3).map((insight) {
                        final confidence =
                            _parseConfidence(insight['confidence']);
                        final confColor = _confidenceColor(confidence);
                        return Padding(
                          padding: const EdgeInsets.only(
                              bottom: AHSpacing.sm),
                          child: Row(
                            crossAxisAlignment:
                                CrossAxisAlignment.start,
                            children: [
                              Container(
                                margin: const EdgeInsets.only(top: 4),
                                width: 6,
                                height: 6,
                                decoration: BoxDecoration(
                                  color: confColor,
                                  shape: BoxShape.circle,
                                ),
                              ),
                              const SizedBox(width: AHSpacing.sm),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      insight['title'] ??
                                          insight['summary'] ??
                                          'Analyse IA',
                                      style: const TextStyle(
                                        fontFamily: 'Inter',
                                        fontSize: 12,
                                        fontWeight: FontWeight.w500,
                                        color: AHColors.gray800,
                                      ),
                                    ),
                                    if (insight['description'] !=
                                            null ||
                                        insight['summary'] != null)
                                      Text(
                                        insight['description'] ??
                                            insight['summary'] ??
                                            '',
                                        style: const TextStyle(
                                          fontFamily: 'Inter',
                                          fontSize: 11,
                                          color: AHColors.gray500,
                                        ),
                                        maxLines: 2,
                                        overflow:
                                            TextOverflow.ellipsis,
                                      ),
                                    if (confidence > 0) ...[
                                      const SizedBox(height: 2),
                                      Row(
                                        children: [
                                          Text(
                                            'Confiance: ${confidence.toStringAsFixed(0)}%',
                                            style: TextStyle(
                                              fontFamily: 'Inter',
                                              fontSize: 10,
                                              fontWeight:
                                                  FontWeight.w500,
                                              color: confColor,
                                            ),
                                          ),
                                          const SizedBox(width: 4),
                                          Expanded(
                                            child:
                                                LinearProgressIndicator(
                                              value:
                                                  confidence / 100,
                                              backgroundColor:
                                                  AHColors.gray200,
                                              valueColor:
                                                  AlwaysStoppedAnimation<
                                                      Color>(confColor),
                                              minHeight: 3,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                            ],
                          ),
                        );
                      }),
                      // ── Voir l'analyse complète ────────────────────
                      Center(
                        child: TextButton(
                          onPressed: () => context.go('/orion'),
                          style: TextButton.styleFrom(
                            padding: const EdgeInsets.symmetric(
                              horizontal: AHSpacing.md,
                              vertical: AHSpacing.xs,
                            ),
                            minimumSize: Size.zero,
                            tapTargetSize:
                                MaterialTapTargetSize.shrinkWrap,
                          ),
                          child: const Text(
                            'Voir l\'analyse complète',
                            style: TextStyle(
                              fontFamily: 'Inter',
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: AHColors.navy,
                            ),
                          ),
                        ),
                      ),
                    ],
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
