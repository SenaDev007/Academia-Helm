import 'package:flutter/material.dart';
import '../../../core/enums/module_config.dart';
import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../../../core/widgets/module_page_shell.dart';
import '../../../core/widgets/sub_tab_content.dart';

class EducastScreen extends StatefulWidget {
  const EducastScreen({super.key});

  @override
  State<EducastScreen> createState() => _EducastScreenState();
}

class _EducastScreenState extends State<EducastScreen> {
  @override
  Widget build(BuildContext context) {
    final module = allModules.firstWhere((m) => m.id == 'educast');
    final subTabs = module.subTabs;
    return StatefulModulePage(
      module: module,
      visibleSubTabs: subTabs,
      initialSubTabId: subTabs.first.id,
      subTabBuilder: (subTab) {
        switch (subTab.id) {
          case 'educast-dashboard':
            return _buildDashboardContent(context);
          case 'educast-channels':
            return _buildChannelsContent(context);
          case 'educast-courses':
            return _buildCoursesContent(context);
          case 'educast-videos':
            return _buildVideosContent(context);
          case 'educast-podcasts':
            return _buildPodcastsContent(context);
          case 'educast-live':
            return _buildLiveContent(context);
          case 'educast-playlists':
            return _buildPlaylistsContent(context);
          case 'educast-categories':
            return _buildCategoriesContent(context);
          case 'educast-analytics':
            return _buildAnalyticsContent(context);
          case 'educast-comments':
            return _buildCommentsContent(context);
          case 'educast-ratings':
            return _buildRatingsContent(context);
          case 'educast-bookmarks':
            return _buildBookmarksContent(context);
          case 'educast-history':
            return _buildHistoryContent(context);
          case 'educast-downloads':
            return _buildDownloadsContent(context);
          case 'educast-subscriptions':
            return _buildSubscriptionsContent(context);
          case 'educast-reports':
            return _buildReportsContent(context);
          case 'educast-settings':
            return _buildSettingsContent(context);
          default:
            return PlaceholderContent(title: subTab.label);
        }
      },
    );
  }

  Widget _buildDashboardContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Tableau de bord EduCast'),
      GridView.count(shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), crossAxisCount: 2, mainAxisSpacing: AHSpacing.sm, crossAxisSpacing: AHSpacing.sm, childAspectRatio: 1.4, children: const [
        StatCard(title: 'Vues ce mois', value: '12.4K', icon: Icons.play_circle, subtitle: '+18% vs mois dernier'),
        StatCard(title: 'Chaînes actives', value: '8', icon: Icons.tv, iconColor: AHColors.info),
        StatCard(title: 'Contenus publiés', value: '156', icon: Icons.video_library, iconColor: AHColors.success),
        StatCard(title: 'Abonnés total', value: '2 340', icon: Icons.subscriptions, iconColor: AHColors.gold, subtitle: '+89 ce mois'),
      ]),
    ]);
  }

  Widget _buildChannelsContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Chaînes'),
      ...[
        ListItemCard(title: 'Chaîne Sciences', subtitle: '42 vidéos - 890 abonnés', leadingIcon: Icons.tv, badge: StatusBadge(label: 'Active', type: StatusBadgeType.success)),
        ListItemCard(title: 'Chaîne Mathématiques', subtitle: '38 vidéos - 756 abonnés', leadingIcon: Icons.tv, badge: StatusBadge(label: 'Active', type: StatusBadgeType.success)),
        ListItemCard(title: 'Chaîne Langues', subtitle: '25 vidéos - 423 abonnés', leadingIcon: Icons.tv, badge: StatusBadge(label: 'Active', type: StatusBadgeType.success)),
        ListItemCard(title: 'Chaîne Orientation', subtitle: '12 vidéos - 271 abonnés', leadingIcon: Icons.tv, badge: StatusBadge(label: 'Active', type: StatusBadgeType.success)),
      ],
    ]);
  }

  Widget _buildCoursesContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Cours'),
      ...[
        ListItemCard(title: 'Physique-Chimie 3ème', subtitle: '18 épisodes - M. Robert', leadingIcon: Icons.book, badge: StatusBadge(label: 'En cours', type: StatusBadgeType.info)),
        ListItemCard(title: 'Mathématiques 2nde', subtitle: '24 épisodes - Mme. Bernard', leadingIcon: Icons.book, badge: StatusBadge(label: 'Complet', type: StatusBadgeType.success)),
        ListItemCard(title: 'Anglais 1ère', subtitle: '15 épisodes - M. Smith', leadingIcon: Icons.book, badge: StatusBadge(label: 'En cours', type: StatusBadgeType.info)),
        ListItemCard(title: 'SVT 4ème', subtitle: '10 épisodes - Mme. Dupuis', leadingIcon: Icons.book, badge: StatusBadge(label: 'Planifié', type: StatusBadgeType.neutral)),
      ],
    ]);
  }

  Widget _buildVideosContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Vidéos'),
      ...[
        ListItemCard(title: 'Les lois de Newton', subtitle: '15 min - 342 vues - 10/03/2025', leadingIcon: Icons.play_circle_fill, leadingIconColor: AHColors.error),
        ListItemCard(title: 'Les équations du second degré', subtitle: '22 min - 218 vues - 08/03/2025', leadingIcon: Icons.play_circle_fill, leadingIconColor: AHColors.error),
        ListItemCard(title: 'Conversation en anglais - Travel', subtitle: '18 min - 156 vues - 05/03/2025', leadingIcon: Icons.play_circle_fill, leadingIconColor: AHColors.error),
      ],
    ]);
  }

  Widget _buildPodcastsContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Podcasts'),
      ...[
        ListItemCard(title: 'Comment réviser efficacement', subtitle: '28 min - 567 écoutes', leadingIcon: Icons.podcast, leadingIconColor: AHColors.navy),
        ListItemCard(title: 'L\'orientation après le bac', subtitle: '35 min - 423 écoutes', leadingIcon: Icons.podcast, leadingIconColor: AHColors.navy),
        ListItemCard(title: 'Stress aux examens: conseils', subtitle: '22 min - 389 écoutes', leadingIcon: Icons.podcast, leadingIconColor: AHColors.navy),
      ],
    ]);
  }

  Widget _buildLiveContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'En direct'),
      ...[
        ListItemCard(title: 'Cours live - Physique 3ème', subtitle: 'En cours - 23 spectateurs', leadingIcon: Icons.radio_button_checked, leadingIconColor: AHColors.error, badge: StatusBadge(label: 'EN DIRECT', type: StatusBadgeType.error)),
        ListItemCard(title: 'Conférence orientation', subtitle: 'Planifié: 15/03/2025 14h00', leadingIcon: Icons.radio_button_checked, leadingIconColor: AHColors.info, badge: StatusBadge(label: 'Planifié', type: StatusBadgeType.info)),
        ListItemCard(title: 'Questions/réponses maths', subtitle: 'Planifié: 18/03/2025 16h00', leadingIcon: Icons.radio_button_checked, leadingIconColor: AHColors.info, badge: StatusBadge(label: 'Planifié', type: StatusBadgeType.info)),
      ],
    ]);
  }

  Widget _buildPlaylistsContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Playlists'),
      ...[
        ListItemCard(title: 'Révision Bac Physique', subtitle: '12 vidéos - 3h45 total', leadingIcon: Icons.playlist_play, leadingIconColor: AHColors.navy),
        ListItemCard(title: 'Anglais niveau intermédiaire', subtitle: '8 vidéos - 2h20 total', leadingIcon: Icons.playlist_play, leadingIconColor: AHColors.navy),
        ListItemCard(title: 'Maths - Rappel 2nde', subtitle: '15 vidéos - 4h10 total', leadingIcon: Icons.playlist_play, leadingIconColor: AHColors.navy),
      ],
    ]);
  }

  Widget _buildCategoriesContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Catégories'),
      ...[
        ListItemCard(title: 'Sciences', subtitle: '42 contenus', leadingIcon: Icons.category, leadingIconColor: AHColors.info),
        ListItemCard(title: 'Mathématiques', subtitle: '38 contenus', leadingIcon: Icons.category, leadingIconColor: AHColors.navy),
        ListItemCard(title: 'Langues vivantes', subtitle: '25 contenus', leadingIcon: Icons.category, leadingIconColor: AHColors.success),
        ListItemCard(title: 'Orientation', subtitle: '12 contenus', leadingIcon: Icons.category, leadingIconColor: AHColors.gold),
      ],
    ]);
  }

  Widget _buildAnalyticsContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Analytique EduCast'),
      GridView.count(shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), crossAxisCount: 2, mainAxisSpacing: AHSpacing.sm, crossAxisSpacing: AHSpacing.sm, childAspectRatio: 1.4, children: const [
        StatCard(title: 'Vues totales', value: '12.4K', icon: Icons.visibility, subtitle: 'Ce mois'),
        StatCard(title: 'Taux d\'engagement', value: '34%', icon: Icons.thumb_up, iconColor: AHColors.success),
        StatCard(title: 'Durée moyenne', value: '14 min', icon: Icons.timer, iconColor: AHColors.info),
        StatCard(title: 'Taux complétion', value: '67%', icon: Icons.check_circle, iconColor: AHColors.gold),
      ]),
    ]);
  }

  Widget _buildCommentsContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Commentaires'),
      ...[
        ListItemCard(title: 'Les lois de Newton', subtitle: '8 commentaires - Dernier: 10/03/2025', leadingIcon: Icons.chat_bubble, leadingIconColor: AHColors.info, badge: StatusBadge(label: 'Nouveau', type: StatusBadgeType.info)),
        ListItemCard(title: 'Équations second degré', subtitle: '5 commentaires - Dernier: 09/03/2025', leadingIcon: Icons.chat_bubble, leadingIconColor: AHColors.info),
        ListItemCard(title: 'Conversation Travel', subtitle: '3 commentaires - Dernier: 08/03/2025', leadingIcon: Icons.chat_bubble, leadingIconColor: AHColors.info),
      ],
    ]);
  }

  Widget _buildRatingsContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Évaluations'),
      ...[
        ListItemCard(title: 'Cours Physique 3ème', subtitle: '4.6/5 - 89 évaluations', leadingIcon: Icons.star, leadingIconColor: AHColors.gold, badge: StatusBadge(label: 'Excellent', type: StatusBadgeType.success)),
        ListItemCard(title: 'Cours Maths 2nde', subtitle: '4.3/5 - 67 évaluations', leadingIcon: Icons.star, leadingIconColor: AHColors.gold, badge: StatusBadge(label: 'Très bon', type: StatusBadgeType.success)),
        ListItemCard(title: 'Podcast Orientation', subtitle: '3.8/5 - 45 évaluations', leadingIcon: Icons.star, leadingIconColor: AHColors.gold, badge: StatusBadge(label: 'Bien', type: StatusBadgeType.warning)),
      ],
    ]);
  }

  Widget _buildBookmarksContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Favoris'),
      ...[
        ListItemCard(title: 'Les lois de Newton', subtitle: 'Ajouté le 10/03/2025', leadingIcon: Icons.bookmark, leadingIconColor: AHColors.gold),
        ListItemCard(title: 'Révision Bac - Playlist', subtitle: 'Ajouté le 08/03/2025', leadingIcon: Icons.bookmark, leadingIconColor: AHColors.gold),
        ListItemCard(title: 'Podcast - Réviser efficacement', subtitle: 'Ajouté le 05/03/2025', leadingIcon: Icons.bookmark, leadingIconColor: AHColors.gold),
      ],
    ]);
  }

  Widget _buildHistoryContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Historique'),
      ...[
        ListItemCard(title: 'Les lois de Newton', subtitle: 'Vu le 10/03/2025 - 15 min', leadingIcon: Icons.history, leadingIconColor: AHColors.muted),
        ListItemCard(title: 'Équations second degré', subtitle: 'Vu le 09/03/2025 - 22 min', leadingIcon: Icons.history, leadingIconColor: AHColors.muted),
        ListItemCard(title: 'Conversation Travel', subtitle: 'Vu le 08/03/2025 - 18 min', leadingIcon: Icons.history, leadingIconColor: AHColors.muted),
        ListItemCard(title: 'Podcast Orientation', subtitle: 'Vu le 07/03/2025 - 35 min', leadingIcon: Icons.history, leadingIconColor: AHColors.muted),
      ],
    ]);
  }

  Widget _buildDownloadsContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Téléchargements'),
      ...[
        ListItemCard(title: 'Les lois de Newton', subtitle: '156 téléchargements - 1.2 GB', leadingIcon: Icons.download, leadingIconColor: AHColors.info),
        ListItemCard(title: 'Équations second degré', subtitle: '98 téléchargements - 0.8 GB', leadingIcon: Icons.download, leadingIconColor: AHColors.info),
        ListItemCard(title: 'Podcast Révision', subtitle: '234 téléchargements - 0.3 GB', leadingIcon: Icons.download, leadingIconColor: AHColors.info),
      ],
    ]);
  }

  Widget _buildSubscriptionsContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Abonnements'),
      ...[
        ListItemCard(title: 'Plan Essentiel', subtitle: 'Gratuit - Accès limité', leadingIcon: Icons.card_membership, badge: StatusBadge(label: 'Actif', type: StatusBadgeType.success)),
        ListItemCard(title: 'Plan Premium', subtitle: '9,99 €/mois - Accès complet', leadingIcon: Icons.card_membership, leadingIconColor: AHColors.gold, badge: StatusBadge(label: 'Populaire', type: StatusBadgeType.gold)),
        ListItemCard(title: 'Plan Établissement', subtitle: 'Sur devis - Multi-utilisateurs', leadingIcon: Icons.card_membership, leadingIconColor: AHColors.navy, badge: StatusBadge(label: 'Sur mesure', type: StatusBadgeType.info)),
      ],
    ]);
  }

  Widget _buildReportsContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Rapports EduCast'),
      ...[
        ListItemCard(title: 'Rapport d\'audience - Mars 2025', subtitle: '12.4K vues, 8 chaînes, 156 contenus', leadingIcon: Icons.assessment, badge: StatusBadge(label: 'En cours', type: StatusBadgeType.info)),
        ListItemCard(title: 'Bilan engagement Q1', subtitle: '34% taux engagement, +5% vs Q4', leadingIcon: Icons.summarize, badge: StatusBadge(label: 'Disponible', type: StatusBadgeType.success)),
        ListItemCard(title: 'Rapport qualité contenu', subtitle: 'Note moyenne: 4.3/5', leadingIcon: Icons.high_quality, badge: StatusBadge(label: 'Disponible', type: StatusBadgeType.success)),
      ],
    ]);
  }

  Widget _buildSettingsContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Paramètres EduCast'),
      ...[
        ListItemCard(title: 'Qualité vidéo par défaut', subtitle: 'Auto (HD si disponible)', leadingIcon: Icons.settings, leadingIconColor: AHColors.navy),
        ListItemCard(title: 'Téléchargement automatique', subtitle: 'Désactivé', leadingIcon: Icons.download, leadingIconColor: AHColors.muted),
        ListItemCard(title: 'Notifications direct', subtitle: 'Activées - Chaînes suivies', leadingIcon: Icons.notifications, leadingIconColor: AHColors.info),
        ListItemCard(title: 'Contrôle parental', subtitle: 'Activé - Filtrage par âge', leadingIcon: Icons.family_restroom, leadingIconColor: AHColors.success),
      ],
    ]);
  }
}
