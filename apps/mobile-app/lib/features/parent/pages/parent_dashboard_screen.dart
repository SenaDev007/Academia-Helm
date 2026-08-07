import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/auth/auth_notifier.dart';
import '../../../core/auth/auth_providers.dart';
import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../../parents/providers/children_provider.dart';
import '../../../domain/entities/child.dart';

/// Parent dashboard — mirrors the web app's `/app/parent/page.tsx`.
///
/// Layout (top → bottom):
/// 1. Welcome header (gradient blue→purple, parent name, school · year)
/// 2. Empty state OR children grid (one card per child)
/// 3. Each child card: avatar, name, class, matricule, scolarité status
/// 4. On tap → child detail (grades, payments, attendance, etc.)
class ParentDashboardScreen extends ConsumerWidget {
  const ParentDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final parentName = ref.watch(currentUserDisplayNameProvider) ?? 'Parent';
    final childrenAsync = ref.watch(childrenProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC), // slate-50
      appBar: AppBar(
        backgroundColor: Colors.white,
        foregroundColor: AHColors.navy,
        elevation: 0,
        title: const Text(
          'Portail Parent',
          style: TextStyle(
            fontFamily: 'Inter',
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: AHColors.navy,
          ),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            if (Navigator.of(context).canPop()) {
              Navigator.of(context).pop();
            } else {
              context.go('/dashboard');
            }
          },
        ),
      ),
      body: RefreshIndicator(
        color: AHColors.navy,
        onRefresh: () async {
          ref.invalidate(childrenProvider);
        },
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(AHSpacing.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 1. Welcome banner
              _WelcomeBanner(parentName: parentName),
              const SizedBox(height: AHSpacing.md),

              // 2. Title
              Row(
                children: [
                  Icon(Icons.people_outline, size: 20, color: AHColors.navy),
                  const SizedBox(width: 8),
                  const Text(
                    'Mes Enfants',
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: AHColors.navy,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AHSpacing.md),

              // 3. Children grid OR empty state
              childrenAsync.when(
                data: (children) {
                  if (children.isEmpty) {
                    return const _EmptyState();
                  }
                  return _ChildrenList(children: children);
                },
                loading: () => const Padding(
                  padding: EdgeInsets.all(32),
                  child: Center(
                    child: CircularProgressIndicator(color: AHColors.navy),
                  ),
                ),
                error: (error, _) => _ErrorState(
                  message: error.toString(),
                  onRetry: () => ref.invalidate(childrenProvider),
                ),
              ),
              const SizedBox(height: AHSpacing.xxl),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Welcome Banner ─────────────────────────────────────────────────────

class _WelcomeBanner extends StatelessWidget {
  const _WelcomeBanner({required this.parentName});

  final String parentName;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AHSpacing.lg),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF2563EB), Color(0xFF7C3AED)], // blue-600 → purple-600
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
        ),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.2),
              shape: BoxShape.circle,
              border: Border.all(color: Colors.white.withOpacity(0.3), width: 2),
            ),
            child: const Icon(Icons.family_restroom, color: Colors.white, size: 24),
          ),
          const SizedBox(width: AHSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Bienvenue, $parentName',
                  style: const TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: Colors.white,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                const Text(
                  'Suivez la scolarité de vos enfants',
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 11,
                    color: Colors.white70,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Children List ───────────────────────────────────────────────────────

class _ChildrenList extends StatelessWidget {
  const _ChildrenList({required this.children});

  final List<Child> children;

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: children.length,
      separatorBuilder: (_, __) => const SizedBox(height: AHSpacing.sm),
      itemBuilder: (context, index) {
        final child = children[index];
        return _ChildCard(child: child);
      },
    );
  }
}

// ── Child Card ──────────────────────────────────────────────────────────

class _ChildCard extends StatelessWidget {
  const _ChildCard({required this.child});

  final Child child;

  @override
  Widget build(BuildContext context) {
    final hasPending = child.pendingPayments > 0;
    final hasAlerts = child.hasAlerts;

    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: () => context.push('/children'),
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.all(AHSpacing.md),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFE2E8F0)), // slate-200
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Row 1: Avatar + name + class
              Row(
                children: [
                  _ChildAvatar(child: child),
                  const SizedBox(width: AHSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          child.displayName,
                          style: const TextStyle(
                            fontFamily: 'Inter',
                            fontSize: 14,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF0F172A), // slate-900
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 2),
                        Text(
                          child.className,
                          style: const TextStyle(
                            fontFamily: 'Inter',
                            fontSize: 11,
                            color: Color(0xFF64748B), // slate-500
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                  if (child.matricule != null && child.matricule!.isNotEmpty)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: AHColors.navy.withOpacity(0.08),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        child.matricule!,
                        style: const TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 9,
                          fontWeight: FontWeight.w700,
                          color: AHColors.navy,
                        ),
                      ),
                    ),
                ],
              ),

              // Row 2: Scolarité status (if data available)
              if (child.pendingPayments > 0 || child.totalPendingAmount > 0) ...[
                const SizedBox(height: AHSpacing.sm),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEE2E2), // red-100
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.warning_amber_rounded, size: 12, color: Color(0xFFDC2626)),
                      const SizedBox(width: 4),
                      Flexible(
                        child: Text(
                          child.totalPendingAmount > 0
                              ? 'Reste à payer : ${child.totalPendingAmount.toStringAsFixed(0)} FCFA'
                              : '${child.pendingPayments} paiement(s) en attente',
                          style: const TextStyle(
                            fontFamily: 'Inter',
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFFDC2626), // red-600
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ),
              ] else if (child.pendingPayments == 0 && child.recentGrades >= 0) ...[
                const SizedBox(height: AHSpacing.sm),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFFDCFCE7), // green-100
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.check_circle, size: 12, color: Color(0xFF16A34A)),
                      SizedBox(width: 4),
                      Text(
                        'Scolarité à jour',
                        style: TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF16A34A), // green-600
                        ),
                      ),
                    ],
                  ),
                ),
              ],

              // Row 3: Alerts + "Voir le suivi" link
              if (hasAlerts) ...[
                const SizedBox(height: AHSpacing.sm),
                Row(
                  children: [
                    if (child.unreadMessages > 0)
                      _AlertBadge(
                        icon: Icons.message,
                        count: child.unreadMessages,
                        color: const Color(0xFF2563EB), // blue-600
                      ),
                    if (child.unreadMessages > 0 && child.recentGrades > 0)
                      const SizedBox(width: 8),
                    if (child.recentGrades > 0)
                      _AlertBadge(
                        icon: Icons.grade,
                        count: child.recentGrades,
                        color: const Color(0xFFDB2777), // pink-600
                      ),
                  ],
                ),
              ],
              const SizedBox(height: AHSpacing.sm),

              // "Voir le suivi" link
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  Text(
                    'Voir le suivi',
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: AHColors.blue,
                    ),
                  ),
                  const SizedBox(width: 4),
                  Icon(Icons.chevron_right, size: 14, color: AHColors.blue),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ChildAvatar extends StatelessWidget {
  const _ChildAvatar({required this.child});

  final Child child;

  @override
  Widget build(BuildContext context) {
    if (child.avatarUrl != null && child.avatarUrl!.isNotEmpty) {
      return Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: const LinearGradient(
            colors: [Color(0xFF2563EB), Color(0xFF7C3AED)], // blue → purple
          ),
        ),
        child: ClipOval(
          child: Image.network(
            child.avatarUrl!,
            fit: BoxFit.cover,
            errorBuilder: (_, __, ___) => _InitialsAvatar(child: child),
          ),
        ),
      );
    }
    return _InitialsAvatar(child: child);
  }
}

class _InitialsAvatar extends StatelessWidget {
  const _InitialsAvatar({required this.child});

  final Child child;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 40,
      height: 40,
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(
          colors: [Color(0xFF2563EB), Color(0xFF7C3AED)], // blue → purple
        ),
      ),
      child: Center(
        child: Text(
          child.initials,
          style: const TextStyle(
            fontFamily: 'Inter',
            fontSize: 14,
            fontWeight: FontWeight.w800,
            color: Colors.white,
          ),
        ),
      ),
    );
  }
}

class _AlertBadge extends StatelessWidget {
  const _AlertBadge({
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
        borderRadius: BorderRadius.circular(4),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 10, color: color),
          const SizedBox(width: 2),
          Text(
            '$count',
          style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 9,
              fontWeight: FontWeight.w700,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Empty State ─────────────────────────────────────────────────────────

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AHSpacing.xxl),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.child_care_outlined,
            size: 64,
            color: AHColors.grey300,
          ),
          const SizedBox(height: AHSpacing.md),
          const Text(
            'Aucun enfant lié à votre compte',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: AHColors.navy,
            ),
          ),
          const SizedBox(height: AHSpacing.sm),
          const Text(
            'Contactez l\'administration de l\'école pour lier vos enfants à votre compte.',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 12,
              color: AHColors.grey500,
              height: 1.5,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Error State ─────────────────────────────────────────────────────────

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AHSpacing.xl),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.wifi_off, size: 48, color: AHColors.error),
          const SizedBox(height: AHSpacing.md),
          const Text(
            'Impossible de charger vos enfants',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: AHColors.grey600,
            ),
          ),
          const SizedBox(height: AHSpacing.sm),
          Text(
            'Vérifiez votre connexion internet et réessayez.',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 12,
              color: AHColors.grey400,
            ),
          ),
          const SizedBox(height: AHSpacing.lg),
          ElevatedButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh, size: 16),
            label: const Text('Réessayer'),
            style: ElevatedButton.styleFrom(
              backgroundColor: AHColors.navy,
              foregroundColor: Colors.white,
            ),
          ),
        ],
      ),
    );
  }
}
