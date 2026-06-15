/// ============================================================================
/// SKELETON — Academia Hub Mobile
/// ============================================================================
///
/// Skeleton loading components matching the web app:
/// - Skeleton base with shimmer wave animation (Navy→Blue→Gold gradient L→R)
/// - TableSkeleton (rows, columns)
/// - CardSkeleton (count) with colored badges + gold corner accent
/// - ListSkeleton (items) with avatar + text + badge
/// - DashboardSkeleton (full: cards + charts + table)
/// - ModuleSkeleton (header + cards + charts + table)
/// - FormSkeleton (fields + action buttons)
///
/// Uses AHColors: Navy (#0B2F73), Gold (#F5B335), Blue (#1D4FA5)
/// ============================================================================

import 'dart:math';

import 'package:flutter/material.dart';

import '../../theme/ah_colors.dart';

// ─── Shimmer Animation ───────────────────────────────────────────────────────

/// A shimmer wave effect that sweeps left to right.
/// Uses Navy→Blue→Gold gradient matching the web app's shimmer.
class ShimmerEffect extends StatefulWidget {
  final Widget child;

  const ShimmerEffect({super.key, required this.child});

  @override
  State<ShimmerEffect> createState() => _ShimmerEffectState();
}

class _ShimmerEffectState extends State<ShimmerEffect>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        return ShaderMask(
          blendMode: BlendMode.srcATop,
          shaderCallback: (bounds) {
            final slidePercent = _controller.value;
            return LinearGradient(
              colors: const [
                AHColors.shimmerBase,
                AHColors.shimmerHighlight,
                AHColors.shimmerGold,
                AHColors.shimmerHighlight,
                AHColors.shimmerBase,
              ],
              stops: [
                max(0, slidePercent - 0.3),
                max(0, slidePercent - 0.15),
                slidePercent,
                min(1, slidePercent + 0.15),
                min(1, slidePercent + 0.3),
              ],
              begin: Alignment.centerLeft,
              end: Alignment.centerRight,
            ).createShader(bounds);
          },
          child: child,
        );
      },
      child: widget.child,
    );
  }
}

// ─── Base Skeleton Box ───────────────────────────────────────────────────────

/// A single skeleton placeholder box with shimmer.
class SkeletonBox extends StatelessWidget {
  final double width;
  final double height;
  final double borderRadius;
  final Color baseColor;

  const SkeletonBox({
    super.key,
    this.width = double.infinity,
    this.height = 16,
    this.borderRadius = 4,
    this.baseColor = AHColors.shimmerBase,
  });

  @override
  Widget build(BuildContext context) {
    return ShimmerEffect(
      child: Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          color: baseColor,
          borderRadius: BorderRadius.circular(borderRadius),
        ),
      ),
    );
  }
}

/// A circular skeleton placeholder.
class SkeletonCircle extends StatelessWidget {
  final double size;
  final Color baseColor;

  const SkeletonCircle({
    super.key,
    this.size = 40,
    this.baseColor = AHColors.shimmerBase,
  });

  @override
  Widget build(BuildContext context) {
    return ShimmerEffect(
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: baseColor,
          shape: BoxShape.circle,
        ),
      ),
    );
  }
}

// ─── Table Skeleton ──────────────────────────────────────────────────────────

/// Skeleton for a data table with configurable rows and columns.
class TableSkeleton extends StatelessWidget {
  final int rows;
  final int columns;
  final bool showHeader;

  const TableSkeleton({
    super.key,
    this.rows = 5,
    this.columns = 4,
    this.showHeader = true,
  });

  @override
  Widget build(BuildContext context) {
    return ShimmerEffect(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header row
          if (showHeader)
            Container(
              padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
              decoration: BoxDecoration(
                color: AHColors.navy.withOpacity(0.08),
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(8),
                ),
              ),
              child: Row(
                children: List.generate(columns, (i) {
                  return Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      child: Container(
                        height: 14,
                        decoration: BoxDecoration(
                          color: AHColors.navy.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(3),
                        ),
                      ),
                    ),
                  );
                }),
              ),
            ),

          // Data rows
          ...List.generate(rows, (rowIndex) {
            return Container(
              padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 12),
              decoration: BoxDecoration(
                border: Border(
                  bottom: BorderSide(
                    color: AHColors.border.withOpacity(0.5),
                    width: 1,
                  ),
                ),
              ),
              child: Row(
                children: List.generate(columns, (colIndex) {
                  // Vary width per column for realism
                  final widthFactor = colIndex == 0
                      ? 0.6
                      : colIndex == columns - 1
                          ? 0.4
                          : 0.8;
                  return Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      child: FractionallySizedBox(
                        widthFactor: widthFactor,
                        alignment: Alignment.centerLeft,
                        child: Container(
                          height: 12,
                          decoration: BoxDecoration(
                            color: AHColors.shimmerBase,
                            borderRadius: BorderRadius.circular(3),
                          ),
                        ),
                      ),
                    ),
                  );
                }),
              ),
            );
          }),
        ],
      ),
    );
  }
}

// ─── Card Skeleton ───────────────────────────────────────────────────────────

/// Skeleton for a card with colored badge and gold corner accent.
class CardSkeleton extends StatelessWidget {
  final double height;

  const CardSkeleton({
    super.key,
    this.height = 160,
  });

  @override
  Widget build(BuildContext context) {
    return ShimmerEffect(
      child: Container(
        height: height,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AHColors.border),
        ),
        child: Stack(
          children: [
            // Content
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Title line + badge
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      // Title
                      Container(
                        width: 120,
                        height: 16,
                        decoration: BoxDecoration(
                          color: AHColors.shimmerBase,
                          borderRadius: BorderRadius.circular(3),
                        ),
                      ),
                      // Colored badge
                      Container(
                        width: 48,
                        height: 20,
                        decoration: BoxDecoration(
                          color: AHColors.blue.withOpacity(0.2),
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  // Value line
                  Container(
                    width: 80,
                    height: 28,
                    decoration: BoxDecoration(
                      color: AHColors.shimmerBase,
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
                  const SizedBox(height: 8),
                  // Subtitle line
                  Container(
                    width: 140,
                    height: 12,
                    decoration: BoxDecoration(
                      color: AHColors.shimmerBase.withOpacity(0.7),
                      borderRadius: BorderRadius.circular(3),
                    ),
                  ),
                  const Spacer(),
                  // Bottom indicator bar
                  Container(
                    height: 4,
                    decoration: BoxDecoration(
                      color: AHColors.shimmerBase.withOpacity(0.5),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ],
              ),
            ),
            // Gold corner accent
            Positioned(
              top: 0,
              right: 0,
              child: Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      AHColors.gold.withOpacity(0.3),
                      Colors.transparent,
                    ],
                    begin: Alignment.topRight,
                    end: Alignment.bottomLeft,
                  ),
                  borderRadius: const BorderRadius.only(
                    topRight: Radius.circular(12),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── List Skeleton ───────────────────────────────────────────────────────────

/// Skeleton for a list with avatar, text, and badge.
class ListSkeleton extends StatelessWidget {
  final int items;

  const ListSkeleton({
    super.key,
    this.items = 5,
  });

  @override
  Widget build(BuildContext context) {
    return ShimmerEffect(
      child: Column(
        children: List.generate(items, (index) {
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
            child: Row(
              children: [
                // Avatar
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: AHColors.shimmerBase,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 12),
                // Text lines
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: double.infinity,
                        height: 14,
                        decoration: BoxDecoration(
                          color: AHColors.shimmerBase,
                          borderRadius: BorderRadius.circular(3),
                        ),
                      ),
                      const SizedBox(height: 6),
                      Container(
                        width: 180,
                        height: 12,
                        decoration: BoxDecoration(
                          color: AHColors.shimmerBase.withOpacity(0.7),
                          borderRadius: BorderRadius.circular(3),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                // Badge
                Container(
                  width: 56,
                  height: 24,
                  decoration: BoxDecoration(
                    color: AHColors.gold.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ],
            ),
          );
        }),
      ),
    );
  }
}

// ─── Dashboard Skeleton ──────────────────────────────────────────────────────

/// Full dashboard skeleton: cards row + chart + table.
class DashboardSkeleton extends StatelessWidget {
  final int cardCount;

  const DashboardSkeleton({
    super.key,
    this.cardCount = 4,
  });

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final isPhone = width < 600;

    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Stat cards
          if (isPhone)
            ...List.generate(
              cardCount,
              (_) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: CardSkeleton(height: 120),
              ),
            )
          else
            SizedBox(
              height: 160,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: cardCount,
                separatorBuilder: (_, __) => const SizedBox(width: 12),
                itemBuilder: (_, __) => const SizedBox(
                  width: 220,
                  child: CardSkeleton(),
                ),
              ),
            ),

          const SizedBox(height: 24),

          // Chart placeholder
          ShimmerEffect(
            child: Container(
              height: 200,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AHColors.border),
              ),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 120,
                      height: 16,
                      decoration: BoxDecoration(
                        color: AHColors.shimmerBase,
                        borderRadius: BorderRadius.circular(3),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Expanded(
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: List.generate(7, (i) {
                          final heights = [0.4, 0.7, 0.5, 0.9, 0.6, 0.8, 0.3];
                          return Expanded(
                            child: Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 3),
                              child: FractionallySizedBox(
                                heightFactor: heights[i],
                                alignment: Alignment.bottomCenter,
                                child: Container(
                                  decoration: BoxDecoration(
                                    color: AHColors.navy.withOpacity(0.15),
                                    borderRadius: BorderRadius.circular(3),
                                  ),
                                ),
                              ),
                            ),
                          );
                        }),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),

          const SizedBox(height: 24),

          // Table
          const TableSkeleton(rows: 5, columns: 4),
        ],
      ),
    );
  }
}

// ─── Mobile Dashboard Skeleton ───────────────────────────────────────────────

/// Compact dashboard skeleton for phone screens.
class DashboardSkeletonMobile extends StatelessWidget {
  const DashboardSkeletonMobile({super.key});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      child: Column(
        children: [
          // Quick stats row
          Row(
            children: List.generate(
              2,
              (_) => Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(6),
                  child: CardSkeleton(height: 100),
                ),
              ),
            ),
          ),
          // Quick actions placeholder
          Padding(
            padding: const EdgeInsets.all(12),
            child: ShimmerEffect(
              child: Container(
                height: 48,
                decoration: BoxDecoration(
                  color: AHColors.shimmerBase,
                  borderRadius: BorderRadius.circular(24),
                ),
              ),
            ),
          ),
          // List items
          const ListSkeleton(items: 4),
        ],
      ),
    );
  }
}

// ─── Module Skeleton ─────────────────────────────────────────────────────────

/// Skeleton for a full module page: header + cards + charts + table.
class ModuleSkeleton extends StatelessWidget {
  final String moduleName;

  const ModuleSkeleton({
    super.key,
    this.moduleName = '',
  });

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Module header
          ShimmerEffect(
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AHColors.border),
              ),
              child: Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: AHColors.navy.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 160,
                          height: 18,
                          decoration: BoxDecoration(
                            color: AHColors.shimmerBase,
                            borderRadius: BorderRadius.circular(3),
                          ),
                        ),
                        const SizedBox(height: 6),
                        Container(
                          width: 100,
                          height: 12,
                          decoration: BoxDecoration(
                            color: AHColors.shimmerBase.withOpacity(0.7),
                            borderRadius: BorderRadius.circular(3),
                          ),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      color: AHColors.shimmerBase,
                      shape: BoxShape.circle,
                    ),
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 16),

          // Stat cards
          const CardSkeleton(height: 130),

          const SizedBox(height: 16),

          // Chart
          ShimmerEffect(
            child: Container(
              height: 180,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AHColors.border),
              ),
            ),
          ),

          const SizedBox(height: 16),

          // Table
          const TableSkeleton(rows: 4, columns: 3),
        ],
      ),
    );
  }
}

// ─── Form Skeleton ───────────────────────────────────────────────────────────

/// Skeleton for a form with fields and action buttons.
class FormSkeleton extends StatelessWidget {
  final int fields;
  final bool hasActions;

  const FormSkeleton({
    super.key,
    this.fields = 5,
    this.hasActions = true,
  });

  @override
  Widget build(BuildContext context) {
    return ShimmerEffect(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Form fields
          ...List.generate(fields, (index) {
            return Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Label
                  Container(
                    width: 100 + (index * 10 % 60),
                    height: 14,
                    decoration: BoxDecoration(
                      color: AHColors.shimmerBase,
                      borderRadius: BorderRadius.circular(3),
                    ),
                  ),
                  const SizedBox(height: 8),
                  // Input field
                  Container(
                    height: 48,
                    decoration: BoxDecoration(
                      color: AHColors.shimmerBase.withOpacity(0.5),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: AHColors.border),
                    ),
                  ),
                ],
              ),
            );
          }),

          // Action buttons
          if (hasActions) ...[
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                // Cancel button
                Container(
                  width: 100,
                  height: 44,
                  decoration: BoxDecoration(
                    color: AHColors.shimmerBase,
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
                const SizedBox(width: 12),
                // Submit button
                Container(
                  width: 120,
                  height: 44,
                  decoration: BoxDecoration(
                    color: AHColors.navy.withOpacity(0.3),
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
