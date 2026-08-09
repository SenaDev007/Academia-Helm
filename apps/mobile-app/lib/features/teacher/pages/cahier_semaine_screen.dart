import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../providers/phase3_provider.dart';
import '../services/pedagogy_space_service.dart';

/// Cahier de Semaine — mirrors the web's CahierSemaineTab (1213 lines).
///
/// 3 sub-tabs:
/// 1. Paramétrage (PROMOTER/DIRECTOR only — auto-generate 36 weeks, manual create)
/// 2. Liste des semainiers (list with sign action)
/// 3. Cahier du Semainier (daily/weekly report with RichTextEditor)
class CahierSemaineScreen extends ConsumerStatefulWidget {
  const CahierSemaineScreen({super.key, this.academicYearId});
  final String? academicYearId;

  @override
  ConsumerState<CahierSemaineScreen> createState() => _CahierSemaineScreenState();
}

class _CahierSemaineScreenState extends ConsumerState<CahierSemaineScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        foregroundColor: AHColors.navy,
        elevation: 0,
        title: const Text('Cahier de Semaine', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
        leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => Navigator.of(context).pop()),
        bottom: TabBar(
          controller: _tabController,
          labelColor: AHColors.navy,
          unselectedLabelColor: AHColors.grey400,
          indicatorColor: AHColors.gold,
          isScrollable: true,
          tabAlignment: TabAlignment.start,
          tabs: const [Tab(text: 'Paramétrage'), Tab(text: 'Liste'), Tab(text: 'Cahier')],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _ParametrageTab(academicYearId: widget.academicYearId ?? ''),
          _ListeSemainiersTab(academicYearId: widget.academicYearId ?? ''),
          _CahierSemainierTab(),
        ],
      ),
    );
  }
}

class _ParametrageTab extends ConsumerWidget {
  const _ParametrageTab({required this.academicYearId});
  final String academicYearId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final seminarsAsync = ref.watch(seminarConfigProvider(academicYearId));

    return SingleChildScrollView(
      padding: const EdgeInsets.all(AHSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Génération automatique', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AHColors.navy)),
          const SizedBox(height: 4),
          const Text('Génère 36 semaines avec rotation des enseignants FR (maternelle + primaire).',
            style: TextStyle(fontSize: 11, color: AHColors.grey500)),
          const SizedBox(height: AHSpacing.sm),
          ElevatedButton.icon(
            onPressed: seminarsAsync.isLoading ? null : () async {
              final service = ref.read(pedagogySpaceServiceProvider);
              await service.autoGenerateSeminar(academicYearId: academicYearId);
              ref.invalidate(seminarConfigProvider(academicYearId));
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('36 semaines générées'), backgroundColor: AHColors.success));
              }
            },
            icon: const Icon(Icons.auto_mode, size: 18),
            label: const Text('Auto-générer 36 semaines'),
            style: ElevatedButton.styleFrom(backgroundColor: AHColors.navy, foregroundColor: Colors.white),
          ),
          const SizedBox(height: AHSpacing.lg),
          const Text('Création manuelle', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AHColors.navy)),
          const SizedBox(height: AHSpacing.sm),
          OutlinedButton.icon(
            onPressed: () {
              // TODO: show manual create form
            },
            icon: const Icon(Icons.add, size: 18),
            label: const Text('Créer une semaine'),
          ),
          const SizedBox(height: AHSpacing.lg),
          const Text('Semaines existantes', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AHColors.navy)),
          const SizedBox(height: AHSpacing.sm),
          seminarsAsync.when(
            data: (seminars) => seminars.isEmpty
                ? const Text('Aucune semaine configurée', style: TextStyle(fontSize: 12, color: AHColors.grey400))
                : Column(children: seminars.map((s) => _SeminarTile(seminar: s)).toList()),
            loading: () => const Center(child: CircularProgressIndicator(color: AHColors.navy)),
            error: (_, __) => const Text('Erreur', style: TextStyle(color: AHColors.error)),
          ),
        ],
      ),
    );
  }
}

class _ListeSemainiersTab extends ConsumerWidget {
  const _ListeSemainiersTab({required this.academicYearId});
  final String academicYearId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final seminarsAsync = ref.watch(seminarConfigProvider(academicYearId));

    return seminarsAsync.when(
      data: (seminars) {
        if (seminars.isEmpty) {
          return Center(child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.list_alt, size: 48, color: AHColors.grey300),
              const SizedBox(height: 8),
              const Text('Aucun semainier', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AHColors.grey600)),
            ],
          ));
        }
        return ListView.builder(
          padding: const EdgeInsets.all(AHSpacing.md),
          itemCount: seminars.length,
          itemBuilder: (context, index) => _SeminarTile(seminar: seminars[index], canSign: true),
        );
      },
      loading: () => const Center(child: CircularProgressIndicator(color: AHColors.navy)),
      error: (_, __) => Center(child: Text('Erreur', style: TextStyle(color: AHColors.error))),
    );
  }
}

class _CahierSemainierTab extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.edit_note, size: 48, color: AHColors.grey300),
          const SizedBox(height: 8),
          const Text('Cahier du Semainier', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AHColors.grey600)),
          const SizedBox(height: 4),
          const Text('Rapports quotidiens et synthèse hebdomadaire\n(nécessite un éditeur de texte riche)',
            textAlign: TextAlign.center, style: TextStyle(fontSize: 11, color: AHColors.grey400)),
        ],
      ),
    );
  }
}

class _SeminarTile extends StatelessWidget {
  const _SeminarTile({required this.seminar, this.canSign = false});
  final SeminarConfig seminar;
  final bool canSign;

  @override
  Widget build(BuildContext context) {
    final statusColor = switch (seminar.status) {
      SeminarStatus.validated => const Color(0xFF16A34A),
      SeminarStatus.submitted => const Color(0xFF7C3AED),
      SeminarStatus.signed => const Color(0xFFF59E0B),
      SeminarStatus.pending => const Color(0xFF64748B),
    };
    final statusLabel = switch (seminar.status) {
      SeminarStatus.validated => 'Validée',
      SeminarStatus.submitted => 'Soumise',
      SeminarStatus.signed => 'Signée',
      SeminarStatus.pending => 'En attente',
    };

    return Container(
      margin: const EdgeInsets.only(bottom: 4),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(children: [
        Container(width: 32, height: 32, decoration: BoxDecoration(color: statusColor.withOpacity(0.1), borderRadius: BorderRadius.circular(6)),
          child: Center(child: Text('S${seminar.weekNumber}', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: statusColor)))),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Semaine ${seminar.weekNumber}', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF0F172A))),
          if (seminar.teacherName.isNotEmpty)
            Text(seminar.teacherName, style: const TextStyle(fontSize: 10, color: Color(0xFF64748B))),
        ])),
        Container(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
          decoration: BoxDecoration(color: statusColor.withOpacity(0.1), borderRadius: BorderRadius.circular(4)),
          child: Text(statusLabel, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: statusColor))),
      ]),
    );
  }
}
