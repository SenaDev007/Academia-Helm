import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shimmer/shimmer.dart';

import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/empty_state_widget.dart';
import '../../../core/widgets/error_widget.dart' as ah_error;
import '../providers/payments_provider.dart';
import '../widgets/payment_card.dart';

/// Screen displaying a list of payments/invoices.
///
/// Features:
/// - Filter chips: Tous, En attente, Payé, En retard
/// - Summary card at top showing total pending amount
/// - List of payment cards
/// - Pull-to-refresh
/// - Loading/empty/error states
class PaymentsListScreen extends ConsumerWidget {
  const PaymentsListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedFilter = ref.watch(selectedPaymentFilterProvider);
    final paymentsAsync = ref.watch(paymentsListProvider(selectedFilter));
    final summaryAsync = ref.watch(pendingPaymentsSummaryProvider);

    return Scaffold(
      backgroundColor: AHColors.lightBackground,
      body: Column(
        children: [
          // ── Header ──────────────────────────────────────────────────
          const _PaymentsHeader(),

          // ── Summary Card ────────────────────────────────────────────
          summaryAsync.when(
            data: (summary) => _SummaryCard(summary: summary),
            loading: () => const SizedBox.shrink(),
            error: (_, __) => const SizedBox.shrink(),
          ),

          // ── Filter Chips ────────────────────────────────────────────
          _PaymentFilterChips(
            selectedFilter: selectedFilter,
            onFilterChanged: (filter) {
              ref.read(selectedPaymentFilterProvider.notifier).state = filter;
            },
          ),

          // ── Payments List ──────────────────────────────────────────
          Expanded(
            child: paymentsAsync.when(
              loading: () => const _PaymentsListShimmer(),
              error: (error, _) => ah_error.AHErrorWidget(
                message: 'Impossible de charger les paiements.',
                onRetry: () => ref.invalidate(paymentsListProvider(selectedFilter)),
              ),
              data: (payments) {
                if (payments.isEmpty) {
                  return const AHEmptyState(
                    icon: Icons.payment_outlined,
                    title: 'Aucun paiement',
                    subtitle: 'Vos factures et paiements apparaîtront ici.',
                  );
                }
                return _PaymentsListContent(payments: payments);
              },
            ),
          ),
        ],
      ),
    );
  }
}

// ── Header ────────────────────────────────────────────────────────────

class _PaymentsHeader extends StatelessWidget {
  const _PaymentsHeader();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(
        AHSpacing.xl,
        AHSpacing.xl + 12,
        AHSpacing.xl,
        AHSpacing.lg,
      ),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [AHColors.navy, AHColors.blue],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(AHSpacing.r20),
          bottomRight: Radius.circular(AHSpacing.r20),
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
                'Paiements',
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                  color: AHColors.white,
                ),
              ),
            ),
            Container(
              padding: const EdgeInsets.all(AHSpacing.sm),
              decoration: BoxDecoration(
                color: AHColors.white.withOpacity(0.15),
                borderRadius: BorderRadius.circular(AHSpacing.r8),
              ),
              child: const Icon(
                Icons.receipt_long_outlined,
                color: AHColors.gold,
                size: 24,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Summary Card ──────────────────────────────────────────────────────

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({required this.summary});

  final PaymentsSummary summary;

  @override
  Widget build(BuildContext context) {
    final totalOwed = summary.totalPending + summary.totalOverdue;
    if (totalOwed <= 0) return const SizedBox.shrink();

    return Container(
      margin: const EdgeInsets.fromLTRB(
        AHSpacing.lg,
        AHSpacing.md,
        AHSpacing.lg,
        AHSpacing.xs,
      ),
      padding: const EdgeInsets.all(AHSpacing.md),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            AHColors.warningLight,
            AHColors.warningLight.withOpacity(0.5),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(AHSpacing.r12),
        border: Border.all(
          color: AHColors.warning.withOpacity(0.3),
        ),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(AHSpacing.sm),
            decoration: BoxDecoration(
              color: AHColors.warning.withOpacity(0.2),
              borderRadius: BorderRadius.circular(AHSpacing.r8),
            ),
            child: const Icon(
              Icons.account_balance_wallet_outlined,
              color: AHColors.warningDark,
              size: 24,
            ),
          ),
          const SizedBox(width: AHSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Montant en attente',
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: AHColors.warningDark,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  AHFormatters.formatCurrency(totalOwed),
                  style: const TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                    color: AHColors.warningDark,
                  ),
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              if (summary.overdueCount > 0)
                Text(
                  '${summary.overdueCount} en retard',
                  style: const TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: AHColors.error,
                  ),
                ),
              if (summary.pendingCount > 0)
                Text(
                  '${summary.pendingCount} en attente',
                  style: const TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                    color: AHColors.warningDark,
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

// ── Filter Chips ──────────────────────────────────────────────────────

class _PaymentFilterChips extends StatelessWidget {
  const _PaymentFilterChips({
    required this.selectedFilter,
    required this.onFilterChanged,
  });

  final PaymentFilter selectedFilter;
  final ValueChanged<PaymentFilter> onFilterChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(
        horizontal: AHSpacing.lg,
        vertical: AHSpacing.md,
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: PaymentFilter.values.map((filter) {
            final isSelected = filter == selectedFilter;
            return Padding(
              padding: const EdgeInsets.only(right: AHSpacing.sm),
              child: FilterChip(
                selected: isSelected,
                label: Text(filter.label),
                onSelected: (_) => onFilterChanged(filter),
                backgroundColor: AHColors.lightSurface,
                selectedColor: AHColors.navy.withOpacity(0.12),
                checkmarkColor: AHColors.navy,
                labelStyle: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 13,
                  fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
                  color: isSelected ? AHColors.navy : AHColors.grey600,
                ),
                side: BorderSide(
                  color: isSelected
                      ? AHColors.navy.withOpacity(0.3)
                      : AHColors.lightOutline,
                  width: 1,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AHSpacing.r8),
                ),
                padding: const EdgeInsets.symmetric(
                  horizontal: AHSpacing.md,
                  vertical: AHSpacing.xs,
                ),
              ),
            );
          }).toList(),
        ),
      ),
    );
  }
}

// ── Payments List Content ─────────────────────────────────────────────

class _PaymentsListContent extends ConsumerWidget {
  const _PaymentsListContent({required this.payments});

  final List<Payment> payments;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedFilter = ref.watch(selectedPaymentFilterProvider);

    return RefreshIndicator(
      color: AHColors.navy,
      onRefresh: () async {
        ref.invalidate(paymentsListProvider(selectedFilter));
        ref.invalidate(pendingPaymentsSummaryProvider);
      },
      child: ListView.separated(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.only(
          top: AHSpacing.sm,
          bottom: AHSpacing.xxl,
        ),
        itemCount: payments.length,
        separatorBuilder: (_, __) => const SizedBox(height: AHSpacing.xs),
        itemBuilder: (context, index) {
          final payment = payments[index];
          return PaymentCard(
            payment: payment,
            onTap: () => context.push('/payments/${payment.id}'),
          );
        },
      ),
    );
  }
}

// ── Loading Shimmer ───────────────────────────────────────────────────

class _PaymentsListShimmer extends StatelessWidget {
  const _PaymentsListShimmer();

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Shimmer.fromColors(
      baseColor: isDark ? AHColors.grey700 : AHColors.grey200,
      highlightColor: isDark ? AHColors.grey600 : AHColors.grey100,
      child: ListView.separated(
        physics: const NeverScrollableScrollPhysics(),
        padding: const EdgeInsets.all(AHSpacing.lg),
        itemCount: 5,
        separatorBuilder: (_, __) => const SizedBox(height: AHSpacing.md),
        itemBuilder: (context, index) {
          return Container(
            width: double.infinity,
            padding: const EdgeInsets.all(AHSpacing.md),
            decoration: BoxDecoration(
              color: AHColors.white,
              borderRadius: BorderRadius.circular(AHSpacing.r12),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Container(
                        height: 14,
                        decoration: BoxDecoration(
                          color: AHColors.white,
                          borderRadius: BorderRadius.circular(4),
                        ),
                      ),
                    ),
                    Container(
                      width: 60,
                      height: 20,
                      decoration: BoxDecoration(
                        color: AHColors.white,
                        borderRadius: BorderRadius.circular(AHSpacing.r8),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AHSpacing.sm),
                Container(
                  width: 160,
                  height: 22,
                  decoration: BoxDecoration(
                    color: AHColors.white,
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
                const SizedBox(height: AHSpacing.sm),
                Container(
                  width: 200,
                  height: 10,
                  decoration: BoxDecoration(
                    color: AHColors.white,
                    borderRadius: BorderRadius.circular(4),
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
