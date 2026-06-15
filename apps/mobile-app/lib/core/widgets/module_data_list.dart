/// ============================================================================
/// MODULE DATA LIST — Academia Hub Mobile
/// ============================================================================
///
/// Reusable widget that combines [ModuleLoadingWrapper] with a ListView,
/// empty state, and optional FAB for module sub-tab content.
///
/// Usage:
/// ```dart
/// ModuleDataList(
///   itemsAsync: ref.watch(studentsProvider),
///   moduleName: 'Élèves',
///   itemBuilder: (item) => ListItemCard(
///     title: item['name'] ?? '',
///     subtitle: item['class'] ?? '',
///     leadingIcon: Icons.person,
///   ),
///   onRetry: () => ref.invalidate(studentsProvider),
///   onAdd: () => _showAddDialog(context, ref),
///   addLabel: 'Ajouter un élève',
/// )
/// ```
/// ============================================================================

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../theme/ah_colors.dart';
import '../../theme/ah_spacing.dart';
import '../loading/module_loading_wrapper.dart';
import '../sub_tab_content.dart';

/// A reusable data list widget for module sub-tabs that handles
/// loading, empty state, error, and data display with optional FAB.
class ModuleDataList extends ConsumerWidget {
  final AsyncValue<List<Map<String, dynamic>>> itemsAsync;
  final String moduleName;
  final Widget Function(Map<String, dynamic> item) itemBuilder;
  final VoidCallback onRetry;
  final VoidCallback? onAdd;
  final String? addLabel;
  final IconData? addIcon;
  final String emptyTitle;
  final String emptySubtitle;
  final EdgeInsets padding;

  const ModuleDataList({
    super.key,
    required this.itemsAsync,
    required this.moduleName,
    required this.itemBuilder,
    required this.onRetry,
    this.onAdd,
    this.addLabel,
    this.addIcon,
    this.emptyTitle = 'Aucune donnée',
    this.emptySubtitle = 'Appuyez sur + pour ajouter',
    this.padding = const EdgeInsets.all(AHSpacing.lg),
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: ModuleLoadingWrapper<List<Map<String, dynamic>>>(
        value: itemsAsync,
        moduleName: moduleName,
        onRetry: onRetry,
        builder: (items) {
          if (items.isEmpty) {
            return _ModuleEmptyState(
              title: emptyTitle,
              subtitle: emptySubtitle,
              icon: addIcon ?? Icons.inbox,
            );
          }
          return ListView.separated(
            padding: padding,
            itemCount: items.length,
            separatorBuilder: (_, __) => const SizedBox(height: AHSpacing.sm),
            itemBuilder: (_, index) => itemBuilder(items[index]),
          );
        },
      ),
      floatingActionButton: onAdd != null
          ? FloatingActionButton(
              onPressed: onAdd,
              tooltip: addLabel ?? 'Ajouter',
              child: Icon(addIcon ?? Icons.add),
            )
          : null,
    );
  }
}

/// A reusable dashboard widget that shows stats cards from provider data.
class ModuleDashboardView extends ConsumerWidget {
  final AsyncValue<Map<String, dynamic>> dashboardAsync;
  final String moduleName;
  final VoidCallback onRetry;
  final List<StatCardConfig> statCards;
  final List<Widget>? extraChildren;

  const ModuleDashboardView({
    super.key,
    required this.dashboardAsync,
    required this.moduleName,
    required this.onRetry,
    required this.statCards,
    this.extraChildren,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleLoadingWrapper<Map<String, dynamic>>(
      value: dashboardAsync,
      moduleName: moduleName,
      onRetry: onRetry,
      builder: (data) {
        return SubTabContentWrapper(
          children: [
            GridView.count(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisCount: 2,
              mainAxisSpacing: AHSpacing.sm,
              crossAxisSpacing: AHSpacing.sm,
              childAspectRatio: 1.4,
              children: statCards
                  .map((config) => StatCard(
                        title: config.title,
                        value: _extractValue(data, config.valueKey) ?? config.defaultValue,
                        icon: config.icon,
                        iconColor: config.iconColor,
                        subtitle: config.subtitle,
                      ))
                  .toList(),
            ),
            if (extraChildren != null) ...extraChildren!,
          ],
        );
      },
    );
  }

  String? _extractValue(Map<String, dynamic> data, String key) {
    final value = data[key];
    if (value == null) return null;
    return value.toString();
  }
}

/// Configuration for a stat card in a dashboard view.
class StatCardConfig {
  final String title;
  final String valueKey;
  final String defaultValue;
  final IconData icon;
  final Color? iconColor;
  final String? subtitle;

  const StatCardConfig({
    required this.title,
    required this.valueKey,
    required this.defaultValue,
    required this.icon,
    this.iconColor,
    this.subtitle,
  });
}

// ─── Empty State ────────────────────────────────────────────────────────────

class _ModuleEmptyState extends StatelessWidget {
  final String title;
  final String subtitle;
  final IconData icon;

  const _ModuleEmptyState({
    required this.title,
    required this.subtitle,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AHSpacing.xxl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: AHColors.navy.withValues(alpha: 0.08),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 32, color: AHColors.muted),
            ),
            const SizedBox(height: AHSpacing.lg),
            Text(
              title,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: AHColors.textSecondary,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AHSpacing.xxs),
            Text(
              subtitle,
              style: const TextStyle(
                fontSize: 13,
                color: AHColors.textMuted,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

/// Helper to show a simple add dialog for creating new items.
Future<Map<String, dynamic>?> showAddItemDialog(
  BuildContext context, {
  required String title,
  required List<AddFieldConfig> fields,
}) {
  final controllers = <String, TextEditingController>{};
  for (final field in fields) {
    controllers[field.key] = TextEditingController();
  }

  return showDialog<Map<String, dynamic>>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(title),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: fields
              .map((field) => Padding(
                    padding: const EdgeInsets.only(bottom: AHSpacing.md),
                    child: TextField(
                      controller: controllers[field.key],
                      decoration: InputDecoration(
                        labelText: field.label,
                        hintText: field.hint,
                      ),
                    ),
                  ))
              .toList(),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Annuler'),
        ),
        ElevatedButton(
          onPressed: () {
            final data = <String, dynamic>{};
            for (final field in fields) {
              data[field.key] = controllers[field.key]!.text;
            }
            Navigator.of(context).pop(data);
          },
          child: const Text('Créer'),
        ),
      ],
    ),
  ).then((result) {
    for (final controller in controllers.values) {
      controller.dispose();
    }
    return result;
  });
}

/// Configuration for a field in an add dialog.
class AddFieldConfig {
  final String key;
  final String label;
  final String? hint;

  const AddFieldConfig({
    required this.key,
    required this.label,
    this.hint,
  });
}
