import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/ah_colors.dart';
import '../../../core/widgets/ah_app_bar.dart';

/// Communication module — 15 sub-tabs matching web communication/layout.tsx
class CommunicationModuleScreen extends ConsumerStatefulWidget {
  const CommunicationModuleScreen({super.key});
  @override
  ConsumerState<CommunicationModuleScreen> createState() => _CommunicationModuleScreenState();
}

class _CommunicationModuleScreenState extends ConsumerState<CommunicationModuleScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  static const _tabs = [
    'Pilotage', 'Boîte de réception', 'Messagerie', 'Annonces', 'Automatisations',
    'Campagnes', 'Templates', 'Parents', 'Enseignants', 'Élèves',
    'Administration', 'Canaux', 'Historique', 'Rapports', 'Paramètres',
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
          children: List.generate(15, (_) => _Placeholder()))),
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
