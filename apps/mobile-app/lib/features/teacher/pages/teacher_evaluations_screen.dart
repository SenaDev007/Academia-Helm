import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../providers/pedagogy_space_provider.dart';
import '../providers/teacher_provider.dart';

/// Teacher Evaluations screen — mirrors the web's /app/teacher/exams page.
///
/// Features:
/// - Hierarchical list grouped by trimester
/// - Status badges (PLANNED → OPEN_FOR_GRADING → SUBMITTED → VALIDATED)
/// - Bell icon with notification count
/// - Click group → GradingSheet (grade entry)
/// - Save + Validate buttons (PLANNED → OPEN_FOR_GRADING)
class TeacherEvaluationsScreen extends ConsumerWidget {
  const TeacherEvaluationsScreen({super.key, required this.teacherId, this.academicYearId});

  final String teacherId;
  final String? academicYearId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final params = TeacherParams(teacherId: teacherId, academicYearId: academicYearId);
    final evaluationsAsync = ref.watch(teacherEvaluationsProvider(params));

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        foregroundColor: AHColors.navy,
        elevation: 0,
        title: const Text('Mes Évaluations', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.of(context).pop(),
        ),
        actions: [
          // Bell icon with notification badge
          Stack(
            children: [
              IconButton(
                icon: const Icon(Icons.notifications_outlined, color: AHColors.navy),
                onPressed: () {
                  // TODO: show notifications panel
                },
              ),
              // Red badge (placeholder — will fetch real count from /notifications API)
              Positioned(
                right: 8,
                top: 8,
                child: Container(
                  padding: const EdgeInsets.all(2),
                  decoration: const BoxDecoration(color: Colors.red, shape: BoxShape.circle),
                  constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                  child: const Text('0',
                    style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: Colors.white),
                    textAlign: TextAlign.center),
                ),
              ),
            ],
          ),
          IconButton(
            icon: const Icon(Icons.refresh, color: AHColors.navy),
            onPressed: () => ref.invalidate(teacherEvaluationsProvider(params)),
          ),
        ],
      ),
      body: evaluationsAsync.when(
        data: (evaluations) {
          if (evaluations.isEmpty) return _buildEmpty(context);
          return _buildEvaluationList(context, evaluations);
        },
        loading: () => const Center(child: CircularProgressIndicator(color: AHColors.navy)),
        error: (_, __) => _buildError(context, ref, params),
      ),
    );
  }

  Widget _buildEvaluationList(BuildContext context, List<TeacherEvaluation> evaluations) {
    // Group by status (simplified — web groups by trimester)
    final grouped = <EvaluationStatus, List<TeacherEvaluation>>{};
    for (final e in evaluations) {
      grouped.putIfAbsent(e.status, () => []).add(e);
    }

    return ListView.builder(
      padding: const EdgeInsets.all(AHSpacing.md),
      itemCount: grouped.length,
      itemBuilder: (context, index) {
        final status = grouped.keys.elementAt(index);
        final items = grouped[status]!;
        return _EvaluationGroup(status: status, evaluations: items);
      },
    );
  }

  Widget _buildEmpty(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.edit_note, size: 64, color: AHColors.grey300),
          const SizedBox(height: AHSpacing.md),
          const Text('Aucune évaluation assignée',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AHColors.grey600),
          ),
          const SizedBox(height: 4),
          const Text('Les évaluations apparaîtront ici une fois créées',
            style: TextStyle(fontSize: 12, color: AHColors.grey400),
          ),
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
          ElevatedButton(
            onPressed: () => ref.invalidate(teacherEvaluationsProvider(params)),
            style: ElevatedButton.styleFrom(backgroundColor: AHColors.navy, foregroundColor: Colors.white),
            child: const Text('Réessayer'),
          ),
        ],
      ),
    );
  }
}

class _EvaluationGroup extends StatelessWidget {
  const _EvaluationGroup({required this.status, required this.evaluations});
  final EvaluationStatus status;
  final List<TeacherEvaluation> evaluations;

  String get _statusLabel => switch (status) {
    EvaluationStatus.draft => 'Brouillons',
    EvaluationStatus.planned => 'Planifiées',
    EvaluationStatus.openForGrading => 'Saisie des notes',
    EvaluationStatus.submitted => 'Soumises au directeur',
    EvaluationStatus.validated => 'Validées',
    EvaluationStatus.locked => 'Verrouillées',
    EvaluationStatus.cancelled => 'Annulées',
  };

  Color get _statusColor => switch (status) {
    EvaluationStatus.draft => const Color(0xFF64748B),
    EvaluationStatus.planned => const Color(0xFF2563EB),
    EvaluationStatus.openForGrading => const Color(0xFFF59E0B),
    EvaluationStatus.submitted => const Color(0xFF7C3AED),
    EvaluationStatus.validated => const Color(0xFF16A34A),
    EvaluationStatus.locked => const Color(0xFFDC2626),
    EvaluationStatus.cancelled => const Color(0xFFDC2626),
  };

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Row(
            children: [
              Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(color: _statusColor, shape: BoxShape.circle),
              ),
              const SizedBox(width: 6),
              Text(_statusLabel.toUpperCase(),
                style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: _statusColor)),
              const SizedBox(width: 4),
              Text('(${evaluations.length})',
                style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: _statusColor.withOpacity(0.7))),
            ],
          ),
        ),
        ...evaluations.map((e) => _EvaluationCard(evaluation: e, statusColor: _statusColor)),
        const SizedBox(height: AHSpacing.md),
      ],
    );
  }
}

class _EvaluationCard extends StatelessWidget {
  const _EvaluationCard({required this.evaluation, required this.statusColor});
  final TeacherEvaluation evaluation;
  final Color statusColor;

  @override
  Widget build(BuildContext context) {
    return Card(
      color: Colors.white,
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 4),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
        side: BorderSide(color: const Color(0xFFE2E8F0)),
      ),
      child: InkWell(
        onTap: () {
          // TODO: navigate to GradingSheet (grade entry)
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Saisie des notes — ${evaluation.title}'),
              duration: const Duration(seconds: 1)),
          );
        },
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.edit_note, size: 18, color: statusColor),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(evaluation.title,
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
                      maxLines: 1, overflow: TextOverflow.ellipsis),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Row(
                children: [
                  if (evaluation.className.isNotEmpty) ...[
                    Icon(Icons.school, size: 12, color: AHColors.grey400),
                    const SizedBox(width: 2),
                    Text(evaluation.className, style: const TextStyle(fontSize: 10, color: Color(0xFF64748B))),
                    const SizedBox(width: 8),
                  ],
                  if (evaluation.subjectName.isNotEmpty) ...[
                    Icon(Icons.book, size: 12, color: AHColors.grey400),
                    const SizedBox(width: 2),
                    Text(evaluation.subjectName, style: const TextStyle(fontSize: 10, color: Color(0xFF64748B))),
                    const SizedBox(width: 8),
                  ],
                  Text('/${evaluation.maxScore}',
                    style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Color(0xFF64748B))),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
