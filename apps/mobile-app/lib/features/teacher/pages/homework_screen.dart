import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../providers/pedagogy_space_provider.dart';
import '../providers/teacher_provider.dart';

/// Homework list screen — mirrors the web's HomeworkTab + Tasks page.
///
/// Features:
/// - List of homework with status badges (Fait / En retard / En cours)
/// - Due date, class name, done/totalStudents counter
/// - Create homework (class, subject, title, description, dueDate, maxScore)
/// - Per-student status (6 statuses: PENDING/DONE/NOT_DONE/INCOMPLETE/LATE/TO_REDO)
class HomeworkScreen extends ConsumerWidget {
  const HomeworkScreen({super.key, required this.teacherId, this.academicYearId});

  final String teacherId;
  final String? academicYearId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final params = TeacherParams(teacherId: teacherId, academicYearId: academicYearId);
    final homeworkAsync = ref.watch(homeworksProvider(params));

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        foregroundColor: AHColors.navy,
        elevation: 0,
        title: const Text('Devoirs & Tâches', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.of(context).pop(),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: AHColors.navy),
            onPressed: () => ref.invalidate(homeworksProvider(params)),
          ),
          IconButton(
            icon: const Icon(Icons.add, color: AHColors.navy),
            onPressed: () => _showCreateDialog(context, ref, params),
          ),
        ],
      ),
      body: homeworkAsync.when(
        data: (homeworks) {
          if (homeworks.isEmpty) return _buildEmpty(context);
          return RefreshIndicator(
            color: AHColors.navy,
            onRefresh: () async => ref.invalidate(homeworksProvider(params)),
            child: ListView.separated(
              padding: const EdgeInsets.all(AHSpacing.md),
              itemCount: homeworks.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (context, index) => _HomeworkCard(homework: homeworks[index]),
            ),
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
          Icon(Icons.assignment_outlined, size: 64, color: AHColors.grey300),
          const SizedBox(height: AHSpacing.md),
          const Text('Aucun devoir assigné',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AHColors.grey600),
          ),
          const SizedBox(height: 4),
          const Text('Créez un devoir avec le bouton +',
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
            onPressed: () => ref.invalidate(homeworksProvider(params)),
            style: ElevatedButton.styleFrom(backgroundColor: AHColors.navy, foregroundColor: Colors.white),
            child: const Text('Réessayer'),
          ),
        ],
      ),
    );
  }

  void _showCreateDialog(BuildContext context, WidgetRef ref, TeacherParams params) {
    // Simple create dialog — will be expanded later with full form
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Création de devoir — à implémenter avec formulaire complet'),
        duration: Duration(seconds: 2),
      ),
    );
  }
}

class _HomeworkCard extends StatelessWidget {
  const _HomeworkCard({required this.homework});
  final Homework homework;

  @override
  Widget build(BuildContext context) {
    final statusColor = switch (homework.status) {
      HomeworkStatus.done => const Color(0xFF16A34A),
      HomeworkStatus.late => const Color(0xFFDC2626),
      HomeworkStatus.inProgress => const Color(0xFF64748B),
    };
    final statusLabel = switch (homework.status) {
      HomeworkStatus.done => 'Fait',
      HomeworkStatus.late => 'En retard',
      HomeworkStatus.inProgress => 'En cours',
    };

    return Card(
      color: Colors.white,
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8), side: BorderSide(color: const Color(0xFFE2E8F0))),
      child: InkWell(
        onTap: () {
          // TODO: navigate to homework detail (per-student status)
        },
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.assignment_outlined, size: 18, color: const Color(0xFFF59E0B)),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      homework.title,
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(color: statusColor.withOpacity(0.1), borderRadius: BorderRadius.circular(4)),
                    child: Text(statusLabel,
                      style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: statusColor)),
                  ),
                ],
              ),
              if (homework.description.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(homework.description,
                  style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
              const SizedBox(height: 6),
              Row(
                children: [
                  if (homework.className.isNotEmpty) ...[
                    Icon(Icons.school, size: 12, color: AHColors.grey400),
                    const SizedBox(width: 2),
                    Text(homework.className, style: const TextStyle(fontSize: 10, color: Color(0xFF64748B))),
                    const SizedBox(width: 8),
                  ],
                  if (homework.dueDateLabel.isNotEmpty) ...[
                    Icon(Icons.calendar_today, size: 12, color: AHColors.grey400),
                    const SizedBox(width: 2),
                    Text(homework.dueDateLabel, style: const TextStyle(fontSize: 10, color: Color(0xFF64748B))),
                    const SizedBox(width: 8),
                  ],
                  if (homework.totalStudents > 0) ...[
                    Icon(Icons.check_circle, size: 12, color: const Color(0xFF16A34A)),
                    const SizedBox(width: 2),
                    Text('${homework.done}/${homework.totalStudents}',
                      style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Color(0xFF16A34A))),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
