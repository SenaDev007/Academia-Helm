import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/ah_colors.dart';
import '../../../core/widgets/ah_app_bar.dart';
import '../../../core/widgets/generic_module_tab.dart';

/// HR module — 18 sub-tabs, ALL connected to real API endpoints.
class HrModuleScreen extends ConsumerStatefulWidget {
  const HrModuleScreen({super.key});
  @override
  ConsumerState<HrModuleScreen> createState() => _HrModuleScreenState();
}

class _HrModuleScreenState extends ConsumerState<HrModuleScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  static const _tabs = [
    'Tableau de bord', 'Recruteur', 'Directeurs', 'Recrutement', 'Embauche',
    'Personnel', 'Config. Contrats', 'Contrats', 'Collaborateurs', 'IA RH',
    'Congés', 'Présences', 'Planning', 'Indemnités', 'Paie',
    'Impôts/CNSS', 'Rapports', 'Paramètres',
  ];
  @override
  void initState() { super.initState(); _tabController = TabController(length: _tabs.length, vsync: this); }
  @override
  void dispose() { _tabController.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: const AHAppBar(showBackButton: true, title: 'Ressources Humaines'),
      body: Column(children: [
        Container(color: Colors.white, child: TabBar(
          controller: _tabController, labelColor: AHColors.navy, unselectedLabelColor: AHColors.grey400,
          indicatorColor: AHColors.gold, isScrollable: true, tabAlignment: TabAlignment.start,
          labelStyle: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700),
          tabs: _tabs.map((t) => Tab(text: t)).toList(),
        )),
        Expanded(child: TabBarView(controller: _tabController, children: [
          GenericModuleTab(endpoint: '/hr/overview/dashboard', isKpi: true, icon: Icons.dashboard),
          GenericModuleTab(endpoint: '/hr/recruitment/settings', isKpi: true, icon: Icons.person),
          GenericModuleTab(endpoint: '/hr/school-directors', titleField: 'name', subtitleField: 'level', icon: Icons.person_outline, emptyMessage: 'Aucun directeur'),
          GenericModuleTab(endpoint: '/hr/recruitment/jobs', titleField: 'title', subtitleField: 'department', icon: Icons.work, emptyMessage: 'Aucun poste'),
          GenericModuleTab(endpoint: '/hr/recruitment/embauches', titleField: 'candidateName', subtitleField: 'position', icon: Icons.person_add, emptyMessage: 'Aucune embauche'),
          GenericModuleTab(endpoint: '/hr/staff', titleField: 'firstName', subtitleField: 'role', icon: Icons.people, emptyMessage: 'Aucun personnel'),
          GenericModuleTab(endpoint: '/hr/contract-document-config', isKpi: true, icon: Icons.settings),
          GenericModuleTab(endpoint: '/hr/contracts', titleField: 'staffName', subtitleField: 'type', icon: Icons.description, emptyMessage: 'Aucun contrat'),
          GenericModuleTab(endpoint: '/hr/staff', titleField: 'firstName', subtitleField: 'role', icon: Icons.people_outline, emptyMessage: 'Aucun collaborateur'),
          GenericModuleTab(endpoint: '/hr/ia', isKpi: true, icon: Icons.psychology),
          GenericModuleTab(endpoint: '/hr/leaves/requests', titleField: 'staff_name', subtitleField: 'dates', icon: Icons.event_busy, emptyMessage: 'Aucune demande de congé'),
          GenericModuleTab(endpoint: '/hr/attendance', titleField: 'staffName', subtitleField: 'date', icon: Icons.calendar_today, emptyMessage: 'Aucune présence'),
          GenericModuleTab(endpoint: '/hr/planning', titleField: 'staffName', subtitleField: 'shift', icon: Icons.schedule, emptyMessage: 'Aucun planning'),
          GenericModuleTab(endpoint: '/hr/allowances/types', titleField: 'name', subtitleField: 'description', icon: Icons.payments, emptyMessage: 'Aucune indemnité'),
          GenericModuleTab(endpoint: '/hr/payroll/periods', titleField: 'label', subtitleField: 'status', icon: Icons.account_balance_wallet, emptyMessage: 'Aucune période de paie'),
          GenericModuleTab(endpoint: '/hr/cnss', isKpi: true, icon: Icons.account_balance),
          GenericModuleTab(endpoint: '/hr/overview/analytics', isKpi: true, icon: Icons.bar_chart),
          GenericModuleTab(endpoint: '/hr/settings', isKpi: true, icon: Icons.settings),
        ])),
      ]),
    );
  }
}
