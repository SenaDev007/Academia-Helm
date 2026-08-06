import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../../../core/widgets/ah_logo_circle.dart';

/// Mobile version of the public Academia Helm landing page.
///
/// Mirrors the web app's PremiumLandingPage sections:
/// - Hero (Le cockpit digital de votre établissement)
/// - Features (4 cards: Pilotage centralisé, ORION, Offline-first, Sécurité)
/// - Modules bento (6 modules)
/// - ORION IA section
/// - Tarification (3 plans: SEED, GROW, LEAD)
/// - Final CTA
/// - Footer (contact, links, social, copyright)
///
/// Replaces the old "Plateforme" portal button — gives users access to
/// public information about Academia Helm directly from the mobile app.
class LandingPageScreen extends ConsumerWidget {
  const LandingPageScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      backgroundColor: AHColors.navy,
      body: CustomScrollView(
        slivers: [
          // ── App Bar (transparent over navy) ──────────────────────
          SliverAppBar(
            backgroundColor: AHColors.navy,
            pinned: true,
            expandedHeight: 0,
            leading: IconButton(
              icon: const Icon(Icons.arrow_back, color: Colors.white),
              onPressed: () => context.go('/portal-select'),
            ),
            title: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Academia',
                  style: TextStyle(
                    fontFamily: 'Inter',
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                SizedBox(width: 4),
                Text(
                  'Helm',
                  style: TextStyle(
                    fontFamily: 'Inter',
                    color: AHColors.gold,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => context.go('/portal-select'),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: AHColors.gold,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: const Text(
                    'Portails',
                    style: TextStyle(
                      fontFamily: 'Inter',
                      color: AHColors.navy,
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
            ],
          ),

          // ── Hero Section ──────────────────────────────────────────
          SliverToBoxAdapter(child: _buildHeroSection(context)),

          // ── Features Section ─────────────────────────────────────
          SliverToBoxAdapter(child: _buildFeaturesSection()),

          // ── Modules Section ─────────────────────────────────────
          SliverToBoxAdapter(child: _buildModulesSection()),

          // ── ORION IA Section ─────────────────────────────────────
          SliverToBoxAdapter(child: _buildOrionSection()),

          // ── Tarification Section ─────────────────────────────────
          SliverToBoxAdapter(child: _buildPricingSection()),

          // ── Final CTA ────────────────────────────────────────────
          SliverToBoxAdapter(child: _buildFinalCTA(context)),

          // ── Footer ────────────────────────────────────────────────
          SliverToBoxAdapter(child: _buildFooter(context)),
        ],
      ),
    );
  }

  // ── HERO ─────────────────────────────────────────────────────────────

  Widget _buildHeroSection(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [AHColors.navyDark, AHColors.navy, AHColors.blue],
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
        ),
      ),
      padding: const EdgeInsets.symmetric(
        horizontal: AHSpacing.xl,
        vertical: AHSpacing.xxl,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            decoration: BoxDecoration(
              color: AHColors.gold.withOpacity(0.15),
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: AHColors.gold.withOpacity(0.3)),
            ),
            child: const Text(
              'PLATEFORME DE PILOTAGE ÉDUCATIF',
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 9,
                fontWeight: FontWeight.w700,
                letterSpacing: 1.2,
                color: AHColors.gold,
              ),
            ),
          ),
          const SizedBox(height: AHSpacing.lg),
          const Text(
            'Le cockpit digital de votre établissement.',
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 28,
              fontWeight: FontWeight.w800,
              color: Colors.white,
              height: 1.2,
            ),
          ),
          const SizedBox(height: AHSpacing.md),
          const Text(
            'Academia Helm unifie toute la gestion scolaire dans une interface claire, élégante et robuste. Vous pilotez, vos équipes exécutent, l\'institution progresse.',
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 14,
              color: Colors.white70,
              height: 1.5,
            ),
          ),
          const SizedBox(height: AHSpacing.xl),
          Row(
            children: [
              Expanded(
                child: ElevatedButton(
                  onPressed: () => _launchUrl('https://app.academiahelm.com/signup'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AHColors.gold,
                    foregroundColor: AHColors.navy,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: const Text(
                    'Démarrer maintenant',
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: AHSpacing.md),
              Expanded(
                child: OutlinedButton(
                  onPressed: () => context.go('/portal-select'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.white,
                    side: BorderSide(color: Colors.white.withOpacity(0.4)),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: const Text(
                    'Accéder au portail',
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AHSpacing.xl),
          Row(
            children: [
              Expanded(child: _buildStatTile('+12%', 'Taux de recouvrement')),
              const SizedBox(width: AHSpacing.md),
              Expanded(child: _buildStatTile('-8%', 'Absentéisme')),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStatTile(String value, String label) {
    return Container(
      padding: const EdgeInsets.all(AHSpacing.md),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.white.withOpacity(0.1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            value,
            style: const TextStyle(
              fontFamily: 'Inter',
              fontSize: 22,
              fontWeight: FontWeight.w800,
              color: AHColors.gold,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 11,
              color: Colors.white.withOpacity(0.7),
            ),
          ),
        ],
      ),
    );
  }

  // ── FEATURES ─────────────────────────────────────────────────────────

  Widget _buildFeaturesSection() {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.symmetric(
        horizontal: AHSpacing.xl,
        vertical: AHSpacing.xxl,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.auto_awesome, size: 14, color: AHColors.gold),
              const SizedBox(width: 6),
              Text(
                'POURQUOI ACADEMIA HELM',
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.2,
                  color: AHColors.gold,
                ),
              ),
            ],
          ),
          const SizedBox(height: AHSpacing.md),
          const Text(
            'Une direction scolaire moderne, sans compromis',
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 22,
              fontWeight: FontWeight.w800,
              color: AHColors.navy,
              height: 1.3,
            ),
          ),
          const SizedBox(height: AHSpacing.sm),
          Text(
            'Pensée pour les écoles exigeantes : fiabilité opérationnelle, performance mesurable, lisibilité totale.',
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 13,
              color: AHColors.grey500,
              height: 1.5,
            ),
          ),
          const SizedBox(height: AHSpacing.xl),
          _buildFeatureCard(
            number: '01',
            icon: Icons.people_outline,
            title: 'Pilotage centralisé',
            description:
                'Décisions basées sur des indicateurs fiables : élèves, finances, examens, RH. Un cockpit unique pour toute la direction.',
            stat: '360°',
            statLabel: 'visibilité temps réel',
          ),
          const SizedBox(height: AHSpacing.md),
          _buildFeatureCard(
            number: '02',
            icon: Icons.psychology_outlined,
            title: 'ORION intégré',
            description:
                'L\'IA de direction qui transforme vos données en alertes intelligentes, priorités automatiques et recommandations concrètes.',
            stat: 'IA',
            statLabel: 'décisionnelle native',
          ),
          const SizedBox(height: AHSpacing.md),
          _buildFeatureCard(
            number: '03',
            icon: Icons.wifi_off_outlined,
            title: 'Offline-first',
            description:
                'Continuité totale des opérations même sans internet. Saisies locales journalisées, puis synchronisation sécurisée automatique.',
            stat: '24/7',
            statLabel: 'disponibilité réseau',
          ),
          const SizedBox(height: AHSpacing.md),
          _buildFeatureCard(
            number: '04',
            icon: Icons.verified_user_outlined,
            title: 'Conformité & sécurité',
            description:
                'Architecture multi-tenant stricte, RBAC granulaire, audit immuable, RLS PostgreSQL. Vos données restent souveraines et tracées.',
            stat: 'RBAC',
            statLabel: '+ audit immuable',
          ),
        ],
      ),
    );
  }

  Widget _buildFeatureCard({
    required String number,
    required IconData icon,
    required String title,
    required String description,
    required String stat,
    required String statLabel,
  }) {
    return Container(
      padding: const EdgeInsets.all(AHSpacing.lg),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [AHColors.navy.withOpacity(0.04), AHColors.blue.withOpacity(0.02)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AHColors.navy.withOpacity(0.1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  gradient: LinearGradient(colors: [AHColors.navy, AHColors.blue]),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, color: Colors.white, size: 20),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: AHColors.gold.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  stat,
                  style: const TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    color: AHColors.gold,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AHSpacing.md),
          Text(
            title,
            style: const TextStyle(
              fontFamily: 'Inter',
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: AHColors.navy,
            ),
          ),
          const SizedBox(height: AHSpacing.xs),
          Text(
            description,
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 12,
              color: AHColors.grey500,
              height: 1.5,
            ),
          ),
          const SizedBox(height: AHSpacing.sm),
          Text(
            statLabel,
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 10,
              fontWeight: FontWeight.w600,
              color: AHColors.grey400,
            ),
          ),
        ],
      ),
    );
  }

  // ── MODULES ──────────────────────────────────────────────────────────

  Widget _buildModulesSection() {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [AHColors.navyDark, AHColors.navy, AHColors.navyDark],
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
        ),
      ),
      padding: const EdgeInsets.symmetric(
        horizontal: AHSpacing.xl,
        vertical: AHSpacing.xxl,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.grid_view, size: 14, color: AHColors.gold),
              const SizedBox(width: 6),
              Text(
                'MODULES DE L\'APPLICATION',
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.2,
                  color: AHColors.gold,
                ),
              ),
            ],
          ),
          const SizedBox(height: AHSpacing.md),
          const Text(
            'Une suite complète pour piloter toute l\'institution',
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 22,
              fontWeight: FontWeight.w800,
              color: Colors.white,
              height: 1.3,
            ),
          ),
          const SizedBox(height: AHSpacing.sm),
          Text(
            'Six modules essentiels couvrant le cœur du pilotage éducatif.',
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 13,
              color: Colors.white70,
            ),
          ),
          const SizedBox(height: AHSpacing.xl),
          _buildModuleCard(
            icon: Icons.school_outlined,
            title: 'Élèves & Scolarité',
            description:
                'Admissions, dossiers numériques, absences, transferts inter-écoles, documents officiels.',
            featured: true,
          ),
          const SizedBox(height: AHSpacing.md),
          _buildModuleCard(
            icon: Icons.account_balance_outlined,
            title: 'Finances & Économat',
            description:
                'Paiements, recouvrement, dépenses, trésorerie, clôtures journalières et reçus certifiés.',
          ),
          const SizedBox(height: AHSpacing.md),
          _buildModuleCard(
            icon: Icons.assignment_turned_in_outlined,
            title: 'Examens & Bulletins',
            description:
                'Saisie des notes, calculs automatiques, bulletins PDF, conseils de classe.',
          ),
          const SizedBox(height: AHSpacing.md),
          _buildModuleCard(
            icon: Icons.calendar_view_week_outlined,
            title: 'Organisation pédagogique',
            description:
                'Classes, matières, emploi du temps, cahiers de texte, plans de leçon.',
            featured: true,
          ),
          const SizedBox(height: AHSpacing.md),
          _buildModuleCard(
            icon: Icons.badge_outlined,
            title: 'RH & Personnel',
            description:
                'Contrats, présence, paie, CNSS, rôles, habilitations, organigramme.',
          ),
          const SizedBox(height: AHSpacing.md),
          _buildModuleCard(
            icon: Icons.chat_bubble_outline,
            title: 'Communication',
            description:
                'SMS, e-mail, WhatsApp, annonces, templates, automatisations et messagerie interne.',
          ),
          const SizedBox(height: AHSpacing.lg),
          Text(
            '+ 7 modules complémentaires : Transport, Cantine, Infirmerie, Bibliothèque, Laboratoire, Boutique, EduCast',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 11,
              fontStyle: FontStyle.italic,
              color: Colors.white54,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildModuleCard({
    required IconData icon,
    required String title,
    required String description,
    bool featured = false,
  }) {
    return Container(
      padding: const EdgeInsets.all(AHSpacing.lg),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.06),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: featured ? AHColors.gold.withOpacity(0.4) : Colors.white.withOpacity(0.1),
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: AHColors.gold.withOpacity(0.15),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: AHColors.gold, size: 22),
          ),
          const SizedBox(width: AHSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        title,
                        style: const TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                        ),
                      ),
                    ),
                    if (featured)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: AHColors.gold,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: const Text(
                          'Cœur',
                          style: TextStyle(
                            fontFamily: 'Inter',
                            fontSize: 9,
                            fontWeight: FontWeight.w700,
                            color: AHColors.navy,
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  description,
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 11,
                    color: Colors.white70,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ── ORION IA ─────────────────────────────────────────────────────────

  Widget _buildOrionSection() {
    return Container(
      color: const Color(0xFFFEF3C7),
      padding: const EdgeInsets.symmetric(
        horizontal: AHSpacing.xl,
        vertical: AHSpacing.xxl,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.psychology, size: 14, color: AHColors.navy),
              const SizedBox(width: 6),
              Text(
                'ORION IA DE DIRECTION',
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.2,
                  color: AHColors.navy,
                ),
              ),
            ],
          ),
          const SizedBox(height: AHSpacing.md),
          const Text(
            'ORION vous aide à décider plus vite et plus juste.',
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 22,
              fontWeight: FontWeight.w800,
              color: AHColors.navy,
              height: 1.3,
            ),
          ),
          const SizedBox(height: AHSpacing.sm),
          Text(
            'Alertes intelligentes, priorités automatiques, lecture immédiate de la santé académique et financière.',
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 13,
              color: AHColors.grey700,
              height: 1.5,
            ),
          ),
          const SizedBox(height: AHSpacing.xl),
          Container(
            padding: const EdgeInsets.all(AHSpacing.lg),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: AHColors.navy.withOpacity(0.08),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: AHColors.navy,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Icon(Icons.psychology, color: AHColors.gold, size: 20),
                    ),
                    const SizedBox(width: AHSpacing.sm),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Simulation ORION',
                            style: TextStyle(
                              fontFamily: 'Inter',
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: AHColors.navy,
                            ),
                          ),
                          Text(
                            'Analyse hebdomadaire',
                            style: TextStyle(
                              fontFamily: 'Inter',
                              fontSize: 10,
                              color: AHColors.grey500,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: const Color(0xFF16A34A),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.circle, color: Colors.white, size: 6),
                          SizedBox(width: 4),
                          Text(
                            'Live',
                            style: TextStyle(
                              fontFamily: 'Inter',
                              fontSize: 9,
                              fontWeight: FontWeight.w700,
                              color: Colors.white,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AHSpacing.md),
                Row(
                  children: [
                    Expanded(child: _buildOrionKpi('+12%', 'Recouvrement', const Color(0xFF16A34A))),
                    const SizedBox(width: 8),
                    Expanded(child: _buildOrionKpi('-8%', 'Absentéisme', const Color(0xFF16A34A))),
                    const SizedBox(width: 8),
                    Expanded(child: _buildOrionKpi('3 classes', 'Retards', const Color(0xFFF59E0B))),
                  ],
                ),
                const SizedBox(height: AHSpacing.md),
                Container(
                  padding: const EdgeInsets.all(AHSpacing.md),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(colors: [AHColors.navy, AHColors.blue]),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(Icons.auto_awesome, size: 14, color: AHColors.gold),
                          const SizedBox(width: 6),
                          Text(
                            'Recommandation ORION',
                            style: TextStyle(
                              fontFamily: 'Inter',
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: AHColors.gold,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        '«Votre taux de recouvrement progresse de 12%. Les retards sont concentrés sur 3 classes. Recommandation : lancer une relance ciblée avant vendredi.»',
                        style: TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 12,
                          color: Colors.white,
                          fontStyle: FontStyle.italic,
                          height: 1.5,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildOrionKpi(String value, String label, Color color) {
    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        children: [
          Text(
            value,
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 14,
              fontWeight: FontWeight.w800,
              color: color,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: TextStyle(fontFamily: 'Inter', fontSize: 9, color: AHColors.grey600),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  // ── PRICING ──────────────────────────────────────────────────────────

  Widget _buildPricingSection() {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(colors: [AHColors.navyDark, AHColors.navy, AHColors.navyDark]),
      ),
      padding: const EdgeInsets.symmetric(horizontal: AHSpacing.xl, vertical: AHSpacing.xxl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.wallet_outlined, size: 14, color: AHColors.gold),
              const SizedBox(width: 6),
              Text(
                'TARIFICATION TRANSPARENTE',
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.2,
                  color: AHColors.gold,
                ),
              ),
            ],
          ),
          const SizedBox(height: AHSpacing.md),
          const Text(
            'Une offre claire, évolutive et institutionnelle',
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 22,
              fontWeight: FontWeight.w800,
              color: Colors.white,
              height: 1.3,
            ),
          ),
          const SizedBox(height: AHSpacing.xl),
          _buildPricingCard(
            name: 'SEED',
            badge: '1 à 150 élèves',
            tagline: 'Pour démarrer',
            description: 'Idéal pour les petites structures : tous les modules essentiels inclus.',
            features: const ['Modules cœur inclus', 'Support standard', 'Offline-first', '1 établissement'],
            featured: false,
          ),
          const SizedBox(height: AHSpacing.md),
          _buildPricingCard(
            name: 'GROW',
            badge: '151 à 400 élèves',
            tagline: 'Pour croître',
            description: 'Pour les établissements en croissance : modules avancés, ORION IA.',
            features: const ['Modules cœur + avancés', 'ORION IA inclus', 'Support prioritaire', 'Options activables'],
            featured: true,
          ),
          const SizedBox(height: AHSpacing.md),
          _buildPricingCard(
            name: 'LEAD',
            badge: '401+ élèves',
            tagline: 'Pour leader',
            description: 'Pour les grandes institutions et groupes scolaires.',
            features: const ['Tous modules + EduCast', 'ORION + ATLAS', 'Account manager dédié', 'SLA sur-mesure'],
            featured: false,
          ),
        ],
      ),
    );
  }

  Widget _buildPricingCard({
    required String name,
    required String badge,
    required String tagline,
    required String description,
    required List<String> features,
    required bool featured,
  }) {
    return Container(
      padding: const EdgeInsets.all(AHSpacing.lg),
      decoration: BoxDecoration(
        color: featured ? AHColors.gold.withOpacity(0.08) : Colors.white.withOpacity(0.04),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: featured ? AHColors.gold : Colors.white.withOpacity(0.1),
          width: featured ? 2 : 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (featured)
            Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(color: AHColors.gold, borderRadius: BorderRadius.circular(4)),
              child: const Text(
                'Recommandé',
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 9,
                  fontWeight: FontWeight.w700,
                  color: AHColors.navy,
                ),
              ),
            ),
          Row(
            children: [
              Text(
                name,
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: featured ? AHColors.gold : Colors.white,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    badge,
                    style: const TextStyle(fontFamily: 'Inter', fontSize: 9, color: Colors.white70),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            tagline,
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 12,
              fontStyle: FontStyle.italic,
              color: Colors.white70,
            ),
          ),
          const SizedBox(height: AHSpacing.sm),
          Text(
            description,
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 12,
              color: Colors.white60,
              height: 1.4,
            ),
          ),
          const SizedBox(height: AHSpacing.md),
          ...features.map((f) => Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Row(
                  children: [
                    Icon(Icons.check_circle, size: 14, color: AHColors.gold),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        f,
                        style: const TextStyle(fontFamily: 'Inter', fontSize: 12, color: Colors.white),
                      ),
                    ),
                  ],
                ),
              )),
        ],
      ),
    );
  }

  // ── FINAL CTA ────────────────────────────────────────────────────────

  Widget _buildFinalCTA(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(colors: [AHColors.navy, AHColors.blue]),
      ),
      padding: const EdgeInsets.symmetric(horizontal: AHSpacing.xl, vertical: AHSpacing.xxl),
      child: Column(
        children: [
          Icon(Icons.school, size: 48, color: AHColors.gold),
          const SizedBox(height: AHSpacing.md),
          const Text(
            'Passez au pilotage scolaire nouvelle génération',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 22,
              fontWeight: FontWeight.w800,
              color: Colors.white,
              height: 1.3,
            ),
          ),
          const SizedBox(height: AHSpacing.sm),
          Text(
            'Équipez votre établissement d\'un système fiable, élégant et prêt pour la croissance.',
            textAlign: TextAlign.center,
            style: TextStyle(fontFamily: 'Inter', fontSize: 13, color: Colors.white70),
          ),
          const SizedBox(height: AHSpacing.xl),
          ElevatedButton(
            onPressed: () => _launchUrl('https://app.academiahelm.com/signup'),
            style: ElevatedButton.styleFrom(
              backgroundColor: AHColors.gold,
              foregroundColor: AHColors.navy,
              minimumSize: const Size(double.infinity, 52),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: const Text(
              'Créer mon établissement',
              style: TextStyle(fontFamily: 'Inter', fontSize: 15, fontWeight: FontWeight.w700),
            ),
          ),
          const SizedBox(height: AHSpacing.md),
          OutlinedButton(
            onPressed: () => context.go('/portal-select'),
            style: OutlinedButton.styleFrom(
              foregroundColor: Colors.white,
              side: BorderSide(color: Colors.white.withOpacity(0.4)),
              minimumSize: const Size(double.infinity, 52),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: const Text(
              'Accéder à un portail',
              style: TextStyle(fontFamily: 'Inter', fontSize: 15, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }

  // ── FOOTER ───────────────────────────────────────────────────────────

  Widget _buildFooter(BuildContext context) {
    return Container(
      color: AHColors.navy,
      padding: const EdgeInsets.symmetric(horizontal: AHSpacing.xl, vertical: AHSpacing.xxl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(AHSpacing.lg),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.05),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Contactez-nous',
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Notre équipe est à votre écoute',
                  style: TextStyle(fontFamily: 'Inter', fontSize: 12, color: Colors.white70),
                ),
                const SizedBox(height: AHSpacing.md),
                _buildContactRow(Icons.email, 'support@academiahelm.com'),
                const SizedBox(height: 8),
                _buildContactRow(Icons.phone, '+229 01 41 36 08 03'),
                const SizedBox(height: 8),
                _buildContactRow(Icons.location_on, 'Parakou, Bénin — Afrique de l\'Ouest'),
              ],
            ),
          ),
          const SizedBox(height: AHSpacing.xl),
          _buildFooterLinkGroup('Produit', [
            'Fonctionnalités', 'ORION (IA)', 'Tarification', 'Blog & Ressources', 'Recrutement'
          ]),
          const SizedBox(height: AHSpacing.md),
          _buildFooterLinkGroup('Communauté', [
            'Academia Federis', 'Témoignages', 'Nous contacter', 'Partenaires'
          ]),
          const SizedBox(height: AHSpacing.md),
          _buildFooterLinkGroup('Support', [
            'Centre d\'aide', 'Guide de démarrage', 'Documentation API', 'FAQ'
          ]),
          const SizedBox(height: AHSpacing.md),
          _buildFooterLinkGroup('Légal', [
            'Conditions générales', 'Politique de confidentialité', 'Mentions légales', 'CGV'
          ]),
          const SizedBox(height: AHSpacing.xl),
          Row(
            children: [
              _buildSocialIcon(Icons.facebook, 'https://facebook.com/academiahub'),
              const SizedBox(width: 12),
              _buildSocialIcon(Icons.work_outline, 'https://linkedin.com/company/academiahub'),
              const SizedBox(width: 12),
              _buildSocialIcon(Icons.alternate_email, 'https://twitter.com/academiahub'),
              const SizedBox(width: 12),
              _buildSocialIcon(Icons.play_circle_outline, 'https://youtube.com/@academiahub'),
            ],
          ),
          const SizedBox(height: AHSpacing.xl),
          Row(
            children: [
              const AHLogoCircle(size: 32, animated: false),
              const SizedBox(width: AHSpacing.sm),
              Expanded(
                child: Text(
                  '© ${DateTime.now().year} Academia Helm. Tous droits réservés.',
                  style: TextStyle(fontFamily: 'Inter', fontSize: 10, color: Colors.white54),
                ),
              ),
            ],
          ),
          const SizedBox(height: AHSpacing.sm),
          Row(
            children: [
              _buildBadge('Conforme RGPD'),
              const SizedBox(width: 8),
              _buildBadge('Standards intern.'),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildContactRow(IconData icon, String text) {
    return Row(
      children: [
        Icon(icon, size: 16, color: AHColors.gold),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            text,
            style: const TextStyle(fontFamily: 'Inter', fontSize: 12, color: Colors.white),
          ),
        ),
      ],
    );
  }

  Widget _buildFooterLinkGroup(String title, List<String> links) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title.toUpperCase(),
          style: TextStyle(
            fontFamily: 'Inter',
            fontSize: 10,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.2,
            color: AHColors.gold,
          ),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 12,
          runSpacing: 4,
          children: links.map((link) => Text(
            link,
            style: TextStyle(fontFamily: 'Inter', fontSize: 12, color: Colors.white70),
          )).toList(),
        ),
      ],
    );
  }

  Widget _buildSocialIcon(IconData icon, String url) {
    return InkWell(
      onTap: () => _launchUrl(url),
      child: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.08),
          shape: BoxShape.circle,
        ),
        child: Icon(icon, color: Colors.white, size: 18),
      ),
    );
  }

  Widget _buildBadge(String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.08),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: Colors.white.withOpacity(0.15)),
      ),
      child: Text(
        text,
        style: TextStyle(fontFamily: 'Inter', fontSize: 9, color: Colors.white60),
      ),
    );
  }

  Future<void> _launchUrl(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }
}
