import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../auth/auth_notifier.dart';
import '../auth/auth_providers.dart';
import '../providers/school_identity_provider.dart';
import '../theme/ah_colors.dart';
import '../theme/ah_spacing.dart';

/// Custom AH App Bar with:
/// - Real school logo (from /api/settings/identity)
/// - Full school name + acronym
/// - Notification bell with badge
/// - User avatar
/// - Back button that NEVER exits the app — falls back to /dashboard
class AHAppBar extends ConsumerWidget implements PreferredSizeWidget {
  const AHAppBar({super.key, this.showBackButton = false, this.title});

  final bool showBackButton;
  final String? title;

  @override
  Size get preferredSize => const Size.fromHeight(60);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authNotifierProvider).valueOrNull;
    final user = authState?.userOrNull;
    final identityAsync = ref.watch(schoolIdentityProvider);

    // Use the identity from API if available, else fall back to whatever
    // is in the auth state's tenant list, else default.
    final identity = identityAsync.valueOrNull;
    final tenantId = authState?.selectedTenantIdOrNull;
    final tenants = authState?.availableTenantsOrNull ?? [];
    final tenant = tenantId != null
        ? tenants.where((t) => t.id == tenantId).firstOrNull
        : null;

    final tenantName = identity?.schoolName ??
        tenant?.name ??
        'Academia Helm';
    final acronym = identity?.displayAcronym ?? tenant?.acronym ?? 'AH';
    final logoUrl = identity?.absoluteLogoUrl;
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
                  onPressed: () => _safeBack(context),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                )
              else
                _SchoolLogo(logoUrl: logoUrl),

              const SizedBox(width: AHSpacing.md),

              // ── School Name + Acronym ─────────────────────────────
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      title ?? tenantName,
                      style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (title == null)
                      Text(
                        acronym,
                        style: TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                          color: Colors.white.withOpacity(0.7),
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
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
                onPressed: () => context.go('/communication'),
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

  /// Pop the current route if there's something to pop, otherwise navigate
  /// to the dashboard. NEVER exits the app from a module screen.
  void _safeBack(BuildContext context) {
    final navigator = Navigator.of(context);
    if (navigator.canPop()) {
      navigator.pop();
    } else {
      // Fall back to the dashboard — the user is at the root of the shell.
      GoRouter.of(context).go('/dashboard');
    }
  }

  String _getInitials(String name) {
    final parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    }
    return name.substring(0, name.length > 2 ? 2 : name.length).toUpperCase();
  }
}

/// School logo widget — shows the real logo from URL, or a fallback shield
/// icon with the school's first letter.
class _SchoolLogo extends StatelessWidget {
  const _SchoolLogo({required this.logoUrl});

  final String? logoUrl;

  @override
  Widget build(BuildContext context) {
    if (logoUrl == null || logoUrl!.isEmpty) {
      return Container(
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
      );
    }

    return Container(
      width: 36,
      height: 36,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AHRadius.md),
        border: Border.all(color: AHColors.gold, width: 1.5),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(AHRadius.md),
        child: CachedNetworkImage(
          imageUrl: logoUrl!,
          fit: BoxFit.cover,
          placeholder: (context, url) => const Center(
            child: SizedBox(
              width: 14,
              height: 14,
              child: CircularProgressIndicator(
                strokeWidth: 1.5,
                color: AHColors.navy,
              ),
            ),
          ),
          errorWidget: (context, url, error) => const Icon(
            Icons.shield,
            color: AHColors.gold,
            size: 20,
          ),
        ),
      ),
    );
  }
}
