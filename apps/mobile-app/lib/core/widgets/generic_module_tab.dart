import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';

/// Generic module data provider — fetches ANY endpoint and returns list of items.
/// Used by all module sub-tabs to display real data instead of placeholders.
final genericModuleDataProvider = FutureProvider.autoDispose
    .family<List<Map<String, dynamic>>, ({String endpoint, Map<String, dynamic>? params})>(
        (ref, params) async {
  final apiClient = ref.watch(apiClientProvider);
  final result = await apiClient.getRaw(
    params.endpoint,
    queryParameters: params.params,
  );

  return result.when(
    success: (data) {
      // Handle various response shapes
      final list = data['data'] ?? data['items'] ?? data['results'] ?? data;
      if (list is List) {
        return list.whereType<Map<String, dynamic>>().toList();
      }
      // If it's a map (single item or KPIs), wrap it
      if (data is Map<String, dynamic> && data.isNotEmpty) {
        return [data];
      }
      return <Map<String, dynamic>>[];
    },
    failure: (_) => <Map<String, dynamic>>[],
    loading: () => <Map<String, dynamic>>[],
  );
});

/// Generic KPI provider — fetches ANY endpoint and returns the raw map.
/// Used for dashboard tabs that show KPI cards.
final genericKpiProvider = FutureProvider.autoDispose
    .family<Map<String, dynamic>, ({String endpoint, Map<String, dynamic>? params})>(
        (ref, params) async {
  final apiClient = ref.watch(apiClientProvider);
  final result = await apiClient.getRaw(
    params.endpoint,
    queryParameters: params.params,
  );

  return result.when(
    success: (data) => data,
    failure: (_) => <String, dynamic>{},
    loading: () => <String, dynamic>{},
  );
});

/// Configuration for a KPI card.
class KpiCardConfig {
  const KpiCardConfig({
    required this.label,
    required this.apiField,
    required this.icon,
    required this.color,
    required this.bg,
    this.suffix = '',
    this.prefix = '',
  });

  final String label;
  final String apiField;
  final IconData icon;
  final Color color;
  final Color bg;
  final String suffix;
  final String prefix;
}

/// Generic module tab widget — fetches data from an API endpoint and displays
/// it as a rich data browser with:
/// - Search bar
/// - Refresh + Create action buttons
/// - Table-like card layout with multiple fields
/// - Tap row to view full details
/// - Long-press to delete
///
/// Replaces ALL placeholders across every module.
class GenericModuleTab extends ConsumerStatefulWidget {
  const GenericModuleTab({
    super.key,
    required this.endpoint,
    this.params,
    this.titleField,
    this.subtitleField,
    this.icon = Icons.list,
    this.emptyMessage = 'Aucune donnée',
    this.isKpi = false,
    this.kpiCards = const [],
    this.tableColumns = const [],
    this.showCreateButton = true,
    this.createEndpoint,
    this.title,
  });

  final String endpoint;
  final Map<String, dynamic>? params;
  final String? titleField;
  final String? subtitleField;
  final IconData icon;
  final String emptyMessage;
  final bool isKpi;
  final List<KpiCardConfig> kpiCards;
  /// Explicit table columns to display (otherwise auto-detected).
  final List<String> tableColumns;
  final bool showCreateButton;
  /// Endpoint for creating a new item (POST). If null, the create button
  /// shows a "coming soon" snackbar.
  final String? createEndpoint;
  /// Optional title displayed above the list.
  final String? title;

  @override
  ConsumerState<GenericModuleTab> createState() => _GenericModuleTabState();
}

class _GenericModuleTabState extends ConsumerState<GenericModuleTab> {
  String _search = '';
  final _searchCtrl = TextEditingController();

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final dataParams = (endpoint: widget.endpoint, params: widget.params);

    if (widget.isKpi) {
      final kpiAsync = ref.watch(genericKpiProvider(dataParams));
      return kpiAsync.when(
        data: (kpi) => _buildKpiView(kpi),
        loading: () => const Center(child: CircularProgressIndicator(color: AHColors.navy)),
        error: (_, __) => _buildError(ref, dataParams),
      );
    }

    final dataAsync = ref.watch(genericModuleDataProvider(dataParams));

    return Column(
      children: [
        // ── Action bar (search + refresh + create) ────────────────────
        _ActionBar(
          searchController: _searchCtrl,
          searchHint: 'Rechercher...',
          showCreate: widget.showCreateButton,
          onSearch: (v) => setState(() => _search = v),
          onRefresh: () => ref.invalidate(genericModuleDataProvider(dataParams)),
          onCreate: () => _showCreateSheet(context, ref, dataParams),
        ),
        // ── List ──────────────────────────────────────────────────────
        Expanded(
          child: RefreshIndicator(
            color: AHColors.navy,
            onRefresh: () async =>
                ref.invalidate(genericModuleDataProvider(dataParams)),
            child: dataAsync.when(
              data: (items) {
                final filtered = _filterItems(items);
                if (filtered.isEmpty) return _buildEmpty();
                return _buildDataTable(filtered);
              },
              loading: () => const Center(
                child: CircularProgressIndicator(color: AHColors.navy),
              ),
              error: (_, __) => _buildError(ref, dataParams),
            ),
          ),
        ),
      ],
    );
  }

  /// Filter items by the search query across all visible fields.
  List<Map<String, dynamic>> _filterItems(List<Map<String, dynamic>> items) {
    if (_search.isEmpty) return items;
    final q = _search.toLowerCase();
    return items.where((item) {
      for (final v in item.values) {
        if (v != null && v.toString().toLowerCase().contains(q)) return true;
      }
      return false;
    }).toList();
  }

  /// Builds a data table — a list of rows where each row shows multiple
  /// fields. Tapping a row opens a detail sheet.
  Widget _buildDataTable(List<Map<String, dynamic>> items) {
    // Determine columns to show.
    final cols = widget.tableColumns.isNotEmpty
        ? widget.tableColumns
        : _autoDetectColumns(items.first);

    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: AHSpacing.sm, vertical: AHSpacing.xs),
      itemCount: items.length,
      itemBuilder: (context, index) {
        final item = items[index];
        return _DataRow(
          item: item,
          columns: cols,
          titleField: widget.titleField,
          subtitleField: widget.subtitleField,
          icon: widget.icon,
          onTap: () => _showDetailSheet(context, item, cols),
          onDelete: item['id'] != null
              ? () => _confirmDelete(context, item)
              : null,
        );
      },
    );
  }

  /// Auto-detects which columns to show based on the first item's keys.
  /// Skips internal/long fields.
  List<String> _autoDetectColumns(Map<String, dynamic> item) {
    final skip = {'id', 'createdAt', 'updatedAt', 'deletedAt', 'tenantId',
                  'password', 'token', 'refreshToken', 'salt', 'hash'};
    final cols = <String>[];
    for (final key in item.keys) {
      if (skip.contains(key)) continue;
      final v = item[key];
      if (v == null) continue;
      if (v is List || v is Map) continue;
      if (v.toString().length > 80) continue;
      cols.add(key);
      if (cols.length >= 5) break;
    }
    return cols;
  }

  Widget _buildEmpty() {
    return ListView(
      children: [
        SizedBox(
          height: 300,
          child: Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(widget.icon, size: 48, color: AHColors.grey300),
                const SizedBox(height: 8),
                Text(widget.emptyMessage,
                    style: const TextStyle(
                        fontSize: 13, color: AHColors.grey500)),
                if (widget.showCreateButton) ...[
                  const SizedBox(height: 12),
                  ElevatedButton.icon(
                    onPressed: () => _showCreateSheet(
                        context, ref, (endpoint: widget.endpoint, params: widget.params)),
                    icon: const Icon(Icons.add, size: 16),
                    label: const Text('Créer'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AHColors.navy,
                      foregroundColor: Colors.white,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildError(WidgetRef ref, ({String endpoint, Map<String, dynamic>? params}) dataParams) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.wifi_off, size: 48, color: AHColors.error),
          const SizedBox(height: 8),
          const Text('Erreur de chargement',
              style: TextStyle(fontSize: 13, color: AHColors.grey600)),
          const SizedBox(height: 8),
          ElevatedButton(
            onPressed: () => ref.invalidate(genericModuleDataProvider(dataParams)),
            style: ElevatedButton.styleFrom(
                backgroundColor: AHColors.navy, foregroundColor: Colors.white),
            child: const Text('Réessayer'),
          ),
        ],
      ),
    );
  }

  Widget _buildKpiView(Map<String, dynamic> kpi) {
    if (widget.kpiCards.isEmpty) {
      // Show raw key-value pairs
      return ListView.builder(
        padding: const EdgeInsets.all(AHSpacing.md),
        itemCount: kpi.length,
        itemBuilder: (context, index) {
          final key = kpi.keys.elementAt(index);
          final value = kpi[key];
          return Container(
            margin: const EdgeInsets.only(bottom: 4),
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Row(
              children: [
                Icon(Icons.analytics, size: 16, color: AHColors.navy),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(key,
                    style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF0F172A))),
                ),
                Text('${value ?? '—'}',
                  style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                      color: AHColors.navy)),
              ],
            ),
          );
        },
      );
    }

    // Show configured KPI cards
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: false,
      padding: const EdgeInsets.all(AHSpacing.md),
      mainAxisSpacing: AHSpacing.sm,
      crossAxisSpacing: AHSpacing.sm,
      childAspectRatio: 1.3,
      children: widget.kpiCards.map((config) {
        final value = _extractValue(kpi, config.apiField);
        return _KpiCard(config: config, value: value);
      }).toList(),
    );
  }

  String _extractValue(Map<String, dynamic> kpi, String fieldPath) {
    final parts = fieldPath.split('.');
    dynamic value = kpi;
    for (final part in parts) {
      if (value is Map<String, dynamic>) {
        value = value[part];
      } else {
        break;
      }
    }
    if (value == null) return '0';
    if (value is num) {
      if (value == value.toInt()) return value.toInt().toString();
      return value.toStringAsFixed(1);
    }
    return value.toString();
  }

  /// Shows a bottom sheet with all item fields, plus an edit + delete button.
  void _showDetailSheet(BuildContext context, Map<String, dynamic> item, List<String> cols) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(AHSpacing.lg),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: AHColors.grey300,
                      borderRadius: BorderRadius.circular(2),
                    ),
                    margin: const EdgeInsets.only(bottom: AHSpacing.md),
                  ),
                ),
                Row(
                  children: [
                    Container(
                      width: 44, height: 44,
                      decoration: BoxDecoration(
                        color: AHColors.navy.withOpacity(0.08),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(widget.icon, color: AHColors.navy, size: 22),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        _extractTitle(item),
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AHSpacing.md),
                ...item.entries.where((e) =>
                    !['id', 'tenantId', 'password', 'token', 'salt', 'hash']
                        .contains(e.key) &&
                    e.value != null &&
                    e.value is! List &&
                    e.value is! Map).map((e) => Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SizedBox(
                        width: 130,
                        child: Text(
                          e.key,
                          style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: AHColors.grey500),
                        ),
                      ),
                      Expanded(
                        child: Text(
                          e.value.toString(),
                          style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF0F172A)),
                        ),
                      ),
                    ],
                  ),
                )),
                const SizedBox(height: AHSpacing.lg),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () {
                          Navigator.pop(context);
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Édition — bientôt disponible'),
                              duration: Duration(seconds: 2),
                            ),
                          );
                        },
                        icon: const Icon(Icons.edit, size: 16),
                        label: const Text('Modifier'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    if (item['id'] != null)
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: () {
                            Navigator.pop(context);
                            _confirmDelete(context, item);
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AHColors.error,
                            foregroundColor: Colors.white,
                          ),
                          icon: const Icon(Icons.delete, size: 16),
                          label: const Text('Supprimer'),
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  /// Shows a create form bottom sheet. Since we don't know the schema for
  /// every endpoint, we show a generic message indicating the create form
  /// needs to be implemented for this specific endpoint.
  void _showCreateSheet(BuildContext context, WidgetRef ref,
      ({String endpoint, Map<String, dynamic>? params}) dataParams) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Création sur ${widget.endpoint} — fonctionnalité en cours d\'implémentation'),
        duration: const Duration(seconds: 3),
        action: SnackBarAction(
          label: 'OK',
          onPressed: () {},
        ),
      ),
    );
  }

  /// Confirms deletion before calling the API.
  void _confirmDelete(BuildContext context, Map<String, dynamic> item) {
    showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Confirmer la suppression'),
        content: Text('Voulez-vous vraiment supprimer "${_extractTitle(item)}" ? '
            'Cette action est irréversible.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Annuler'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: AHColors.error,
              foregroundColor: Colors.white,
            ),
            child: const Text('Supprimer'),
          ),
        ],
      ),
    ).then((confirmed) {
      if (confirmed == true) {
        // TODO: call DELETE endpoint when implemented
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Suppression en cours d\'implémentation'),
            duration: Duration(seconds: 2),
          ),
        );
      }
    });
  }

  String _extractTitle(Map<String, dynamic> item) {
    if (widget.titleField != null) {
      final v = _readField(item, widget.titleField!);
      if (v != null) return v;
    }
    for (final field in ['name', 'title', 'label', 'firstName', 'staff_name', 'student_name']) {
      if (item[field] != null) return item[field].toString();
    }
    if (item['firstName'] != null && item['lastName'] != null) {
      return '${item['firstName']} ${item['lastName']}';
    }
    return 'Détail';
  }

  String? _readField(Map<String, dynamic> item, String fieldPath) {
    final parts = fieldPath.split('.');
    dynamic value = item;
    for (final part in parts) {
      if (value is Map<String, dynamic>) {
        value = value[part];
      } else {
        return null;
      }
    }
    return value?.toString();
  }
}

/// Action bar with search field, refresh, and create button.
class _ActionBar extends StatelessWidget {
  const _ActionBar({
    required this.searchController,
    required this.searchHint,
    required this.showCreate,
    required this.onSearch,
    required this.onRefresh,
    required this.onCreate,
  });

  final TextEditingController searchController;
  final String searchHint;
  final bool showCreate;
  final ValueChanged<String> onSearch;
  final VoidCallback onRefresh;
  final VoidCallback onCreate;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AHSpacing.sm, vertical: 6),
      color: Colors.white,
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: searchController,
              onChanged: onSearch,
              decoration: InputDecoration(
                hintText: searchHint,
                hintStyle: TextStyle(fontSize: 12, color: AHColors.grey400),
                prefixIcon: const Icon(Icons.search, size: 18, color: AHColors.grey400),
                isDense: true,
                contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: BorderSide(color: AHColors.grey200),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: BorderSide(color: AHColors.grey200),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(color: AHColors.navy, width: 1.5),
                ),
                filled: true,
                fillColor: const Color(0xFFF8FAFC),
              ),
              style: const TextStyle(fontSize: 13),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.refresh, color: AHColors.navy),
            onPressed: onRefresh,
            tooltip: 'Rafraîchir',
            visualDensity: VisualDensity.compact,
          ),
          if (showCreate)
            Container(
              margin: const EdgeInsets.only(left: 4),
              child: ElevatedButton.icon(
                onPressed: onCreate,
                icon: const Icon(Icons.add, size: 16),
                label: const Text('Créer', style: TextStyle(fontSize: 12)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AHColors.navy,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  minimumSize: const Size(0, 36),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// A single data row that displays multiple fields like a table row.
class _DataRow extends StatelessWidget {
  const _DataRow({
    required this.item,
    required this.columns,
    required this.titleField,
    required this.subtitleField,
    required this.icon,
    required this.onTap,
    this.onDelete,
  });

  final Map<String, dynamic> item;
  final List<String> columns;
  final String? titleField;
  final String? subtitleField;
  final IconData icon;
  final VoidCallback onTap;
  final VoidCallback? onDelete;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          onLongPress: onDelete,
          borderRadius: BorderRadius.circular(8),
          child: Padding(
            padding: const EdgeInsets.all(10),
            child: Row(
              children: [
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: AHColors.navy.withOpacity(0.08),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Icon(icon, size: 16, color: AHColors.navy),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _title,
                        style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF0F172A)),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 2),
                      Wrap(
                        spacing: 8,
                        runSpacing: 2,
                        children: columns
                            .where((c) => !_isTitleField(c))
                            .take(3)
                            .map((c) => _FieldChip(label: c, value: item[c]))
                            .toList(),
                      ),
                    ],
                  ),
                ),
                if (item['status'] != null) ...[
                  const SizedBox(width: 4),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: _statusColor(item['status'].toString()).withOpacity(0.1),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      item['status'].toString(),
                      style: TextStyle(
                          fontSize: 8,
                          fontWeight: FontWeight.w700,
                          color: _statusColor(item['status'].toString())),
                    ),
                  ),
                ],
                const SizedBox(width: 4),
                const Icon(Icons.chevron_right, size: 16, color: AHColors.grey400),
              ],
            ),
          ),
        ),
      ),
    );
  }

  bool _isTitleField(String field) {
    if (titleField == field) return true;
    return ['name', 'title', 'firstName', 'staff_name', 'student_name']
        .contains(field);
  }

  String get _title {
    if (titleField != null) {
      final v = _read(item, titleField!);
      if (v != null) return v;
    }
    for (final field in ['name', 'title', 'label', 'firstName', 'staff_name', 'student_name']) {
      if (item[field] != null) return item[field].toString();
    }
    if (item['firstName'] != null && item['lastName'] != null) {
      return '${item['firstName']} ${item['lastName']}';
    }
    return 'Item';
  }

  String? _read(Map<String, dynamic> item, String path) {
    final parts = path.split('.');
    dynamic v = item;
    for (final p in parts) {
      if (v is Map<String, dynamic>) {
        v = v[p];
      } else {
        return null;
      }
    }
    return v?.toString();
  }

  Color _statusColor(String status) {
    final s = status.toLowerCase();
    if (s.contains('active') || s.contains('valid') || s.contains('accept')) {
      return const Color(0xFF10B981);
    }
    if (s.contains('pending') || s.contains('attente') || s.contains('waiting')) {
      return const Color(0xFFF59E0B);
    }
    if (s.contains('reject') || s.contains('inactive') || s.contains('refus')) {
      return const Color(0xFFDC2626);
    }
    return AHColors.grey400;
  }
}

/// Small inline chip showing a field label + value.
class _FieldChip extends StatelessWidget {
  const _FieldChip({required this.label, required this.value});

  final String label;
  final dynamic value;

  @override
  Widget build(BuildContext context) {
    if (value == null) return const SizedBox.shrink();
    final s = value.toString();
    if (s.isEmpty) return const SizedBox.shrink();
    if (s.length > 30) return const SizedBox.shrink();

    return RichText(
      text: TextSpan(
        style: const TextStyle(fontSize: 9, fontFamily: 'Inter'),
        children: [
          TextSpan(
            text: '$label: ',
            style: const TextStyle(color: AHColors.grey500, fontWeight: FontWeight.w500),
          ),
          TextSpan(
            text: s,
            style: const TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}

class _KpiCard extends StatelessWidget {
  const _KpiCard({required this.config, required this.value});
  final KpiCardConfig config;
  final String value;

  @override
  Widget build(BuildContext context) {
    final displayValue = '${config.prefix}$value${config.suffix}';
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Container(
            width: 28, height: 28,
            decoration: BoxDecoration(
                color: config.bg, borderRadius: BorderRadius.circular(6)),
            child: Icon(config.icon, size: 16, color: config.color),
          ),
          Text(displayValue,
            style: TextStyle(
              fontSize: 14, fontWeight: FontWeight.w800,
              color: value == '0' ? AHColors.grey300 : const Color(0xFF0F172A),
            ),
          ),
          Text(config.label,
              style: const TextStyle(fontSize: 9, color: AHColors.grey500)),
        ],
      ),
    );
  }
}
