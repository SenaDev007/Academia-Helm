/// ============================================================================
/// CHILD JOURNAL SCREEN — Écran "Cahier de texte" (parent)
/// ============================================================================
///
/// Le parent consulte le cahier journal de la classe de son enfant.
/// Affiche les séances par jour avec : matière, thème, contenu, devoirs.
///
/// ============================================================================

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../../../core/widgets/loading/async_value_widget.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_result.dart';
import '../providers/children_provider.dart';
import '../../../domain/entities/child.dart';

/// Provider pour le cahier journal d'un enfant (via sa classe)
final childJournalProvider =
    FutureProvider.family<List<Map<String, dynamic>>, String>((ref, childId) async {
  final apiClient = ref.watch(apiClientProvider);

  // 1. Récupérer le détail de l'enfant pour avoir son classId
  final childResult = await apiClient.getRaw('/api/profile/children/$childId');
  String? classId;

  childResult.when(
    success: (data) {
      classId = data['classId'] as String?;
    },
    failure: (_) {},
    loading: () {},
  );

  if (classId == null) return [];

  // 2. Récupérer le cahier journal de la classe pour la semaine courante
  final now = DateTime.now();
  final monday = now.subtract(Duration(days: now.weekday - 1));
  final weekStart = monday.toIso8601String().split('T')[0];

  final result = await apiClient.getRaw(
    '/api/parent/cahier-journal/$classId?weekStart=$weekStart',
  );

  return result.when(
    success: (data) {
      if (data['available'] == false) return [];
      final entries = data['entries'] as Map<String, dynamic>? ?? {};
      final List<Map<String, dynamic>> allEntries = [];

      for (final entry in entries.entries) {
        final dayKey = entry.key;
        final dayData = entry.value;
        if (dayData is List) {
          for (final item in dayData) {
            allEntries.add({
              ...item as Map<String, dynamic>,
              'day': dayKey,
            });
          }
        } else if (dayData is Map) {
          for (final subEntry in (dayData as Map<String, dynamic>).entries) {
            allEntries.add({
              ...subEntry.value as Map<String, dynamic>,
              'day': dayKey,
            });
          }
        }
      }

      return allEntries;
    },
    failure: (error) => throw Exception(error.message),
    loading: () => [],
  );
});

class ChildJournalScreen extends ConsumerStatefulWidget {
  const ChildJournalScreen({super.key});

  @override
  ConsumerState<ChildJournalScreen> createState() => _ChildJournalScreenState();
}

class _ChildJournalScreenState extends ConsumerState<ChildJournalScreen> {
  String? _selectedChildId;

  @override
  Widget build(BuildContext context) {
    final childrenAsync = ref.watch(childrenProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Cahier de texte')),
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

              // Cahier journal
              Expanded(
                child: AsyncValueWidget<List<Map<String, dynamic>>>(
                  value: ref.watch(childJournalProvider(_selectedChildId!)),
                  builder: (entries) {
                    if (entries.isEmpty) {
                      return Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.book, size: 48, color: AHColors.gray300),
                            const SizedBox(height: AHSpacing.sm),
                            Text('Cahier journal non disponible', style: TextStyle(color: AHColors.gray500)),
                          ],
                        ),
                      );
                    }

                    return ListView.builder(
                      padding: const EdgeInsets.all(AHSpacing.md),
                      itemCount: entries.length,
                      itemBuilder: (context, index) {
                        final entry = entries[index];
                        return _JournalEntryCard(entry: entry);
                      },
                    );
                  },
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _JournalEntryCard extends StatelessWidget {
  const _JournalEntryCard({required this.entry});

  final Map<String, dynamic> entry;

  @override
  Widget build(BuildContext context) {
    final day = entry['day'] as String? ?? '';
    final subject = entry['subjectName'] ?? entry['subject'] ?? 'Matière';
    final topic = entry['topic'] ?? '';
    final content = entry['content'] ?? '';
    final homework = entry['homework'] ?? '';

    return Card(
      margin: const EdgeInsets.only(bottom: AHSpacing.sm),
      child: Padding(
        padding: const EdgeInsets.all(AHSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // En-tête : jour + matière
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: AHColors.navy.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    _capitalize(day),
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AHColors.navy),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    subject.toString(),
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                  ),
                ),
              ],
            ),

            // Thème
            if (topic.toString().isNotEmpty) ...[
              const SizedBox(height: 8),
              Text('Thème: $topic', style: TextStyle(fontSize: 12, color: AHColors.gray700)),
            ],

            // Contenu
            if (content.toString().isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(content.toString(), style: TextStyle(fontSize: 12, color: AHColors.gray600)),
            ],

            // Devoir
            if (homework.toString().isNotEmpty) ...[
              const SizedBox(height: 8),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.amber.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Row(
                  children: [
                    Icon(Icons.assignment, size: 14, color: Colors.amber[700]),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Text(
                        'Devoir: $homework',
                        style: TextStyle(fontSize: 11, color: Colors.amber[800]),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  String _capitalize(String s) {
    if (s.isEmpty) return s;
    return s[0].toUpperCase() + s.substring(1);
  }
}
