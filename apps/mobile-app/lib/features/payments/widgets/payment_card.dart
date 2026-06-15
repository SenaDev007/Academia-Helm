import 'package:flutter/material.dart';

import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../../../core/utils/formatters.dart';
import '../providers/payments_provider.dart';
import 'payment_status_badge.dart';

/// A card for a payment list item.
///
/// Shows label, amount, status badge (color coded), due date if pending,
/// payment method if paid, and progress bar for partial payments.
class PaymentCard extends StatelessWidget {
  const PaymentCard({
    super.key,
    required this.payment,
    this.onTap,
  });

  final Payment payment;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(
        horizontal: AHSpacing.lg,
        vertical: AHSpacing.xs,
      ),
      elevation: AHSpacing.elevationNone,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AHSpacing.r12),
        side: BorderSide(
          color: AHColors.lightOutline.withOpacity(0.5),
          width: 0.5,
        ),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AHSpacing.r12),
        child: Padding(
          padding: const EdgeInsets.all(AHSpacing.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Top Row: Label + Status Badge ──────────────────────
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Text(
                      payment.label,
                      style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: AHColors.grey900,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const SizedBox(width: AHSpacing.sm),
                  PaymentStatusBadge(status: payment.status, compact: true),
                ],
              ),

              const SizedBox(height: AHSpacing.sm),

              // ── Amount Row ─────────────────────────────────────────
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    AHFormatters.formatCurrency(payment.amount),
                    style: const TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: AHColors.navy,
                    ),
                  ),
                  if (payment.isPartial) ...[
                    const SizedBox(width: AHSpacing.sm),
                    Padding(
                      padding: const EdgeInsets.only(bottom: 2),
                      child: Text(
                        'Payé : ${AHFormatters.formatCurrency(payment.paidAmount)}',
                        style: const TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                          color: AHColors.success,
                        ),
                      ),
                    ),
                  ],
                ],
              ),

              // ── Progress Bar for Partial Payments ──────────────────
              if (payment.isPartial) ...[
                const SizedBox(height: AHSpacing.sm),
                ClipRRect(
                  borderRadius: BorderRadius.circular(AHSpacing.r4),
                  child: LinearProgressIndicator(
                    value: payment.progressPercentage / 100,
                    backgroundColor: AHColors.grey200,
                    color: AHColors.info,
                    minHeight: 6,
                  ),
                ),
              ],

              const SizedBox(height: AHSpacing.sm),

              // ── Bottom Row: Due Date or Payment Method ─────────────
              Row(
                children: [
                  if (payment.isPending || payment.isOverdue) ...[
                    Icon(
                      Icons.event_outlined,
                      size: 14,
                      color: payment.isOverdue ? AHColors.error : AHColors.grey500,
                    ),
                    const SizedBox(width: AHSpacing.xs),
                    Text(
                      'Échéance : ${AHFormatters.formatDateDisplay(payment.dueDate)}',
                      style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 12,
                        fontWeight: FontWeight.w400,
                        color: payment.isOverdue ? AHColors.error : AHColors.grey500,
                      ),
                    ),
                  ] else if (payment.isPaid) ...[
                    Icon(
                      Icons.check_circle_outline,
                      size: 14,
                      color: AHColors.success,
                    ),
                    const SizedBox(width: AHSpacing.xs),
                    Text(
                      'Payé le ${payment.paidDate != null ? AHFormatters.formatDateDisplay(payment.paidDate!) : "—"}',
                      style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 12,
                        fontWeight: FontWeight.w400,
                        color: AHColors.success,
                      ),
                    ),
                    if (payment.paymentMethod != null) ...[
                      const SizedBox(width: AHSpacing.md),
                      Icon(
                        Icons.payment_outlined,
                        size: 14,
                        color: AHColors.grey500,
                      ),
                      const SizedBox(width: AHSpacing.xs),
                      Flexible(
                        child: Text(
                          payment.paymentMethod!,
                          style: const TextStyle(
                            fontFamily: 'Inter',
                            fontSize: 12,
                            fontWeight: FontWeight.w400,
                            color: AHColors.grey500,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ] else if (payment.isPartial) ...[
                    Icon(
                      Icons.event_outlined,
                      size: 14,
                      color: AHColors.grey500,
                    ),
                    const SizedBox(width: AHSpacing.xs),
                    Text(
                      'Reste : ${AHFormatters.formatCurrency(payment.remainingAmount)}',
                      style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                        color: AHColors.info,
                      ),
                    ),
                  ],
                  const Spacer(),
                  Icon(
                    Icons.chevron_right,
                    color: AHColors.grey400,
                    size: AHSpacing.icon20,
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
