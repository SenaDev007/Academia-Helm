import 'package:flutter/material.dart';

import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../providers/payments_provider.dart';

/// A badge widget showing payment status with appropriate color.
///
/// Color mapping:
/// - PENDING: warning/amber
/// - PARTIAL: info/blue
/// - PAID: success/green
/// - OVERDUE: error/red
class PaymentStatusBadge extends StatelessWidget {
  const PaymentStatusBadge({
    super.key,
    required this.status,
    this.compact = false,
  });

  final PaymentStatus status;
  final bool compact;

  Color get _backgroundColor {
    switch (status) {
      case PaymentStatus.paid:
        return AHColors.successLight;
      case PaymentStatus.pending:
        return AHColors.warningLight;
      case PaymentStatus.partial:
        return AHColors.infoLight;
      case PaymentStatus.overdue:
        return AHColors.errorLight;
    }
  }

  Color get _textColor {
    switch (status) {
      case PaymentStatus.paid:
        return AHColors.successDark;
      case PaymentStatus.pending:
        return AHColors.warningDark;
      case PaymentStatus.partial:
        return AHColors.infoDark;
      case PaymentStatus.overdue:
        return AHColors.errorDark;
    }
  }

  IconData get _icon {
    switch (status) {
      case PaymentStatus.paid:
        return Icons.check_circle_outline;
      case PaymentStatus.pending:
        return Icons.schedule;
      case PaymentStatus.partial:
        return Icons.pending_outlined;
      case PaymentStatus.overdue:
        return Icons.warning_amber_outlined;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: compact ? AHSpacing.sm : AHSpacing.md,
        vertical: compact ? 3 : AHSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: _backgroundColor,
        borderRadius: BorderRadius.circular(AHSpacing.r8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (!compact) ...[
            Icon(_icon, size: 14, color: _textColor),
            const SizedBox(width: AHSpacing.xs),
          ],
          Text(
            status.label,
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: compact ? 10 : 12,
              fontWeight: FontWeight.w600,
              color: _textColor,
            ),
          ),
        ],
      ),
    );
  }
}
