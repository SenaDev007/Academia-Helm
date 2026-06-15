import 'package:flutter/material.dart';
import '../../../core/enums/module_config.dart';
import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../../../core/widgets/module_page_shell.dart';
import '../../../core/widgets/sub_tab_content.dart';

class ShopScreen extends StatefulWidget {
  const ShopScreen({super.key});

  @override
  State<ShopScreen> createState() => _ShopScreenState();
}

class _ShopScreenState extends State<ShopScreen> {
  @override
  Widget build(BuildContext context) {
    final module = allModules.firstWhere((m) => m.id == 'shop');
    final subTabs = module.subTabs;
    return StatefulModulePage(
      module: module,
      visibleSubTabs: subTabs,
      initialSubTabId: subTabs.first.id,
      subTabBuilder: (subTab) {
        switch (subTab.id) {
          case 'shop-dashboard':
            return _buildDashboardContent(context);
          case 'shop-products':
            return _buildProductsContent(context);
          case 'shop-orders':
            return _buildOrdersContent(context);
          case 'shop-payments':
            return _buildPaymentsContent(context);
          case 'shop-deliveries':
            return _buildDeliveriesContent(context);
          case 'shop-returns':
            return _buildReturnsContent(context);
          case 'shop-categories':
            return _buildCategoriesContent(context);
          case 'shop-inventory':
            return _buildInventoryContent(context);
          case 'shop-suppliers':
            return _buildSuppliersContent(context);
          case 'shop-promotions':
            return _buildPromotionsContent(context);
          case 'shop-coupons':
            return _buildCouponsContent(context);
          case 'shop-reviews':
            return _buildReviewsContent(context);
          case 'shop-reports':
            return _buildReportsContent(context);
          case 'shop-settings':
            return _buildSettingsContent(context);
          default:
            return PlaceholderContent(title: subTab.label);
        }
      },
    );
  }

  Widget _buildDashboardContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Tableau de bord Boutique'),
      GridView.count(shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), crossAxisCount: 2, mainAxisSpacing: AHSpacing.sm, crossAxisSpacing: AHSpacing.sm, childAspectRatio: 1.4, children: const [
        StatCard(title: 'Commandes ce mois', value: '89', icon: Icons.shopping_cart, subtitle: '+12% vs mois dernier'),
        StatCard(title: 'Chiffre d\'affaires', value: '4 560 €', icon: Icons.euro, iconColor: AHColors.success, subtitle: 'Ce mois'),
        StatCard(title: 'Produits en stock', value: '234', icon: Icons.inventory, iconColor: AHColors.info),
        StatCard(title: 'Avis clients', value: '4.2/5', icon: Icons.star, iconColor: AHColors.gold, subtitle: '156 avis'),
      ]),
    ]);
  }

  Widget _buildProductsContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Produits'),
      ...[
        ListItemCard(title: 'Cahier Academia Premium', subtitle: '12,50 € - Stock: 45 unités', leadingIcon: Icons.book, badge: StatusBadge(label: 'En stock', type: StatusBadgeType.success)),
        ListItemCard(title: 'Stylo 4 couleurs', subtitle: '3,90 € - Stock: 120 unités', leadingIcon: Icons.edit, badge: StatusBadge(label: 'En stock', type: StatusBadgeType.success)),
        ListItemCard(title: 'Tote bag établissement', subtitle: '15,00 € - Stock: 8 unités', leadingIcon: Icons.shopping_bag, badge: StatusBadge(label: 'Stock bas', type: StatusBadgeType.warning)),
        ListItemCard(title: 'Calculatrice scientifique', subtitle: '29,90 € - Stock: 0 unité', leadingIcon: Icons.calculate, badge: StatusBadge(label: 'Rupture', type: StatusBadgeType.error)),
      ],
    ]);
  }

  Widget _buildOrdersContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Commandes'),
      ...[
        ListItemCard(title: 'CMD-2025-0487', subtitle: 'M. Dupont - 45,80 € - 3 articles', leadingIcon: Icons.receipt, badge: StatusBadge(label: 'En traitement', type: StatusBadgeType.warning)),
        ListItemCard(title: 'CMD-2025-0486', subtitle: 'Mme. Martin - 23,40 € - 2 articles', leadingIcon: Icons.receipt, badge: StatusBadge(label: 'Expédiée', type: StatusBadgeType.info)),
        ListItemCard(title: 'CMD-2025-0485', subtitle: 'M. Ben Ahmed - 67,20 € - 5 articles', leadingIcon: Icons.receipt, badge: StatusBadge(label: 'Livrée', type: StatusBadgeType.success)),
        ListItemCard(title: 'CMD-2025-0484', subtitle: 'Mme. Petit - 12,50 € - 1 article', leadingIcon: Icons.receipt, badge: StatusBadge(label: 'Livrée', type: StatusBadgeType.success)),
      ],
    ]);
  }

  Widget _buildPaymentsContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Paiements'),
      ...[
        ListItemCard(title: 'Carte bancaire', subtitle: '3 240 € - 56 transactions', leadingIcon: Icons.credit_card, badge: StatusBadge(label: 'Principal', type: StatusBadgeType.success)),
        ListItemCard(title: 'Virement', subtitle: '890 € - 12 transactions', leadingIcon: Icons.account_balance, badge: StatusBadge(label: 'Actif', type: StatusBadgeType.info)),
        ListItemCard(title: 'Chèque', subtitle: '430 € - 8 transactions', leadingIcon: Icons.receipt_long, badge: StatusBadge(label: 'En attente', type: StatusBadgeType.warning)),
      ],
    ]);
  }

  Widget _buildDeliveriesContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Livraisons'),
      ...[
        ListItemCard(title: 'CMD-0486 - Mme. Martin', subtitle: 'Colis préparé - Retrait prévu 12/03', leadingIcon: Icons.local_shipping, badge: StatusBadge(label: 'Prêt', type: StatusBadgeType.info)),
        ListItemCard(title: 'CMD-0483 - M. Laurent', subtitle: 'Livré le 09/03/2025', leadingIcon: Icons.local_shipping, badge: StatusBadge(label: 'Livré', type: StatusBadgeType.success)),
        ListItemCard(title: 'CMD-0481 - Mme. Dubois', subtitle: 'Livré le 08/03/2025', leadingIcon: Icons.local_shipping, badge: StatusBadge(label: 'Livré', type: StatusBadgeType.success)),
      ],
    ]);
  }

  Widget _buildReturnsContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Retours'),
      ...[
        ListItemCard(title: 'RET-2025-012 - Calculatrice', subtitle: 'Défectueuse - Remboursement demandé', leadingIcon: Icons.assignment_return, badge: StatusBadge(label: 'En cours', type: StatusBadgeType.warning)),
        ListItemCard(title: 'RET-2025-011 - Tote bag L', subtitle: 'Taille incorrecte - Échange demandé', leadingIcon: Icons.assignment_return, badge: StatusBadge(label: 'Échange', type: StatusBadgeType.info)),
        ListItemCard(title: 'RET-2025-010 - Cahier', subtitle: 'Page manquante - Remboursement effectué', leadingIcon: Icons.assignment_return, badge: StatusBadge(label: 'Résolu', type: StatusBadgeType.success)),
      ],
    ]);
  }

  Widget _buildCategoriesContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Catégories'),
      ...[
        ListItemCard(title: 'Papeterie', subtitle: '67 produits', leadingIcon: Icons.category, leadingIconColor: AHColors.navy),
        ListItemCard(title: 'Bagagerie', subtitle: '15 produits', leadingIcon: Icons.category, leadingIconColor: AHColors.info),
        ListItemCard(title: 'Électronique', subtitle: '23 produits', leadingIcon: Icons.category, leadingIconColor: AHColors.success),
        ListItemCard(title: 'Textile', subtitle: '34 produits', leadingIcon: Icons.category, leadingIconColor: AHColors.gold),
      ],
    ]);
  }

  Widget _buildInventoryContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Inventaire'),
      GridView.count(shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), crossAxisCount: 2, mainAxisSpacing: AHSpacing.sm, crossAxisSpacing: AHSpacing.sm, childAspectRatio: 1.4, children: const [
        StatCard(title: 'Produits en stock', value: '234', icon: Icons.inventory_2, subtitle: '4 catégories'),
        StatCard(title: 'Alertes stock bas', value: '5', icon: Icons.warning, iconColor: AHColors.warning),
        StatCard(title: 'Ruptures', value: '2', icon: Icons.cancel, iconColor: AHColors.error),
        StatCard(title: 'Valeur stock', value: '8 450 €', icon: Icons.euro, iconColor: AHColors.success),
      ]),
    ]);
  }

  Widget _buildSuppliersContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Fournisseurs'),
      ...[
        ListItemCard(title: 'Papeterie Générale SA', subtitle: 'Papeterie - Délai: 3 jours', leadingIcon: Icons.local_shipping, badge: StatusBadge(label: 'Actif', type: StatusBadgeType.success)),
        ListItemCard(title: 'Tech Edu Supply', subtitle: 'Électronique - Délai: 5 jours', leadingIcon: Icons.local_shipping, badge: StatusBadge(label: 'Actif', type: StatusBadgeType.success)),
        ListItemCard(title: 'Textil School', subtitle: 'Textile - Délai: 7 jours', leadingIcon: Icons.local_shipping, badge: StatusBadge(label: 'Actif', type: StatusBadgeType.success)),
      ],
    ]);
  }

  Widget _buildPromotionsContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Promotions'),
      ...[
        ListItemCard(title: 'Rentrée scolaire -20%', subtitle: 'Valide: 01/09 - 30/09/2025 - Tous les articles', leadingIcon: Icons.local_offer, leadingIconColor: AHColors.error, badge: StatusBadge(label: 'Planifiée', type: StatusBadgeType.info)),
        ListItemCard(title: 'Pack cahiers -15%', subtitle: 'Valide: 10/03 - 31/03/2025 - Papeterie', leadingIcon: Icons.local_offer, leadingIconColor: AHColors.error, badge: StatusBadge(label: 'Active', type: StatusBadgeType.success)),
        ListItemCard(title: 'Fête de l\'école -10%', subtitle: 'Valide: 15/06/2025 - Textile uniquement', leadingIcon: Icons.local_offer, leadingIconColor: AHColors.error, badge: StatusBadge(label: 'Planifiée', type: StatusBadgeType.info)),
      ],
    ]);
  }

  Widget _buildCouponsContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Coupons'),
      ...[
        ListItemCard(title: 'BIENVENUE10', subtitle: '-10% sur la 1ère commande - 89 utilisations', leadingIcon: Icons.confirmation_number, leadingIconColor: AHColors.gold, badge: StatusBadge(label: 'Actif', type: StatusBadgeType.success)),
        ListItemCard(title: 'RENTREE20', subtitle: '-20% rentrée scolaire - 0/234 utilisations', leadingIcon: Icons.confirmation_number, leadingIconColor: AHColors.gold, badge: StatusBadge(label: 'Planifié', type: StatusBadgeType.info)),
        ListItemCard(title: 'FIDELITE5', subtitle: '-5€ dès 30€ d\'achat - 56 utilisations', leadingIcon: Icons.confirmation_number, leadingIconColor: AHColors.gold, badge: StatusBadge(label: 'Actif', type: StatusBadgeType.success)),
      ],
    ]);
  }

  Widget _buildReviewsContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Avis clients'),
      ...[
        ListItemCard(title: 'Cahier Academia Premium', subtitle: '4.5/5 - 34 avis - "Excellent qualité"', leadingIcon: Icons.star, leadingIconColor: AHColors.gold, badge: StatusBadge(label: 'Top', type: StatusBadgeType.success)),
        ListItemCard(title: 'Tote bag établissement', subtitle: '3.8/5 - 12 avis - "Sympa mais petit"', leadingIcon: Icons.star, leadingIconColor: AHColors.gold, badge: StatusBadge(label: 'Bien', type: StatusBadgeType.warning)),
        ListItemCard(title: 'Calculatrice scientifique', subtitle: '4.2/5 - 28 avis - "Bon rapport qualité/prix"', leadingIcon: Icons.star, leadingIconColor: AHColors.gold, badge: StatusBadge(label: 'Bien', type: StatusBadgeType.success)),
      ],
    ]);
  }

  Widget _buildReportsContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Rapports Boutique'),
      ...[
        ListItemCard(title: 'Rapport ventes - Mars 2025', subtitle: '89 commandes - 4 560 € CA', leadingIcon: Icons.assessment, badge: StatusBadge(label: 'En cours', type: StatusBadgeType.info)),
        ListItemCard(title: 'Bilan trimestriel Q1', subtitle: '+12% vs Q4 - 256 commandes', leadingIcon: Icons.summarize, badge: StatusBadge(label: 'Disponible', type: StatusBadgeType.success)),
        ListItemCard(title: 'Rapport stocks', subtitle: '2 ruptures - 5 alertes stock bas', leadingIcon: Icons.inventory, badge: StatusBadge(label: 'Disponible', type: StatusBadgeType.warning)),
      ],
    ]);
  }

  Widget _buildSettingsContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Paramètres Boutique'),
      ...[
        ListItemCard(title: 'Mode de vente', subtitle: 'Click & Collect + Livraison', leadingIcon: Icons.settings, leadingIconColor: AHColors.navy),
        ListItemCard(title: 'Moyens de paiement', subtitle: 'CB, Virement, Chèque activés', leadingIcon: Icons.payment, leadingIconColor: AHColors.success),
        ListItemCard(title: 'Frais de livraison', subtitle: 'Gratuit dès 25 € - 3,50 € sinon', leadingIcon: Icons.local_shipping, leadingIconColor: AHColors.info),
        ListItemCard(title: 'Politique de retour', subtitle: '30 jours - Remboursement/Échange', leadingIcon: Icons.assignment_return, leadingIconColor: AHColors.warning),
      ],
    ]);
  }
}
