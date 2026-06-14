import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/ah_theme.dart';
import '../../../core/widgets/loading_widget.dart';
import '../providers/auth_provider.dart';
import '../widgets/tenant_card.dart';

/// Tenant selection screen:
/// - Shows list of available schools (after login)
/// - Each school shows: logo, name, acronym, type
/// - Search bar for filtering
/// - Select a tenant to proceed
/// - AH branding header
/// - Uses tenant notifier
class TenantSelectScreen extends ConsumerStatefulWidget {
  const TenantSelectScreen({super.key});

  @override
  ConsumerState<TenantSelectScreen> createState() =>
      _TenantSelectScreenState();
}

class _TenantSelectScreenState extends ConsumerState<TenantSelectScreen> {
  final _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<TenantInfo> _filterTenants(List<TenantInfo> tenants) {
    if (_searchQuery.isEmpty) return tenants;
    final query = _searchQuery.toLowerCase();
    return tenants.where((t) {
      return t.name.toLowerCase().contains(query) ||
          t.acronym.toLowerCase().contains(query) ||
          t.type.toLowerCase().contains(query);
    }).toList();
  }

  Future<void> _selectTenant(TenantInfo tenant) async {
    await ref.read(authStateProvider.notifier).selectTenant(tenant);
    if (mounted) {
      context.go('/dashboard');
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authStateProvider);
    final tenants = ref.watch(availableTenantsProvider);
    final screenWidth = MediaQuery.of(context).size.width;
    final isTablet = screenWidth >= 600;

    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [AHColors.navyDark, AHColors.navy],
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              // ── Header ───────────────────────────────────────────
              Padding(
                padding: const EdgeInsets.all(AHSpacing.xl),
                child: Column(
                  children: [
                    // Shield icon
                    Container(
                      width: 56,
                      height: 56,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: const Icon(
                        Icons.shield,
                        color: AHColors.gold,
                        size: 30,
                      ),
                    ),
                    const SizedBox(height: AHSpacing.lg),
                    const Text(
                      'Choisir votre établissement',
                      style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 20,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(height: AHSpacing.sm),
                    Text(
                      'Sélectionnez l\'établissement auquel vous souhaitez accéder',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 14,
                        color: Colors.white.withValues(alpha: 0.7),
                      ),
                    ),
                  ],
                ),
              ),

              // ── Search + List ─────────────────────────────────────
              Expanded(
                child: Container(
                  decoration: const BoxDecoration(
                    color: AHColors.gray50,
                    borderRadius: BorderRadius.only(
                      topLeft: Radius.circular(AHRadius.xl),
                      topRight: Radius.circular(AHRadius.xl),
                    ),
                  ),
                  child: Column(
                    children: [
                      // Search bar
                      Padding(
                        padding: const EdgeInsets.fromLTRB(
                          AHSpacing.xl,
                          AHSpacing.xl,
                          AHSpacing.xl,
                          AHSpacing.md,
                        ),
                        child: TextField(
                          controller: _searchController,
                          onChanged: (value) {
                            setState(() => _searchQuery = value);
                          },
                          decoration: InputDecoration(
                            prefixIcon: const Icon(
                              Icons.search,
                              color: AHColors.gray400,
                              size: 22,
                            ),
                            hintText: 'Rechercher un établissement...',
                            suffixIcon: _searchQuery.isNotEmpty
                                ? IconButton(
                                    icon: const Icon(
                                      Icons.clear,
                                      color: AHColors.gray400,
                                      size: 20,
                                    ),
                                    onPressed: () {
                                      _searchController.clear();
                                      setState(() => _searchQuery = '');
                                    },
                                  )
                                : null,
                          ),
                        ),
                      ),

                      // Tenant list
                      Expanded(
                        child: authState.isLoading
                            ? const AHFullScreenLoading(
                                message: 'Chargement des établissements...',
                              )
                            : _buildTenantList(tenants, isTablet),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTenantList(List<TenantInfo> tenants, bool isTablet) {
    final filtered = _filterTenants(tenants);

    if (filtered.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.search_off, size: 48, color: AHColors.gray300),
            const SizedBox(height: AHSpacing.lg),
            Text(
              'Aucun établissement trouvé',
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: AHColors.gray500,
              ),
            ),
            const SizedBox(height: AHSpacing.sm),
            Text(
              _searchQuery.isNotEmpty
                  ? 'Essayez un autre terme de recherche'
                  : 'Vous n\'avez accès à aucun établissement',
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 14,
                color: AHColors.gray400,
              ),
            ),
          ],
        ),
      );
    }

    if (isTablet) {
      return GridView.builder(
        padding: const EdgeInsets.all(AHSpacing.lg),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          mainAxisSpacing: AHSpacing.md,
          crossAxisSpacing: AHSpacing.md,
          childAspectRatio: 3.2,
        ),
        itemCount: filtered.length,
        itemBuilder: (context, index) {
          return _buildTenantGridItem(filtered[index]);
        },
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.only(bottom: AHSpacing.xxl),
      itemCount: filtered.length,
      itemBuilder: (context, index) {
        return TenantCard(
          tenant: filtered[index],
          onTap: () => _selectTenant(filtered[index]),
        );
      },
    );
  }

  Widget _buildTenantGridItem(TenantInfo tenant) {
    return Card(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AHRadius.lg),
        side: BorderSide(color: AHColors.gray200, width: 1),
      ),
      elevation: 1,
      child: InkWell(
        onTap: () => _selectTenant(tenant),
        borderRadius: BorderRadius.circular(AHRadius.lg),
        child: Padding(
          padding: const EdgeInsets.all(AHSpacing.lg),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: AHColors.navy.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(AHRadius.md),
                ),
                child: Center(
                  child: Text(
                    tenant.acronym,
                    style: const TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: AHColors.navy,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: AHSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      tenant.name,
                      style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: AHColors.gray900,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    Text(
                      tenant.type,
                      style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 12,
                        color: AHColors.gray500,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
