/// ============================================================================
/// BULLETIN SCREEN — Écran "Bulletin" (parent)
/// ============================================================================
///
/// Le parent sélectionne un enfant, puis voit son bulletin par période.
/// Affiche : moyenne générale, rang, notes par matière avec coefficients.
///
/// ============================================================================

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../../../core/widgets/loading/async_value_widget.dart';
import '../../../data/datasources/remote/grade_api.dart';
import '../../../domain/entities/child.dart';
import '../providers/children_provider.dart';

class BulletinScreen extends ConsumerStatefulWidget {
  const BulletinScreen({super.key});

  @override
  ConsumerState<BulletinScreen> createState() => _BulletinScreenState();
}

class _BulletinScreenState extends ConsumerState<BulletinScreen> {
  String? _selectedChildId;
  String _selectedPeriod = 'T1';

  final _periods = [
    {'value': 'T1', 'label': '1er Trimestre'},
    {'value': 'T2', 'label': '2ème Trimestre'},
    {'value': 'T3', 'label': '3ème Trimestre'},
  ];

  @override
  Widget build(BuildContext context) {
    final childrenAsync = ref.watch(childrenProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Bulletins')),
      body: AsyncValueWidget<List<Child>>(
        value: childrenAsync,
        builder: (children) {
          if (children.isEmpty) {
            return Center(child: Text('Aucun enfant', style: TextStyle(color: AHColors.gray500)));
          }

          // Auto-sélection du premier enfant
          _selectedChildId ??= children.first.id;

          return Column(
            children: [
              // Sélecteur enfant
              _ChildSelector(
                children: children,
                selectedId: _selectedChildId!,
                onChanged: (id) => setState(() => _selectedChildId = id),
              ),

              // Sélecteur période
              _PeriodSelector(
                periods: _periods,
                selected: _selectedPeriod,
                onChanged: (p) => setState(() => _selectedPeriod = p),
              ),

              // Bulletin
              Expanded(child: _BulletinContent(
                childId: _selectedChildId!,
                period: _selectedPeriod,
              )),
            ],
          );
        },
      ),
    );
  }
}

class _ChildSelector extends StatelessWidget {
  const _ChildSelector({
    required this.children,
    required this.selectedId,
    required this.onChanged,
  });

  final List<Child> children;
  final String selectedId;
  final void Function(String) onChanged;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(AHSpacing.md),
      child: DropdownButtonFormField<String>(
        value: selectedId,
        decoration: const InputDecoration(
          labelText: 'Enfant',
          prefixIcon: Icon(Icons.child_care),
        ),
        items: children.map((c) => DropdownMenuItem(
          value: c.id,
          child: Text(c.displayName),
        )).toList(),
        onChanged: (v) => onChanged(v ?? selectedId),
      ),
    );
  }
}

class _PeriodSelector extends StatelessWidget {
  const _PeriodSelector({
    required this.periods,
    required this.selected,
    required this.onChanged,
  });

  final List<Map<String, String>> periods;
  final String selected;
  final void Function(String) onChanged;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AHSpacing.md),
      child: Row(
        children: periods.map((p) {
          final isSelected = p['value'] == selected;
          return Expanded(
            child: Padding(
              padding: const EdgeInsets.only(right: 4),
              child: ElevatedButton(
                onPressed: () => onChanged(p['value']!),
                style: ElevatedButton.styleFrom(
                  backgroundColor: isSelected ? AHColors.navy : AHColors.gray100,
                  foregroundColor: isSelected ? Colors.white : AHColors.gray600,
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(vertical: 8),
                ),
                child: Text(p['label']!, style: const TextStyle(fontSize: 11)),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

class _BulletinContent extends ConsumerWidget {
  const _BulletinContent({required this.childId, required this.period});

  final String childId;
  final String period;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final gradeApi = ref.watch(gradeApiProvider);
    final reportFuture = gradeApi.getPeriodReport(childId, period);

    return FutureBuilder(
      future: reportFuture,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }

        return snapshot.data?.when(
          success: (report) => _BulletinView(report: report),
          failure: (error) => Center(
            child: Text('Erreur: ${error.message}', style: TextStyle(color: AHColors.gray500)),
          ),
          loading: () => const Center(child: CircularProgressIndicator()),
        ) ?? Center(child: Text('Aucun bulletin', style: TextStyle(color: AHColors.gray500)));
      },
    );
  }
}

class _BulletinView extends StatelessWidget {
  const _BulletinView({required this.report});

  final dynamic report;

  @override
  Widget build(BuildContext context) {
    // report est de type PeriodReport — adapter selon l'entity
    final overallAverage = report.overallAverage ?? 0;
    final rank = report.rank;
    final subjects = report.subjectAverages ?? <dynamic>[];

    return ListView(
      padding: const EdgeInsets.all(AHSpacing.md),
      children: [
        // Carte moyenne générale
        Card(
          child: Padding(
            padding: const EdgeInsets.all(AHSpacing.md),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _StatItem(
                  label: 'Moyenne générale',
                  value: overallAverage.toStringAsFixed(2),
                  suffix: '/ 20',
                  color: _gradeColor(overallAverage),
                ),
                if (rank != null)
                  _StatItem(
                    label: 'Rang',
                    value: '$rank',
                    suffix: 'er',
                    color: AHColors.navy,
                  ),
              ],
            ),
          ),
        ),
        const SizedBox(height: AHSpacing.md),

        // Notes par matière
        Text('Notes par matière', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold)),
        const SizedBox(height: AHSpacing.sm),

        ...subjects.map((s) => Card(
          child: ListTile(
            title: Text(s.subjectName ?? 'Matière', style: const TextStyle(fontWeight: FontWeight.w600)),
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  (s.average ?? 0).toStringAsFixed(2),
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: _gradeColor(s.average ?? 0),
                  ),
                ),
                const SizedBox(width: 4),
                Text('/ 20', style: TextStyle(fontSize: 12, color: AHColors.gray400)),
              ],
            ),
            subtitle: s.coefficient != null
                ? Text('Coefficient: ${s.coefficient}', style: TextStyle(fontSize: 11, color: AHColors.gray500))
                : null,
          ),
        )),
      ],
    );
  }

  Color _gradeColor(double grade) {
    if (grade >= 10) return Colors.green;
    if (grade >= 8) return Colors.orange;
    return Colors.red;
  }
}

class _StatItem extends StatelessWidget {
  const _StatItem({required this.label, required this.value, this.suffix, required this.color});

  final String label;
  final String value;
  final String? suffix;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(label, style: TextStyle(fontSize: 12, color: AHColors.gray500)),
        const SizedBox(height: 4),
        Row(
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            Text(value, style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: color)),
            if (suffix != null) ...[
              const SizedBox(width: 2),
              Text(suffix!, style: TextStyle(fontSize: 12, color: AHColors.gray400)),
            ],
          ],
        ),
      ],
    );
  }
}
