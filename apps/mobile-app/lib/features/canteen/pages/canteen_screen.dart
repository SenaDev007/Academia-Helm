import 'package:flutter/material.dart';
import '../../../core/enums/module_config.dart';
import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../../../core/widgets/module_page_shell.dart';
import '../../../core/widgets/sub_tab_content.dart';

class CanteenScreen extends StatefulWidget {
  const CanteenScreen({super.key});

  @override
  State<CanteenScreen> createState() => _CanteenScreenState();
}

class _CanteenScreenState extends State<CanteenScreen> {
  @override
  Widget build(BuildContext context) {
    final module = allModules.firstWhere((m) => m.id == 'canteen');
    final subTabs = module.subTabs;
    return StatefulModulePage(
      module: module,
      visibleSubTabs: subTabs,
      initialSubTabId: subTabs.first.id,
      subTabBuilder: (subTab) {
        switch (subTab.id) {
          case 'canteen-dashboard':
            return _buildDashboardContent(context);
          case 'canteen-menus':
            return _buildMenusContent(context);
          case 'canteen-meals':
            return _buildMealsContent(context);
          case 'canteen-reservations':
            return _buildReservationsContent(context);
          case 'canteen-payments':
            return _buildPaymentsContent(context);
          case 'canteen-stock':
            return _buildStockContent(context);
          case 'canteen-suppliers':
            return _buildSuppliersContent(context);
          case 'canteen-allergens':
            return _buildAllergensContent(context);
          case 'canteen-statistics':
            return _buildStatisticsContent(context);
          case 'canteen-reports':
            return _buildReportsContent(context);
          case 'canteen-feedback':
            return _buildFeedbackContent(context);
          case 'canteen-settings':
            return _buildSettingsContent(context);
          default:
            return PlaceholderContent(title: subTab.label);
        }
      },
    );
  }

  Widget _buildDashboardContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Tableau de bord Cantine'),
      GridView.count(shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), crossAxisCount: 2, mainAxisSpacing: AHSpacing.sm, crossAxisSpacing: AHSpacing.sm, childAspectRatio: 1.4, children: const [
        StatCard(title: 'Repas servis aujourd\'hui', value: '423', icon: Icons.restaurant, subtitle: '+12 vs hier'),
        StatCard(title: 'Réservations demain', value: '387', icon: Icons.bookmark, iconColor: AHColors.info, subtitle: 'En cours'),
        StatCard(title: 'Taux de satisfaction', value: '87%', icon: Icons.sentiment_satisfied, iconColor: AHColors.success, subtitle: 'Ce mois'),
        StatCard(title: 'Stock alertes', value: '3', icon: Icons.warning, iconColor: AHColors.warning, subtitle: 'Produits bas'),
      ]),
    ]);
  }

  Widget _buildMenusContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Menus'),
      ...[
        ListItemCard(title: 'Menu du jour - Lundi', subtitle: 'Poulet rôti, purée, haricots verts, fruit', leadingIcon: Icons.today, badge: StatusBadge(label: 'Actif', type: StatusBadgeType.success)),
        ListItemCard(title: 'Menu du jour - Mardi', subtitle: 'Poisson grillé, riz, courgettes, yaourt', leadingIcon: Icons.today, badge: StatusBadge(label: 'Planifié', type: StatusBadgeType.info)),
        ListItemCard(title: 'Menu végétarien', subtitle: 'Gratin de légumes, salade, fromage', leadingIcon: Icons.eco, leadingIconColor: AHColors.success),
        ListItemCard(title: 'Menu semaine prochaine', subtitle: 'En cours de préparation', leadingIcon: Icons.event, badge: StatusBadge(label: 'Brouillon', type: StatusBadgeType.neutral)),
      ],
    ]);
  }

  Widget _buildMealsContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Repas'),
      ...[
        ListItemCard(title: 'Poulet rôti', subtitle: 'Plat principal - 350 kcal/portion', leadingIcon: Icons.lunch_dining, leadingIconColor: AHColors.gold),
        ListItemCard(title: 'Poisson grillé', subtitle: 'Plat principal - 280 kcal/portion', leadingIcon: Icons.set_meal, leadingIconColor: AHColors.info),
        ListItemCard(title: 'Gratin de légumes', subtitle: 'Plat végétarien - 220 kcal/portion', leadingIcon: Icons.grass, leadingIconColor: AHColors.success),
        ListItemCard(title: 'Salade composée', subtitle: 'Entrée - 120 kcal/portion', leadingIcon: Icons.spa, leadingIconColor: AHColors.success),
      ],
    ]);
  }

  Widget _buildReservationsContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Réservations'),
      GridView.count(shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), crossAxisCount: 2, mainAxisSpacing: AHSpacing.sm, crossAxisSpacing: AHSpacing.sm, childAspectRatio: 1.4, children: const [
        StatCard(title: 'Réservations aujourd\'hui', value: '423', icon: Icons.bookmark, subtitle: 'Sur 567 inscrits'),
        StatCard(title: 'Réservations demain', value: '387', icon: Icons.event_available, iconColor: AHColors.info),
        StatCard(title: 'Annulations', value: '15', icon: Icons.cancel, iconColor: AHColors.error, subtitle: 'Aujourd\'hui'),
        StatCard(title: 'Taux de présence', value: '92%', icon: Icons.check_circle, iconColor: AHColors.success, subtitle: 'Ce mois'),
      ]),
    ]);
  }

  Widget _buildPaymentsContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Paiements Cantine'),
      ...[
        ListItemCard(title: 'Facture mars 2025', subtitle: '4 230,00 € - 567 élèves', leadingIcon: Icons.receipt, badge: StatusBadge(label: 'En cours', type: StatusBadgeType.warning)),
        ListItemCard(title: 'Facture février 2025', subtitle: '3 980,00 € - 543 élèves', leadingIcon: Icons.receipt, badge: StatusBadge(label: 'Payée', type: StatusBadgeType.success)),
        ListItemCard(title: 'Facture janvier 2025', subtitle: '4 100,00 € - 558 élèves', leadingIcon: Icons.receipt, badge: StatusBadge(label: 'Payée', type: StatusBadgeType.success)),
      ],
    ]);
  }

  Widget _buildStockContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Stock'),
      ...[
        ListItemCard(title: 'Poulet congelé', subtitle: '45 kg restants - Seuil: 20 kg', leadingIcon: Icons.inventory_2, badge: StatusBadge(label: 'OK', type: StatusBadgeType.success)),
        ListItemCard(title: 'Légumes frais', subtitle: '12 kg restants - Seuil: 15 kg', leadingIcon: Icons.inventory_2, leadingIconColor: AHColors.warning, badge: StatusBadge(label: 'Bas', type: StatusBadgeType.warning)),
        ListItemCard(title: 'Huile de cuisson', subtitle: '3 L restants - Seuil: 5 L', leadingIcon: Icons.inventory_2, leadingIconColor: AHColors.error, badge: StatusBadge(label: 'Critique', type: StatusBadgeType.error)),
        ListItemCard(title: 'Riz basmati', subtitle: '80 kg restants - Seuil: 25 kg', leadingIcon: Icons.inventory_2, badge: StatusBadge(label: 'OK', type: StatusBadgeType.success)),
      ],
    ]);
  }

  Widget _buildSuppliersContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Fournisseurs'),
      ...[
        ListItemCard(title: 'Boucherie Dupont', subtitle: 'Viandes - Livraison mardi/vendredi', leadingIcon: Icons.local_shipping, badge: StatusBadge(label: 'Actif', type: StatusBadgeType.success)),
        ListItemCard(title: 'Primeur Martin', subtitle: 'Fruits & Légumes - Livraison quotidienne', leadingIcon: Icons.local_shipping, badge: StatusBadge(label: 'Actif', type: StatusBadgeType.success)),
        ListItemCard(title: 'Épicerie Générale SA', subtitle: 'Épicerie - Livraison lundi', leadingIcon: Icons.local_shipping, badge: StatusBadge(label: 'Actif', type: StatusBadgeType.success)),
      ],
    ]);
  }

  Widget _buildAllergensContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Allergènes'),
      ...[
        ListItemCard(title: 'Gluten', subtitle: '18 élèves concernés - Présent dans 12 plats', leadingIcon: Icons.warning_amber, leadingIconColor: AHColors.warning),
        ListItemCard(title: 'Arachides', subtitle: '7 élèves concernés - Présent dans 3 plats', leadingIcon: Icons.warning_amber, leadingIconColor: AHColors.error),
        ListItemCard(title: 'Lactose', subtitle: '14 élèves concernés - Présent dans 8 plats', leadingIcon: Icons.warning_amber, leadingIconColor: AHColors.warning),
        ListItemCard(title: 'Œufs', subtitle: '5 élèves concernés - Présent dans 6 plats', leadingIcon: Icons.warning_amber, leadingIconColor: AHColors.info),
      ],
    ]);
  }

  Widget _buildStatisticsContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Statistiques'),
      GridView.count(shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), crossAxisCount: 2, mainAxisSpacing: AHSpacing.sm, crossAxisSpacing: AHSpacing.sm, childAspectRatio: 1.4, children: const [
        StatCard(title: 'Repas/mois', value: '8 450', icon: Icons.restaurant_menu, subtitle: 'Moyenne'),
        StatCard(title: 'Coût/repas', value: '3,20 €', icon: Icons.euro, iconColor: AHColors.gold),
        StatCard(title: 'Gaspillage', value: '6.2%', icon: Icons.delete_outline, iconColor: AHColors.error, subtitle: '-1.3% vs mois dernier'),
        StatCard(title: 'Fréquentation', value: '92%', icon: Icons.groups, iconColor: AHColors.success),
      ]),
    ]);
  }

  Widget _buildReportsContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Rapports Cantine'),
      ...[
        ListItemCard(title: 'Rapport mensuel - Mars 2025', subtitle: 'Consommation, coûts, satisfaction', leadingIcon: Icons.assessment, badge: StatusBadge(label: 'En cours', type: StatusBadgeType.info)),
        ListItemCard(title: 'Bilan trimestriel Q1', subtitle: 'Analyse complète T1 2025', leadingIcon: Icons.summarize, badge: StatusBadge(label: 'Disponible', type: StatusBadgeType.success)),
        ListItemCard(title: 'Rapport hygiène', subtitle: 'Dernière inspection: 15/02/2025', leadingIcon: Icons.health_and_safety, badge: StatusBadge(label: 'Conforme', type: StatusBadgeType.success)),
      ],
    ]);
  }

  Widget _buildFeedbackContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Avis'),
      ...[
        ListItemCard(title: 'Qualité des repas', subtitle: '4.2/5 - 156 avis ce mois', leadingIcon: Icons.star, leadingIconColor: AHColors.gold, badge: StatusBadge(label: 'Bon', type: StatusBadgeType.success)),
        ListItemCard(title: 'Variété des menus', subtitle: '3.8/5 - 142 avis ce mois', leadingIcon: Icons.star_half, leadingIconColor: AHColors.gold, badge: StatusBadge(label: 'Moyen', type: StatusBadgeType.warning)),
        ListItemCard(title: 'Temps d\'attente', subtitle: '3.5/5 - 98 avis ce mois', leadingIcon: Icons.schedule, leadingIconColor: AHColors.info, badge: StatusBadge(label: 'À améliorer', type: StatusBadgeType.warning)),
      ],
    ]);
  }

  Widget _buildSettingsContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Paramètres Cantine'),
      ...[
        ListItemCard(title: 'Horaires de service', subtitle: '11h30 - 13h30', leadingIcon: Icons.schedule, leadingIconColor: AHColors.navy),
        ListItemCard(title: 'Capacité maximale', subtitle: '150 couverts / service', leadingIcon: Icons.people, leadingIconColor: AHColors.navy),
        ListItemCard(title: 'Prix du repas', subtitle: '3,20 € - Élève / 5,50 € - Adulte', leadingIcon: Icons.euro, leadingIconColor: AHColors.gold),
        ListItemCard(title: 'Notifications', subtitle: 'Rappels réservation activés', leadingIcon: Icons.notifications, leadingIconColor: AHColors.info),
      ],
    ]);
  }
}
