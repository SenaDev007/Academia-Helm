import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/error_widget.dart' as ah_error;
import '../providers/payments_provider.dart';
import '../widgets/payment_status_badge.dart';

/// Screen showing payment details.
///
/// Features:
/// - Status badge at top (color coded)
/// - Amount display
/// - Details: label, due date, paid date, payment method, transaction ref
/// - Download receipt button (for paid items)
/// - Share button
class PaymentDetailScreen extends ConsumerWidget {
  const PaymentDetailScreen({super.key, required this.paymentId});

  final String paymentId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final paymentAsync = ref.watch(paymentDetailProvider(paymentId));

    return Scaffold(
      backgroundColor: AHColors.lightBackground,
      body: paymentAsync.when(
        loading: () => const Center(
          child: CircularProgressIndicator(color: AHColors.navy),
        ),
        error: (error, _) => ah_error.AHErrorWidget(
          message: 'Impossible de charger le détail du paiement.',
          onRetry: () => ref.invalidate(paymentDetailProvider(paymentId)),
        ),
        data: (payment) => _PaymentDetailContent(payment: payment),
      ),
    );
  }
}

class _PaymentDetailContent extends StatelessWidget {
  const _PaymentDetailContent({required this.payment});

  final Payment payment;

  Color get _statusColor {
    switch (payment.status) {
      case PaymentStatus.paid:
        return AHColors.success;
      case PaymentStatus.pending:
        return AHColors.warning;
      case PaymentStatus.partial:
        return AHColors.info;
      case PaymentStatus.overdue:
        return AHColors.error;
    }
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      child: Column(
        children: [
          // ── Header ──────────────────────────────────────────────────
          _PaymentDetailHeader(status: payment.status, statusColor: _statusColor),

          // ── Amount Card ─────────────────────────────────────────────
          Container(
            margin: const EdgeInsets.all(AHSpacing.lg),
            padding: const EdgeInsets.all(AHSpacing.xl),
            decoration: BoxDecoration(
              color: AHColors.white,
              borderRadius: BorderRadius.circular(AHSpacing.r16),
              boxShadow: [
                BoxShadow(
                  color: AHColors.navy.withOpacity(0.06),
                  offset: const Offset(0, 2),
                  blurRadius: 8,
                ),
              ],
            ),
            child: Column(
              children: [
                PaymentStatusBadge(status: payment.status),
                const SizedBox(height: AHSpacing.lg),
                Text(
                  AHFormatters.formatCurrency(payment.amount),
                  style: const TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 32,
                    fontWeight: FontWeight.w800,
                    color: AHColors.grey900,
                  ),
                ),
                if (payment.isPartial) ...[
                  const SizedBox(height: AHSpacing.sm),
                  Text(
                    'Payé : ${AHFormatters.formatCurrency(payment.paidAmount)} — Reste : ${AHFormatters.formatCurrency(payment.remainingAmount)}',
                    style: const TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                      color: AHColors.info,
                    ),
                  ),
                  const SizedBox(height: AHSpacing.md),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(AHSpacing.r4),
                    child: LinearProgressIndicator(
                      value: payment.progressPercentage / 100,
                      backgroundColor: AHColors.grey200,
                      color: AHColors.info,
                      minHeight: 8,
                    ),
                  ),
                ],
              ],
            ),
          ),

          // ── Details Section ─────────────────────────────────────────
          Container(
            margin: const EdgeInsets.symmetric(horizontal: AHSpacing.lg),
            padding: const EdgeInsets.all(AHSpacing.lg),
            decoration: BoxDecoration(
              color: AHColors.white,
              borderRadius: BorderRadius.circular(AHSpacing.r16),
              boxShadow: [
                BoxShadow(
                  color: AHColors.navy.withOpacity(0.06),
                  offset: const Offset(0, 2),
                  blurRadius: 8,
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Détails du paiement',
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: AHColors.grey900,
                  ),
                ),
                const SizedBox(height: AHSpacing.md),
                const Divider(height: 1, color: AHColors.lightOutline),
                const SizedBox(height: AHSpacing.md),

                _DetailRow(
                  icon: Icons.receipt_outlined,
                  label: 'Libellé',
                  value: payment.label,
                ),
                _DetailRow(
                  icon: Icons.person_outline,
                  label: 'Élève',
                  value: payment.studentName,
                ),
                _DetailRow(
                  icon: Icons.event_outlined,
                  label: 'Date d\'échéance',
                  value: AHFormatters.formatDateDisplay(payment.dueDate),
                  valueColor: payment.isOverdue ? AHColors.error : null,
                ),
                if (payment.paidDate != null)
                  _DetailRow(
                    icon: Icons.check_circle_outline,
                    label: 'Date de paiement',
                    value: AHFormatters.formatDateDisplay(payment.paidDate!),
                    valueColor: AHColors.success,
                  ),
                if (payment.paymentMethod != null)
                  _DetailRow(
                    icon: Icons.payment_outlined,
                    label: 'Mode de paiement',
                    value: payment.paymentMethod!,
                  ),
                if (payment.transactionRef != null)
                  _DetailRow(
                    icon: Icons.tag_outlined,
                    label: 'Référence',
                    value: payment.transactionRef!,
                  ),
                if (payment.academicYearName != null)
                  _DetailRow(
                    icon: Icons.school_outlined,
                    label: 'Année scolaire',
                    value: payment.academicYearName!,
                  ),
              ],
            ),
          ),

          const SizedBox(height: AHSpacing.xl),

          // ── Action Buttons ──────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: AHSpacing.lg),
            child: Column(
              children: [
                if (payment.isPaid)
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: () {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('Téléchargement du reçu...'),
                          ),
                        );
                      },
                      icon: const Icon(Icons.download_outlined, size: 18),
                      label: const Text('Télécharger le reçu'),
                      style: FilledButton.styleFrom(
                        backgroundColor: AHColors.navy,
                        foregroundColor: AHColors.white,
                        padding: const EdgeInsets.symmetric(vertical: AHSpacing.md),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(AHSpacing.r8),
                        ),
                        textStyle: const TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                if (payment.isPaid) const SizedBox(height: AHSpacing.md),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: () {
                      Share.share(
                        '${payment.label}\nMontant : ${AHFormatters.formatCurrency(payment.amount)}\nStatut : ${payment.status.label}',
                        subject: 'Paiement — ${payment.label}',
                      );
                    },
                    icon: const Icon(Icons.share_outlined, size: 18),
                    label: const Text('Partager'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AHColors.navy,
                      side: const BorderSide(color: AHColors.navy, width: 1.5),
                      padding: const EdgeInsets.symmetric(vertical: AHSpacing.md),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(AHSpacing.r8),
                      ),
                      textStyle: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: AHSpacing.xxl),
        ],
      ),
    );
  }
}

// ── Header ────────────────────────────────────────────────────────────

class _PaymentDetailHeader extends StatelessWidget {
  const _PaymentDetailHeader({
    required this.status,
    required this.statusColor,
  });

  final PaymentStatus status;
  final Color statusColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(
        AHSpacing.xl,
        AHSpacing.xl + 12,
        AHSpacing.xl,
        AHSpacing.xl,
      ),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [statusColor.withOpacity(0.85), statusColor],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: const BorderRadius.only(
          bottomLeft: Radius.circular(AHSpacing.r24),
          bottomRight: Radius.circular(AHSpacing.r24),
        ),
      ),
      child: SafeArea(
        bottom: false,
        child: Row(
          children: [
            IconButton(
              icon: const Icon(Icons.arrow_back, color: AHColors.white),
              onPressed: () => context.pop(),
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(),
            ),
            const SizedBox(width: AHSpacing.md),
            const Expanded(
              child: Text(
                'Détail du paiement',
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  color: AHColors.white,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Detail Row ────────────────────────────────────────────────────────

class _DetailRow extends StatelessWidget {
  const _DetailRow({
    required this.icon,
    required this.label,
    required this.value,
    this.valueColor,
  });

  final IconData icon;
  final String label;
  final String value;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AHSpacing.md),
      child: Row(
        children: [
          Icon(icon, size: 20, color: AHColors.grey500),
          const SizedBox(width: AHSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                    color: AHColors.grey500,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                    color: valueColor ?? AHColors.grey900,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
