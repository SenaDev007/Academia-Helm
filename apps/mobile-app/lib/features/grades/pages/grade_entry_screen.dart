/// ============================================================================
/// GRADE ENTRY SCREEN — Écran "Saisir des notes" (enseignant)
/// ============================================================================
///
/// L'enseignant sélectionne une évaluation, puis voit la liste de ses élèves
/// avec un champ de saisie de note pour chacun.
///
/// En bas : bouton "Enregistrer les notes" qui sauvegarde via l'API.
///
/// ============================================================================

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../../../core/widgets/loading/async_value_widget.dart';
import '../providers/grade_entry_provider.dart';

class GradeEntryScreen extends ConsumerStatefulWidget {
  const GradeEntryScreen({super.key, required this.evaluationId});

  final String evaluationId;

  @override
  ConsumerState<GradeEntryScreen> createState() => _GradeEntryScreenState();
}

class _GradeEntryScreenState extends ConsumerState<GradeEntryScreen> {
  /// Map des notes modifiées : studentId → note (String pour le TextField)
  final Map<String, TextEditingController> _controllers = {};
  bool _isSaving = false;

  @override
  void dispose() {
    for (final c in _controllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final gradesAsync = ref.watch(evaluationGradesProvider(widget.evaluationId));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Saisir les notes'),
        actions: [
          TextButton.icon(
            onPressed: _isSaving ? null : _saveGrades,
            icon: _isSaving
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                  )
                : const Icon(Icons.save, color: Colors.white),
            label: const Text('Enregistrer', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
      body: AsyncValueWidget<List<Map<String, dynamic>>>(
        value: gradesAsync,
        builder: (students) {
          if (students.isEmpty) {
            return Center(
              child: Text('Aucun élève', style: TextStyle(color: AHColors.gray500)),
            );
          }

          return ListView.builder(
            padding: const EdgeInsets.all(AHSpacing.md),
            itemCount: students.length,
            itemBuilder: (context, index) {
              final student = students[index];
              final studentId = student['id'] as String? ?? '$index';
              final existingGrade = student['score'] ?? student['grade'] ?? '';

              // Créer le controller si pas encore fait
              _controllers.putIfAbsent(
                studentId,
                () => TextEditingController(text: existingGrade.toString()),
              );

              return _GradeInputRow(
                name: '${student['firstName'] ?? ''} ${student['lastName'] ?? ''}'.trim(),
                matricule: student['matricule'] as String?,
                maxScore: (student['maxScore'] ?? 20) as num,
                controller: _controllers[studentId]!,
              );
            },
          );
        },
      ),
    );
  }

  Future<void> _saveGrades() async {
    setState(() => _isSaving = true);

    final api = ref.read(gradeEntryApiProvider);
    final grades = <Map<String, dynamic>>[];

    for (final entry in _controllers.entries) {
      final value = entry.value.text.trim();
      if (value.isNotEmpty) {
        grades.add({
          'studentId': entry.key,
          'score': double.tryParse(value) ?? 0,
        });
      }
    }

    final result = await api.saveGrades(
      evaluationId: widget.evaluationId,
      grades: grades,
    );

    setState(() => _isSaving = false);

    if (!mounted) return;

    result.when(
      success: (_) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('${grades.length} note(s) enregistrée(s)'),
            backgroundColor: Colors.green,
          ),
        );
      },
      failure: (error) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Erreur: ${error.message}'),
            backgroundColor: Colors.red,
          ),
        );
      },
      loading: () {},
    );
  }
}

// ── Ligne de saisie de note ──

class _GradeInputRow extends StatelessWidget {
  const _GradeInputRow({
    required this.name,
    required this.maxScore,
    required this.controller,
    this.matricule,
  });

  final String name;
  final String? matricule;
  final num maxScore;
  final TextEditingController controller;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AHSpacing.sm),
      child: Row(
        children: [
          // Avatar avec initiale
          CircleAvatar(
            radius: 18,
            backgroundColor: AHColors.navy.withValues(alpha: 0.1),
            child: Text(
              name.isNotEmpty ? name[0].toUpperCase() : '?',
              style: TextStyle(color: AHColors.navy, fontSize: 14, fontWeight: FontWeight.bold),
            ),
          ),
          const SizedBox(width: AHSpacing.sm),

          // Nom + matricule
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: AHColors.gray900),
                ),
                if (matricule != null)
                  Text(matricule!, style: TextStyle(fontSize: 10, color: AHColors.gray500)),
              ],
            ),
          ),

          // Champ de note
          SizedBox(
            width: 70,
            child: TextField(
              controller: controller,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(
                hintText: '/ ${maxScore.toInt()}',
                isDense: true,
                contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              style: TextStyle(fontWeight: FontWeight.bold, color: AHColors.navy),
            ),
          ),
        ],
      ),
    );
  }
}
