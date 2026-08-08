import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_result.dart';
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

/// Generic module tab widget — fetches data from an API endpoint and displays
/// it as a list of cards. Replaces ALL placeholders.
class GenericModuleTab extends ConsumerWidget {
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
  });

  final String endpoint;
  final Map<String, dynamic>? params;
  final String? titleField;
  final String? subtitleField;
  final IconData icon;
  final String emptyMessage;
  final bool isKpi;
  final List<KpiCardConfig> kpiCards;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dataParams = (endpoint: endpoint, params: params);

    if (isKpi) {
      final kpiAsync = ref.watch(genericKpiProvider(dataParams));
      return kpiAsync.when(
        data: (kpi) => _buildKpiView(kpi),
        loading: () => const Center(child: CircularProgressIndicator(color: AHColors.navy)),
        error: (_, __) => _buildError(ref, dataParams),
      );
    }

    final dataAsync = ref.watch(genericModuleDataProvider(dataParams));
    return RefreshIndicator(
      color: AHColors.navy,
      onRefresh: () async => ref.invalidate(genericModuleDataProvider(dataParams)),
      child: dataAsync.when(
        data: (items) {
          if (items.isEmpty) return _buildEmpty();
          return ListView.builder(
            padding: const EdgeInsets.all(AHSpacing.sm),
            itemCount: items.length,
            itemBuilder: (context, index) => _DataCard(
              item: items[index],
              titleField: titleField,
              subtitleField: subtitleField,
              icon: icon,
            ),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator(color: AHColors.navy)),
        error: (_, __) => _buildError(ref, dataParams),
      ),
    );
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
                Icon(icon, size: 48, color: AHColors.grey300),
                const SizedBox(height: 8),
                Text(emptyMessage, style: const TextStyle(fontSize: 13, color: AHColors.grey500)),
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
          const Text('Erreur de chargement', style: TextStyle(fontSize: 13, color: AHColors.grey600)),
          const SizedBox(height: 8),
          ElevatedButton(
            onPressed: () => ref.invalidate(genericModuleDataProvider(dataParams)),
            style: ElevatedButton.styleFrom(backgroundColor: AHColors.navy, foregroundColor: Colors.white),
            child: const Text('Réessayer'),
          ),
        ],
      ),
    );
  }

  Widget _buildKpiView(Map<String, dynamic> kpi) {
    if (kpiCards.isEmpty) {
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
                Expanded(child: Text(key, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF0F172A)))),
                Text('${value ?? '—'}', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: AHColors.navy)),
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
      children: kpiCards.map((config) {
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
}

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

class _KpiCard extends StatelessWidget {
  const _KpiCard({required this.config, required this.value});
  final KpiCardConfig config;
  final String value;

  @override
  Widget build(BuildContext context) {
    final displayValue = '$config.prefix$value$config.suffix';
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
            decoration: BoxDecoration(color: config.bg, borderRadius: BorderRadius.circular(6)),
            child: Icon(config.icon, size: 16, color: config.color),
          ),
          Text(displayValue,
            style: TextStyle(
              fontSize: 14, fontWeight: FontWeight.w800,
              color: value == '0' ? AHColors.grey300 : const Color(0xFF0F172A),
            ),
          ),
          Text(config.label, style: const TextStyle(fontSize: 9, color: AHColors.grey500)),
        ],
      ),
    );
  }
}

class _DataCard extends StatelessWidget {
  const _DataCard({
    required this.item,
    required this.titleField,
    required this.subtitleField,
    required this.icon,
  });

  final Map<String, dynamic> item;
  final String? titleField;
  final String? subtitleField;
  final IconData icon;

  String get _title {
    if (titleField != null) {
      final parts = titleField!.split('.');
      dynamic value = item;
      for (final part in parts) {
        if (value is Map<String, dynamic>) {
          value = value[part];
        }
      }
      return value?.toString() ?? '';
    }
    // Auto-detect common title fields
    for (final field in ['name', 'title', 'label', 'firstName', 'staff_name', 'student_name']) {
      if (item[field] != null) return item[field].toString();
    }
    if (item['firstName'] != null && item['lastName'] != null) {
      return '${item['firstName']} ${item['lastName']}';
    }
    return item.keys.isNotEmpty ? item.keys.first : 'Item';
  }

  String get _subtitle {
    if (subtitleField != null) {
      final parts = subtitleField!.split('.');
      dynamic value = item;
      for (final part in parts) {
        if (value is Map<String, dynamic>) {
          value = value[part];
        }
      }
      return value?.toString() ?? '';
    }
    // Auto-detect common subtitle fields
    for (final field in ['description', 'className', 'class', 'status', 'type', 'role', 'email', 'phone', 'amount', 'dates']) {
      if (item[field] != null) return '${field}: ${item[field]}';
    }
    // Show status if present
    if (item['status'] != null) return 'Statut: ${item['status']}';
    return '';
  }

  @override
  Widget build(BuildContext context) {
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
          Container(
            width: 32, height: 32,
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
                Text(_title,
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
                  maxLines: 1, overflow: TextOverflow.ellipsis,
                ),
                if (_subtitle.isNotEmpty)
                  Text(_subtitle,
                    style: const TextStyle(fontSize: 9, color: AHColors.grey500),
                    maxLines: 1, overflow: TextOverflow.ellipsis,
                  ),
              ],
            ),
          ),
          if (item['status'] != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: _statusColor(item['status'].toString()).withOpacity(0.1),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                item['status'].toString(),
                style: TextStyle(fontSize: 8, fontWeight: FontWeight.w700, color: _statusColor(item['status'].toString())),
              ),
            ),
        ],
      ),
    );
  }

  Color _statusColor(String status) {
    final s = status.toLowerCase();
    if (s.contains('active') || s.contains('valid') || s.contains('accept')) return const Color(0xFF10B981);
    if (s.contains('pending') || s.contains('attente') || s.contains('waiting')) return const Color(0xFFF59E0B);
    if (s.contains('reject') || s.contains('inactive') || s.contains('refus')) return const Color(0xFFDC2626);
    return AHColors.grey400;
  }
}
