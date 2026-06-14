import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';

import '../theme/ah_theme.dart';

/// Full screen loading overlay.
class AHFullScreenLoading extends StatelessWidget {
  const AHFullScreenLoading({super.key, this.message});

  final String? message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const SizedBox(
            width: 40,
            height: 40,
            child: CircularProgressIndicator(
              color: AHColors.navy,
              strokeWidth: 3,
            ),
          ),
          if (message != null) ...[
            const SizedBox(height: AHSpacing.lg),
            Text(
              message!,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: AHColors.gray500,
                  ),
            ),
          ],
        ],
      ),
    );
  }
}

/// Card loading shimmer effect.
class AHCardShimmer extends StatelessWidget {
  const AHCardShimmer({super.key});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Shimmer.fromColors(
      baseColor: isDark ? AHColors.darkCard : AHColors.gray200,
      highlightColor: isDark ? AHColors.gray700 : AHColors.gray100,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(AHSpacing.lg),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(AHRadius.lg),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Title placeholder
            Container(
              width: 180,
              height: 16,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(4),
              ),
            ),
            const SizedBox(height: AHSpacing.md),
            // Value placeholder
            Container(
              width: 80,
              height: 28,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(4),
              ),
            ),
            const SizedBox(height: AHSpacing.sm),
            // Subtitle placeholder
            Container(
              width: 120,
              height: 12,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(4),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// List loading shimmer effect.
class AHListShimmer extends StatelessWidget {
  const AHListShimmer({super.key, this.itemCount = 5});

  final int itemCount;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Shimmer.fromColors(
      baseColor: isDark ? AHColors.darkCard : AHColors.gray200,
      highlightColor: isDark ? AHColors.gray700 : AHColors.gray100,
      child: ListView.separated(
        physics: const NeverScrollableScrollPhysics(),
        shrinkWrap: true,
        itemCount: itemCount,
        separatorBuilder: (_, __) => const SizedBox(height: AHSpacing.md),
        itemBuilder: (context, index) {
          return Container(
            width: double.infinity,
            padding: const EdgeInsets.all(AHSpacing.lg),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(AHRadius.lg),
            ),
            child: Row(
              children: [
                // Circle placeholder
                Container(
                  width: 44,
                  height: 44,
                  decoration: const BoxDecoration(
                    color: Colors.white,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: AHSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Title
                      Container(
                        width: double.infinity,
                        height: 14,
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(4),
                        ),
                      ),
                      const SizedBox(height: AHSpacing.sm),
                      // Subtitle
                      Container(
                        width: 160,
                        height: 12,
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(4),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

/// Grid loading shimmer effect.
class AHGridShimmer extends StatelessWidget {
  const AHGridShimmer({super.key, this.crossAxisCount = 2, this.itemCount = 4});

  final int crossAxisCount;
  final int itemCount;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Shimmer.fromColors(
      baseColor: isDark ? AHColors.darkCard : AHColors.gray200,
      highlightColor: isDark ? AHColors.gray700 : AHColors.gray100,
      child: GridView.count(
        physics: const NeverScrollableScrollPhysics(),
        shrinkWrap: true,
        crossAxisCount: crossAxisCount,
        mainAxisSpacing: AHSpacing.md,
        crossAxisSpacing: AHSpacing.md,
        childAspectRatio: 1.4,
        children: List.generate(itemCount, (_) {
          return Container(
            width: double.infinity,
            padding: const EdgeInsets.all(AHSpacing.lg),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(AHRadius.lg),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(AHRadius.md),
                  ),
                ),
                const SizedBox(height: AHSpacing.md),
                Container(
                  width: double.infinity,
                  height: 20,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
                const SizedBox(height: AHSpacing.sm),
                Container(
                  width: 80,
                  height: 12,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(4),
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
