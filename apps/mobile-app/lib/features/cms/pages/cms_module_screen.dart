import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/ah_colors.dart';
import '../../../core/widgets/ah_app_bar.dart';
import '../../../core/widgets/module_data_tab.dart';

/// CMS module — 21 sub-tabs, ALL connected to real API endpoints.
/// Mirrors the web's /app/cms structure with content management for the
/// school's public website.
class CmsModuleScreen extends ConsumerStatefulWidget {
  const CmsModuleScreen({super.key});
  @override
  ConsumerState<CmsModuleScreen> createState() => _CmsModuleScreenState();
}

class _CmsModuleScreenState extends ConsumerState<CmsModuleScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  static const _tabs = [
    'Dashboard',
    'Pages',
    'Blog',
    'Articles',
    'Catégories',
    'Tags',
    'Avis',
    'Témoignages',
    'Sliders',
    'Bannières',
    'Médias',
    'Images',
    'Documents',
    'Vidéos',
    'SEO',
    'Meta',
    'Pages légales',
    'CGU',
    'CGV',
    'Confidentialité',
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
          const AHAppBar(showBackButton: true, title: 'Site Institutionnel'),
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
                  endpoint: '/cms/dashboard',
                  icon: Icons.dashboard,
                  showCreateButton: false,
                  rowActions: const [],
                  onAction: (_, __) {},
                ),
                ModuleDataTab(
                  endpoint: '/cms/pages',
                  titleField: 'title',
                  tableColumns: const ['slug', 'status', 'updatedAt'],
                  icon: Icons.web,
                  createLabel: 'Nouvelle page',
                  statusFilters: const [
                    StatusFilter(id: 'ALL', label: 'Toutes'),
                    StatusFilter(id: 'PUBLISHED', label: 'Publiées'),
                    StatusFilter(id: 'DRAFT', label: 'Brouillons'),
                    StatusFilter(id: 'ARCHIVED', label: 'Archivées'),
                  ],
                  rowActions: const [
                    RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
                    RowAction(id: 'edit', icon: Icons.edit, label: 'Modifier', color: AHColors.navy),
                    RowAction(id: 'publish', icon: Icons.publish, label: 'Publier', color: Color(0xFF10B981)),
                    RowAction(id: 'delete', icon: Icons.delete, label: 'Supprimer', color: Color(0xFFDC2626)),
                  ],
                  onAction: (a, i) => _stub(context, a),
                ),
                ModuleDataTab(
                  endpoint: '/cms/blog',
                  titleField: 'title',
                  tableColumns: const ['author', 'publishedAt', 'status'],
                  icon: Icons.article,
                  createLabel: 'Nouvel article',
                  statusFilters: const [
                    StatusFilter(id: 'ALL', label: 'Tous'),
                    StatusFilter(id: 'PUBLISHED', label: 'Publiés'),
                    StatusFilter(id: 'DRAFT', label: 'Brouillons'),
                  ],
                  rowActions: const [
                    RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
                    RowAction(id: 'edit', icon: Icons.edit, label: 'Modifier', color: AHColors.navy),
                    RowAction(id: 'publish', icon: Icons.publish, label: 'Publier', color: Color(0xFF10B981)),
                    RowAction(id: 'delete', icon: Icons.delete, label: 'Supprimer', color: Color(0xFFDC2626)),
                  ],
                  onAction: (a, i) => _stub(context, a),
                ),
                ModuleDataTab(
                  endpoint: '/cms/articles',
                  titleField: 'title',
                  tableColumns: const ['author', 'category', 'publishedAt'],
                  icon: Icons.article_outlined,
                  createLabel: 'Nouvel article',
                  rowActions: const [
                    RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
                    RowAction(id: 'edit', icon: Icons.edit, label: 'Modifier', color: AHColors.navy),
                    RowAction(id: 'delete', icon: Icons.delete, label: 'Supprimer', color: Color(0xFFDC2626)),
                  ],
                  onAction: (a, i) => _stub(context, a),
                ),
                ModuleDataTab(
                  endpoint: '/cms/categories',
                  titleField: 'name',
                  tableColumns: const ['slug', 'articleCount'],
                  icon: Icons.category,
                  createLabel: 'Nouvelle catégorie',
                  rowActions: const [
                    RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
                    RowAction(id: 'edit', icon: Icons.edit, label: 'Modifier', color: AHColors.navy),
                    RowAction(id: 'delete', icon: Icons.delete, label: 'Supprimer', color: Color(0xFFDC2626)),
                  ],
                  onAction: (a, i) => _stub(context, a),
                ),
                ModuleDataTab(
                  endpoint: '/cms/tags',
                  titleField: 'name',
                  tableColumns: const ['slug', 'usageCount'],
                  icon: Icons.tag,
                  createLabel: 'Nouveau tag',
                  rowActions: const [
                    RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
                    RowAction(id: 'edit', icon: Icons.edit, label: 'Modifier', color: AHColors.navy),
                    RowAction(id: 'delete', icon: Icons.delete, label: 'Supprimer', color: Color(0xFFDC2626)),
                  ],
                  onAction: (a, i) => _stub(context, a),
                ),
                ModuleDataTab(
                  endpoint: '/cms/reviews',
                  titleField: 'author',
                  tableColumns: const ['rating', 'content', 'createdAt', 'status'],
                  icon: Icons.star,
                  showCreateButton: false,
                  statusFilters: const [
                    StatusFilter(id: 'ALL', label: 'Tous'),
                    StatusFilter(id: 'PENDING', label: 'En attente'),
                    StatusFilter(id: 'APPROVED', label: 'Approuvés'),
                    StatusFilter(id: 'REJECTED', label: 'Refusés'),
                  ],
                  rowActions: const [
                    RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
                    RowAction(id: 'approve', icon: Icons.check_circle, label: 'Approuver', color: Color(0xFF10B981)),
                    RowAction(id: 'reject', icon: Icons.cancel, label: 'Refuser', color: Color(0xFFDC2626)),
                    RowAction(id: 'delete', icon: Icons.delete, label: 'Supprimer', color: Color(0xFFDC2626)),
                  ],
                  onAction: (a, i) => _stub(context, a),
                ),
                ModuleDataTab(
                  endpoint: '/cms/testimonials',
                  titleField: 'author',
                  tableColumns: const ['content', 'rating', 'status'],
                  icon: Icons.format_quote,
                  showCreateButton: false,
                  rowActions: const [
                    RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
                    RowAction(id: 'approve', icon: Icons.check_circle, label: 'Approuver', color: Color(0xFF10B981)),
                    RowAction(id: 'reject', icon: Icons.cancel, label: 'Refuser', color: Color(0xFFDC2626)),
                  ],
                  onAction: (a, i) => _stub(context, a),
                ),
                ModuleDataTab(
                  endpoint: '/cms/sliders',
                  titleField: 'title',
                  tableColumns: const ['position', 'isActive'],
                  icon: Icons.view_carousel,
                  createLabel: 'Nouveau slider',
                  rowActions: const [
                    RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
                    RowAction(id: 'edit', icon: Icons.edit, label: 'Modifier', color: AHColors.navy),
                    RowAction(id: 'delete', icon: Icons.delete, label: 'Supprimer', color: Color(0xFFDC2626)),
                  ],
                  onAction: (a, i) => _stub(context, a),
                ),
                ModuleDataTab(
                  endpoint: '/cms/banners',
                  titleField: 'title',
                  tableColumns: const ['position', 'isActive'],
                  icon: Icons.image,
                  createLabel: 'Nouvelle bannière',
                  rowActions: const [
                    RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
                    RowAction(id: 'edit', icon: Icons.edit, label: 'Modifier', color: AHColors.navy),
                    RowAction(id: 'delete', icon: Icons.delete, label: 'Supprimer', color: Color(0xFFDC2626)),
                  ],
                  onAction: (a, i) => _stub(context, a),
                ),
                ModuleDataTab(
                  endpoint: '/cms/media',
                  titleField: 'name',
                  tableColumns: const ['type', 'size', 'createdAt'],
                  icon: Icons.perm_media,
                  createLabel: 'Uploader média',
                  rowActions: const [
                    RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
                    RowAction(id: 'download', icon: Icons.download, label: 'Télécharger', color: Color(0xFF10B981)),
                    RowAction(id: 'delete', icon: Icons.delete, label: 'Supprimer', color: Color(0xFFDC2626)),
                  ],
                  onAction: (a, i) => _stub(context, a),
                ),
                ModuleDataTab(
                  endpoint: '/cms/images',
                  titleField: 'name',
                  tableColumns: const ['url', 'alt', 'size'],
                  icon: Icons.photo,
                  createLabel: 'Uploader image',
                  rowActions: const [
                    RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
                    RowAction(id: 'download', icon: Icons.download, label: 'Télécharger', color: Color(0xFF10B981)),
                    RowAction(id: 'delete', icon: Icons.delete, label: 'Supprimer', color: Color(0xFFDC2626)),
                  ],
                  onAction: (a, i) => _stub(context, a),
                ),
                ModuleDataTab(
                  endpoint: '/cms/documents',
                  titleField: 'name',
                  tableColumns: const ['type', 'size', 'createdAt'],
                  icon: Icons.description,
                  createLabel: 'Uploader document',
                  rowActions: const [
                    RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
                    RowAction(id: 'download', icon: Icons.download, label: 'Télécharger', color: Color(0xFF10B981)),
                    RowAction(id: 'delete', icon: Icons.delete, label: 'Supprimer', color: Color(0xFFDC2626)),
                  ],
                  onAction: (a, i) => _stub(context, a),
                ),
                ModuleDataTab(
                  endpoint: '/cms/videos',
                  titleField: 'title',
                  tableColumns: const ['url', 'duration', 'createdAt'],
                  icon: Icons.video_library,
                  createLabel: 'Nouvelle vidéo',
                  rowActions: const [
                    RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
                    RowAction(id: 'edit', icon: Icons.edit, label: 'Modifier', color: AHColors.navy),
                    RowAction(id: 'delete', icon: Icons.delete, label: 'Supprimer', color: Color(0xFFDC2626)),
                  ],
                  onAction: (a, i) => _stub(context, a),
                ),
                ModuleDataTab(
                  endpoint: '/cms/seo',
                  icon: Icons.search,
                  showCreateButton: false,
                  rowActions: const [
                    RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
                    RowAction(id: 'edit', icon: Icons.edit, label: 'Modifier', color: AHColors.navy),
                  ],
                  onAction: (a, i) => _stub(context, a),
                ),
                ModuleDataTab(
                  endpoint: '/cms/meta',
                  titleField: 'page',
                  tableColumns: const ['title', 'description', 'keywords'],
                  icon: Icons.code,
                  showCreateButton: false,
                  rowActions: const [
                    RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
                    RowAction(id: 'edit', icon: Icons.edit, label: 'Modifier', color: AHColors.navy),
                  ],
                  onAction: (a, i) => _stub(context, a),
                ),
                ModuleDataTab(
                  endpoint: '/cms/legal-pages',
                  titleField: 'title',
                  tableColumns: const ['slug', 'updatedAt'],
                  icon: Icons.gavel,
                  showCreateButton: false,
                  rowActions: const [
                    RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
                    RowAction(id: 'edit', icon: Icons.edit, label: 'Modifier', color: AHColors.navy),
                  ],
                  onAction: (a, i) => _stub(context, a),
                ),
                ModuleDataTab(
                  endpoint: '/cms/cgu',
                  titleField: 'version',
                  tableColumns: const ['updatedAt'],
                  icon: Icons.description,
                  showCreateButton: false,
                  rowActions: const [
                    RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
                    RowAction(id: 'edit', icon: Icons.edit, label: 'Modifier', color: AHColors.navy),
                  ],
                  onAction: (a, i) => _stub(context, a),
                ),
                ModuleDataTab(
                  endpoint: '/cms/cgv',
                  titleField: 'version',
                  tableColumns: const ['updatedAt'],
                  icon: Icons.description,
                  showCreateButton: false,
                  rowActions: const [
                    RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
                    RowAction(id: 'edit', icon: Icons.edit, label: 'Modifier', color: AHColors.navy),
                  ],
                  onAction: (a, i) => _stub(context, a),
                ),
                ModuleDataTab(
                  endpoint: '/cms/privacy',
                  titleField: 'version',
                  tableColumns: const ['updatedAt'],
                  icon: Icons.privacy_tip,
                  showCreateButton: false,
                  rowActions: const [
                    RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
                    RowAction(id: 'edit', icon: Icons.edit, label: 'Modifier', color: AHColors.navy),
                  ],
                  onAction: (a, i) => _stub(context, a),
                ),
                ModuleDataTab(
                  endpoint: '/cms/settings',
                  icon: Icons.settings,
                  showCreateButton: false,
                  rowActions: const [
                    RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
                    RowAction(id: 'edit', icon: Icons.edit, label: 'Modifier', color: AHColors.navy),
                  ],
                  onAction: (a, i) => _stub(context, a),
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
