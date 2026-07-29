/// ============================================================================
/// MODULE LOADING — Academia Hub Mobile
/// ============================================================================
///
/// ModuleLoading component matching the web app:
/// - Shows ModuleSkeleton on tablet/desktop
/// - Shows compact DashboardSkeletonMobile on phone
/// - Accepts moduleName parameter
///
/// Uses AHColors: Navy (#0B2F73), Gold (#F5B335), Blue (#1D4FA5)
/// ============================================================================

import 'package:flutter/material.dart';

import '../../theme/ah_colors.dart';
import 'skeleton.dart';

// ─── Module Loading ──────────────────────────────────────────────────────────

/// Adaptive module loading placeholder.
/// Displays ModuleSkeleton on larger screens and DashboardSkeletonMobile on phones.
class ModuleLoading extends StatelessWidget {
  /// Name of the module being loaded (for display in the header).
  final String moduleName;

  /// Whether to show the loading header with module name.
  final bool showHeader;

  const ModuleLoading({
    super.key,
    required this.moduleName,
    this.showHeader = true,
  });

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final isPhone = width < 600;

    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Optional header with module name
          if (showHeader) _buildHeader(),

          // Adaptive skeleton
          Expanded(
            child: isPhone
                ? const DashboardSkeletonMobile()
                : ModuleSkeleton(moduleName: moduleName),
          ),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Row(
        children: [
          // Module icon placeholder
          ShimmerEffect(
            child: Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: AHColors.navy.withOpacity(0.1),
                borderRadius: BorderRadius.circular(8),
              ),
            ),
          ),
          const SizedBox(width: 12),
          // Module name placeholder
          ShimmerEffect(
            child: Container(
              width: 140,
              height: 20,
              decoration: BoxDecoration(
                color: AHColors.shimmerBase,
                borderRadius: BorderRadius.circular(4),
              ),
            ),
          ),
          const Spacer(),
          // Action buttons placeholder
          ShimmerEffect(
            child: Container(
              width: 80,
              height: 36,
              decoration: BoxDecoration(
                color: AHColors.shimmerBase,
                borderRadius: BorderRadius.circular(8),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
