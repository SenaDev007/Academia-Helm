import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/ah_theme.dart';
import '../providers/dashboard_provider.dart';

/// Quick action button widget.
class QuickActionButton extends StatelessWidget {
  const QuickActionButton({super.key, required this.action});

  final QuickAction action;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => context.go(action.route),
        borderRadius: BorderRadius.circular(AHRadius.lg),
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: AHSpacing.lg,
            vertical: AHSpacing.md,
          ),
          decoration: BoxDecoration(
            color: AHColors.navy.withValues(alpha: 0.04),
            borderRadius: BorderRadius.circular(AHRadius.lg),
            border: Border.all(
              color: AHColors.navy.withValues(alpha: 0.08),
            ),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: AHColors.navy.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(AHRadius.md),
                ),
                child: Icon(
                  action.icon,
                  color: AHColors.navy,
                  size: 22,
                ),
              ),
              const SizedBox(height: AHSpacing.sm),
              Text(
                action.label,
                style: const TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: AHColors.navy,
                ),
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
