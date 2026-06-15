/// ============================================================================
/// SCHOOL LEVEL SELECTOR — Academia Hub Mobile
/// ============================================================================
///
/// Reusable chip selector for school level context (Maternelle/Primaire/Secondaire).
/// Used alongside the academic year selector in the app bar or dashboard.
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
import 'school_level_provider.dart';

// ─── School Level Selector Widget ─────────────────────────────────────────────

/// A chip selector for school level context (Maternelle/Primaire/Secondaire).
///
/// Typically used alongside [AcademicYearSelector].
///
/// Usage:
/// ```dart
/// SchoolLevelSelector(compact: true) // For app bar
/// SchoolLevelSelector()               // Full width for dashboard
/// ```
class SchoolLevelSelector extends ConsumerStatefulWidget {
  /// Whether to use compact mode (suitable for app bar).
  final bool compact;

  /// Optional callback when the school level changes.
  final VoidCallback? onChanged;

  const SchoolLevelSelector({
    super.key,
    this.compact = false,
    this.onChanged,
  });

  @override
  ConsumerState<SchoolLevelSelector> createState() =>
      _SchoolLevelSelectorState();
}

class _SchoolLevelSelectorState extends ConsumerState<SchoolLevelSelector> {
  @override
  void initState() {
    super.initState();
    // Initialize the school level context on first build
    Future.microtask(() {
      ref.read(schoolLevelInitializerProvider);
    });
  }

  @override
  Widget build(BuildContext context) {
    final currentLevel = ref.watch(currentSchoolLevelProvider);
    final levels = ref.watch(availableSchoolLevelsProvider);
    final theme = Theme.of(context);

    if (levels.isEmpty) {
      return widget.compact ? const SizedBox.shrink() : _buildEmptyState(theme);
    }

    if (widget.compact) {
      return _buildCompactSelector(currentLevel, levels, theme);
    }

    return _buildFullSelector(currentLevel, levels, theme);
  }

  // ─── Compact Mode (App Bar) ─────────────────────────────────────────────

  Widget _buildCompactSelector(
    SchoolLevelModel? currentLevel,
    List<SchoolLevelModel> levels,
    ThemeData theme,
  ) {
    return Material(
      color: AHColors.blue.withValues(alpha: 0.1),
      borderRadius: BorderRadius.circular(AHSpacing.r8),
      child: InkWell(
        borderRadius: BorderRadius.circular(AHSpacing.r8),
        onTap: () => _showLevelPicker(context, levels),
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AHSpacing.s12,
            vertical: AHSpacing.s8,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                currentLevel?.emoji ?? '🏫',
                style: const TextStyle(fontSize: 14),
              ),
              const SizedBox(width: AHSpacing.s4),
              Text(
                currentLevel?.label ?? 'Niveau',
                style: AHTypography.labelLarge.copyWith(
                  color: AHColors.blue,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(width: AHSpacing.s4),
              Icon(
                Icons.arrow_drop_down,
                size: AHSpacing.icon20,
                color: AHColors.blue,
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ─── Full Mode (Dashboard) ──────────────────────────────────────────────

  Widget _buildFullSelector(
    SchoolLevelModel? currentLevel,
    List<SchoolLevelModel> levels,
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
                  Icons.category,
                  size: AHSpacing.icon20,
                  color: AHColors.blue,
                ),
                const SizedBox(width: AHSpacing.s8),
                Text(
                  'Niveau scolaire',
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
              children: levels.map((level) {
                final isSelected = currentLevel?.id == level.id;
                return _LevelChip(
                  level: level,
                  isSelected: isSelected,
                  onTap: () => _selectLevel(level),
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
              'Aucun niveau scolaire disponible',
              style: AHTypography.bodyMedium.copyWith(
                color: AHColors.grey500,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ─── Level Picker Bottom Sheet ──────────────────────────────────────────

  void _showLevelPicker(BuildContext context, List<SchoolLevelModel> levels) {
    final currentLevel = ref.read(currentSchoolLevelProvider);

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
                      Icons.category,
                      color: AHColors.blue,
                    ),
                    const SizedBox(width: AHSpacing.s12),
                    Text(
                      'Choisir le niveau scolaire',
                      style: AHTypography.titleMedium.copyWith(
                        color: AHColors.navy,
                      ),
                    ),
                  ],
                ),
              ),
              const Divider(height: 1),
              ...levels.map((level) {
                final isSelected = currentLevel?.id == level.id;
                return ListTile(
                  leading: Text(
                    level.emoji,
                    style: const TextStyle(fontSize: 24),
                  ),
                  title: Text(
                    level.label,
                    style: AHTypography.bodyLarge.copyWith(
                      fontWeight:
                          isSelected ? FontWeight.w600 : FontWeight.w400,
                    ),
                  ),
                  subtitle: Text(
                    level.name,
                    style: AHTypography.bodySmall.copyWith(
                      color: AHColors.grey500,
                    ),
                  ),
                  trailing: isSelected
                      ? const Icon(
                          Icons.check_circle,
                          color: AHColors.gold,
                        )
                      : null,
                  selected: isSelected,
                  selectedTileColor: AHColors.gold.withValues(alpha: 0.05),
                  onTap: () {
                    _selectLevel(level);
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

  // ─── Select Level ───────────────────────────────────────────────────────

  Future<void> _selectLevel(SchoolLevelModel level) async {
    await ref.read(setCurrentSchoolLevelProvider)(level);
    widget.onChanged?.call();
  }
}

// ─── Level Chip ───────────────────────────────────────────────────────────────

/// Individual chip for a school level in the full selector.
class _LevelChip extends StatelessWidget {
  final SchoolLevelModel level;
  final bool isSelected;
  final VoidCallback onTap;

  const _LevelChip({
    required this.level,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    // Determine chip color based on level code
    Color chipBgColor;
    Color chipTextColor;
    Color chipBorderColor;

    if (isSelected) {
      chipBgColor = AHColors.navy;
      chipTextColor = AHColors.white;
      chipBorderColor = AHColors.gold;
    } else {
      chipBgColor = AHColors.lightSurfaceVariant;
      chipTextColor = AHColors.grey700;
      chipBorderColor = AHColors.lightOutline;
    }

    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(
          horizontal: AHSpacing.s16,
          vertical: AHSpacing.s8,
        ),
        decoration: BoxDecoration(
          color: chipBgColor,
          borderRadius: BorderRadius.circular(AHSpacing.r20),
          border: Border.all(
            color: chipBorderColor,
            width: isSelected ? 2.0 : 1.0,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              level.emoji,
              style: const TextStyle(fontSize: 14),
            ),
            const SizedBox(width: AHSpacing.s8),
            Text(
              level.label,
              style: AHTypography.bodyMedium.copyWith(
                color: chipTextColor,
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
