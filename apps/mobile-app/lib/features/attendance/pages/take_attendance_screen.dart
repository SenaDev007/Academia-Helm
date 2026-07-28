/// ============================================================================
/// TAKE ATTENDANCE SCREEN — Écran "Faire l'appel" (enseignant)
/// ============================================================================
///
/// L'enseignant sélectionne une classe, puis voit la liste de ses élèves
/// avec 3 boutons par élève : Présent / Absent / Retard.
///
/// En bas : bouton "Valider l'appel" qui sauvegarde via l'API.
///
/// ============================================================================

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../../../core/widgets/loading/async_value_widget.dart';
import '../providers/attendance_provider.dart';

class TakeAttendanceScreen extends ConsumerStatefulWidget {
  const TakeAttendanceScreen({super.key, required this.classId});

  final String classId;

  @override
  ConsumerState<TakeAttendanceScreen> createState() => _TakeAttendanceScreenState();
}

class _TakeAttendanceScreenState extends ConsumerState<TakeAttendanceScreen> {
  /// Map des statuts modifiés : studentId → AttendanceStatus
  final Map<String, AttendanceStatus> _statuses = {};
  bool _isSaving = false;

  @override
  Widget build(BuildContext context) {
    final attendanceAsync = ref.watch(classAttendanceProvider(widget.classId));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Faire l\'appel'),
        actions: [
          if (_statuses.isNotEmpty)
            TextButton.icon(
              onPressed: _isSaving ? null : _saveAttendance,
              icon: _isSaving
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Icon(Icons.check, color: Colors.white),
              label: Text(
                'Valider (${_statuses.length})',
                style: const TextStyle(color: Colors.white),
              ),
            ),
        ],
      ),
      body: AsyncValueWidget<List<Map<String, dynamic>>>(
        value: attendanceAsync,
        builder: (students) {
          if (students.isEmpty) {
            return Center(
              child: Text(
                'Aucun élève dans cette classe',
                style: TextStyle(color: AHColors.gray500),
              ),
            );
          }
          return Column(
            children: [
              // En-tête : date du jour
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(AHSpacing.md),
                color: AHColors.navy.withValues(alpha: 0.05),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.calendar_today, size: 16, color: AHColors.navy),
                    const SizedBox(width: 8),
                    Text(
                      DateTime.now().toString().split(' ')[0],
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        color: AHColors.navy,
                      ),
                    ),
                  ],
                ),
              ),

              // Liste des élèves
              Expanded(
                child: ListView.builder(
                  itemCount: students.length,
                  itemBuilder: (context, index) {
                    final student = students[index];
                    final studentId = student['id'] as String? ?? '$index';
                    final currentStatus = _statuses[studentId] ??
                        _parseApiStatus(student['attendanceStatus'] as String?);

                    return _StudentAttendanceRow(
                      name: '${student['firstName'] ?? ''} ${student['lastName'] ?? ''}'.trim(),
                      matricule: student['matricule'] as String?,
                      avatarUrl: student['photoUrl'] as String?,
                      status: currentStatus,
                      onStatusChanged: (newStatus) {
                        setState(() {
                          _statuses[studentId] = newStatus;
                        });
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

  AttendanceStatus _parseApiStatus(String? status) {
    switch (status?.toUpperCase()) {
      case 'ABSENT': return AttendanceStatus.absent;
      case 'LATE': return AttendanceStatus.late;
      default: return AttendanceStatus.present;
    }
  }

  Future<void> _saveAttendance() async {
    setState(() => _isSaving = true);

    final api = ref.read(attendanceApiProvider);
    final records = _statuses.entries.map((e) => {
      'studentId': e.key,
      'status': e.value.apiValue,
    }).toList();

    final result = await api.saveAttendance(
      classId: widget.classId,
      date: DateTime.now(),
      records: records,
    );

    setState(() => _isSaving = false);

    if (!mounted) return;

    result.when(
      success: (_) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Appel validé pour ${_statuses.length} élève(s)'),
            backgroundColor: Colors.green,
          ),
        );
        setState(() => _statuses.clear());
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

// ── Ligne élève avec 3 boutons ──

class _StudentAttendanceRow extends StatelessWidget {
  const _StudentAttendanceRow({
    required this.name,
    required this.status,
    required this.onStatusChanged,
    this.matricule,
    this.avatarUrl,
  });

  final String name;
  final String? matricule;
  final String? avatarUrl;
  final AttendanceStatus status;
  final void Function(AttendanceStatus) onStatusChanged;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: AHSpacing.md,
        vertical: AHSpacing.xs,
      ),
      child: Row(
        children: [
          // Avatar
          CircleAvatar(
            radius: 20,
            backgroundColor: AHColors.navy.withValues(alpha: 0.1),
            backgroundImage: avatarUrl != null ? NetworkImage(avatarUrl!) : null,
            child: avatarUrl == null
                ? Text(
                    name.isNotEmpty ? name[0].toUpperCase() : '?',
                    style: TextStyle(color: AHColors.navy, fontWeight: FontWeight.bold),
                  )
                : null,
          ),
          const SizedBox(width: AHSpacing.sm),

          // Nom
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                    color: AHColors.gray900,
                  ),
                ),
                if (matricule != null)
                  Text(
                    matricule!,
                    style: TextStyle(fontSize: 11, color: AHColors.gray500),
                  ),
              ],
            ),
          ),

          // 3 boutons de statut
          _StatusButton(
            icon: Icons.check,
            color: Colors.green,
            isSelected: status == AttendanceStatus.present,
            onTap: () => onStatusChanged(AttendanceStatus.present),
          ),
          _StatusButton(
            icon: Icons.close,
            color: Colors.red,
            isSelected: status == AttendanceStatus.absent,
            onTap: () => onStatusChanged(AttendanceStatus.absent),
          ),
          _StatusButton(
            icon: Icons.schedule,
            color: Colors.orange,
            isSelected: status == AttendanceStatus.late,
            onTap: () => onStatusChanged(AttendanceStatus.late),
          ),
        ],
      ),
    );
  }
}

class _StatusButton extends StatelessWidget {
  const _StatusButton({
    required this.icon,
    required this.color,
    required this.isSelected,
    required this.onTap,
  });

  final IconData icon;
  final Color color;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 36,
        height: 36,
        margin: const EdgeInsets.only(left: 4),
        decoration: BoxDecoration(
          color: isSelected ? color : color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(8),
          border: isSelected ? null : Border.all(color: color.withValues(alpha: 0.3)),
        ),
        child: Icon(
          icon,
          size: 18,
          color: isSelected ? Colors.white : color,
        ),
      ),
    );
  }
}
