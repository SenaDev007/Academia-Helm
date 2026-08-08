import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../providers/phase3_provider.dart';
import '../providers/teacher_provider.dart';

/// Fiches Pédagogiques — mirrors the web's PedagogicalSheetsTab.
///
/// 5 sheet types: MATH, FRANCAIS, EST, ES, EA
/// Each with type-specific I.bis sections, 7 RichText planning fields,
/// dynamic Déroulement table, Retour et projection, signatures.
/// Status: DRAFT → SUBMITTED → VALIDATED / REJECTED
class FichesPedagogiquesScreen extends ConsumerWidget {
  const FichesPedagogiquesScreen({super.key, required this.teacherId, this.academicYearId});

  final String teacherId;
  final String? academicYearId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final params = TeacherParams(teacherId: teacherId, academicYearId: academicYearId);
    final fichesAsync = ref.watch(fichesProvider(params));

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        foregroundColor: AHColors.navy,
        elevation: 0,
        title: const Text('Fiches Pédagogiques', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
        leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => Navigator.of(context).pop()),
        actions: [
          IconButton(icon: const Icon(Icons.refresh, color: AHColors.navy),
            onPressed: () => ref.invalidate(fichesProvider(params))),
          IconButton(icon: const Icon(Icons.add, color: AHColors.navy),
            onPressed: () => _showCreateSheet(context)),
        ],
      ),
      body: fichesAsync.when(
        data: (fiches) {
          if (fiches.isEmpty) return _buildEmpty(context);
          // Group by sheet type
          final grouped = <FicheType, List<FichePedagogique>>{};
          for (final f in fiches) {
            grouped.putIfAbsent(f.sheetType, () => []).add(f);
          }
          return ListView.builder(
            padding: const EdgeInsets.all(AHSpacing.md),
            itemCount: grouped.length,
            itemBuilder: (context, index) {
              final type = grouped.keys.elementAt(index);
              final items = grouped[type]!;
              return _FicheTypeSection(type: type, fiches: items);
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
          Icon(Icons.note_add, size: 64, color: AHColors.grey300),
          const SizedBox(height: AHSpacing.md),
          const Text('Aucune fiche pédagogique',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AHColors.grey600)),
          const SizedBox(height: 4),
          const Text('Créez une fiche avec le bouton +',
            style: TextStyle(fontSize: 12, color: AHColors.grey400)),
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
          ElevatedButton(onPressed: () => ref.invalidate(fichesProvider(params)),
            style: ElevatedButton.styleFrom(backgroundColor: AHColors.navy, foregroundColor: Colors.white),
            child: const Text('Réessayer')),
        ],
      ),
    );
  }

  void _showCreateSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      builder: (context) => Container(
        padding: const EdgeInsets.all(AHSpacing.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Nouvelle fiche', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AHColors.navy)),
            const SizedBox(height: AHSpacing.md),
            ...FicheType.values.map((type) => _TypeTile(type: type, onTap: () {
              Navigator.pop(context);
              // TODO: navigate to fiche form
            })),
          ],
        ),
      ),
    );
  }
}

class _FicheTypeSection extends StatelessWidget {
  const _FicheTypeSection({required this.type, required this.fiches});
  final FicheType type;
  final List<FichePedagogique> fiches;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Row(
            children: [
              Container(width: 8, height: 8, decoration: BoxDecoration(color: type.color, shape: BoxShape.circle)),
              const SizedBox(width: 6),
              Text(type.label.toUpperCase(),
                style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: type.color)),
              const SizedBox(width: 4),
              Text('(${fiches.length})',
                style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: type.color.withOpacity(0.7))),
            ],
          ),
        ),
        ...fiches.map((f) => _FicheCard(fiche: f, typeColor: type.color)),
        const SizedBox(height: AHSpacing.md),
      ],
    );
  }
}

class _FicheCard extends StatelessWidget {
  const _FicheCard({required this.fiche, required this.typeColor});
  final FichePedagogique fiche;
  final Color typeColor;

  @override
  Widget build(BuildContext context) {
    final statusColor = switch (fiche.status) {
      FicheStatus.validated => const Color(0xFF16A34A),
      FicheStatus.submitted => const Color(0xFF7C3AED),
      FicheStatus.rejected => const Color(0xFFDC2626),
      FicheStatus.draft => const Color(0xFF64748B),
    };
    final statusLabel = switch (fiche.status) {
      FicheStatus.validated => 'Validée',
      FicheStatus.submitted => 'Soumise',
      FicheStatus.rejected => 'Rejetée',
      FicheStatus.draft => 'Brouillon',
    };

    return Card(
      color: Colors.white,
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 4),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8), side: BorderSide(color: const Color(0xFFE2E8F0))),
      child: InkWell(
        onTap: () {
          // TODO: navigate to fiche editor
        },
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Icon(Icons.note, size: 18, color: typeColor),
              const SizedBox(width: 8),
              Expanded(child: Text(fiche.title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)), maxLines: 1, overflow: TextOverflow.ellipsis)),
              Container(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(color: statusColor.withOpacity(0.1), borderRadius: BorderRadius.circular(4)),
                child: Text(statusLabel, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: statusColor))),
            ]),
            if (fiche.className.isNotEmpty || fiche.subjectName.isNotEmpty) ...[
              const SizedBox(height: 4),
              Row(children: [
                if (fiche.className.isNotEmpty) ...[
                  Icon(Icons.school, size: 12, color: AHColors.grey400),
                  const SizedBox(width: 2),
                  Text(fiche.className, style: const TextStyle(fontSize: 10, color: Color(0xFF64748B))),
                  const SizedBox(width: 8),
                ],
                if (fiche.subjectName.isNotEmpty) ...[
                  Icon(Icons.book, size: 12, color: AHColors.grey400),
                  const SizedBox(width: 2),
                  Text(fiche.subjectName, style: const TextStyle(fontSize: 10, color: Color(0xFF64748B))),
                ],
              ]),
            ],
          ]),
        ),
      ),
    );
  }
}

class _TypeTile extends StatelessWidget {
  const _TypeTile({required this.type, required this.onTap});
  final FicheType type;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
        child: Row(children: [
          Container(width: 32, height: 32, decoration: BoxDecoration(color: type.color.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
            child: Icon(Icons.note_add, size: 18, color: type.color)),
          const SizedBox(width: 12),
          Expanded(child: Text(type.label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AHColors.navy))),
          const Icon(Icons.chevron_right, color: AHColors.grey300, size: 20),
        ]),
      ),
    );
  }
}
