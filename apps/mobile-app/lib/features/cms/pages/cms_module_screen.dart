import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/ah_colors.dart';
import '../../../core/widgets/ah_app_bar.dart';
import '../../../core/widgets/generic_module_tab.dart';

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
      appBar: const AHAppBar(showBackButton: true, title: 'Site Institutionnel'),
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
              labelStyle: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700),
              tabs: _tabs.map((t) => Tab(text: t)).toList(),
            ),
          ),
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: const [
                GenericModuleTab(endpoint: '/cms/dashboard', isKpi: true, icon: Icons.dashboard),
                GenericModuleTab(endpoint: '/cms/pages', titleField: 'title', subtitleField: 'slug', icon: Icons.web, emptyMessage: 'Aucune page'),
                GenericModuleTab(endpoint: '/cms/blog', titleField: 'title', subtitleField: 'publishedAt', icon: Icons.article, emptyMessage: 'Aucun article'),
                GenericModuleTab(endpoint: '/cms/articles', titleField: 'title', subtitleField: 'author', icon: Icons.article_outlined, emptyMessage: 'Aucun article'),
                GenericModuleTab(endpoint: '/cms/categories', titleField: 'name', subtitleField: 'slug', icon: Icons.category, emptyMessage: 'Aucune catégorie'),
                GenericModuleTab(endpoint: '/cms/tags', titleField: 'name', subtitleField: 'slug', icon: Icons.tag, emptyMessage: 'Aucun tag'),
                GenericModuleTab(endpoint: '/cms/reviews', titleField: 'author', subtitleField: 'rating', icon: Icons.star, emptyMessage: 'Aucun avis'),
                GenericModuleTab(endpoint: '/cms/testimonials', titleField: 'author', subtitleField: 'content', icon: Icons.format_quote, emptyMessage: 'Aucun témoignage'),
                GenericModuleTab(endpoint: '/cms/sliders', titleField: 'title', subtitleField: 'position', icon: Icons.view_carousel, emptyMessage: 'Aucun slider'),
                GenericModuleTab(endpoint: '/cms/banners', titleField: 'title', subtitleField: 'position', icon: Icons.image, emptyMessage: 'Aucune bannière'),
                GenericModuleTab(endpoint: '/cms/media', titleField: 'name', subtitleField: 'type', icon: Icons.perm_media, emptyMessage: 'Aucun média'),
                GenericModuleTab(endpoint: '/cms/images', titleField: 'name', subtitleField: 'url', icon: Icons.photo, emptyMessage: 'Aucune image'),
                GenericModuleTab(endpoint: '/cms/documents', titleField: 'name', subtitleField: 'type', icon: Icons.description, emptyMessage: 'Aucun document'),
                GenericModuleTab(endpoint: '/cms/videos', titleField: 'title', subtitleField: 'url', icon: Icons.video_library, emptyMessage: 'Aucune vidéo'),
                GenericModuleTab(endpoint: '/cms/seo', isKpi: true, icon: Icons.search),
                GenericModuleTab(endpoint: '/cms/meta', titleField: 'page', subtitleField: 'title', icon: Icons.code, emptyMessage: 'Aucune meta'),
                GenericModuleTab(endpoint: '/cms/legal-pages', titleField: 'title', subtitleField: 'slug', icon: Icons.gavel, emptyMessage: 'Aucune page légale'),
                GenericModuleTab(endpoint: '/cms/cgu', titleField: 'version', subtitleField: 'updatedAt', icon: Icons.description, emptyMessage: 'Aucune CGU'),
                GenericModuleTab(endpoint: '/cms/cgv', titleField: 'version', subtitleField: 'updatedAt', icon: Icons.description, emptyMessage: 'Aucune CGV'),
                GenericModuleTab(endpoint: '/cms/privacy', titleField: 'version', subtitleField: 'updatedAt', icon: Icons.privacy_tip, emptyMessage: 'Aucune politique'),
                GenericModuleTab(endpoint: '/cms/settings', isKpi: true, icon: Icons.settings),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
