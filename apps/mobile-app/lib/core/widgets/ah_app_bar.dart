import '../theme/ah_colors.dart';
import '../theme/ah_spacing.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../auth/auth_notifier.dart';
import '../auth/auth_providers.dart';
import '../auth/auth_state.dart';
import '../theme/ah_theme.dart';
import '../auth/token_storage.dart';

/// Custom AH App Bar with:
/// - School name + acronym
/// - School logo / shield icon
/// - Notification bell with badge
/// - User avatar
class AHAppBar extends ConsumerWidget implements PreferredSizeWidget {
  const AHAppBar({super.key, this.showBackButton = false});

  final bool showBackButton;

  @override
  Size get preferredSize => const Size.fromHeight(60);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authNotifierProvider).valueOrNull;
    final user = authState?.userOrNull;
    final tenantId = authState?.selectedTenantIdOrNull;
    final tenants = authState?.availableTenantsOrNull ?? [];
    final tenant = tenantId != null
        ? tenants.where((t) => t.id == tenantId).firstOrNull
        : null;

    // Try to get tenant name from session storage (stored during login)
    final sessionTenant = TokenStorage.getSessionTenantSync();
    final tenantName = tenant?.name ??
        sessionTenant?['name'] as String? ??
        'Academia Helm';
    final acronym = tenant?.acronym ??
        sessionTenant?['acronym'] as String? ??
        _getAcronym(tenantName);
    final fullName = user?.displayName ?? 'Utilisateur';
    final initials = _getInitials(fullName);

    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [AHColors.navy, AHColors.navyLight],
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
        ),
        boxShadow: [
          BoxShadow(
            color: AHColors.navy,
            blurRadius: 8,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: AHSpacing.lg),
          child: Row(
            children: [
              // ── Back button or Logo ───────────────────────────────
              if (showBackButton)
                IconButton(
                  icon: const Icon(Icons.arrow_back, color: Colors.white),
                  onPressed: () => context.pop(),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                )
              else
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(AHRadius.md),
                  ),
                  child: const Icon(
                    Icons.shield,
                    color: AHColors.gold,
                    size: 20,
                  ),
                ),

              const SizedBox(width: AHSpacing.md),

              // ── School Name + Acronym ─────────────────────────────
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      tenantName,
                      style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    Text(
                      acronym,
                      style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                        color: Colors.white.withOpacity(0.7),
                      ),
                    ),
                  ],
                ),
              ),

              // ── Notification Bell ─────────────────────────────────
              IconButton(
                icon: Badge(
                  label: const Text('3'),
                  backgroundColor: AHColors.gold,
                  textColor: AHColors.gray900,
                  child: const Icon(
                    Icons.notifications_outlined,
                    color: Colors.white,
                    size: 24,
                  ),
                ),
                onPressed: () => context.go('/notifications'),
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
              ),

              const SizedBox(width: AHSpacing.sm),

              // ── User Avatar ──────────────────────────────────────
              GestureDetector(
                onTap: () => context.go('/profile'),
                child: CircleAvatar(
                  radius: 18,
                  backgroundColor: AHColors.gold,
                  child: Text(
                    initials,
                    style: const TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: AHColors.gray900,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
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

  /// Generate an acronym from a long school name.
  /// e.g. "Complexe Scolaire Privé..." → "CSP"
  String _getAcronym(String name) {
    if (name.isEmpty || name == 'Academia Helm') return 'AH';
    final words = name.trim().split(RegExp(r'\s+'));
    if (words.length <= 2) return name.substring(0, name.length > 2 ? 2 : name.length).toUpperCase();
    final acronym = StringBuffer();
    for (final w in words.take(4)) {
      if (w.isNotEmpty && !['de', 'et', 'le', 'la', 'les', 'du', 'des', 'à', 'en'].contains(w.toLowerCase())) {
        acronym.write(w[0].toUpperCase());
      }
    }
    final result = acronym.toString();
    return result.isEmpty ? 'AH' : result;
  }
}
