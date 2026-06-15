import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shimmer/shimmer.dart';

import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../../../core/widgets/empty_state_widget.dart';
import '../../../core/widgets/error_widget.dart' as ah_error;
import '../providers/grades_provider.dart';
import '../widgets/grade_card.dart';

/// Screen displaying a list of grades for a student.
///
/// Features:
/// - Period filter tabs (Tous, Trimestre 1/2/3)
/// - Grade cards with color-coded scores
/// - Pull-to-refresh
/// - Loading shimmer, empty state, error state with retry
class GradesListScreen extends ConsumerWidget {
  const GradesListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedPeriod = ref.watch(selectedPeriodProvider);
    final gradesAsync = ref.watch(gradesListProvider(selectedPeriod));

    return Scaffold(
      backgroundColor: AHColors.lightBackground,
      body: Column(
        children: [
          // ── Header with gradient ────────────────────────────────────
          _GradesHeader(selectedPeriod: selectedPeriod),

          // ── Period Filter Tabs ──────────────────────────────────────
          _PeriodFilterTabs(
            selectedPeriod: selectedPeriod,
            onPeriodChanged: (period) {
              ref.read(selectedPeriodProvider.notifier).state = period;
            },
          ),

          // ── Grades List ────────────────────────────────────────────
          Expanded(
            child: gradesAsync.when(
              loading: () => const _GradesListShimmer(),
              error: (error, stackTrace) => ah_error.AHErrorWidget(
                message: 'Impossible de charger les notes.',
                onRetry: () => ref.invalidate(gradesListProvider(selectedPeriod)),
              ),
              data: (grades) {
                if (grades.isEmpty) {
                  return const AHEmptyState(
                    icon: Icons.grade_outlined,
                    title: 'Aucune note disponible',
                    subtitle: 'Les notes apparaîtront ici une fois publiées par les enseignants.',
                  );
                }
                return _GradesListContent(grades: grades);
              },
            ),
          ),
        ],
      ),
    );
  }
}

// ── Header ────────────────────────────────────────────────────────────

class _GradesHeader extends StatelessWidget {
  const _GradesHeader({required this.selectedPeriod});

  final PeriodFilter selectedPeriod;

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
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Notes & Résultats',
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 22,
                      fontWeight: FontWeight.w700,
                      color: AHColors.white,
                    ),
                  ),
                  const SizedBox(height: AHSpacing.xs),
                  Text(
                    selectedPeriod == PeriodFilter.all
                        ? 'Toutes les périodes'
                        : selectedPeriod.label,
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: AHColors.white.withOpacity(0.75),
                    ),
                  ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.all(AHSpacing.sm),
              decoration: BoxDecoration(
                color: AHColors.white.withOpacity(0.15),
                borderRadius: BorderRadius.circular(AHSpacing.r8),
              ),
              child: const Icon(
                Icons.bar_chart_rounded,
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

// ── Period Filter Tabs ────────────────────────────────────────────────

class _PeriodFilterTabs extends StatelessWidget {
  const _PeriodFilterTabs({
    required this.selectedPeriod,
    required this.onPeriodChanged,
  });

  final PeriodFilter selectedPeriod;
  final ValueChanged<PeriodFilter> onPeriodChanged;

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
          children: PeriodFilter.values.map((period) {
            final isSelected = period == selectedPeriod;
            return Padding(
              padding: const EdgeInsets.only(right: AHSpacing.sm),
              child: FilterChip(
                selected: isSelected,
                label: Text(period.label),
                onSelected: (_) => onPeriodChanged(period),
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

// ── Grades List Content ───────────────────────────────────────────────

class _GradesListContent extends ConsumerWidget {
  const _GradesListContent({required this.grades});

  final List<Grade> grades;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedPeriod = ref.watch(selectedPeriodProvider);

    return RefreshIndicator(
      color: AHColors.navy,
      onRefresh: () async {
        ref.invalidate(gradesListProvider(selectedPeriod));
      },
      child: ListView.separated(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.only(
          top: AHSpacing.sm,
          bottom: AHSpacing.xxl,
        ),
        itemCount: grades.length,
        separatorBuilder: (_, __) => const SizedBox(height: AHSpacing.xs),
        itemBuilder: (context, index) {
          final grade = grades[index];
          return GradeCard(
            grade: grade,
            onTap: () => context.push('/grades/${grade.id}'),
          );
        },
      ),
    );
  }
}

// ── Loading Shimmer ───────────────────────────────────────────────────

class _GradesListShimmer extends StatelessWidget {
  const _GradesListShimmer();

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Shimmer.fromColors(
      baseColor: isDark ? AHColors.grey700 : AHColors.grey200,
      highlightColor: isDark ? AHColors.grey600 : AHColors.grey100,
      child: ListView.separated(
        physics: const NeverScrollableScrollPhysics(),
        padding: const EdgeInsets.all(AHSpacing.lg),
        itemCount: 6,
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
                // Score circle placeholder
                Container(
                  width: 52,
                  height: 52,
                  decoration: const BoxDecoration(
                    color: AHColors.white,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: AHSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 140,
                        height: 14,
                        decoration: BoxDecoration(
                          color: AHColors.white,
                          borderRadius: BorderRadius.circular(4),
                        ),
                      ),
                      const SizedBox(height: AHSpacing.sm),
                      Container(
                        width: 200,
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
                  width: 40,
                  height: 10,
                  decoration: BoxDecoration(
                    color: AHColors.white,
                    borderRadius: BorderRadius.circular(4),
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
