import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/ah_colors.dart';
import '../../../core/widgets/ah_app_bar.dart';
import '../../../core/widgets/module_data_tab.dart';

/// Communication module — 15 sub-tabs, ALL connected to real API endpoints.
class CommunicationModuleScreen extends ConsumerStatefulWidget {
  const CommunicationModuleScreen({super.key});
  @override
  ConsumerState<CommunicationModuleScreen> createState() =>
      _CommunicationModuleScreenState();
}

class _CommunicationModuleScreenState
    extends ConsumerState<CommunicationModuleScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  static const _tabs = [
    'Tableau de bord',
    'Messages',
    'Annonces',
    'Emails',
    'SMS',
    'WhatsApp',
    'Campagnes',
    'Templates',
    'Audience',
    'Élèves',
    'Parents',
    'Enseignants',
    'Staff',
    'Groupes',
    'Paramètres',
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: _tabs.length, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar:
          const AHAppBar(showBackButton: true, title: 'Communication'),
      body: Column(
        children: [
          Container(
            color: Colors.white,
            child: TabBar(
              controller: _tabController,
              labelColor: AHColors.navy,
              unselectedLabelColor: AHColors.grey400,
              indicatorColor: AHColors.gold,
              isScrollable: true,
              tabAlignment: TabAlignment.start,
              labelStyle:
                  const TextStyle(fontSize: 11, fontWeight: FontWeight.w700),
              tabs: _tabs.map((t) => Tab(text: t)).toList(),
            ),
          ),
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                ModuleDataTab(
                  endpoint: '/communication/dashboard',
                  icon: Icons.dashboard,
                  showCreateButton: false,
                  rowActions: const [],
                  onAction: (_, __) {},
                ),
                ModuleDataTab(
                  endpoint: '/communication/messages',
                  titleField: 'subject',
                  tableColumns: const ['recipient', 'channel', 'createdAt', 'status'],
                  icon: Icons.mail,
                  createLabel: 'Nouveau message',
                  statusFilters: const [
                    StatusFilter(id: 'ALL', label: 'Tous'),
                    StatusFilter(id: 'SENT', label: 'Envoyés'),
                    StatusFilter(id: 'DELIVERED', label: 'Livrés'),
                    StatusFilter(id: 'READ', label: 'Lus'),
                    StatusFilter(id: 'FAILED', label: 'Échecs'),
                  ],
                  rowActions: const [
                    RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
                    RowAction(id: 'resend', icon: Icons.refresh, label: 'Renvoyer', color: Color(0xFFD97706)),
                    RowAction(id: 'delete', icon: Icons.delete, label: 'Supprimer', color: Color(0xFFDC2626)),
                  ],
                            ),
                ModuleDataTab(
                  endpoint: '/communication/announcements',
                  titleField: 'title',
                  tableColumns: const ['audience', 'publishedAt', 'status'],
                  icon: Icons.campaign,
                  createLabel: 'Nouvelle annonce',
                  statusFilters: const [
                    StatusFilter(id: 'ALL', label: 'Toutes'),
                    StatusFilter(id: 'DRAFT', label: 'Brouillons'),
                    StatusFilter(id: 'PUBLISHED', label: 'Publiées'),
                    StatusFilter(id: 'ARCHIVED', label: 'Archivées'),
                  ],
                  rowActions: const [
                    RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
                    RowAction(id: 'edit', icon: Icons.edit, label: 'Modifier', color: AHColors.navy),
                    RowAction(id: 'publish', icon: Icons.send, label: 'Publier', color: Color(0xFF10B981)),
                    RowAction(id: 'archive', icon: Icons.archive, label: 'Archiver', color: Color(0xFF64748B)),
                    RowAction(id: 'delete', icon: Icons.delete, label: 'Supprimer', color: Color(0xFFDC2626)),
                  ],
                            ),
                ModuleDataTab(
                  endpoint: '/communication/emails',
                  titleField: 'subject',
                  tableColumns: const ['recipient', 'sentAt', 'openedAt', 'status'],
                  icon: Icons.email,
                  createLabel: 'Nouvel email',
                  rowActions: const [
                    RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
                    RowAction(id: 'resend', icon: Icons.refresh, label: 'Renvoyer', color: Color(0xFFD97706)),
                  ],
                            ),
                ModuleDataTab(
                  endpoint: '/communication/sms',
                  titleField: 'recipient',
                  tableColumns: const ['message', 'sentAt', 'status'],
                  icon: Icons.sms,
                  createLabel: 'Nouveau SMS',
                  rowActions: const [
                    RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
                    RowAction(id: 'resend', icon: Icons.refresh, label: 'Renvoyer', color: Color(0xFFD97706)),
                  ],
                            ),
                ModuleDataTab(
                  endpoint: '/communication/whatsapp',
                  titleField: 'recipient',
                  tableColumns: const ['message', 'sentAt', 'status'],
                  icon: Icons.chat,
                  createLabel: 'Nouveau WhatsApp',
                  rowActions: const [
                    RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
                    RowAction(id: 'resend', icon: Icons.refresh, label: 'Renvoyer', color: Color(0xFF10B981)),
                  ],
                            ),
                ModuleDataTab(
                  endpoint: '/communication/campaigns',
                  titleField: 'name',
                  tableColumns: const ['channel', 'audienceSize', 'sentAt', 'status'],
                  icon: Icons.campaign_outlined,
                  createLabel: 'Nouvelle campagne',
                  statusFilters: const [
                    StatusFilter(id: 'ALL', label: 'Toutes'),
                    StatusFilter(id: 'DRAFT', label: 'Brouillons'),
                    StatusFilter(id: 'SCHEDULED', label: 'Planifiées'),
                    StatusFilter(id: 'IN_PROGRESS', label: 'En cours'),
                    StatusFilter(id: 'COMPLETED', label: 'Terminées'),
                  ],
                  rowActions: const [
                    RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
                    RowAction(id: 'edit', icon: Icons.edit, label: 'Modifier', color: AHColors.navy),
                    RowAction(id: 'launch', icon: Icons.play_arrow, label: 'Lancer', color: Color(0xFF10B981)),
                    RowAction(id: 'duplicate', icon: Icons.copy, label: 'Dupliquer', color: Color(0xFF6366F1)),
                    RowAction(id: 'delete', icon: Icons.delete, label: 'Supprimer', color: Color(0xFFDC2626)),
                  ],
                            ),
                ModuleDataTab(
                  endpoint: '/communication/templates',
                  titleField: 'name',
                  tableColumns: const ['channel', 'category', 'lastUsed'],
                  icon: Icons.article,
                  createLabel: 'Nouveau template',
                  rowActions: const [
                    RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
                    RowAction(id: 'edit', icon: Icons.edit, label: 'Modifier', color: AHColors.navy),
                    RowAction(id: 'duplicate', icon: Icons.copy, label: 'Dupliquer', color: Color(0xFF6366F1)),
                    RowAction(id: 'delete', icon: Icons.delete, label: 'Supprimer', color: Color(0xFFDC2626)),
                  ],
                            ),
                ModuleDataTab(
                  endpoint: '/communication/audience',
                  titleField: 'name',
                  tableColumns: const ['type', 'count'],
                  icon: Icons.group,
                  showCreateButton: false,
                  rowActions: const [
                    RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
                    RowAction(id: 'export', icon: Icons.download, label: 'Exporter', color: Color(0xFF10B981)),
                  ],
                            ),
                ModuleDataTab(
                  endpoint: '/communication/audience/students',
                  titleField: 'firstName',
                  tableColumns: const ['lastName', 'className', 'phone', 'email'],
                  icon: Icons.school,
                  showCreateButton: false,
                  rowActions: const [
                    RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
                    RowAction(id: 'message', icon: Icons.message, label: 'Message', color: Color(0xFF06B6D4)),
                  ],
                            ),
                ModuleDataTab(
                  endpoint: '/communication/audience/parents',
                  titleField: 'lastName',
                  tableColumns: const ['firstName', 'phone', 'email', 'childName'],
                  icon: Icons.family_restroom,
                  showCreateButton: false,
                  rowActions: const [
                    RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
                    RowAction(id: 'message', icon: Icons.message, label: 'Message', color: Color(0xFF06B6D4)),
                  ],
                            ),
                ModuleDataTab(
                  endpoint: '/communication/audience/teachers',
                  titleField: 'firstName',
                  tableColumns: const ['lastName', 'subject', 'phone', 'email'],
                  icon: Icons.person,
                  showCreateButton: false,
                  rowActions: const [
                    RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
                    RowAction(id: 'message', icon: Icons.message, label: 'Message', color: Color(0xFF06B6D4)),
                  ],
                            ),
                ModuleDataTab(
                  endpoint: '/communication/audience/staff',
                  titleField: 'firstName',
                  tableColumns: const ['lastName', 'role', 'phone', 'email'],
                  icon: Icons.people,
                  showCreateButton: false,
                  rowActions: const [
                    RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
                    RowAction(id: 'message', icon: Icons.message, label: 'Message', color: Color(0xFF06B6D4)),
                  ],
                            ),
                ModuleDataTab(
                  endpoint: '/communication/groups',
                  titleField: 'name',
                  tableColumns: const ['memberCount', 'type', 'createdAt'],
                  icon: Icons.groups,
                  createLabel: 'Nouveau groupe',
                  rowActions: const [
                    RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
                    RowAction(id: 'edit', icon: Icons.edit, label: 'Modifier', color: AHColors.navy),
                    RowAction(id: 'message', icon: Icons.message, label: 'Message', color: Color(0xFF06B6D4)),
                    RowAction(id: 'delete', icon: Icons.delete, label: 'Supprimer', color: Color(0xFFDC2626)),
                  ],
                            ),
                ModuleDataTab(
                  endpoint: '/communication/settings',
                  icon: Icons.settings,
                  showCreateButton: false,
                  rowActions: const [
                    RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
                    RowAction(id: 'edit', icon: Icons.edit, label: 'Modifier', color: AHColors.navy),
                  ],
                            ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _stub(BuildContext context, String actionId) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Action "$actionId" — en cours d\'implémentation'),
        duration: const Duration(seconds: 2),
      ),
    );
  }
}
