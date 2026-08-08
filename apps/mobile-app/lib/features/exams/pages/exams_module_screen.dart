import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/ah_colors.dart';
import '../../../core/widgets/ah_app_bar.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_config.dart';
import '../../../core/network/api_result.dart';

/// Examens module — 11 sub-tabs matching web exams/sub-modules.ts
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
      appBar: const AHAppBar(),
      body: Column(children: [
        Container(color: Colors.white, child: TabBar(
          controller: _tabController, labelColor: AHColors.navy, unselectedLabelColor: AHColors.grey400,
          indicatorColor: AHColors.gold, isScrollable: true, tabAlignment: TabAlignment.start,
          labelStyle: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700),
          tabs: _tabs.map((t) => Tab(text: t)).toList(),
        )),
        Expanded(child: TabBarView(controller: _tabController, children: [
          _ExamsDashboard(), ...List.generate(10, (_) => _Placeholder('En cours')),
        ])),
      ]),
    );
  }
}

class _ExamsDashboard extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
      Icon(Icons.assignment, size: 48, color: AHColors.grey300),
      const SizedBox(height: 8),
      const Text('Tableau de bord Examens', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AHColors.grey600)),
      const Text('Données depuis /institutional-exams/*', style: TextStyle(fontSize: 11, color: AHColors.grey400)),
    ]));
  }
}

class _Placeholder extends StatelessWidget {
  const _Placeholder(this.label);
  final String label;
  @override
  Widget build(BuildContext context) {
    return Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
      Icon(Icons.construction, size: 48, color: AHColors.grey300),
      const SizedBox(height: 8),
      Text(label, style: TextStyle(fontSize: 14, color: AHColors.grey500)),
    ]));
  }
}
