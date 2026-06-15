import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_notifier.dart';
import '../../../core/auth/auth_providers.dart';
import '../../../core/auth/auth_state.dart';
import '../../../core/theme/ah_theme.dart';
import '../../../core/widgets/ah_app_bar.dart';
import '../providers/dashboard_provider.dart';
import '../widgets/stat_card.dart';
import '../widgets/quick_action_button.dart';

/// Main dashboard with:
/// - Role-based content
/// - Adaptive layout: phone = single column, tablet = 2 columns
/// - Welcome header with user name and school name
/// - Quick stats cards (based on role)
/// - Bottom navigation bar (phone) / Side navigation rail (tablet)
/// - Uses Scaffold with adaptive navigation
class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final userName = ref.watch(currentUserDisplayNameProvider) ?? 'Utilisateur';
    final authState = ref.watch(authNotifierProvider).valueOrNull;
    final tenantId = authState?.selectedTenantIdOrNull;
    final tenants = authState?.availableTenantsOrNull ?? [];
    final tenant = tenantId != null
        ? tenants.where((TenantBasic t) => t.id == tenantId).firstOrNull
        : null;
    final schoolName = tenant?.name ?? 'Academia Helm';
    final stats = ref.watch(dashboardStatsProvider);
    final quickActions = ref.watch(dashboardQuickActionsProvider);
    final role = ref.watch(currentUserRoleProvider) ?? '';

    return Scaffold(
      appBar: const AHAppBar(),
      body: RefreshIndicator(
        color: AHColors.navy,
        onRefresh: () async {
          // Trigger a refresh of dashboard data
          ref.invalidate(dashboardStatsProvider);
          ref.invalidate(dashboardQuickActionsProvider);
        },
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.only(bottom: AHSpacing.xxl),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Welcome Header ────────────────────────────────────
              _WelcomeHeader(
                userName: userName,
                schoolName: schoolName,
                role: role,
              ),

              // ── Stats Grid ────────────────────────────────────────
              _StatsGrid(stats: stats),

              // ── Quick Actions ─────────────────────────────────────
              _QuickActionsSection(actions: quickActions),

              // ── Recent Activity ──────────────────────────────────
              const _RecentActivitySection(),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Welcome Header ────────────────────────────────────────────────────

class _WelcomeHeader extends StatelessWidget {
  const _WelcomeHeader({
    required this.userName,
    required this.schoolName,
    required this.role,
  });

  final String userName;
  final String schoolName;
  final String role;

  String _getRoleLabel(String role) {
    switch (role) {
      case 'ADMIN':
      case 'SUPER_ADMIN':
        return 'Administrateur';
      case 'TEACHER':
        return 'Enseignant';
      case 'PARENT':
        return 'Parent';
      case 'STUDENT':
        return 'Élève';
      default:
        return role;
    }
  }

  String _getGreeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Bonjour';
    if (hour < 18) return 'Bon après-midi';
    return 'Bonsoir';
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(
        AHSpacing.xl,
        AHSpacing.xl,
        AHSpacing.xl,
        AHSpacing.lg,
      ),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [AHColors.navy, AHColors.navyLight],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(AHRadius.xl),
          bottomRight: Radius.circular(AHRadius.xl),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${_getGreeting()},',
                      style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 14,
                        color: Colors.white.withValues(alpha: 0.8),
                      ),
                    ),
                    const SizedBox(height: AHSpacing.xs),
                    Text(
                      userName,
                      style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 22,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                      ),
                    ),
                  ],
                ),
              ),
              // User avatar
              CircleAvatar(
                radius: 28,
                backgroundColor: AHColors.gold,
                child: Text(
                  _getInitials(userName),
                  style: const TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: AHColors.gray900,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AHSpacing.md),
          // School info row
          Container(
            padding: const EdgeInsets.symmetric(
              horizontal: AHSpacing.md,
              vertical: AHSpacing.sm,
            ),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(AHRadius.md),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.school,
                  color: AHColors.gold,
                  size: 16,
                ),
                const SizedBox(width: AHSpacing.sm),
                Flexible(
                  child: Text(
                    schoolName,
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: Colors.white.withValues(alpha: 0.9),
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const SizedBox(width: AHSpacing.sm),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AHSpacing.sm,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    color: AHColors.gold.withValues(alpha: 0.25),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    _getRoleLabel(role),
                    style: const TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                      color: AHColors.gold,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _getInitials(String name) {
    final parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    }
    return name.substring(0, name.length > 2 ? 2 : name.length).toUpperCase();
  }
}

// ── Stats Grid ────────────────────────────────────────────────────────

class _StatsGrid extends StatelessWidget {
  const _StatsGrid({required this.stats});

  final List<DashboardStat> stats;

  @override
  Widget build(BuildContext context) {
    final screenWidth = MediaQuery.of(context).size.width;
    final crossAxisCount = screenWidth >= 600 ? 4 : 2;

    return Padding(
      padding: const EdgeInsets.all(AHSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Vue d\'ensemble',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                  color: AHColors.gray900,
                ),
          ),
          const SizedBox(height: AHSpacing.md),
          GridView.count(
            physics: const NeverScrollableScrollPhysics(),
            shrinkWrap: true,
            crossAxisCount: crossAxisCount,
            mainAxisSpacing: AHSpacing.md,
            crossAxisSpacing: AHSpacing.md,
            childAspectRatio: crossAxisCount == 4 ? 1.1 : 1.2,
            children: stats.map((stat) => StatCard(stat: stat)).toList(),
          ),
        ],
      ),
    );
  }
}

// ── Quick Actions Section ─────────────────────────────────────────────

class _QuickActionsSection extends StatelessWidget {
  const _QuickActionsSection({required this.actions});

  final List<QuickAction> actions;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AHSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Actions rapides',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                  color: AHColors.gray900,
                ),
          ),
          const SizedBox(height: AHSpacing.md),
          Row(
            children: actions
                .map((action) => Expanded(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                            horizontal: AHSpacing.xs),
                        child: QuickActionButton(action: action),
                      ),
                    ))
                .toList(),
          ),
        ],
      ),
    );
  }
}

// ── Recent Activity Section ───────────────────────────────────────────

class _RecentActivitySection extends StatelessWidget {
  const _RecentActivitySection();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(AHSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Activité récente',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                  color: AHColors.gray900,
                ),
          ),
          const SizedBox(height: AHSpacing.md),
          ..._recentItems.map((item) => _ActivityItemWidget(item: item)),
        ],
      ),
    );
  }
}

class _ActivityItem {
  final IconData icon;
  final Color iconColor;
  final String title;
  final String subtitle;
  final String time;

  const _ActivityItem({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.subtitle,
    required this.time,
  });
}

const _recentItems = [
  _ActivityItem(
    icon: Icons.grade,
    iconColor: AHColors.gold,
    title: 'Nouvelle note publiée',
    subtitle: 'Mathématiques — Devoir n°3',
    time: 'Il y a 2h',
  ),
  _ActivityItem(
    icon: Icons.payment,
    iconColor: AHColors.success,
    title: 'Paiement reçu',
    subtitle: 'Frais de scolarité — Janvier',
    time: 'Il y a 5h',
  ),
  _ActivityItem(
    icon: Icons.message,
    iconColor: AHColors.info,
    title: 'Nouveau message',
    subtitle: 'Direction — Réunion parents',
    time: 'Hier',
  ),
  _ActivityItem(
    icon: Icons.person_add,
    iconColor: AHColors.navy,
    title: 'Nouvel élève inscrit',
    subtitle: 'Classe 6ème A',
    time: 'Hier',
  ),
];

class _ActivityItemWidget extends StatelessWidget {
  const _ActivityItemWidget({required this.item});

  final _ActivityItem item;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AHSpacing.md),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: item.iconColor.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(AHRadius.md),
            ),
            child: Icon(item.icon, color: item.iconColor, size: 20),
          ),
          const SizedBox(width: AHSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.title,
                  style: const TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: AHColors.gray900,
                  ),
                ),
                Text(
                  item.subtitle,
                  style: const TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 13,
                    color: AHColors.gray500,
                  ),
                ),
              ],
            ),
          ),
          Text(
            item.time,
            style: const TextStyle(
              fontFamily: 'Inter',
              fontSize: 12,
              color: AHColors.gray400,
            ),
          ),
        ],
      ),
    );
  }
}
