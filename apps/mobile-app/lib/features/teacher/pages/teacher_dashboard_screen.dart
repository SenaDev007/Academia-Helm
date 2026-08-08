import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/auth/auth_notifier.dart';
import '../../../core/auth/auth_providers.dart';
import '../../../core/auth/auth_state.dart';
import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../providers/teacher_provider.dart';

/// Teacher dashboard — mirrors the web app's `/app/teacher/page.tsx`.
///
/// Layout (top → bottom):
/// 1. Welcome banner (blue gradient, avatar, name, school · year)
/// 2. Stats grid (4 cards: Mes Classes, Garçons, Filles, Total élèves)
/// 3. "Mes classes assignées" section (grid of class cards)
/// 4. "Mes modules" section (8 colored module cards)
class TeacherDashboardScreen extends ConsumerWidget {
  const TeacherDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final userName = ref.watch(currentUserDisplayNameProvider) ?? 'Enseignant';
    final authState = ref.watch(authNotifierProvider).valueOrNull;
    final user = authState?.userOrNull;
    final teacherId = user?.id ?? '';
    final academicYearId = authState?.selectedTenantIdOrNull;

    final tenants = authState?.availableTenantsOrNull ?? [];
    final tenantId = authState?.selectedTenantIdOrNull;
    final tenant = tenantId != null
        ? tenants.where((t) => t.id == tenantId).firstOrNull
        : null;
    final schoolName = tenant?.name ?? 'École';

    final params = TeacherParams(teacherId: teacherId, academicYearId: academicYearId);
    final stats = ref.watch(teacherStatsProvider(params));
    final classesAsync = ref.watch(teacherClassesProvider(params));

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC), // slate-50
      appBar: AppBar(
        backgroundColor: Colors.white,
        foregroundColor: AHColors.navy,
        elevation: 0,
        title: const Text(
          'Portail Enseignant',
          style: TextStyle(
            fontFamily: 'Inter',
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: AHColors.navy,
          ),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            if (Navigator.of(context).canPop()) {
              Navigator.of(context).pop();
            } else {
              context.go('/dashboard');
            }
          },
        ),
      ),
      body: RefreshIndicator(
        color: AHColors.navy,
        onRefresh: () async {
          ref.invalidate(teacherClassesProvider(params));
        },
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(AHSpacing.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 1. Welcome banner
              _WelcomeBanner(
                teacherName: userName,
                schoolName: schoolName,
                academicYear: '2025-2026',
              ),
              const SizedBox(height: AHSpacing.md),

              // 2. Stats grid (4 cards)
              _StatsGrid(stats: stats),
              const SizedBox(height: AHSpacing.lg),

              // 3. Mes classes assignées
              classesAsync.when(
                data: (classes) {
                  if (classes.isEmpty) return const SizedBox.shrink();
                  return _AssignedClassesSection(classes: classes);
                },
                loading: () => const Padding(
                  padding: EdgeInsets.all(32),
                  child: Center(
                    child: CircularProgressIndicator(color: AHColors.navy),
                  ),
                ),
                error: (_, __) => const SizedBox.shrink(),
              ),
              const SizedBox(height: AHSpacing.lg),

              // 4. Mes modules (8 colored cards)
              const _ModulesSection(),
              const SizedBox(height: AHSpacing.xxl),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Welcome Banner ─────────────────────────────────────────────────────

class _WelcomeBanner extends StatelessWidget {
  const _WelcomeBanner({
    required this.teacherName,
    required this.schoolName,
    required this.academicYear,
  });

  final String teacherName;
  final String schoolName;
  final String academicYear;

  @override
  Widget build(BuildContext context) {
    final initials = teacherName.isNotEmpty
        ? teacherName.split(' ').take(2).map((n) => n[0]).join().toUpperCase()
        : 'EN';

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AHSpacing.lg),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF2563EB), Color(0xFF1D4ED8)], // blue-600 → blue-700
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
        ),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.2),
              shape: BoxShape.circle,
              border: Border.all(color: Colors.white.withOpacity(0.3), width: 2),
            ),
            child: Center(
              child: Text(
                initials,
                style: const TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: Colors.white,
                ),
              ),
            ),
          ),
          const SizedBox(width: AHSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Bienvenue, $teacherName',
                  style: const TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: Colors.white,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  '$schoolName · $academicYear',
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 12,
                    color: Colors.blue[100],
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Stats Grid (4 cards) ────────────────────────────────────────────────

class _StatsGrid extends StatelessWidget {
  const _StatsGrid({required this.stats});

  final TeacherStats? stats;

  @override
  Widget build(BuildContext context) {
    final value = stats != null ? '${stats!.totalClasses}' : '…';
    final boys = stats != null ? '${stats!.totalBoys}' : '…';
    final girls = stats != null ? '${stats!.totalGirls}' : '…';
    final total = stats != null ? '${stats!.totalStudents}' : '…';

    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: AHSpacing.sm,
      crossAxisSpacing: AHSpacing.sm,
      childAspectRatio: 1.8,
      children: [
        _StatCard(
          label: 'Mes Classes',
          value: value,
          iconColor: const Color(0xFF2563EB), // blue-600
        ),
        _StatCard(
          label: 'Garçons',
          value: boys,
          iconColor: const Color(0xFF0891B2), // cyan-600
        ),
        _StatCard(
          label: 'Filles',
          value: girls,
          iconColor: const Color(0xFFDB2777), // pink-600
        ),
        _StatCard(
          label: 'Total élèves',
          value: total,
          iconColor: const Color(0xFF059669), // emerald-600
        ),
      ],
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.label,
    required this.value,
    required this.iconColor,
  });

  final String label;
  final String value;
  final Color iconColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AHSpacing.md),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)), // slate-200
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Icon(Icons.people_outline, size: 16, color: iconColor),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  label.toUpperCase(),
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 9,
                    fontWeight: FontWeight.w700,
                    color: const Color(0xFF64748B), // slate-500
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          Text(
            value,
            style: const TextStyle(
              fontFamily: 'Inter',
              fontSize: 22,
              fontWeight: FontWeight.w800,
              color: Color(0xFF0F172A), // slate-900
            ),
          ),
        ],
      ),
    );
  }
}

// ── Assigned Classes Section ────────────────────────────────────────────

class _AssignedClassesSection extends StatelessWidget {
  const _AssignedClassesSection({required this.classes});

  final List<TeacherClass> classes;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'MES CLASSES ASSIGNÉES',
          style: TextStyle(
            fontFamily: 'Inter',
            fontSize: 11,
            fontWeight: FontWeight.w800,
            color: Color(0xFF334155), // slate-700
          ),
        ),
        const SizedBox(height: AHSpacing.sm),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            mainAxisSpacing: 8,
            crossAxisSpacing: 8,
            childAspectRatio: 1.4,
          ),
          itemCount: classes.length,
          itemBuilder: (context, index) {
            return _ClassCard(cls: classes[index]);
          },
        ),
      ],
    );
  }
}

class _ClassCard extends StatelessWidget {
  const _ClassCard({required this.cls});

  final TeacherClass cls;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: () => context.push('/pedagogy'),
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.all(AHSpacing.md),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                cls.className,
                style: const TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF0F172A),
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 2),
              Text(
                cls.schoolLevelName,
                style: const TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 10,
                  color: Color(0xFF64748B),
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const Spacer(),
              Row(
                children: [
                  Text(
                    '${cls.totalStudents} élèves',
                    style: const TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF334155),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    '${cls.boys}G',
                    style: const TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 10,
                      color: Color(0xFF0891B2), // cyan-600
                    ),
                  ),
                  const SizedBox(width: 4),
                  Text(
                    '${cls.girls}F',
                    style: const TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 10,
                      color: Color(0xFFDB2777), // pink-600
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Modules Section (8 colored cards) ───────────────────────────────────

class _ModulesSection extends StatelessWidget {
  const _ModulesSection();

  static const _modules = <_ModuleDef>[
    _ModuleDef(
      label: 'Emploi du Temps',
      description: 'Consulter votre emploi du temps',
      icon: Icons.calendar_month_outlined,
      route: '/schedule',
      bgColor: Color(0xFFFAF5FF), // purple-50
      textColor: Color(0xFF6B21A8), // purple-700
      borderColor: Color(0xFFE9D5FF), // purple-200
    ),
    _ModuleDef(
      label: 'Espace Pédagogique',
      description: 'Cahier journal, fiches, registre d\'appel',
      icon: Icons.menu_book_outlined,
      route: '/pedagogy',
      bgColor: Color(0xFFEFF6FF), // blue-50
      textColor: Color(0xFF1D4ED8), // blue-700
      borderColor: Color(0xFFBFDBFE), // blue-200
    ),
    _ModuleDef(
      label: 'Travaux & Suivi',
      description: 'Tâches assignées, suivi pédagogique',
      icon: Icons.assignment_outlined,
      route: '/pedagogy',
      bgColor: Color(0xFFFFFBEB), // amber-50
      textColor: Color(0xFFB45309), // amber-700
      borderColor: Color(0xFFFDE68A), // amber-200
    ),
    _ModuleDef(
      label: 'Examens & Notes',
      description: 'Mes évaluations, saisie des notes',
      icon: Icons.edit_note_outlined,
      route: '/grades',
      bgColor: Color(0xFFFFF1F2), // rose-50
      textColor: Color(0xFFBE123C), // rose-700
      borderColor: Color(0xFFFECDD3), // rose-200
    ),
    _ModuleDef(
      label: 'EduCast',
      description: 'Vidéos pédagogiques, podcasts',
      icon: Icons.video_library_outlined,
      route: '/educast',
      bgColor: Color(0xFFFDF2F8), // pink-50
      textColor: Color(0xFFBE185D), // pink-700
      borderColor: Color(0xFFFBCFE8), // pink-200
    ),
    _ModuleDef(
      label: 'Bibliothèque',
      description: 'Ressources pédagogiques',
      icon: Icons.local_library_outlined,
      route: '/library',
      bgColor: Color(0xFFF8FAFC), // slate-50
      textColor: Color(0xFF334155), // slate-700
      borderColor: Color(0xFFE2E8F0), // slate-200
    ),
    _ModuleDef(
      label: 'ORION',
      description: 'Alertes pédagogiques',
      icon: Icons.bar_chart_outlined,
      route: '/orion',
      bgColor: Color(0xFFEEF2FF), // indigo-50
      textColor: Color(0xFF4338CA), // indigo-700
      borderColor: Color(0xFFC7D2FE), // indigo-200
    ),
    _ModuleDef(
      label: 'Communication',
      description: 'Messages, chats, annonces',
      icon: Icons.chat_bubble_outline,
      route: '/communication',
      bgColor: Color(0xFFF0FDFA), // teal-50
      textColor: Color(0xFF0F766E), // teal-700
      borderColor: Color(0xFF99F6E4), // teal-200
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Mes modules',
          style: TextStyle(
            fontFamily: 'Inter',
            fontSize: 16,
            fontWeight: FontWeight.w800,
            color: Color(0xFF0F172A),
          ),
        ),
        const SizedBox(height: AHSpacing.md),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            mainAxisSpacing: 8,
            crossAxisSpacing: 8,
            childAspectRatio: 1.0,
          ),
          itemCount: _modules.length,
          itemBuilder: (context, index) {
            final mod = _modules[index];
            return _ModuleCard(module: mod);
          },
        ),
      ],
    );
  }
}

class _ModuleDef {
  const _ModuleDef({
    required this.label,
    required this.description,
    required this.icon,
    required this.route,
    required this.bgColor,
    required this.textColor,
    required this.borderColor,
  });

  final String label;
  final String description;
  final IconData icon;
  final String route;
  final Color bgColor;
  final Color textColor;
  final Color borderColor;
}

class _ModuleCard extends StatelessWidget {
  const _ModuleCard({required this.module});

  final _ModuleDef module;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: module.bgColor,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: () => context.push(module.route),
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.all(AHSpacing.md),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: module.borderColor),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Icon(module.icon, size: 24, color: module.textColor),
              const SizedBox(height: 4),
              Text(
                module.label,
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: module.textColor,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 2),
              Text(
                module.description,
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 9,
                  color: module.textColor.withOpacity(0.7),
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
