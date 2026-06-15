import 'package:flutter/material.dart';

import '../theme/ah_theme.dart';

/// Error display widget with retry button.
class AHErrorWidget extends StatelessWidget {
  const AHErrorWidget({
    super.key,
    required this.message,
    this.onRetry,
    this.icon = Icons.error_outline,
    this.title = 'Une erreur est survenue',
  });

  final String message;
  final VoidCallback? onRetry;
  final IconData icon;
  final String title;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AHSpacing.xxl),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: AHColors.errorLight,
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 36, color: AHColors.error),
            ),
            const SizedBox(height: AHSpacing.xl),
            Text(
              title,
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: AHColors.gray900,
                  ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AHSpacing.sm),
            Text(
              message,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: AHColors.gray500,
                  ),
              textAlign: TextAlign.center,
            ),
            if (onRetry != null) ...[
              const SizedBox(height: AHSpacing.xl),
              ElevatedButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh, size: 18),
                label: const Text('Réessayer'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Inline error banner for use inside forms or sections.
class AHErrorBanner extends StatelessWidget {
  const AHErrorBanner({
    super.key,
    required this.message,
    this.onDismiss,
  });

  final String message;
  final VoidCallback? onDismiss;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(
        horizontal: AHSpacing.lg,
        vertical: AHSpacing.md,
      ),
      decoration: BoxDecoration(
        color: AHColors.errorLight,
        borderRadius: BorderRadius.circular(AHRadius.md),
        border: Border.all(color: AHColors.error.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline, color: AHColors.error, size: 20),
          const SizedBox(width: AHSpacing.md),
          Expanded(
            child: Text(
              message,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AHColors.error,
                    fontWeight: FontWeight.w500,
                  ),
            ),
          ),
          if (onDismiss != null)
            IconButton(
              icon: const Icon(Icons.close, color: AHColors.error, size: 18),
              onPressed: onDismiss,
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(),
            ),
        ],
      ),
    );
  }
}
