import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/ah_colors.dart';
import '../../../core/widgets/ah_app_bar.dart';
import '../../../core/widgets/generic_module_tab.dart';

/// Pedagogy module — 11 sub-tabs, ALL connected to real API endpoints.
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
      appBar: const AHAppBar(showBackButton: true, title: 'Pédagogie'),
      body: Column(children: [
        Container(color: Colors.white, child: TabBar(
          controller: _tabController, labelColor: AHColors.navy, unselectedLabelColor: AHColors.grey400,
          indicatorColor: AHColors.gold, isScrollable: true, tabAlignment: TabAlignment.start,
          labelStyle: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700),
          tabs: _tabs.map((t) => Tab(text: t)).toList(),
        )),
        Expanded(child: TabBarView(controller: _tabController, children: [
          GenericModuleTab(endpoint: '/pedagogy/dashboard', isKpi: true, icon: Icons.dashboard),
          GenericModuleTab(endpoint: '/settings/classes', titleField: 'name', subtitleField: 'level', icon: Icons.grid_view, emptyMessage: 'Aucune classe'),
          GenericModuleTab(endpoint: '/pedagogy/subjects', titleField: 'name', subtitleField: 'code', icon: Icons.book, emptyMessage: 'Aucune matière'),
          GenericModuleTab(endpoint: '/pedagogy/teachers', titleField: 'name', subtitleField: 'subject', icon: Icons.school, emptyMessage: 'Aucun enseignant'),
          GenericModuleTab(endpoint: '/pedagogy/timetables', titleField: 'className', subtitleField: 'day', icon: Icons.calendar_today, emptyMessage: 'Aucun emploi du temps'),
          GenericModuleTab(endpoint: '/pedagogy-space/my-classes', titleField: 'className', subtitleField: 'schoolLevelName', icon: Icons.class_, emptyMessage: 'Aucune classe assignée'),
          GenericModuleTab(endpoint: '/pedagogy/control', titleField: 'className', subtitleField: 'status', icon: Icons.check_box, emptyMessage: 'Aucune validation en attente'),
          GenericModuleTab(endpoint: '/pedagogy/orion-dashboard', isKpi: true, icon: Icons.auto_awesome),
          GenericModuleTab(endpoint: '/pedagogy-space/homeworks', titleField: 'title', subtitleField: 'className', icon: Icons.assignment, emptyMessage: 'Aucun devoir'),
          GenericModuleTab(endpoint: '/pedagogy/sara-compose', isKpi: true, icon: Icons.auto_awesome),
          GenericModuleTab(endpoint: '/pedagogy/class-diaries', titleField: 'className', subtitleField: 'week', icon: Icons.menu_book, emptyMessage: 'Aucun cahier de texte'),
        ])),
      ]),
    );
  }
}
