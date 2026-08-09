import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/ah_colors.dart';
import '../../../core/widgets/ah_app_bar.dart';
import '../../../core/widgets/generic_module_tab.dart';

/// Exams module — 11 sub-tabs, ALL connected to real API endpoints.
class ExamsModuleScreen extends ConsumerStatefulWidget {
  const ExamsModuleScreen({super.key});
  @override
  ConsumerState<ExamsModuleScreen> createState() => _ExamsModuleScreenState();
}

class _ExamsModuleScreenState extends ConsumerState<ExamsModuleScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  static const _tabs = [
    'Tableau de bord', 'Évaluations', 'Saisie des notes', 'Validation',
    'Déverrouillage', 'Registre', 'Bulletins', 'Conseils',
    'Statistiques', 'Audit', 'Paramètres',
  ];
  @override
  void initState() { super.initState(); _tabController = TabController(length: _tabs.length, vsync: this); }
  @override
  void dispose() { _tabController.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: const AHAppBar(showBackButton: true, title: 'Examens & Notes'),
      body: Column(children: [
        Container(color: Colors.white, child: TabBar(
          controller: _tabController, labelColor: AHColors.navy, unselectedLabelColor: AHColors.grey400,
          indicatorColor: AHColors.gold, isScrollable: true, tabAlignment: TabAlignment.start,
          labelStyle: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700),
          tabs: _tabs.map((t) => Tab(text: t)).toList(),
        )),
        Expanded(child: TabBarView(controller: _tabController, children: [
          GenericModuleTab(endpoint: '/institutional-exams/dashboard/kpi', isKpi: true, icon: Icons.dashboard),
          GenericModuleTab(endpoint: '/institutional-exams/evaluations', titleField: 'title', subtitleField: 'className', icon: Icons.assignment, emptyMessage: 'Aucune évaluation'),
          GenericModuleTab(endpoint: '/institutional-exams/evaluations', params: {'status': 'OPEN_FOR_GRADING'}, titleField: 'title', subtitleField: 'className', icon: Icons.edit_note, emptyMessage: 'Aucune évaluation ouverte'),
          GenericModuleTab(endpoint: '/institutional-exams/evaluations', params: {'status': 'SUBMITTED'}, titleField: 'title', subtitleField: 'className', icon: Icons.check_circle, emptyMessage: 'Aucune évaluation à valider'),
          GenericModuleTab(endpoint: '/institutional-exams/unlock-requests', titleField: 'evaluationTypeName', subtitleField: 'className', icon: Icons.lock_open, emptyMessage: 'Aucune demande de déverrouillage'),
          GenericModuleTab(endpoint: '/institutional-exams/evaluations', params: {'status': 'VALIDATED'}, titleField: 'title', subtitleField: 'className', icon: Icons.assignment_turned_in, emptyMessage: 'Aucun registre'),
          GenericModuleTab(endpoint: '/institutional-exams/bulletins', titleField: 'studentName', subtitleField: 'className', icon: Icons.description, emptyMessage: 'Aucun bulletin'),
          GenericModuleTab(endpoint: '/institutional-exams/councils', titleField: 'className', subtitleField: 'periodName', icon: Icons.groups, emptyMessage: 'Aucun conseil de classe'),
          GenericModuleTab(endpoint: '/institutional-exams/dashboard/kpi', isKpi: true, icon: Icons.bar_chart),
          GenericModuleTab(endpoint: '/institutional-exams/audit/logs', titleField: 'action', subtitleField: 'user', icon: Icons.history, emptyMessage: 'Aucun log d\'audit'),
          GenericModuleTab(endpoint: '/institutional-exams/config', isKpi: true, icon: Icons.settings),
        ])),
      ]),
    );
  }
}
