import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/ah_colors.dart';
import '../../../core/widgets/ah_app_bar.dart';

/// Pedagogy module — 11 sub-tabs matching web pedagogy-tabs.tsx
class PedagogyModuleScreen extends ConsumerStatefulWidget {
  const PedagogyModuleScreen({super.key});
  @override
  ConsumerState<PedagogyModuleScreen> createState() => _PedagogyModuleScreenState();
}

class _PedagogyModuleScreenState extends ConsumerState<PedagogyModuleScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  static const _tabs = [
    'Dashboard', 'Structure académique', 'Matières', 'Enseignants', 'Emploi du temps',
    'Espace Pédagogie', 'Validation Direction', 'ORION', 'Travaux & Suivi',
    'Sarah Compose', 'Cahiers de textes',
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
        Expanded(child: TabBarView(controller: _tabController,
          children: List.generate(11, (_) => _Placeholder()))),
      ]),
    );
  }
}

class _Placeholder extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
      Icon(Icons.construction, size: 48, color: AHColors.grey300),
      const SizedBox(height: 8),
      Text('En cours d\'implémentation', style: TextStyle(fontSize: 14, color: AHColors.grey500)),
    ]));
  }
}
