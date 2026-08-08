import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_notifier.dart';
import '../../../core/auth/auth_providers.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_result.dart';
import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';

// ── Dashboard Data Models ──────────────────────────────────────────────

class ConsolidatedReport {
  final int enrollmentTotal;
  final double attendanceRate;
  final double revenueTotal;
  final int alertsCount;
  final List<AlertItem> alertsItems;
  final double weightedAverage;

  const ConsolidatedReport({
    this.enrollmentTotal = 0,
    this.attendanceRate = 0,
    this.revenueTotal = 0,
    this.alertsCount = 0,
    this.alertsItems = const [],
    this.weightedAverage = 0,
  });

  factory ConsolidatedReport.fromJson(Map<String, dynamic> json) {
    final enrollment = json['enrollment'] ?? {};
    final attendance = json['attendance'] ?? {};
    final revenue = json['revenue'] ?? {};
    final alerts = json['alerts'] ?? {};
    final weightedAvg = json['weightedAverage'] ?? {};

    final alertItems = alerts['items'] ?? [];
    return ConsolidatedReport(
      enrollmentTotal: _toInt(enrollment['total']) ?? 0,
      attendanceRate: _toDouble(attendance['rate']) ?? 0,
      revenueTotal: _toDouble(revenue['total']) ?? 0,
      alertsCount: _toInt(alerts['count']) ?? 0,
      alertsItems: alertItems is List
          ? alertItems.whereType<Map<String, dynamic>>().map(AlertItem.fromJson).take(5).toList()
          : [],
      weightedAverage: _toDouble(weightedAvg['value']) ?? 0,
    );
  }
}

class AlertItem {
  final String title;
  final String? description;
  final String? severity;
  final String? date;

  const AlertItem({required this.title, this.description, this.severity, this.date});

  factory AlertItem.fromJson(Map<String, dynamic> json) {
    return AlertItem(
      title: (json['title'] ?? json['label'] ?? json['message'] ?? '').toString(),
      description: json['description']?.toString(),
      severity: (json['severity'] ?? json['level'] ?? 'medium').toString().toLowerCase(),
      date: json['date']?.toString(),
    );
  }

  bool get isCritical => severity == 'critical';
  bool get isHigh => severity == 'high';
}

class FinanceKpis {
  final double totalEncaissement;
  final double totalUnpaid;
  final double totalDue;
  final double totalReductions;
  final double totalDepenses;
  final double soldeNet;
  final double tauxRecouvrement;
  final double previsonnementGlobal;

  const FinanceKpis({
    this.totalEncaissement = 0,
    this.totalUnpaid = 0,
    this.totalDue = 0,
    this.totalReductions = 0,
    this.totalDepenses = 0,
    this.soldeNet = 0,
    this.tauxRecouvrement = 0,
    this.previsonnementGlobal = 0,
  });

  factory FinanceKpis.fromJson(Map<String, dynamic> json) {
    return FinanceKpis(
      totalEncaissement: _toDouble(json['totalEncaissement'] ?? json['totalCollected']) ?? 0,
      totalUnpaid: _toDouble(json['unpaidAmount'] ?? json['totalUnpaid']) ?? 0,
      totalDue: _toDouble(json['totalDue']) ?? 0,
      totalReductions: _toDouble(json['totalReductions']) ?? 0,
      totalDepenses: _toDouble(json['totalDepenses']) ?? 0,
      soldeNet: _toDouble(json['soldeNet']) ?? 0,
      tauxRecouvrement: _toDouble(json['tauxRecouvrement']) ?? 0,
      previsonnementGlobal: _toDouble(json['previsonnementGlobal'] ?? json['totalDu']) ?? 0,
    );
  }
}

class StudentsStats {
  final int total;
  final List<ClassStat> byClass;
  final int boys;
  final int girls;

  const StudentsStats({this.total = 0, this.byClass = const [], this.boys = 0, this.girls = 0});

  factory StudentsStats.fromJson(Map<String, dynamic> json) {
    final byClassRaw = json['byClass'] ?? json['byLevel'] ?? [];
    final byGender = json['byGender'] ?? [];

    int boys = 0, girls = 0;
    if (byGender is List) {
      for (final g in byGender) {
        if (g is Map<String, dynamic>) {
          final label = (g['label'] ?? g['gender'] ?? '').toString().toLowerCase();
          final count = _toInt(g['count'] ?? g['total']) ?? 0;
          if (label.contains('f') || label.contains('girl')) {
            girls += count;
          } else {
            boys += count;
          }
        }
      }
    }

    return StudentsStats(
      total: _toInt(json['total']) ?? 0,
      byClass: byClassRaw is List
          ? byClassRaw.whereType<Map<String, dynamic>>().map(ClassStat.fromJson).take(6).toList()
          : [],
      boys: boys,
      girls: girls,
    );
  }
}

class ClassStat {
  final String label;
  final int count;
  final String? color;

  const ClassStat({required this.label, required this.count, this.color});

  factory ClassStat.fromJson(Map<String, dynamic> json) {
    return ClassStat(
      label: (json['label'] ?? json['name'] ?? json['className'] ?? '').toString(),
      count: _toInt(json['count'] ?? json['total'] ?? json['totalStudents']) ?? 0,
      color: json['color']?.toString(),
    );
  }
}

// ── Providers ───────────────────────────────────────────────────────────

final consolidatedReportProvider = FutureProvider.autoDispose<ConsolidatedReport>((ref) async {
  final apiClient = ref.watch(apiClientProvider);
  final result = await apiClient.getRaw('/general/consolidated-report');
  return result.when(
    success: (data) => ConsolidatedReport.fromJson(data),
    failure: (_) => const ConsolidatedReport(),
    loading: () => const ConsolidatedReport(),
  );
});

final financeKpisProvider = FutureProvider.autoDispose<FinanceKpis>((ref) async {
  final apiClient = ref.watch(apiClientProvider);
  final result = await apiClient.getRaw('/finance/reports/kpi');
  return result.when(
    success: (data) => FinanceKpis.fromJson(data),
    failure: (_) => const FinanceKpis(),
    loading: () => const FinanceKpis(),
  );
});

final studentsStatsProvider = FutureProvider.autoDispose<StudentsStats>((ref) async {
  final apiClient = ref.watch(apiClientProvider);
  final result = await apiClient.getRaw('/students/statistics');
  return result.when(
    success: (data) => StudentsStats.fromJson(data),
    failure: (_) => const StudentsStats(),
    loading: () => const StudentsStats(),
  );
});

final todayRevenueProvider = FutureProvider.autoDispose<double>((ref) async {
  final apiClient = ref.watch(apiClientProvider);
  final result = await apiClient.getRaw('/finance/payments/today');
  return result.when(
    success: (data) => _toDouble(data['total'] ?? data['amount']) ?? 0,
    failure: (_) => 0,
    loading: () => 0,
  );
});

// ── Helpers ────────────────────────────────────────────────────────────

int? _toInt(dynamic value) {
  if (value == null) return null;
  if (value is int) return value;
  if (value is double) return value.toInt();
  if (value is String) return int.tryParse(value);
  return null;
}

double? _toDouble(dynamic value) {
  if (value == null) return null;
  if (value is double) return value;
  if (value is int) return value.toDouble();
  if (value is String) return double.tryParse(value);
  return null;
}

String formatFCFA(double amount) {
  final formatted = amount.toInt().toString();
  final buffer = StringBuffer();
  for (int i = 0; i < formatted.length; i++) {
    if (i > 0 && (formatted.length - i) % 3 == 0) buffer.write(' ');
    buffer.write(formatted[i]);
  }
  return '${buffer} F CFA';
}

String formatNumber(int n) {
  final buffer = StringBuffer();
  final s = n.toString();
  for (int i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 == 0) buffer.write(' ');
    buffer.write(s[i]);
  }
  return buffer.toString();
}
