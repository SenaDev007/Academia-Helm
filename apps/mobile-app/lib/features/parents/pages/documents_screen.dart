/// ============================================================================
/// DOCUMENTS SCREEN — Écran "Documents" (parent)
/// ============================================================================
///
/// Le parent peut télécharger des documents liés à ses enfants :
/// - Certificat de scolarité
/// - Attestation de paiement
/// - Bulletins de notes
/// - Carnet de liaison
///
/// ============================================================================

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../../../core/widgets/loading/async_value_widget.dart';
import '../providers/children_provider.dart';
import '../../../domain/entities/child.dart';

class DocumentsScreen extends ConsumerStatefulWidget {
  const DocumentsScreen({super.key});

  @override
  ConsumerState<DocumentsScreen> createState() => _DocumentsScreenState();
}

class _DocumentsScreenState extends ConsumerState<DocumentsScreen> {
  String? _selectedChildId;

  @override
  Widget build(BuildContext context) {
    final childrenAsync = ref.watch(childrenProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Documents')),
      body: AsyncValueWidget<List<Child>>(
        value: childrenAsync,
        builder: (children) {
          if (children.isEmpty) {
            return Center(
              child: Text('Aucun enfant', style: TextStyle(color: AHColors.gray500)),
            );
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

              // Liste des documents
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.symmetric(horizontal: AHSpacing.md),
                  children: [
                    _DocumentCard(
                      icon: Icons.verified,
                      title: 'Certificat de scolarité',
                      subtitle: 'Atteste que l\'élève est inscrit',
                      color: Colors.blue,
                      onTap: () => _downloadDocument(context, 'certificat-scolarite'),
                    ),
                    _DocumentCard(
                      icon: Icons.receipt_long,
                      title: 'Attestation de paiement',
                      subtitle: 'Récapitulatif des paiements',
                      color: Colors.green,
                      onTap: () => _downloadDocument(context, 'attestation-paiement'),
                    ),
                    _DocumentCard(
                      icon: Icons.assignment,
                      title: 'Bulletin de notes',
                      subtitle: 'Dernier bulletin disponible',
                      color: Colors.purple,
                      onTap: () => _downloadDocument(context, 'bulletin'),
                    ),
                    _DocumentCard(
                      icon: Icons.menu_book,
                      title: 'Carnet de liaison',
                      subtitle: 'Messages de l\'école',
                      color: Colors.orange,
                      onTap: () => _downloadDocument(context, 'carnet-liaison'),
                    ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  void _downloadDocument(BuildContext context, String docType) async {
    final childId = _selectedChildId ?? '';
    final url = 'https://app.academiahelm.com/api/parent/documents/$docType?studentId=$childId';

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Téléchargement du document...'),
        backgroundColor: AHColors.navy,
      ),
    );

    if (await canLaunchUrl(Uri.parse(url))) {
      await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
    } else {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Document non disponible. Contactez l\'administration.'),
            backgroundColor: Colors.orange,
          ),
        );
      }
    }
  }
}

class _DocumentCard extends StatelessWidget {
  const _DocumentCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.color,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: AHSpacing.sm),
      child: ListTile(
        onTap: onTap,
        leading: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(icon, color: color, size: 20),
        ),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
        subtitle: Text(subtitle, style: TextStyle(fontSize: 12, color: AHColors.gray500)),
        trailing: Icon(Icons.download, color: AHColors.gray400, size: 20),
      ),
    );
  }
}
