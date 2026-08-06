import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shimmer/shimmer.dart';

import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../../../core/widgets/empty_state_widget.dart';
import '../../../core/widgets/error_widget.dart' as ah_error;
import '../providers/absences_provider.dart';
import '../widgets/absence_card.dart';

/// Screen showing absences and tardiness.
///
/// Features:
/// - Stats summary at top (total absences, total tardiness, justified count)
/// - Filter chips: Tous, Absences, Retards
/// - List of absence cards
/// - Pull-to-refresh
/// - Loading/empty/error states
class AbsencesListScreen extends ConsumerWidget {
  const AbsencesListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedFilter = ref.watch(selectedAbsenceFilterProvider);
    final absencesAsync = ref.watch(absencesListProvider(selectedFilter));
    final statsAsync = ref.watch(absencesStatsProvider);

    return Scaffold(
      backgroundColor: AHColors.lightBackground,
      body: Column(
        children: [
          // ── Header ──────────────────────────────────────────────────
          const _AbsencesHeader(),

          // ── Stats Summary ───────────────────────────────────────────
          statsAsync.when(
            data: (stats) => _StatsSummary(stats: stats),
            loading: () => const SizedBox.shrink(),
            error: (_, __) => const SizedBox.shrink(),
          ),

          // ── Filter Chips ────────────────────────────────────────────
          _AbsenceFilterChips(
            selectedFilter: selectedFilter,
            onFilterChanged: (filter) {
              ref.read(selectedAbsenceFilterProvider.notifier).state = filter;
            },
          ),

          // ── Absences List ──────────────────────────────────────────
          Expanded(
            child: absencesAsync.when(
              loading: () => const _AbsencesListShimmer(),
              error: (error, _) => ah_error.AHErrorWidget(
                message: 'Impossible de charger les absences.',
                onRetry: () => ref.invalidate(absencesListProvider(selectedFilter)),
              ),
              data: (records) {
                if (records.isEmpty) {
                  return const AHEmptyState(
                    icon: Icons.event_available_outlined,
                    title: 'Aucune absence',
                    subtitle: 'Aucune absence ou retard enregistré. Continuez comme ça !',
                  );
                }
                return _AbsencesListContent(records: records);
              },
            ),
          ),
        ],
      ),
    );
  }
}

// ── Header ────────────────────────────────────────────────────────────

class _AbsencesHeader extends StatelessWidget {
  const _AbsencesHeader();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(
        AHSpacing.xl,
        AHSpacing.xl + 12,
        AHSpacing.xl,
        AHSpacing.lg,
      ),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [AHColors.navy, AHColors.blue],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(AHSpacing.r20),
          bottomRight: Radius.circular(AHSpacing.r20),
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
            const Expanded(
              child: Text(
                'Absences & Retards',
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                  color: AHColors.white,
                ),
              ),
            ),
            Container(
              padding: const EdgeInsets.all(AHSpacing.sm),
              decoration: BoxDecoration(
                color: AHColors.white.withOpacity(0.15),
                borderRadius: BorderRadius.circular(AHSpacing.r8),
              ),
              child: const Icon(
                Icons.event_busy_outlined,
                color: AHColors.gold,
                size: 24,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Stats Summary ─────────────────────────────────────────────────────

class _StatsSummary extends StatelessWidget {
  const _StatsSummary({required this.stats});

  final AbsencesStats stats;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(
        AHSpacing.lg,
        AHSpacing.md,
        AHSpacing.lg,
        AHSpacing.xs,
      ),
      padding: const EdgeInsets.all(AHSpacing.md),
      decoration: BoxDecoration(
        color: AHColors.white,
        borderRadius: BorderRadius.circular(AHSpacing.r12),
        boxShadow: [
          BoxShadow(
            color: AHColors.navy.withOpacity(0.06),
            offset: const Offset(0, 2),
            blurRadius: 8,
          ),
        ],
      ),
      child: Row(
        children: [
          // Total absences
          _StatItem(
            label: 'Absences',
            value: '${stats.totalAbsences}',
            icon: Icons.person_off_outlined,
            color: AHColors.error,
          ),

          Container(
            width: 1,
            height: 40,
            color: AHColors.lightOutline,
          ),

          // Total tardiness
          _StatItem(
            label: 'Retards',
            value: '${stats.totalTardiness}',
            icon: Icons.schedule_outlined,
            color: AHColors.warning,
          ),

          Container(
            width: 1,
            height: 40,
            color: AHColors.lightOutline,
          ),

          // Justified
          _StatItem(
            label: 'Justifiés',
            value: '${stats.justifiedCount}',
            icon: Icons.check_circle_outline,
            color: AHColors.success,
          ),

          Container(
            width: 1,
            height: 40,
            color: AHColors.lightOutline,
          ),

          // Pending
          _StatItem(
            label: 'En attente',
            value: '${stats.pendingCount}',
            icon: Icons.pending_outlined,
            color: AHColors.warning,
          ),
        ],
      ),
    );
  }
}

class _StatItem extends StatelessWidget {
  const _StatItem({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Icon(icon, size: 20, color: color),
          const SizedBox(height: AHSpacing.xs),
          Text(
            value,
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 20,
              fontWeight: FontWeight.w700,
              color: color,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: const TextStyle(
              fontFamily: 'Inter',
              fontSize: 10,
              fontWeight: FontWeight.w500,
              color: AHColors.grey500,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

// ── Filter Chips ──────────────────────────────────────────────────────

class _AbsenceFilterChips extends StatelessWidget {
  const _AbsenceFilterChips({
    required this.selectedFilter,
    required this.onFilterChanged,
  });

  final AbsenceFilter selectedFilter;
  final ValueChanged<AbsenceFilter> onFilterChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(
        horizontal: AHSpacing.lg,
        vertical: AHSpacing.md,
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: AbsenceFilter.values.map((filter) {
            final isSelected = filter == selectedFilter;
            return Padding(
              padding: const EdgeInsets.only(right: AHSpacing.sm),
              child: FilterChip(
                selected: isSelected,
                label: Text(filter.label),
                onSelected: (_) => onFilterChanged(filter),
                backgroundColor: AHColors.lightSurface,
                selectedColor: AHColors.navy.withOpacity(0.12),
                checkmarkColor: AHColors.navy,
                labelStyle: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 13,
                  fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
                  color: isSelected ? AHColors.navy : AHColors.grey600,
                ),
                side: BorderSide(
                  color: isSelected
                      ? AHColors.navy.withOpacity(0.3)
                      : AHColors.lightOutline,
                  width: 1,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AHSpacing.r8),
                ),
                padding: const EdgeInsets.symmetric(
                  horizontal: AHSpacing.md,
                  vertical: AHSpacing.xs,
                ),
              ),
            );
          }).toList(),
        ),
      ),
    );
  }
}

// ── Absences List Content ─────────────────────────────────────────────

class _AbsencesListContent extends ConsumerWidget {
  const _AbsencesListContent({required this.records});

  final List<AbsenceRecord> records;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedFilter = ref.watch(selectedAbsenceFilterProvider);

    return RefreshIndicator(
      color: AHColors.navy,
      onRefresh: () async {
        ref.invalidate(absencesListProvider(selectedFilter));
        ref.invalidate(absencesStatsProvider);
      },
      child: ListView.separated(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.only(
          top: AHSpacing.sm,
          bottom: AHSpacing.xxl,
        ),
        itemCount: records.length,
        separatorBuilder: (_, __) => const SizedBox(height: AHSpacing.xs),
        itemBuilder: (context, index) {
          return AbsenceCard(record: records[index]);
        },
      ),
    );
  }
}

// ── Loading Shimmer ───────────────────────────────────────────────────

class _AbsencesListShimmer extends StatelessWidget {
  const _AbsencesListShimmer();

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Shimmer.fromColors(
      baseColor: isDark ? AHColors.grey700 : AHColors.grey200,
      highlightColor: isDark ? AHColors.grey600 : AHColors.grey100,
      child: ListView.separated(
        physics: const NeverScrollableScrollPhysics(),
        padding: const EdgeInsets.all(AHSpacing.lg),
        itemCount: 5,
        separatorBuilder: (_, __) => const SizedBox(height: AHSpacing.md),
        itemBuilder: (context, index) {
          return Container(
            width: double.infinity,
            padding: const EdgeInsets.all(AHSpacing.md),
            decoration: BoxDecoration(
              color: AHColors.white,
              borderRadius: BorderRadius.circular(AHSpacing.r12),
            ),
            child: Row(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: AHColors.white,
                    borderRadius: BorderRadius.circular(AHSpacing.r8),
                  ),
                ),
                const SizedBox(width: AHSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 120,
                        height: 14,
                        decoration: BoxDecoration(
                          color: AHColors.white,
                          borderRadius: BorderRadius.circular(4),
                        ),
                      ),
                      const SizedBox(height: AHSpacing.sm),
                      Container(
                        width: 180,
                        height: 10,
                        decoration: BoxDecoration(
                          color: AHColors.white,
                          borderRadius: BorderRadius.circular(4),
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  width: 60,
                  height: 20,
                  decoration: BoxDecoration(
                    color: AHColors.white,
                    borderRadius: BorderRadius.circular(AHSpacing.r8),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
