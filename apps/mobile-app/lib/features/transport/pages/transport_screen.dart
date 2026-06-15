import 'package:flutter/material.dart';
import '../../../core/enums/module_config.dart';
import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../../../core/widgets/module_page_shell.dart';
import '../../../core/widgets/sub_tab_content.dart';

class TransportScreen extends StatefulWidget {
  const TransportScreen({super.key});

  @override
  State<TransportScreen> createState() => _TransportScreenState();
}

class _TransportScreenState extends State<TransportScreen> {
  @override
  Widget build(BuildContext context) {
    final module = allModules.firstWhere((m) => m.id == 'transport');
    final subTabs = module.subTabs;
    return StatefulModulePage(
      module: module,
      visibleSubTabs: subTabs,
      initialSubTabId: subTabs.first.id,
      subTabBuilder: (subTab) {
        switch (subTab.id) {
          case 'transport-dashboard': return _buildDashboardContent(context);
          case 'transport-routes': return _buildRoutesContent(context);
          case 'transport-vehicles': return _buildVehiclesContent(context);
          case 'transport-drivers': return _buildDriversContent(context);
          case 'transport-students': return _buildStudentsContent(context);
          case 'transport-tracking': return _buildTrackingContent(context);
          case 'transport-maintenance': return _buildMaintenanceContent(context);
          case 'transport-insurance': return _buildInsuranceContent(context);
          case 'transport-fuel': return _buildFuelContent(context);
          case 'transport-incidents': return _buildIncidentsContent(context);
          case 'transport-contracts': return _buildContractsContent(context);
          case 'transport-payments': return _buildPaymentsContent(context);
          case 'transport-reports': return _buildReportsContent(context);
          case 'transport-settings': return _buildSettingsContent(context);
          default: return PlaceholderContent(title: subTab.label);
        }
      },
    );
  }

  Widget _buildDashboardContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Tableau de bord Transport'),
      GridView.count(shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), crossAxisCount: 2, mainAxisSpacing: AHSpacing.sm, crossAxisSpacing: AHSpacing.sm, childAspectRatio: 1.4, children: const [
        StatCard(title: 'Élèves transportés', value: '312', icon: Icons.bus, subtitle: '8 circuits'),
        StatCard(title: 'Véhicules', value: '8', icon: Icons.directions_bus, iconColor: AHColors.info, subtitle: 'Tous opérationnels'),
        StatCard(title: 'Chauffeurs', value: '8', icon: Icons.person, iconColor: AHColors.success, subtitle: 'Permis valides'),
        StatCard(title: 'Incidents', value: '0', icon: Icons.check_circle, iconColor: AHColors.success, subtitle: 'Ce mois'),
      ]),
    ]);
  }

  Widget _buildRoutesContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Trajets'), ...[ListItemCard(title: 'Circuit Nord', subtitle: '42 élèves - 8 arrêts - 35 min', leadingIcon: Icons.alt_route, badge: StatusBadge(label: 'Actif', type: StatusBadgeType.success)), ListItemCard(title: 'Circuit Sud', subtitle: '38 élèves - 6 arrêts - 28 min', leadingIcon: Icons.alt_route, badge: StatusBadge(label: 'Actif', type: StatusBadgeType.success)), ListItemCard(title: 'Circuit Est', subtitle: '45 élèves - 10 arrêts - 42 min', leadingIcon: Icons.alt_route, badge: StatusBadge(label: 'Actif', type: StatusBadgeType.success)), ListItemCard(title: 'Circuit Centre', subtitle: '35 élèves - 5 arrêts - 22 min', leadingIcon: Icons.alt_route, badge: StatusBadge(label: 'Actif', type: StatusBadgeType.success))]]); }
  Widget _buildVehiclesContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Véhicules'), ...[ListItemCard(title: 'Bus #1 - Renault Travego', subtitle: '52 places - CT validé 12/2024', leadingIcon: Icons.directions_bus, badge: StatusBadge(label: 'OK', type: StatusBadgeType.success)), ListItemCard(title: 'Bus #3 - Mercedes Tourismo', subtitle: '48 places - CT validé 01/2025', leadingIcon: Icons.directions_bus, badge: StatusBadge(label: 'OK', type: StatusBadgeType.success)), ListItemCard(title: 'Minibus #7 - Iveco Daily', subtitle: '22 places - CT expire 04/2025', leadingIcon: Icons.directions_bus, badge: StatusBadge(label: 'Attention', type: StatusBadgeType.warning))]]); }
  Widget _buildDriversContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Chauffeurs'), ...[ListItemCard(title: 'Ahmed K.', subtitle: 'Bus #1 - Permis D valide jusqu\'au 06/2026', leadingIcon: Icons.person, badge: StatusBadge(label: 'Actif', type: StatusBadgeType.success)), ListItemCard(title: 'Sow M.', subtitle: 'Bus #3 - Permis D valide jusqu\'au 12/2025', leadingIcon: Icons.person, badge: StatusBadge(label: 'Actif', type: StatusBadgeType.success))]]); }
  Widget _buildStudentsContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Élèves transportés'), ...[ListItemCard(title: 'Dupont Marie', subtitle: 'Circuit Nord - Arrêt: Place Victor Hugo', leadingIcon: Icons.person, badge: StatusBadge(label: 'Inscrit', type: StatusBadgeType.success)), ListItemCard(title: 'Ben Ahmed Youssef', subtitle: 'Circuit Est - Arrêt: Rue des Écoles', leadingIcon: Icons.person, badge: StatusBadge(label: 'Inscrit', type: StatusBadgeType.success))]]); }
  Widget _buildTrackingContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Suivi en temps réel'), ...[ListItemCard(title: 'Bus #1 - Circuit Nord', subtitle: 'En route - Arrêt 5/8 - 08:42', leadingIcon: Icons.gps_fixed, badge: StatusBadge(label: 'En ligne', type: StatusBadgeType.success)), ListItemCard(title: 'Bus #3 - Circuit Sud', subtitle: 'En route - Arrêt 3/6 - 08:38', leadingIcon: Icons.gps_fixed, badge: StatusBadge(label: 'En ligne', type: StatusBadgeType.success))]]); }
  Widget _buildMaintenanceContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Maintenance'), ...[ListItemCard(title: 'Bus #5 - Révision 60 000 km', subtitle: 'Programmée le 20/03/2025', leadingIcon: Icons.build, badge: StatusBadge(label: 'Planifié', type: StatusBadgeType.info)), ListItemCard(title: 'Minibus #7 - Freins', subtitle: 'Terminée le 05/03/2025', leadingIcon: Icons.build, badge: StatusBadge(label: 'Terminé', type: StatusBadgeType.success))]]); }
  Widget _buildInsuranceContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Assurance'), ...[ListItemCard(title: 'Police flotte 2024-2025', subtitle: 'AXA - N°POL-2024-789', leadingIcon: Icons.shield, badge: StatusBadge(label: 'Active', type: StatusBadgeType.success)), ListItemCard(title: 'Renouvellement', subtitle: 'Échéance le 01/09/2025', leadingIcon: Icons.event, badge: StatusBadge(label: 'À venir', type: StatusBadgeType.warning))]]); }
  Widget _buildFuelContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Carburant'), ...[ListItemCard(title: 'Consommation février', subtitle: '2 340 L - Budget: 3 200 €', leadingIcon: Icons.local_gas_station, leadingIconColor: AHColors.error), ListItemCard(title: 'Consommation janvier', subtitle: '2 180 L - Budget: 2 950 €', leadingIcon: Icons.local_gas_station, leadingIconColor: AHColors.warning)]]); }
  Widget _buildIncidentsContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Incidents'), ...[ListItemCard(title: 'Aucun incident ce mois', subtitle: 'Dernier incident: 15/02/2025', leadingIcon: Icons.check_circle, leadingIconColor: AHColors.success, badge: StatusBadge(label: 'Aucun', type: StatusBadgeType.success))]]); }
  Widget _buildContractsContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Contrats'), ...[ListItemCard(title: 'Contrat transport 2024-2025', subtitle: 'Société TransEdu - 8 véhicules', leadingIcon: Icons.description, badge: StatusBadge(label: 'Actif', type: StatusBadgeType.success)), ListItemCard(title: 'Avenant #2', subtitle: 'Ajout circuit Centre - Signé le 01/02', leadingIcon: Icons.description, badge: StatusBadge(label: 'Signé', type: StatusBadgeType.success))]]); }
  Widget _buildPaymentsContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Paiements transport'), ...[ListItemCard(title: 'Facture mars 2025', subtitle: 'TransEdu - 8 500 €', leadingIcon: Icons.payment, badge: StatusBadge(label: 'En attente', type: StatusBadgeType.warning)), ListItemCard(title: 'Facture février 2025', subtitle: 'TransEdu - 8 200 € - Payée', leadingIcon: Icons.payment, badge: StatusBadge(label: 'Payée', type: StatusBadgeType.success))]]); }
  Widget _buildReportsContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Rapports'), ...[ListItemCard(title: 'Rapport mensuel mars', subtitle: 'Ponctualité: 96%, Satisfaction: 89%', leadingIcon: Icons.assessment, badge: StatusBadge(label: 'Nouveau', type: StatusBadgeType.gold))]]); }
  Widget _buildSettingsContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Paramètres transport'), ...[ListItemCard(title: 'Horaires de départ', subtitle: '07h15 premier départ', leadingIcon: Icons.schedule), ListItemCard(title: 'Zones desservies', subtitle: '4 zones configurées', leadingIcon: Icons.map), ListItemCard(title: 'Notifications parents', subtitle: 'Activées - GPS temps réel', leadingIcon: Icons.notifications_active)]]); }
}
