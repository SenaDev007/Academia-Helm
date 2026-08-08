import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../providers/phase3_provider.dart';
import '../providers/teacher_provider.dart';

/// Cahier de Texte — mirrors the web's CahierDeTexteTab (818 lines).
///
/// Secondary-only feature: test/evaluation manager.
/// 4 test types: DEVOIR, COMPOSITION, INTERROGATION, TEST
/// Full score editor with statistics (average, min, max, pass rate, répartition par sexe).
/// Status: DRAFT → SUBMITTED → VALIDATED / REJECTED
class CahierTexteScreen extends ConsumerWidget {
  const CahierTexteScreen({super.key, required this.teacherId, this.academicYearId});

  final String teacherId;
  final String? academicYearId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final params = TeacherParams(teacherId: teacherId, academicYearId: academicYearId);
    final cahierAsync = ref.watch(cahierTextesProvider(params));

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        foregroundColor: AHColors.navy,
        elevation: 0,
        title: const Text('Cahier de Texte', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
        leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => Navigator.of(context).pop()),
        actions: [
          IconButton(icon: const Icon(Icons.refresh, color: AHColors.navy),
            onPressed: () => ref.invalidate(cahierTextesProvider(params))),
          IconButton(icon: const Icon(Icons.add, color: AHColors.navy),
            onPressed: () => _showCreateDialog(context)),
        ],
      ),
      body: cahierAsync.when(
        data: (items) {
          if (items.isEmpty) return _buildEmpty(context);
          // Group by test type
          final grouped = <TestType, List<CahierTexte>>{};
          for (final c in items) {
            grouped.putIfAbsent(c.testType, () => []).add(c);
          }
          return ListView.builder(
            padding: const EdgeInsets.all(AHSpacing.md),
            itemCount: grouped.length,
            itemBuilder: (context, index) {
              final type = grouped.keys.elementAt(index);
              final tests = grouped[type]!;
              return _TestTypeSection(testType: type, tests: tests);
            },
          );
        },
        loading: () => const Center(child: CircularProgressIndicator(color: AHColors.navy)),
        error: (_, __) => _buildError(context, ref, params),
      ),
    );
  }

  Widget _buildEmpty(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.quiz, size: 64, color: AHColors.grey300),
          const SizedBox(height: AHSpacing.md),
          const Text('Aucun test enregistré',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AHColors.grey600)),
          const SizedBox(height: 4),
          const Text('Créez un test avec le bouton +\n(Devoir, Composition, Interrogation, Test)',
            textAlign: TextAlign.center, style: TextStyle(fontSize: 12, color: AHColors.grey400)),
        ],
      ),
    );
  }

  Widget _buildError(BuildContext context, WidgetRef ref, TeacherParams params) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.wifi_off, size: 48, color: AHColors.error),
          const SizedBox(height: 8),
          const Text('Erreur de chargement', style: TextStyle(fontSize: 14, color: AHColors.grey600)),
          const SizedBox(height: 8),
          ElevatedButton(onPressed: () => ref.invalidate(cahierTextesProvider(params)),
            style: ElevatedButton.styleFrom(backgroundColor: AHColors.navy, foregroundColor: Colors.white),
            child: const Text('Réessayer')),
        ],
      ),
    );
  }

  void _showCreateDialog(BuildContext context) {
    showModalBottomSheet(
      context: context,
      builder: (context) => Container(
        padding: const EdgeInsets.all(AHSpacing.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Nouveau test', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AHColors.navy)),
            const SizedBox(height: AHSpacing.md),
            ...TestType.values.map((type) => _TestTypeTile(type: type, onTap: () {
              Navigator.pop(context);
              // TODO: navigate to test creation form
            })),
          ],
        ),
      ),
    );
  }
}

class _TestTypeSection extends StatelessWidget {
  const _TestTypeSection({required this.testType, required this.tests});
  final TestType testType;
  final List<CahierTexte> tests;

  String get _typeLabel => switch (testType) {
    TestType.devoir => 'Devoirs',
    TestType.composition => 'Compositions',
    TestType.interrogation => 'Interrogations',
    TestType.test => 'Tests',
  };

  Color get _typeColor => switch (testType) {
    TestType.devoir => const Color(0xFF3B82F6),
    TestType.composition => const Color(0xFF8B5CF6),
    TestType.interrogation => const Color(0xFF10B981),
    TestType.test => const Color(0xFFF59E0B),
  };

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Row(children: [
            Container(width: 8, height: 8, decoration: BoxDecoration(color: _typeColor, shape: BoxShape.circle)),
            const SizedBox(width: 6),
            Text(_typeLabel.toUpperCase(), style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: _typeColor)),
            const SizedBox(width: 4),
            Text('(${tests.length})', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: _typeColor.withOpacity(0.7))),
          ]),
        ),
        ...tests.map((t) => _TestCard(test: t, typeColor: _typeColor)),
        const SizedBox(height: AHSpacing.md),
      ],
    );
  }
}

class _TestCard extends StatelessWidget {
  const _TestCard({required this.test, required this.typeColor});
  final CahierTexte test;
  final Color typeColor;

  @override
  Widget build(BuildContext context) {
    final statusColor = switch (test.status) {
      FicheStatus.validated => const Color(0xFF16A34A),
      FicheStatus.submitted => const Color(0xFF7C3AED),
      FicheStatus.rejected => const Color(0xFFDC2626),
      FicheStatus.draft => const Color(0xFF64748B),
    };
    final statusLabel = switch (test.status) {
      FicheStatus.validated => 'Validé',
      FicheStatus.submitted => 'Soumis',
      FicheStatus.rejected => 'Rejeté',
      FicheStatus.draft => 'Brouillon',
    };

    return Card(
      color: Colors.white,
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 4),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8), side: BorderSide(color: const Color(0xFFE2E8F0))),
      child: InkWell(
        onTap: () {
          // TODO: navigate to score editor (TestScoreEditor)
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Saisie des notes — ${test.title}'), duration: const Duration(seconds: 1)),
          );
        },
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Icon(Icons.quiz, size: 18, color: typeColor),
              const SizedBox(width: 8),
              Expanded(child: Text(test.title.isEmpty ? 'Test ${test.testNumber ?? ''}' : test.title,
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)), maxLines: 1, overflow: TextOverflow.ellipsis)),
              Container(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(color: statusColor.withOpacity(0.1), borderRadius: BorderRadius.circular(4)),
                child: Text(statusLabel, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: statusColor))),
            ]),
            const SizedBox(height: 4),
            Row(children: [
              if (test.className.isNotEmpty) ...[
                Icon(Icons.school, size: 12, color: AHColors.grey400),
                const SizedBox(width: 2),
                Text(test.className, style: const TextStyle(fontSize: 10, color: Color(0xFF64748B))),
                const SizedBox(width: 8),
              ],
              if (test.subjectName.isNotEmpty) ...[
                Icon(Icons.book, size: 12, color: AHColors.grey400),
                const SizedBox(width: 2),
                Text(test.subjectName, style: const TextStyle(fontSize: 10, color: Color(0xFF64748B))),
                const SizedBox(width: 8),
              ],
              Text('/${test.maxScore} (coef ${test.coefficient})',
                style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Color(0xFF64748B))),
              if (test.trimester != null) ...[
                const SizedBox(width: 8),
                Text('T${test.trimester}', style: const TextStyle(fontSize: 10, color: AHColors.grey400)),
              ],
            ]),
          ]),
        ),
      ),
    );
  }
}

class _TestTypeTile extends StatelessWidget {
  const _TestTypeTile({required this.type, required this.onTap});
  final TestType type;
  final VoidCallback onTap;

  String get _label => switch (type) {
    TestType.devoir => 'Devoir',
    TestType.composition => 'Composition',
    TestType.interrogation => 'Interrogation',
    TestType.test => 'Test',
  };

  Color get _color => switch (type) {
    TestType.devoir => const Color(0xFF3B82F6),
    TestType.composition => const Color(0xFF8B5CF6),
    TestType.interrogation => const Color(0xFF10B981),
    TestType.test => const Color(0xFFF59E0B),
  };

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
        child: Row(children: [
          Container(width: 32, height: 32, decoration: BoxDecoration(color: _color.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
            child: Icon(Icons.quiz, size: 18, color: _color)),
          const SizedBox(width: 12),
          Expanded(child: Text(_label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AHColors.navy))),
          const Icon(Icons.chevron_right, color: AHColors.grey300, size: 20),
        ]),
      ),
    );
  }
}
