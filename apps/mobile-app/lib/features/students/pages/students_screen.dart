import 'package:flutter/material.dart';
import '../../../core/enums/module_config.dart';
import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../../../core/widgets/module_page_shell.dart';
import '../../../core/widgets/sub_tab_content.dart';

class StudentsScreen extends StatefulWidget {
  const StudentsScreen({super.key});

  @override
  State<StudentsScreen> createState() => _StudentsScreenState();
}

class _StudentsScreenState extends State<StudentsScreen> {
  @override
  Widget build(BuildContext context) {
    final module = allModules.firstWhere((m) => m.id == 'students');
    final subTabs = module.subTabs;
    return StatefulModulePage(
      module: module,
      visibleSubTabs: subTabs,
      initialSubTabId: subTabs.first.id,
      subTabBuilder: (subTab) {
        switch (subTab.id) {
          case 'students-dashboard':
            return _buildDashboardContent(context);
          case 'students-list':
            return _buildListContent(context);
          case 'students-enrollments':
            return _buildEnrollmentsContent(context);
          case 'students-attendance':
            return _buildAttendanceContent(context);
          case 'students-grades':
            return _buildGradesContent(context);
          case 'students-discipline':
            return _buildDisciplineContent(context);
          case 'students-health':
            return _buildHealthContent(context);
          case 'students-transports':
            return _buildTransportsContent(context);
          case 'students-canteen':
            return _buildCanteenContent(context);
          case 'students-documents':
            return _buildDocumentsContent(context);
          case 'students-communications':
            return _buildCommunicationsContent(context);
          case 'students-scholarships':
            return _buildScholarshipsContent(context);
          case 'students-activities':
            return _buildActivitiesContent(context);
          case 'students-alumni':
            return _buildAlumniContent(context);
          case 'students-reports':
            return _buildReportsContent(context);
          case 'students-archive':
            return _buildArchiveContent(context);
          default:
            return PlaceholderContent(title: subTab.label);
        }
      },
    );
  }

  Widget _buildDashboardContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Tableau de bord Élèves'),
      GridView.count(shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), crossAxisCount: 2, mainAxisSpacing: AHSpacing.sm, crossAxisSpacing: AHSpacing.sm, childAspectRatio: 1.4, children: const [
        StatCard(title: 'Élèves inscrits', value: '1 247', icon: Icons.school, subtitle: '+32 cette année'),
        StatCard(title: 'Nouveaux inscrits', value: '89', icon: Icons.person_add, iconColor: AHColors.success, subtitle: 'Rentrée 2025'),
        StatCard(title: 'Taux de présence', value: '94.2%', icon: Icons.event_available, iconColor: AHColors.info, subtitle: 'Ce trimestre'),
        StatCard(title: 'Moyenne générale', value: '12.8', icon: Icons.grade, iconColor: AHColors.gold, subtitle: '/20'),
      ]),
    ]);
  }

  Widget _buildListContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Liste des élèves'),
      ...[
        ListItemCard(title: 'Dupont Marie', subtitle: '3ème B - Née le 15/03/2010', leadingIcon: Icons.person, badge: StatusBadge(label: 'Actif', type: StatusBadgeType.success)),
        ListItemCard(title: 'Martin Lucas', subtitle: '2nde A - Né le 22/07/2009', leadingIcon: Icons.person, badge: StatusBadge(label: 'Actif', type: StatusBadgeType.success)),
        ListItemCard(title: 'Ben Ahmed Youssef', subtitle: '1ère S - Né le 08/11/2008', leadingIcon: Icons.person, badge: StatusBadge(label: 'Actif', type: StatusBadgeType.success)),
        ListItemCard(title: 'Petit Sophie', subtitle: '6ème C - Née le 03/05/2013', leadingIcon: Icons.person, badge: StatusBadge(label: 'Inactif', type: StatusBadgeType.neutral)),
      ],
    ]);
  }

  Widget _buildEnrollmentsContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Inscriptions'),
      ...[
        ListItemCard(title: 'Kone Aminata', subtitle: 'Demande: 4ème - Reçue le 02/03/2025', leadingIcon: Icons.person_add, badge: StatusBadge(label: 'En attente', type: StatusBadgeType.warning)),
        ListItemCard(title: 'Moreau Thomas', subtitle: 'Demande: 5ème - Reçue le 28/02/2025', leadingIcon: Icons.person_add, badge: StatusBadge(label: 'Validée', type: StatusBadgeType.success)),
        ListItemCard(title: 'Diop Fatou', subtitle: 'Demande: 3ème - Reçue le 25/02/2025', leadingIcon: Icons.person_add, badge: StatusBadge(label: 'Dossier incomplet', type: StatusBadgeType.error)),
      ],
    ]);
  }

  Widget _buildAttendanceContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Présence'),
      GridView.count(shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), crossAxisCount: 2, mainAxisSpacing: AHSpacing.sm, crossAxisSpacing: AHSpacing.sm, childAspectRatio: 1.4, children: const [
        StatCard(title: 'Taux présence', value: '94.2%', icon: Icons.check_circle, iconColor: AHColors.success),
        StatCard(title: 'Absences aujourd\'hui', value: '18', icon: Icons.person_off, iconColor: AHColors.error),
        StatCard(title: 'Retards', value: '7', icon: Icons.schedule, iconColor: AHColors.warning),
        StatCard(title: 'Justifiées', value: '12', icon: Icons.verified, iconColor: AHColors.info),
      ]),
    ]);
  }

  Widget _buildGradesContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Notes des élèves'), ...[ListItemCard(title: 'Trimestre 2 - Résultats', subtitle: 'Moyenne générale: 12.8/20', leadingIcon: Icons.assessment, badge: StatusBadge(label: 'Publié', type: StatusBadgeType.success)), ListItemCard(title: 'Trimestre 1 - Résultats', subtitle: 'Moyenne générale: 12.3/20', leadingIcon: Icons.assessment, badge: StatusBadge(label: 'Archivé', type: StatusBadgeType.neutral))]]); }
  Widget _buildDisciplineContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Discipline'), ...[ListItemCard(title: 'Avertissement - Martin L.', subtitle: 'Comportement en cours - 10/03/2025', leadingIcon: Icons.warning, leadingIconColor: AHColors.warning), ListItemCard(title: 'Blâme - Ben A. Y.', subtitle: 'Retards répétés - 05/03/2025', leadingIcon: Icons.gavel, leadingIconColor: AHColors.error), ListItemCard(title: 'Félicitation - Dupont M.', subtitle: 'Excellence scolaire - 01/03/2025', leadingIcon: Icons.star, leadingIconColor: AHColors.gold)]]); }
  Widget _buildHealthContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Santé'), ...[ListItemCard(title: 'Allergies déclarées', subtitle: '23 élèves concernés', leadingIcon: Icons.health_and_safety, leadingIconColor: AHColors.error), ListItemCard(title: 'Vaccinations à jour', subtitle: '89% de conformité', leadingIcon: Icons.vaccines, leadingIconColor: AHColors.success), ListItemCard(title: 'Visites infirmerie', subtitle: '45 ce mois', leadingIcon: Icons.local_hospital, leadingIconColor: AHColors.info)]]); }
  Widget _buildTransportsContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Transports'), ...[ListItemCard(title: 'Élèves transportés', subtitle: '312 élèves - 8 circuits', leadingIcon: Icons.bus, leadingIconColor: AHColors.info), ListItemCard(title: 'Circuit Nord', subtitle: '42 élèves - Bus #3', leadingIcon: Icons.alt_route, leadingIconColor: AHColors.navy), ListItemCard(title: 'Circuit Sud', subtitle: '38 élèves - Bus #5', leadingIcon: Icons.alt_route, leadingIconColor: AHColors.navy)]]); }
  Widget _buildCanteenContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Cantine'), ...[ListItemCard(title: 'Inscrits cantine', subtitle: '567 élèves', leadingIcon: Icons.restaurant, leadingIconColor: AHColors.info), ListItemCard(title: 'Menu du jour', subtitle: 'Poulet rôti, légumes, fruit', leadingIcon: Icons.lunch_dining, leadingIconColor: AHColors.gold), ListItemCard(title: 'Réservations demain', subtitle: '423 repas commandés', leadingIcon: Icons.bookmark, leadingIconColor: AHColors.success)]]); }
  Widget _buildDocumentsContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Documents élèves'), ...[ListItemCard(title: 'Certificat de scolarité', subtitle: 'Modèle disponible', leadingIcon: Icons.description), ListItemCard(title: 'Attestation d\'inscription', subtitle: 'Modèle disponible', leadingIcon: Icons.badge), ListItemCard(title: 'Dossier de bourse', subtitle: 'Formulaire en ligne', leadingIcon: Icons.folder)]]); }
  Widget _buildCommunicationsContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Communications'), ...[ListItemCard(title: 'Message aux parents 3ème', subtitle: 'Envoyé le 10/03/2025', leadingIcon: Icons.mail, badge: StatusBadge(label: 'Envoyé', type: StatusBadgeType.success)), ListItemCard(title: 'Avis rentrée septembre', subtitle: 'Programmé le 15/06/2025', leadingIcon: Icons.campaign, badge: StatusBadge(label: 'Planifié', type: StatusBadgeType.info))]]); }
  Widget _buildScholarshipsContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Bourses'), ...[ListItemCard(title: 'Bourses mérite', subtitle: '15 élèves bénéficiaires', leadingIcon: Icons.emoji_events, leadingIconColor: AHColors.gold), ListItemCard(title: 'Bourses sociales', subtitle: '42 dossiers en cours', leadingIcon: Icons.volunteer_activism, leadingIconColor: AHColors.info), ListItemCard(title: 'Aides exceptionnelles', subtitle: '3 demandes en attente', leadingIcon: Icons.handshake, leadingIconColor: AHColors.success)]]); }
  Widget _buildActivitiesContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Activités'), ...[ListItemCard(title: 'Club informatique', subtitle: '28 membres - Mercredi 14h', leadingIcon: Icons.computer, leadingIconColor: AHColors.info), ListItemCard(title: 'Chorale', subtitle: '35 membres - Vendredi 16h', leadingIcon: Icons.music_note, leadingIconColor: AHColors.gold), ListItemCard(title: 'Sport scolaire', subtitle: '92 inscrits - 4 disciplines', leadingIcon: Icons.sports_soccer, leadingIconColor: AHColors.success)]]); }
  Widget _buildAlumniContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Anciens élèves'), ...[ListItemCard(title: 'Promotion 2024', subtitle: '87 diplômés', leadingIcon: Icons.school, leadingIconColor: AHColors.navy), ListItemCard(title: 'Promotion 2023', subtitle: '92 diplômés', leadingIcon: Icons.school, leadingIconColor: AHColors.navy), ListItemCard(title: 'Réunion anciens', subtitle: 'Prévue le 20/06/2025', leadingIcon: Icons.event_available, leadingIconColor: AHColors.gold)]]); }
  Widget _buildReportsContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Rapports élèves'), ...[ListItemCard(title: 'Rapport annuel 2024-2025', subtitle: 'En cours de rédaction', leadingIcon: Icons.assessment, badge: StatusBadge(label: 'En cours', type: StatusBadgeType.info)), ListItemCard(title: 'Statistiques inscriptions', subtitle: 'Mis à jour le 01/03/2025', leadingIcon: Icons.bar_chart, badge: StatusBadge(label: 'Disponible', type: StatusBadgeType.success))]]); }
  Widget _buildArchiveContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Archive élèves'), ...[ListItemCard(title: 'Année 2023-2024', subtitle: '1 198 dossiers archivés', leadingIcon: Icons.archive, leadingIconColor: AHColors.muted), ListItemCard(title: 'Année 2022-2023', subtitle: '1 156 dossiers archivés', leadingIcon: Icons.archive, leadingIconColor: AHColors.muted), ListItemCard(title: 'Année 2021-2022', subtitle: '1 089 dossiers archivés', leadingIcon: Icons.archive, leadingIconColor: AHColors.muted)]]); }
}
