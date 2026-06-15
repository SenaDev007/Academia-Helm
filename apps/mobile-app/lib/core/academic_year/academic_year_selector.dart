/// ============================================================================
/// ACADEMIC YEAR SELECTOR — Academia Hub Mobile
/// ============================================================================
///
/// Reusable dropdown/chip selector for academic year context.
/// Used in the app bar or dashboard to switch between academic years.
///
/// When changed, persists the selection and invalidates dependent providers.
///
/// All user-facing strings are in FRENCH.
/// ============================================================================

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../theme/ah_colors.dart';
import '../../theme/ah_spacing.dart';
import '../../theme/ah_typography.dart';
import 'academic_year_model.dart';
import 'academic_year_provider.dart';

// ─── Academic Year Selector Widget ────────────────────────────────────────────

/// A compact dropdown selector for academic year context.
///
/// Shows the current year with a dropdown to switch.
/// Typically placed in the app bar or dashboard header.
///
/// Usage:
/// ```dart
/// AcademicYearSelector(compact: true) // For app bar
/// AcademicYearSelector()               // Full width for dashboard
/// ```
class AcademicYearSelector extends ConsumerStatefulWidget {
  /// Whether to use compact mode (suitable for app bar).
  final bool compact;

  /// Optional callback when the academic year changes.
  final VoidCallback? onChanged;

  const AcademicYearSelector({
    super.key,
    this.compact = false,
    this.onChanged,
  });

  @override
  ConsumerState<AcademicYearSelector> createState() =>
      _AcademicYearSelectorState();
}

class _AcademicYearSelectorState extends ConsumerState<AcademicYearSelector> {
  @override
  void initState() {
    super.initState();
    // Initialize the academic year context on first build
    Future.microtask(() {
      ref.read(academicYearInitializerProvider);
    });
  }

  @override
  Widget build(BuildContext context) {
    final currentYear = ref.watch(currentAcademicYearProvider);
    final years = ref.watch(availableAcademicYearsProvider);
    final theme = Theme.of(context);

    if (years.isEmpty) {
      return _buildEmptyState(theme);
    }

    if (widget.compact) {
      return _buildCompactSelector(currentYear, years, theme);
    }

    return _buildFullSelector(currentYear, years, theme);
  }

  // ─── Compact Mode (App Bar) ─────────────────────────────────────────────

  Widget _buildCompactSelector(
    AcademicYearModel? currentYear,
    List<AcademicYearModel> years,
    ThemeData theme,
  ) {
    return Material(
      color: AHColors.navy.withValues(alpha: 0.1),
      borderRadius: BorderRadius.circular(AHSpacing.r8),
      child: InkWell(
        borderRadius: BorderRadius.circular(AHSpacing.r8),
        onTap: () => _showYearPicker(context, years),
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AHSpacing.s12,
            vertical: AHSpacing.s8,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.calendar_today,
                size: AHSpacing.icon16,
                color: AHColors.navy,
              ),
              const SizedBox(width: AHSpacing.s8),
              Text(
                currentYear?.displayName ?? 'Année scolaire',
                style: AHTypography.labelLarge.copyWith(
                  color: AHColors.navy,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(width: AHSpacing.s4),
              Icon(
                Icons.arrow_drop_down,
                size: AHSpacing.icon20,
                color: AHColors.navy,
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ─── Full Mode (Dashboard) ──────────────────────────────────────────────

  Widget _buildFullSelector(
    AcademicYearModel? currentYear,
    List<AcademicYearModel> years,
    ThemeData theme,
  ) {
    return Card(
      elevation: AHSpacing.elevationLow,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AHSpacing.r12),
        side: BorderSide(color: AHColors.lightOutline),
      ),
      child: Padding(
        padding: const EdgeInsets.all(AHSpacing.s16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  Icons.school,
                  size: AHSpacing.icon20,
                  color: AHColors.navy,
                ),
                const SizedBox(width: AHSpacing.s8),
                Text(
                  'Année scolaire',
                  style: AHTypography.titleSmall.copyWith(
                    color: AHColors.navy,
                  ),
                ),
              ],
            ),
            const SizedBox(height: AHSpacing.s12),
            Wrap(
              spacing: AHSpacing.s8,
              runSpacing: AHSpacing.s8,
              children: years.map((year) {
                final isSelected = currentYear?.id == year.id;
                return _YearChip(
                  year: year,
                  isSelected: isSelected,
                  onTap: () => _selectYear(year),
                );
              }).toList(),
            ),
          ],
        ),
      ),
    );
  }

  // ─── Empty State ────────────────────────────────────────────────────────

  Widget _buildEmptyState(ThemeData theme) {
    if (widget.compact) {
      return const SizedBox.shrink();
    }

    return Card(
      elevation: AHSpacing.elevationLow,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AHSpacing.r12),
      ),
      child: Padding(
        padding: const EdgeInsets.all(AHSpacing.s16),
        child: Row(
          children: [
            Icon(
              Icons.info_outline,
              size: AHSpacing.icon20,
              color: AHColors.grey500,
            ),
            const SizedBox(width: AHSpacing.s8),
            Text(
              'Aucune année scolaire disponible',
              style: AHTypography.bodyMedium.copyWith(
                color: AHColors.grey500,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ─── Year Picker Bottom Sheet ───────────────────────────────────────────

  void _showYearPicker(BuildContext context, List<AcademicYearModel> years) {
    final currentYear = ref.read(currentAcademicYearProvider);

    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AHSpacing.r16)),
      ),
      builder: (BuildContext context) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Padding(
                padding: const EdgeInsets.all(AHSpacing.s16),
                child: Row(
                  children: [
                    Icon(
                      Icons.calendar_today,
                      color: AHColors.navy,
                    ),
                    const SizedBox(width: AHSpacing.s12),
                    Text(
                      'Choisir l\'année scolaire',
                      style: AHTypography.titleMedium.copyWith(
                        color: AHColors.navy,
                      ),
                    ),
                  ],
                ),
              ),
              const Divider(height: 1),
              ...years.map((year) {
                final isSelected = currentYear?.id == year.id;
                return ListTile(
                  leading: Icon(
                    isSelected
                        ? Icons.radio_button_checked
                        : Icons.radio_button_unchecked,
                    color: isSelected ? AHColors.gold : AHColors.grey400,
                  ),
                  title: Text(
                    year.displayName,
                    style: AHTypography.bodyLarge.copyWith(
                      fontWeight:
                          isSelected ? FontWeight.w600 : FontWeight.w400,
                    ),
                  ),
                  subtitle: Text(
                    year.shortLabel,
                    style: AHTypography.bodySmall.copyWith(
                      color: AHColors.grey500,
                    ),
                  ),
                  trailing: year.isCurrent
                      ? Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: AHSpacing.s8,
                            vertical: AHSpacing.s4,
                          ),
                          decoration: BoxDecoration(
                            color: AHColors.successLight,
                            borderRadius:
                                BorderRadius.circular(AHSpacing.r4),
                          ),
                          child: Text(
                            'En cours',
                            style: AHTypography.labelSmall.copyWith(
                              color: AHColors.successDark,
                            ),
                          ),
                        )
                      : null,
                  onTap: () {
                    _selectYear(year);
                    Navigator.of(context).pop();
                  },
                );
              }),
              const SizedBox(height: AHSpacing.s16),
            ],
          ),
        );
      },
    );
  }

  // ─── Select Year ────────────────────────────────────────────────────────

  Future<void> _selectYear(AcademicYearModel year) async {
    await ref.read(setCurrentAcademicYearProvider)(year);
    widget.onChanged?.call();
  }
}

// ─── Year Chip ────────────────────────────────────────────────────────────────

/// Individual chip for an academic year in the full selector.
class _YearChip extends StatelessWidget {
  final AcademicYearModel year;
  final bool isSelected;
  final VoidCallback onTap;

  const _YearChip({
    required this.year,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(
          horizontal: AHSpacing.s16,
          vertical: AHSpacing.s8,
        ),
        decoration: BoxDecoration(
          color: isSelected ? AHColors.navy : AHColors.lightSurfaceVariant,
          borderRadius: BorderRadius.circular(AHSpacing.r20),
          border: Border.all(
            color: isSelected ? AHColors.gold : AHColors.lightOutline,
            width: isSelected ? 2.0 : 1.0,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (year.isCurrent) ...[
              Container(
                width: 6,
                height: 6,
                decoration: const BoxDecoration(
                  color: AHColors.success,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: AHSpacing.s8),
            ],
            Text(
              year.displayName,
              style: AHTypography.bodyMedium.copyWith(
                color: isSelected ? AHColors.white : AHColors.grey700,
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
