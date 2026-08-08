import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/ah_colors.dart';
import '../../../core/widgets/ah_app_bar.dart';
import '../../../core/widgets/generic_module_tab.dart';

/// Communication module — 15 sub-tabs, ALL connected to real API endpoints.
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
        Expanded(child: TabBarView(controller: _tabController, children: [
          GenericModuleTab(endpoint: '/communication/dashboard', isKpi: true, icon: Icons.dashboard),
          GenericModuleTab(endpoint: '/communication/messages', params: {'folder': 'inbox'}, titleField: 'subject', subtitleField: 'sender', icon: Icons.inbox, emptyMessage: 'Aucun message'),
          GenericModuleTab(endpoint: '/communication/messages', titleField: 'subject', subtitleField: 'sender', icon: Icons.message, emptyMessage: 'Aucun message'),
          GenericModuleTab(endpoint: '/communication/v2/announcements', titleField: 'title', subtitleField: 'body', icon: Icons.campaign, emptyMessage: 'Aucune annonce'),
          GenericModuleTab(endpoint: '/communication/automated-notifications', titleField: 'name', subtitleField: 'trigger', icon: Icons.bolt, emptyMessage: 'Aucune automatisation'),
          GenericModuleTab(endpoint: '/communication/campaigns', titleField: 'name', subtitleField: 'status', icon: Icons.send, emptyMessage: 'Aucune campagne'),
          GenericModuleTab(endpoint: '/communication/templates', titleField: 'name', subtitleField: 'type', icon: Icons.description, emptyMessage: 'Aucun template'),
          GenericModuleTab(endpoint: '/communication/audience/parents', titleField: 'name', subtitleField: 'phone', icon: Icons.people, emptyMessage: 'Aucun parent'),
          GenericModuleTab(endpoint: '/communication/audience/teachers', titleField: 'name', subtitleField: 'email', icon: Icons.school, emptyMessage: 'Aucun enseignant'),
          GenericModuleTab(endpoint: '/communication/audience/students', titleField: 'firstName', subtitleField: 'className', icon: Icons.menu_book, emptyMessage: 'Aucun élève'),
          GenericModuleTab(endpoint: '/communication/audience/administration', titleField: 'name', subtitleField: 'role', icon: Icons.business, emptyMessage: 'Aucun administrateur'),
          GenericModuleTab(endpoint: '/communication/channels', titleField: 'name', subtitleField: 'type', icon: Icons.radio, emptyMessage: 'Aucun canal'),
          GenericModuleTab(endpoint: '/communication/history', titleField: 'subject', subtitleField: 'sentAt', icon: Icons.history, emptyMessage: 'Aucun historique'),
          GenericModuleTab(endpoint: '/communication/reports', isKpi: true, icon: Icons.bar_chart),
          GenericModuleTab(endpoint: '/communication/settings', isKpi: true, icon: Icons.settings),
        ])),
      ]),
    );
  }
}
