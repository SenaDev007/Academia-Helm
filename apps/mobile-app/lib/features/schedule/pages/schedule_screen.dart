import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shimmer/shimmer.dart';

import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/empty_state_widget.dart';
import '../../../core/widgets/error_widget.dart' as ah_error;
import '../providers/schedule_provider.dart';
import '../widgets/schedule_entry_card.dart';

/// Weekly schedule view.
///
/// Features:
/// - Week navigation (previous/next week buttons with date range display)
/// - Day tabs (Lun, Mar, Mer, Jeu, Ven, Sam)
/// - List of schedule entries for selected day
/// - Each entry shows: time, subject, room, teacher, type
/// - Color coded by subject
/// - Loading/empty states
class ScheduleScreen extends ConsumerWidget {
  const ScheduleScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedDay = ref.watch(selectedDayProvider);
    final weekStart = ref.watch(currentWeekStartProvider);
    final scheduleAsync = ref.watch(scheduleProvider(weekStart));

    return Scaffold(
      backgroundColor: AHColors.lightBackground,
      body: Column(
        children: [
          // ── Header ──────────────────────────────────────────────────
          const _ScheduleHeader(),

          // ── Week Navigation ─────────────────────────────────────────
          _WeekNavigation(weekStart: weekStart),

          // ── Day Tabs ────────────────────────────────────────────────
          _DayTabs(
            weekStart: weekStart,
            selectedDay: selectedDay,
            onDaySelected: (day) {
              ref.read(selectedDayProvider.notifier).state = day;
            },
          ),

          // ── Schedule Entries ────────────────────────────────────────
          Expanded(
            child: scheduleAsync.when(
              loading: () => const _ScheduleShimmer(),
              error: (error, _) => ah_error.AHErrorWidget(
                message: 'Impossible de charger l\'emploi du temps.',
                onRetry: () => ref.invalidate(scheduleProvider(weekStart)),
              ),
              data: (schedule) {
                final entries = schedule.entriesForDay(selectedDay);
                if (entries.isEmpty) {
                  return AHEmptyState(
                    icon: Icons.event_available_outlined,
                    title: 'Aucun cours',
                    subtitle: 'Pas de cours prévu le ${dayFullNames[selectedDay] ?? ''}.',
                  );
                }
                return _ScheduleEntriesList(entries: entries);
              },
            ),
          ),
        ],
      ),
    );
  }
}

// ── Header ────────────────────────────────────────────────────────────

class _ScheduleHeader extends StatelessWidget {
  const _ScheduleHeader();

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
                'Emploi du temps',
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
                Icons.calendar_month_outlined,
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

// ── Week Navigation ───────────────────────────────────────────────────

class _WeekNavigation extends ConsumerWidget {
  const _WeekNavigation({required this.weekStart});

  final DateTime weekStart;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final weekEnd = weekStart.add(const Duration(days: 5));

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(
        horizontal: AHSpacing.lg,
        vertical: AHSpacing.md,
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // Previous week button
          IconButton(
            onPressed: () {
              final newWeekStart = weekStart.subtract(const Duration(days: 7));
              ref.read(currentWeekStartProvider.notifier).state = newWeekStart;
            },
            icon: const Icon(Icons.chevron_left),
            color: AHColors.navy,
            iconSize: 28,
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(),
          ),

          const SizedBox(width: AHSpacing.md),

          // Week range display
          Container(
            padding: const EdgeInsets.symmetric(
              horizontal: AHSpacing.lg,
              vertical: AHSpacing.sm,
            ),
            decoration: BoxDecoration(
              color: AHColors.navy.withOpacity(0.06),
              borderRadius: BorderRadius.circular(AHSpacing.r8),
            ),
            child: Text(
              '${AHFormatters.formatDateDisplay(weekStart)} — ${AHFormatters.formatDateDisplay(weekEnd)}',
              style: const TextStyle(
                fontFamily: 'Inter',
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: AHColors.navy,
              ),
            ),
          ),

          const SizedBox(width: AHSpacing.md),

          // Next week button
          IconButton(
            onPressed: () {
              final newWeekStart = weekStart.add(const Duration(days: 7));
              ref.read(currentWeekStartProvider.notifier).state = newWeekStart;
            },
            icon: const Icon(Icons.chevron_right),
            color: AHColors.navy,
            iconSize: 28,
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(),
          ),

          const SizedBox(width: AHSpacing.sm),

          // Today button
          InkWell(
            onTap: () {
              final now = DateTime.now();
              final monday = now.subtract(Duration(days: now.weekday - 1));
              ref.read(currentWeekStartProvider.notifier).state = monday;
              ref.read(selectedDayProvider.notifier).state = now.weekday > 6 ? 1 : now.weekday;
            },
            borderRadius: BorderRadius.circular(AHSpacing.r8),
            child: Container(
              padding: const EdgeInsets.symmetric(
                horizontal: AHSpacing.md,
                vertical: AHSpacing.xs,
              ),
              decoration: BoxDecoration(
                border: Border.all(color: AHColors.navy, width: 1),
                borderRadius: BorderRadius.circular(AHSpacing.r8),
              ),
              child: const Text(
                'Aujourd\'hui',
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
    );
  }
}

// ── Day Tabs ──────────────────────────────────────────────────────────

class _DayTabs extends StatelessWidget {
  const _DayTabs({
    required this.weekStart,
    required this.selectedDay,
    required this.onDaySelected,
  });

  final DateTime weekStart;
  final int selectedDay;
  final ValueChanged<int> onDaySelected;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: AHSpacing.md),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: List.generate(6, (index) {
            final dayOfWeek = index + 1;
            final isSelected = dayOfWeek == selectedDay;
            final dayDate = weekStart.add(Duration(days: index));
            final isToday = _isToday(dayDate);

            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: AHSpacing.xs),
              child: InkWell(
                onTap: () => onDaySelected(dayOfWeek),
                borderRadius: BorderRadius.circular(AHSpacing.r12),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  width: 52,
                  padding: const EdgeInsets.symmetric(vertical: AHSpacing.sm),
                  decoration: BoxDecoration(
                    color: isSelected
                        ? AHColors.navy
                        : isToday
                            ? AHColors.navy.withOpacity(0.08)
                            : AHColors.lightSurface,
                    borderRadius: BorderRadius.circular(AHSpacing.r12),
                    border: isToday && !isSelected
                        ? Border.all(color: AHColors.navy.withOpacity(0.3), width: 1)
                        : null,
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        dayNames[dayOfWeek] ?? '',
                        style: TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                          color: isSelected
                              ? AHColors.white.withOpacity(0.8)
                              : AHColors.grey500,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${dayDate.day}',
                        style: TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 16,
                          fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                          color: isSelected ? AHColors.white : AHColors.grey900,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          }),
        ),
      ),
    );
  }

  bool _isToday(DateTime date) {
    final now = DateTime.now();
    return date.year == now.year && date.month == now.month && date.day == now.day;
  }
}

// ── Schedule Entries List ─────────────────────────────────────────────

class _ScheduleEntriesList extends StatelessWidget {
  const _ScheduleEntriesList({required this.entries});

  final List<ScheduleEntry> entries;

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.only(
        top: AHSpacing.md,
        bottom: AHSpacing.xxl,
      ),
      itemCount: entries.length,
      separatorBuilder: (_, __) => const SizedBox(height: AHSpacing.sm),
      itemBuilder: (context, index) {
        return ScheduleEntryCard(entry: entries[index]);
      },
    );
  }
}

// ── Loading Shimmer ───────────────────────────────────────────────────

class _ScheduleShimmer extends StatelessWidget {
  const _ScheduleShimmer();

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Shimmer.fromColors(
      baseColor: isDark ? AHColors.grey700 : AHColors.grey200,
      highlightColor: isDark ? AHColors.grey600 : AHColors.grey100,
      child: ListView.separated(
        physics: const NeverScrollableScrollPhysics(),
        padding: const EdgeInsets.all(AHSpacing.lg),
        itemCount: 4,
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
                  width: 5,
                  height: 60,
                  decoration: BoxDecoration(
                    color: AHColors.white,
                    borderRadius: BorderRadius.circular(3),
                  ),
                ),
                const SizedBox(width: AHSpacing.sm),
                Container(
                  width: 52,
                  child: Column(
                    children: [
                      Container(
                        width: 40,
                        height: 12,
                        decoration: BoxDecoration(
                          color: AHColors.white,
                          borderRadius: BorderRadius.circular(4),
                        ),
                      ),
                      const SizedBox(height: AHSpacing.xs),
                      Container(
                        width: 36,
                        height: 10,
                        decoration: BoxDecoration(
                          color: AHColors.white,
                          borderRadius: BorderRadius.circular(4),
                        ),
                      ),
                    ],
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
              ],
            ),
          );
        },
      ),
    );
  }
}
