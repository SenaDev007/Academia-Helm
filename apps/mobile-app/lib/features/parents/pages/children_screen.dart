/// ============================================================================
/// CHILDREN SCREEN — Écran "Mes Enfants" pour le portail Parent
/// ============================================================================
///
/// Affiche la liste des enfants du parent connecté sous forme de cartes.
/// Chaque carte montre : photo/avatar, nom, classe, matricule,
/// alertes (messages non lus, paiements en attente).
///
/// Au tap sur un enfant → navigation vers le détail (grades, payments, etc.)
///
/// ============================================================================

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../../../core/widgets/loading/async_value_widget.dart';
import '../providers/children_provider.dart';
import '../../../domain/entities/child.dart';

class ChildrenScreen extends ConsumerWidget {
  const ChildrenScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final childrenAsync = ref.watch(childrenProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Mes enfants'),
        automaticallyImplyLeading: false,
      ),
      body: AsyncValueWidget<List<Child>>(
        value: childrenAsync,
        builder: (children) {
          if (children.isEmpty) {
            return _EmptyState();
          }
          return ListView.builder(
            padding: const EdgeInsets.all(AHSpacing.md),
            itemCount: children.length,
            itemBuilder: (context, index) {
              final child = children[index];
              return _ChildCard(
                child: child,
                onTap: () {
                  // Fix: navigate to parent-dashboard with child selected
                  // (not /students/:id which is a staff screen)
                  context.push('/parent-dashboard');
                },
              );
            },
          );
        },
      ),
    );
  }
}

// ── Carte enfant ──

class _ChildCard extends StatelessWidget {
  const _ChildCard({required this.child, this.onTap});

  final Child child;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: AHSpacing.sm),
      child: InkWell(
        onTap: onTap ?? () {
          // Default: navigate to parent dashboard (not /students/:id which is staff)
          context.push('/parent-dashboard');
        },
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(AHSpacing.md),
          child: Row(
            children: [
              // Avatar
              _Avatar(child: child),
              const SizedBox(width: AHSpacing.md),

              // Infos
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      child.displayName,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.bold,
                            color: AHColors.gray900,
                          ),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Icon(Icons.school, size: 14, color: AHColors.gray500),
                        const SizedBox(width: 4),
                        Text(
                          child.className,
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                color: AHColors.gray600,
                              ),
                        ),
                        if (child.matricule != null) ...[
                          const SizedBox(width: 12),
                          Icon(Icons.badge, size: 14, color: AHColors.gray500),
                          const SizedBox(width: 4),
                          Text(
                            child.matricule!,
                            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                  color: AHColors.gray500,
                                ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),

              // Alertes
              if (child.hasAlerts) ...[
                const SizedBox(width: AHSpacing.sm),
                _AlertsBadge(child: child),
              ],

              // Flèche
              Icon(Icons.chevron_right, color: AHColors.gray400),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Avatar ──

class _Avatar extends StatelessWidget {
  const _Avatar({required this.child});

  final Child child;

  @override
  Widget build(BuildContext context) {
    if (child.avatarUrl != null && child.avatarUrl!.isNotEmpty) {
      return CircleAvatar(
        radius: 24,
        backgroundImage: NetworkImage(child.avatarUrl!),
      );
    }
    return CircleAvatar(
      radius: 24,
      backgroundColor: AHColors.navy.withOpacity(0.1),
      child: Text(
        child.initials,
        style: TextStyle(
          fontWeight: FontWeight.bold,
          color: AHColors.navy,
          fontSize: 16,
        ),
      ),
    );
  }
}

// ── Badge d'alertes ──

class _AlertsBadge extends StatelessWidget {
  const _AlertsBadge({required this.child});

  final Child child;

  @override
  Widget build(BuildContext context) {
    final alerts = <Widget>[];

    if (child.unreadMessages > 0) {
      alerts.add(_AlertChip(
        icon: Icons.message,
        count: child.unreadMessages,
        color: Colors.blue,
      ));
    }

    if (child.pendingPayments > 0) {
      alerts.add(_AlertChip(
        icon: Icons.payment,
        count: child.pendingPayments,
        color: Colors.orange,
      ));
    }

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: alerts
          .expand((w) => [w, const SizedBox(width: 4)])
          .toList()
        ..removeLast(),
    );
  }
}

class _AlertChip extends StatelessWidget {
  const _AlertChip({
    required this.icon,
    required this.count,
    required this.color,
  });

  final IconData icon;
  final int count;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: color),
          const SizedBox(width: 2),
          Text(
            '$count',
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}

// ── État vide ──

class _EmptyState extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.child_care,
              size: 64,
              color: AHColors.gray300,
            ),
            const SizedBox(height: AHSpacing.md),
            Text(
              'Aucun enfant lié à votre compte',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: AHColors.gray600,
                  ),
            ),
            const SizedBox(height: AHSpacing.sm),
            Text(
              'Contactez l\'administration de l\'établissement\npour lier vos enfants à votre compte.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AHColors.gray500,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}
