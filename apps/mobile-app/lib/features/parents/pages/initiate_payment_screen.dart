/// ============================================================================
/// INITIATE PAYMENT SCREEN — Écran "Initier un paiement" (parent)
/// ============================================================================
///
/// Le parent voit le solde restant à payer pour son enfant et peut
/// initier un paiement en ligne (FedaPay).
///
/// ============================================================================

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../../../core/widgets/loading/async_value_widget.dart';
import '../../../data/datasources/remote/payment_api.dart';
import '../providers/children_provider.dart';
import '../../../domain/entities/child.dart';

class InitiatePaymentScreen extends ConsumerStatefulWidget {
  const InitiatePaymentScreen({super.key});

  @override
  ConsumerState<InitiatePaymentScreen> createState() => _InitiatePaymentScreenState();
}

class _InitiatePaymentScreenState extends ConsumerState<InitiatePaymentScreen> {
  String? _selectedChildId;

  @override
  Widget build(BuildContext context) {
    final childrenAsync = ref.watch(childrenProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Paiements')),
      body: AsyncValueWidget<List<Child>>(
        value: childrenAsync,
        builder: (children) {
          if (children.isEmpty) {
            return Center(child: Text('Aucun enfant', style: TextStyle(color: AHColors.gray500)));
          }

          _selectedChildId ??= children.first.id;

          return Column(
            children: [
              // Sélecteur enfant
              Padding(
                padding: const EdgeInsets.all(AHSpacing.md),
                child: DropdownButtonFormField<String>(
                  value: _selectedChildId,
                  decoration: const InputDecoration(
                    labelText: 'Enfant',
                    prefixIcon: Icon(Icons.child_care),
                  ),
                  items: children.map((c) => DropdownMenuItem(
                    value: c.id,
                    child: Text(c.displayName),
                  )).toList(),
                  onChanged: (v) => setState(() => _selectedChildId = v),
                ),
              ),

              // Solde + paiements
              Expanded(child: _PaymentContent(childId: _selectedChildId!)),
            ],
          );
        },
      ),
    );
  }
}

class _PaymentContent extends ConsumerWidget {
  const _PaymentContent({required this.childId});

  final String childId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final paymentApi = ref.watch(paymentApiProvider);
    final paymentsFuture = paymentApi.getPayments(childId);

    return FutureBuilder(
      future: paymentsFuture,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }

        return snapshot.data?.when(
          success: (payments) {
            // Calculer le solde
            final totalDue = payments.fold<double>(0, (sum, p) => sum + (p.amount ?? 0));
            final paid = payments.where((p) => p.status == 'PAID').fold<double>(0, (sum, p) => sum + (p.amount ?? 0));
            final remaining = totalDue - paid;

            return ListView(
              padding: const EdgeInsets.all(AHSpacing.md),
              children: [
                // Carte solde
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(AHSpacing.md),
                    child: Column(
                      children: [
                        Text('Solde restant', style: TextStyle(fontSize: 12, color: AHColors.gray500)),
                        const SizedBox(height: 8),
                        Text(
                          '${remaining.toStringAsFixed(0)} FCFA',
                          style: TextStyle(
                            fontSize: 32,
                            fontWeight: FontWeight.bold,
                            color: remaining > 0 ? Colors.red : Colors.green,
                          ),
                        ),
                        const SizedBox(height: 16),

                        // Bouton payer
                        if (remaining > 0)
                          SizedBox(
                            width: double.infinity,
                            child: ElevatedButton.icon(
                              onPressed: () => _initiatePayment(context, ref),
                              icon: const Icon(Icons.payment),
                              label: const Text('Payer maintenant'),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AHColors.navy,
                                foregroundColor: Colors.white,
                                padding: const EdgeInsets.symmetric(vertical: 14),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: AHSpacing.md),

                // Historique
                Text('Historique des paiements', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold)),
                const SizedBox(height: AHSpacing.sm),

                ...payments.map((p) => Card(
                  child: ListTile(
                    leading: Icon(
                      p.status == 'PAID' ? Icons.check_circle : Icons.pending,
                      color: p.status == 'PAID' ? Colors.green : Colors.orange,
                    ),
                    title: Text(p.label ?? 'Paiement', style: const TextStyle(fontWeight: FontWeight.w600)),
                    subtitle: Text(
                      '${p.amount?.toStringAsFixed(0) ?? 0} FCFA',
                      style: TextStyle(color: AHColors.gray600),
                    ),
                    trailing: p.status == 'PAID'
                        ? TextButton(
                            onPressed: () => _downloadReceipt(context, ref, p.id ?? ''),
                            child: const Text('Reçu'),
                          )
                        : null,
                  ),
                )),
              ],
            );
          },
          failure: (error) => Center(child: Text('Erreur: ${error.message}')),
          loading: () => const Center(child: CircularProgressIndicator()),
        ) ?? Center(child: Text('Aucune donnée', style: TextStyle(color: AHColors.gray500)));
      },
    );
  }

  void _initiatePayment(BuildContext context, WidgetRef ref) async {
    // TODO: intégrer FedaPay Checkout (webview ou URL)
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Paiement en ligne — redirection vers FedaPay...'),
        backgroundColor: Colors.blue,
      ),
    );

    // Pour l'instant, ouvrir la page web de paiement
    const paymentUrl = 'https://app.academiahelm.com/app/parent/payments';
    if (await canLaunchUrl(Uri.parse(paymentUrl))) {
      await launchUrl(Uri.parse(paymentUrl), mode: LaunchMode.externalApplication);
    }
  }

  void _downloadReceipt(BuildContext context, WidgetRef ref, String paymentId) async {
    final api = ref.read(paymentApiProvider);
    final result = await api.getPaymentReceipt(childId, paymentId);

    if (!context.mounted) return;

    result.when(
      success: (receiptUrl) {
        launchUrl(Uri.parse(receiptUrl), mode: LaunchMode.externalApplication);
      },
      failure: (error) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erreur: ${error.message}'), backgroundColor: Colors.red),
        );
      },
      loading: () {},
    );
  }
}
