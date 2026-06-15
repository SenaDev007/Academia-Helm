import 'package:flutter/material.dart';
import '../../../core/enums/module_config.dart';
import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../../../core/widgets/module_page_shell.dart';
import '../../../core/widgets/sub_tab_content.dart';

class CommunicationScreen extends StatefulWidget {
  const CommunicationScreen({super.key});

  @override
  State<CommunicationScreen> createState() => _CommunicationScreenState();
}

class _CommunicationScreenState extends State<CommunicationScreen> {
  @override
  Widget build(BuildContext context) {
    final module = allModules.firstWhere((m) => m.id == 'communication');
    final subTabs = module.subTabs;
    return StatefulModulePage(
      module: module,
      visibleSubTabs: subTabs,
      initialSubTabId: subTabs.first.id,
      subTabBuilder: (subTab) {
        switch (subTab.id) {
          case 'communication-dashboard': return _buildDashboardContent(context);
          case 'communication-inbox': return _buildInboxContent(context);
          case 'communication-sent': return _buildSentContent(context);
          case 'communication-announcements': return _buildAnnouncementsContent(context);
          case 'communication-notifications': return _buildNotificationsContent(context);
          case 'communication-newsletter': return _buildNewsletterContent(context);
          case 'communication-sms': return _buildSmsContent(context);
          case 'communication-email': return _buildEmailContent(context);
          case 'communication-push': return _buildPushContent(context);
          case 'communication-templates': return _buildTemplatesContent(context);
          case 'communication-contacts': return _buildContactsContent(context);
          case 'communication-groups': return _buildGroupsContent(context);
          case 'communication-calendar': return _buildCalendarContent(context);
          case 'communication-media': return _buildMediaContent(context);
          case 'communication-settings': return _buildSettingsContent(context);
          default: return PlaceholderContent(title: subTab.label);
        }
      },
    );
  }

  Widget _buildDashboardContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Tableau de bord Communication'),
      GridView.count(shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), crossAxisCount: 2, mainAxisSpacing: AHSpacing.sm, crossAxisSpacing: AHSpacing.sm, childAspectRatio: 1.4, children: const [
        StatCard(title: 'Messages reçus', value: '128', icon: Icons.inbox, subtitle: '12 non lus'),
        StatCard(title: 'Envoyés aujourd\'hui', value: '23', icon: Icons.send, iconColor: AHColors.success, subtitle: 'Ce jour'),
        StatCard(title: 'Annonces actives', value: '5', icon: Icons.campaign, iconColor: AHColors.gold, subtitle: 'Publiées'),
        StatCard(title: 'SMS envoyés', value: '342', icon: Icons.sms, iconColor: AHColors.info, subtitle: 'Ce mois'),
      ]),
    ]);
  }

  Widget _buildInboxContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Boîte de réception'), ...[ListItemCard(title: 'Mme Dupont - Absence enfant', subtitle: 'Reçu le 10/03/2025 à 08:32', leadingIcon: Icons.mail, badge: StatusBadge(label: 'Non lu', type: StatusBadgeType.gold)), ListItemCard(title: 'M. Martin - Demande RDV', subtitle: 'Reçu le 09/03/2025 à 16:15', leadingIcon: Icons.mail, badge: StatusBadge(label: 'Non lu', type: StatusBadgeType.gold)), ListItemCard(title: 'Inspection académique', subtitle: 'Reçu le 08/03/2025 à 10:00', leadingIcon: Icons.mail, badge: StatusBadge(label: 'Lu', type: StatusBadgeType.neutral))]]); }
  Widget _buildSentContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Messages envoyés'), ...[ListItemCard(title: 'Convocation conseil classe', subtitle: 'Envoyé à 32 parents - 09/03/2025', leadingIcon: Icons.send, badge: StatusBadge(label: 'Délivré', type: StatusBadgeType.success)), ListItemCard(title: 'Rappel paiement T2', subtitle: 'Envoyé à 42 familles - 07/03/2025', leadingIcon: Icons.send, badge: StatusBadge(label: 'Délivré', type: StatusBadgeType.success))]]); }
  Widget _buildAnnouncementsContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Annonces'), ...[ListItemCard(title: 'Portes ouvertes 2025', subtitle: 'Publiée le 01/03 - Visible tous', leadingIcon: Icons.campaign, badge: StatusBadge(label: 'Active', type: StatusBadgeType.success)), ListItemCard(title: 'Modification horaires ramadan', subtitle: 'Publiée le 28/02 - Visible tous', leadingIcon: Icons.notifications, badge: StatusBadge(label: 'Active', type: StatusBadgeType.success)), ListItemCard(title: 'Vaccination HP - 6ème', subtitle: 'Publiée le 15/02 - 6ème uniquement', leadingIcon: Icons.campaign, badge: StatusBadge(label: 'Expirée', type: StatusBadgeType.neutral))]]); }
  Widget _buildNotificationsContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Notifications'), ...[ListItemCard(title: 'Nouvelle inscription reçue', subtitle: 'Il y a 2h', leadingIcon: Icons.notifications_active, leadingIconColor: AHColors.info), ListItemCard(title: 'Rapport mensuel disponible', subtitle: 'Il y a 5h', leadingIcon: Icons.notifications_active, leadingIconColor: AHColors.info), ListItemCard(title: 'Alerte Orion IA', subtitle: 'Il y a 1j', leadingIcon: Icons.notifications_active, leadingIconColor: AHColors.warning)]]); }
  Widget _buildNewsletterContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Newsletter'), ...[ListItemCard(title: 'Newsletter mars 2025', subtitle: 'En cours de rédaction', leadingIcon: Icons.newspaper, badge: StatusBadge(label: 'Brouillon', type: StatusBadgeType.neutral)), ListItemCard(title: 'Newsletter février 2025', subtitle: 'Envoyée le 01/02/2025 - 892 destinataires', leadingIcon: Icons.newspaper, badge: StatusBadge(label: 'Envoyée', type: StatusBadgeType.success))]]); }
  Widget _buildSmsContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'SMS'), GridView.count(shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), crossAxisCount: 2, mainAxisSpacing: AHSpacing.sm, crossAxisSpacing: AHSpacing.sm, childAspectRatio: 1.4, children: const [StatCard(title: 'Envoyés ce mois', value: '342', icon: Icons.sms, iconColor: AHColors.info), StatCard(title: 'Crédit restant', value: '1 658', icon: Icons.account_balance_wallet, iconColor: AHColors.success)]), const SizedBox(height: AHSpacing.md), ...[ListItemCard(title: 'Rappel rentrée - Tous', subtitle: 'Envoyé le 01/03 - 1 247 SMS', leadingIcon: Icons.sms), ListItemCard(title: 'Absence élève - Parents', subtitle: 'Envoyé le 10/03 - 18 SMS', leadingIcon: Icons.sms)]]); }
  Widget _buildEmailContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'E-mail'), ...[ListItemCard(title: 'Courriel rentrée 2025', subtitle: 'Programmé le 15/06/2025', leadingIcon: Icons.email, badge: StatusBadge(label: 'Planifié', type: StatusBadgeType.info)), ListItemCard(title: 'Bulletins T2', subtitle: 'Envoyé le 28/02/2025 - 892 emails', leadingIcon: Icons.email, badge: StatusBadge(label: 'Envoyé', type: StatusBadgeType.success))]]); }
  Widget _buildPushContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Notifications push'), ...[ListItemCard(title: 'Campagne rentrée', subtitle: 'Envoyée le 01/09/2024 - 456 envois', leadingIcon: Icons.notifications_active, badge: StatusBadge(label: 'Terminée', type: StatusBadgeType.success)), ListItemCard(title: 'Alerte urgence', subtitle: 'Envoyée le 15/02/2025 - Tous', leadingIcon: Icons.notifications_active, badge: StatusBadge(label: 'Envoyée', type: StatusBadgeType.success))]]); }
  Widget _buildTemplatesContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Modèles'), ...[ListItemCard(title: 'Convocation parents', subtitle: 'Dernière MAJ: 01/01/2025', leadingIcon: Icons.description), ListItemCard(title: 'Certificat de scolarité', subtitle: 'Dernière MAJ: 15/09/2024', leadingIcon: Icons.description), ListItemCard(title: 'Rappel paiement', subtitle: 'Dernière MAJ: 01/02/2025', leadingIcon: Icons.description)]]); }
  Widget _buildContactsContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Contacts'), ...[ListItemCard(title: 'Parents 3ème B', subtitle: '28 contacts', leadingIcon: Icons.contacts, leadingIconColor: AHColors.navy), ListItemCard(title: 'Personnel enseignant', subtitle: '52 contacts', leadingIcon: Icons.contacts, leadingIconColor: AHColors.info), ListItemCard(title: 'Partenaires', subtitle: '15 contacts', leadingIcon: Icons.contacts, leadingIconColor: AHColors.gold)]]); }
  Widget _buildGroupsContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Groupes'), ...[ListItemCard(title: 'Conseil pédagogique', subtitle: '8 membres', leadingIcon: Icons.group, leadingIconColor: AHColors.navy), ListItemCard(title: 'Équipe direction', subtitle: '5 membres', leadingIcon: Icons.group, leadingIconColor: AHColors.gold), ListItemCard(title: 'Parents délégués', subtitle: '12 membres', leadingIcon: Icons.group, leadingIconColor: AHColors.info)]]); }
  Widget _buildCalendarContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Calendrier communication'), ...[ListItemCard(title: 'Journée portes ouvertes', subtitle: '15 mars 2025 - Communication envoyée', leadingIcon: Icons.calendar_today, badge: StatusBadge(label: 'Actif', type: StatusBadgeType.success)), ListItemCard(title: 'Fin de période T2', subtitle: '28 mars 2025 - Rappel à envoyer', leadingIcon: Icons.calendar_today, badge: StatusBadge(label: 'Planifié', type: StatusBadgeType.info))]]); }
  Widget _buildMediaContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Médias'), ...[ListItemCard(title: 'Photos événements', subtitle: '234 fichiers - 2.1 Go', leadingIcon: Icons.photo_library, leadingIconColor: AHColors.info), ListItemCard(title: 'Vidéos promotionnelles', subtitle: '8 fichiers - 1.5 Go', leadingIcon: Icons.video_library, leadingIconColor: AHColors.error), ListItemCard(title: 'Documents presse', subtitle: '45 fichiers - 120 Mo', leadingIcon: Icons.folder, leadingIconColor: AHColors.gold)]]); }
  Widget _buildSettingsContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Paramètres communication'), ...[ListItemCard(title: 'Canaux activés', subtitle: 'Email, SMS, Push, App', leadingIcon: Icons.settings), ListItemCard(title: 'Heures d\'envoi', subtitle: '08h-20h (configurable)', leadingIcon: Icons.schedule), ListItemCard(title: 'Destinataires par défaut', subtitle: 'Groupes configurés', leadingIcon: Icons.group)]]); }
}
