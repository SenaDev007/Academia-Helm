import 'package:flutter/material.dart';
import 'package:academia_helm_mobile/core/enums/module_config.dart';
import 'package:academia_helm_mobile/core/widgets/module_page_shell.dart';
import 'package:academia_helm_mobile/core/theme/ah_colors.dart';
import 'package:academia_helm_mobile/core/theme/ah_spacing.dart';

/// Academia Federis module screen with 29 sub-tabs.
class FederisScreen extends StatefulWidget {
  const FederisScreen({super.key});

  @override
  State<FederisScreen> createState() => _FederisScreenState();
}

class _FederisScreenState extends State<FederisScreen> {
  @override
  Widget build(BuildContext context) {
    final subTabs = federisModule.subTabs;

    return StatefulModulePage(
      module: federisModule,
      visibleSubTabs: subTabs,
      initialSubTabId: subTabs.first.id,
      subTabBuilder: (subTab) {
        switch (subTab.id) {
          case 'fed-dashboard':
            return _buildDashboardContent();
          case 'fed-bureau':
            return _buildBureauContent();
          case 'fed-schools':
            return _buildSchoolsContent();
          case 'fed-centers':
            return _buildCentersContent();
          case 'fed-candidates':
            return _buildCandidatesContent();
          case 'fed-exams':
            return _buildExamsContent();
          case 'fed-exam-classes':
            return _buildExamClassesContent();
          case 'fed-compositions':
            return _buildCompositionsContent();
          case 'fed-correction':
            return _buildCorrectionContent();
          case 'fed-grading':
            return _buildGradingContent();
          case 'fed-deliberations':
            return _buildDeliberationsContent();
          case 'fed-results':
            return _buildResultsContent();
          case 'fed-reports':
            return _buildReportsContent();
          case 'fed-surveillance':
            return _buildSurveillanceContent();
          case 'fed-conflicts':
            return _buildConflictsContent();
          case 'fed-question-bank':
            return _buildQuestionBankContent();
          case 'fed-stats':
            return _buildStatsContent();
          case 'fed-communication':
            return _buildCommunicationContent();
          case 'fed-connect':
            return _buildConnectContent();
          case 'fed-documents':
            return _buildDocumentsContent();
          case 'fed-notifications':
            return _buildNotificationsContent();
          case 'fed-orion':
            return _buildOrionContent();
          case 'fed-billing':
            return _buildBillingContent();
          case 'fed-settings':
            return _buildSettingsContent();
          case 'fed-archives':
            return _buildArchivesContent();
          case 'fed-sara':
            return _buildSaraContent();
          case 'fed-checkout':
            return _buildCheckoutContent();
          case 'fed-checkout-success':
            return _buildCheckoutSuccessContent();
          case 'fed-platform-admin':
            return _buildPlatformAdminContent();
          default:
            return _buildPlaceholder(subTab.label);
        }
      },
    );
  }

  Widget _buildDashboardContent() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(AHSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Tableau de bord Federis', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AHColors.gray900)),
          const SizedBox(height: AHSpacing.md),
          Wrap(spacing: AHSpacing.md, runSpacing: AHSpacing.md, children: [
            _FStatCard(icon: Icons.business, label: 'Écoles membres', value: '24', color: AHColors.navy),
            _FStatCard(icon: Icons.person, label: 'Candidats', value: '3 456', color: AHColors.info),
            _FStatCard(icon: Icons.quiz, label: 'Examens actifs', value: '6', color: AHColors.gold),
            _FStatCard(icon: Icons.location_city, label: 'Centres d\'examen', value: '12', color: AHColors.success),
            _FStatCard(icon: Icons.emoji_events, label: 'Taux de réussite', value: '72%', color: AHColors.success),
            _FStatCard(icon: Icons.visibility, label: 'Surveillants', value: '148', color: AHColors.warning),
          ]),
          const SizedBox(height: AHSpacing.xl),
          const Text('Examens en cours', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AHColors.gray800)),
          const SizedBox(height: AHSpacing.sm),
          ...List.generate(4, (i) => _FListItem(
            title: _examNames[i],
            subtitle: '${200 + i * 100} candidats • Centre: ${_centerNames[i]} • ${i < 2 ? 'En cours' : 'À venir'}',
            icon: Icons.quiz, iconColor: i < 2 ? AHColors.success : AHColors.info,
          )),
        ],
      ),
    );
  }

  Widget _buildBureauContent() {
    return ListView(padding: const EdgeInsets.all(AHSpacing.lg), children: [
      _FSectionHeader(title: 'Bureau Federis'),
      ...List.generate(6, (i) => _FListItem(
        title: _bureauRoles[i],
        subtitle: '${_bureauNames[i]} • ${_bureauSchools[i]}',
        icon: Icons.groups, iconColor: AHColors.navy,
      )),
    ]);
  }

  Widget _buildSchoolsContent() {
    return ListView(padding: const EdgeInsets.all(AHSpacing.lg), children: [
      _FSearchBar(hintText: 'Rechercher une école...'),
      const SizedBox(height: AHSpacing.md),
      _FSectionHeader(title: 'Écoles membres (24)'),
      ...List.generate(8, (i) => _FListItem(
        title: _schoolNames[i],
        subtitle: '${50 + i * 20} candidats • ${i < 6 ? 'Membre actif' : 'En attente'} • ${_centerNames[i % _centerNames.length]}',
        icon: Icons.business, iconColor: i < 6 ? AHColors.navy : AHColors.warning,
      )),
    ]);
  }

  Widget _buildCentersContent() {
    return ListView(padding: const EdgeInsets.all(AHSpacing.lg), children: [
      _FSectionHeader(title: 'Centres d\'examen (12)'),
      ...List.generate(8, (i) => _FListItem(
        title: _centerNames[i % _centerNames.length],
        subtitle: 'Capacité: ${100 + i * 30} places • ${2 + i} salles • ${i < 5 ? 'Actif' : 'Indisponible'}',
        icon: Icons.location_city, iconColor: i < 5 ? AHColors.success : AHColors.gray400,
      )),
    ]);
  }

  Widget _buildCandidatesContent() {
    return ListView(padding: const EdgeInsets.all(AHSpacing.lg), children: [
      _FSearchBar(hintText: 'Rechercher un candidat...'),
      const SizedBox(height: AHSpacing.md),
      _FSectionHeader(title: 'Candidats (3 456)'),
      _FStatRow(items: [
        _FStatMini(label: 'Inscrits', value: '3 456', color: AHColors.success),
        _FStatMini(label: 'Confirmés', value: '3 210', color: AHColors.navy),
        _FStatMini(label: 'En attente', value: '246', color: AHColors.warning),
      ]),
      const SizedBox(height: AHSpacing.md),
      ...List.generate(8, (i) => _FListItem(
        title: 'Candidat ${i + 1} — ${_candidateFirstNames[i]} ${_candidateLastNames[i]}',
        subtitle: 'N°: ${2025000 + i} • ${_schoolNames[i]} • ${i < 5 ? 'Confirmé' : 'En attente'}',
        icon: Icons.person, iconColor: i < 5 ? AHColors.success : AHColors.warning,
      )),
    ]);
  }

  Widget _buildExamsContent() {
    return ListView(padding: const EdgeInsets.all(AHSpacing.lg), children: [
      _FSectionHeader(title: 'Examens'),
      ...List.generate(6, (i) => _FListItem(
        title: _examNames[i],
        subtitle: '${200 + i * 100} candidats • ${15 + i} épreuves • ${i < 2 ? 'En cours' : (i < 4 ? 'Planifié' : 'Terminé')}',
        icon: Icons.quiz, iconColor: [AHColors.success, AHColors.success, AHColors.info, AHColors.info, AHColors.gray400, AHColors.gray400][i],
      )),
    ]);
  }

  Widget _buildExamClassesContent() {
    return ListView(padding: const EdgeInsets.all(AHSpacing.lg), children: [
      _FSectionHeader(title: 'Classes d\'examen'),
      ...List.generate(6, (i) => _FListItem(
        title: 'Salle ${_roomNames[i]}',
        subtitle: '${25 + i * 5} candidats • Centre: ${_centerNames[i % _centerNames.length]} • ${i < 4 ? 'Assignée' : 'En attente'}',
        icon: Icons.class_, iconColor: AHColors.navy,
      )),
    ]);
  }

  Widget _buildCompositionsContent() {
    return ListView(padding: const EdgeInsets.all(AHSpacing.lg), children: [
      _FSectionHeader(title: 'Compositions'),
      _FStatRow(items: [
        _FStatMini(label: 'Planifiées', value: '18', color: AHColors.info),
        _FStatMini(label: 'En cours', value: '4', color: AHColors.warning),
        _FStatMini(label: 'Terminées', value: '12', color: AHColors.success),
      ]),
      const SizedBox(height: AHSpacing.md),
      ...List.generate(6, (i) => _FListItem(
        title: _subjectNames[i],
        subtitle: '${10 + i}/04/2025 • ${8 + i}h-${10 + i}h • ${25 + i * 3} copies',
        icon: Icons.edit_note, iconColor: AHColors.info,
      )),
    ]);
  }

  Widget _buildCorrectionContent() {
    return ListView(padding: const EdgeInsets.all(AHSpacing.lg), children: [
      _FSectionHeader(title: 'Correction'),
      _FStatRow(items: [
        _FStatMini(label: 'À corriger', value: '560', color: AHColors.warning),
        _FStatMini(label: 'En cours', value: '180', color: AHColors.info),
        _FStatMini(label: 'Corrigées', value: '2 716', color: AHColors.success),
      ]),
      const SizedBox(height: AHSpacing.md),
      ...List.generate(6, (i) => _FListItem(
        title: '${_subjectNames[i]} — ${_examNames[i % _examNames.length]}',
        subtitle: '${50 + i * 20} copies • ${i < 3 ? 'Correction en cours' : 'En attente'} • Correcteur: ${_correctorNames[i]}',
        icon: Icons.grading, iconColor: i < 3 ? AHColors.info : AHColors.warning,
      )),
    ]);
  }

  Widget _buildGradingContent() {
    return ListView(padding: const EdgeInsets.all(AHSpacing.lg), children: [
      _FSectionHeader(title: 'Notation'),
      _FStatRow(items: [
        _FStatMini(label: 'Notes saisies', value: '2 716', color: AHColors.success),
        _FStatMini(label: 'En attente', value: '740', color: AHColors.warning),
        _FStatMini(label: 'Validées', value: '2 100', color: AHColors.navy),
      ]),
      const SizedBox(height: AHSpacing.md),
      ...List.generate(5, (i) => _FListItem(
        title: '${_subjectNames[i]} — Moyenne: ${(10 + i * 1.5).toStringAsFixed(1)}/20',
        subtitle: '${50 + i * 10} copies notées • Min: ${(5 + i).toStringAsFixed(1)} • Max: ${(17 + i * 0.5).toStringAsFixed(1)}',
        icon: Icons.calculate, iconColor: AHColors.navy,
      )),
    ]);
  }

  Widget _buildDeliberationsContent() {
    return ListView(padding: const EdgeInsets.all(AHSpacing.lg), children: [
      _FSectionHeader(title: 'Délibérations'),
      ...List.generate(5, (i) => _FListItem(
        title: 'Délibération ${_examNames[i % _examNames.length]}',
        subtitle: '${i < 2 ? 'Terminée' : 'Planifiée le ${20 + i}/04/2025'} • ${15 + i} membres du jury',
        icon: Icons.gavel, iconColor: i < 2 ? AHColors.success : AHColors.info,
      )),
    ]);
  }

  Widget _buildResultsContent() {
    return ListView(padding: const EdgeInsets.all(AHSpacing.lg), children: [
      _FSectionHeader(title: 'Résultats'),
      _FStatRow(items: [
        _FStatMini(label: 'Admis', value: '2 487', color: AHColors.success),
        _FStatMini(label: 'Ajournés', value: '969', color: AHColors.error),
        _FStatMini(label: 'Taux réussite', value: '72%', color: AHColors.navy),
      ]),
      const SizedBox(height: AHSpacing.md),
      ...List.generate(5, (i) => _FListItem(
        title: _examNames[i],
        subtitle: 'Admis: ${150 + i * 80} / ${200 + i * 100} • Taux: ${(65 + i * 3)}%',
        icon: Icons.emoji_events, iconColor: AHColors.gold,
      )),
    ]);
  }

  Widget _buildReportsContent() {
    return ListView(padding: const EdgeInsets.all(AHSpacing.lg), children: [
      _FSectionHeader(title: 'Rapports'),
      ...['Rapport général des examens', 'Statistiques de réussite', 'Analyse des notes par matière',
          'Rapport des centres', 'Bilan des délibérations', 'Rapport des conflits']
          .map((r) => _FListItem(
        title: r, subtitle: 'Généré le ${10 + DateTime.now().month}/03/2025',
        icon: Icons.assessment, iconColor: AHColors.navy,
        trailing: const Icon(Icons.download, color: AHColors.gray400, size: 20),
      )),
    ]);
  }

  Widget _buildSurveillanceContent() {
    return ListView(padding: const EdgeInsets.all(AHSpacing.lg), children: [
      _FSectionHeader(title: 'Surveillance'),
      _FStatRow(items: [
        _FStatMini(label: 'Surveillants', value: '148', color: AHColors.navy),
        _FStatMini(label: 'Chefs de salle', value: '24', color: AHColors.info),
        _FStatMini(label: 'Non assignés', value: '12', color: AHColors.warning),
      ]),
      const SizedBox(height: AHSpacing.md),
      ...List.generate(6, (i) => _FListItem(
        title: '${_candidateFirstNames[i]} ${_candidateLastNames[i]}',
        subtitle: 'Salle: ${_roomNames[i % _roomNames.length]} • ${['Chef de salle', 'Surveillant', 'Surveillant', 'Chef de salle', 'Surveillant', 'Surveillant'][i]}',
        icon: Icons.visibility, iconColor: AHColors.navy,
      )),
    ]);
  }

  Widget _buildConflictsContent() {
    return ListView(padding: const EdgeInsets.all(AHSpacing.lg), children: [
      _FSectionHeader(title: 'Conflits d\'horaire'),
      ...List.generate(3, (i) => _FListItem(
        title: _conflictTitles[i],
        subtitle: '${['Résolu', 'En cours', 'En attente'][i]} • Priorité: ${['Haute', 'Moyenne', 'Basse'][i]}',
        icon: Icons.warning, iconColor: [AHColors.success, AHColors.warning, AHColors.error][i],
      )),
    ]);
  }

  Widget _buildQuestionBankContent() {
    return ListView(padding: const EdgeInsets.all(AHSpacing.lg), children: [
      _FSearchBar(hintText: 'Rechercher une question...'),
      const SizedBox(height: AHSpacing.md),
      _FSectionHeader(title: 'Banque de Questions'),
      _FStatRow(items: [
        _FStatMini(label: 'Questions', value: '2 450', color: AHColors.navy),
        _FStatMini(label: 'Matières', value: '15', color: AHColors.info),
        _FStatMini(label: 'Niveaux', value: '6', color: AHColors.success),
      ]),
      const SizedBox(height: AHSpacing.md),
      ...List.generate(6, (i) => _FListItem(
        title: _subjectNames[i],
        subtitle: '${150 + i * 80} questions • Dernière MAJ: ${5 + i}/03/2025',
        icon: Icons.quiz, iconColor: AHColors.navy,
      )),
    ]);
  }

  Widget _buildStatsContent() {
    return ListView(padding: const EdgeInsets.all(AHSpacing.lg), children: [
      _FSectionHeader(title: 'Statistiques'),
      _FStatRow(items: [
        _FStatMini(label: 'Moyenne générale', value: '11.8/20', color: AHColors.navy),
        _FStatMini(label: 'Écart-type', value: '3.2', color: AHColors.info),
        _FStatMini(label: 'Médiane', value: '12.1/20', color: AHColors.success),
      ]),
      const SizedBox(height: AHSpacing.md),
      ...List.generate(5, (i) => _FListItem(
        title: _subjectNames[i],
        subtitle: 'Moyenne: ${(9 + i * 0.8).toStringAsFixed(1)}/20 • Admis: ${(60 + i * 5)}%',
        icon: Icons.analytics, iconColor: AHColors.navy,
      )),
    ]);
  }

  Widget _buildCommunicationContent() {
    return ListView(padding: const EdgeInsets.all(AHSpacing.lg), children: [
      _FSectionHeader(title: 'Communication'),
      ...List.generate(5, (i) => _FListItem(
        title: _commTitles[i],
        subtitle: '${10 + i}/03/2025 • ${50 + i * 20} destinataires',
        icon: Icons.campaign, iconColor: AHColors.gold,
      )),
    ]);
  }

  Widget _buildConnectContent() {
    return ListView(padding: const EdgeInsets.all(AHSpacing.lg), children: [
      _FSectionHeader(title: 'Connect'),
      ...List.generate(4, (i) => _FListItem(
        title: _connectServices[i],
        subtitle: '${i < 3 ? 'Connecté' : 'Non configuré'} • Dernière sync: ${i < 3 ? 'il y a ${5 + i}min' : 'N/A'}',
        icon: Icons.device_hub, iconColor: i < 3 ? AHColors.success : AHColors.gray400,
      )),
    ]);
  }

  Widget _buildDocumentsContent() {
    return ListView(padding: const EdgeInsets.all(AHSpacing.lg), children: [
      _FSectionHeader(title: 'Documents'),
      ...List.generate(6, (i) => _FListItem(
        title: _docNames[i],
        subtitle: 'Version ${1 + i ~/ 2}.${i % 3} • ${i + 1} pages • ${5 + i}/03/2025',
        icon: Icons.description, iconColor: AHColors.navy,
        trailing: const Icon(Icons.download, color: AHColors.gray400, size: 20),
      )),
    ]);
  }

  Widget _buildNotificationsContent() {
    return ListView(padding: const EdgeInsets.all(AHSpacing.lg), children: [
      _FSectionHeader(title: 'Notifications'),
      ...List.generate(6, (i) => _FListItem(
        title: _notifTitles[i],
        subtitle: '${8 + i}/03/2025 ${9 + i}h • ${i < 3 ? 'Non lue' : 'Lue'}',
        icon: Icons.notifications, iconColor: i < 3 ? AHColors.warning : AHColors.gray400,
      )),
    ]);
  }

  Widget _buildOrionContent() {
    return ListView(padding: const EdgeInsets.all(AHSpacing.lg), children: [
      _FSectionHeader(title: 'ORION Federis'),
      Container(
        width: double.infinity, padding: const EdgeInsets.all(AHSpacing.xl),
        decoration: BoxDecoration(
          gradient: const LinearGradient(colors: [AHColors.navy, AHColors.navyLight], begin: Alignment.topLeft, end: Alignment.bottomRight),
          borderRadius: BorderRadius.circular(AHRadius.lg),
        ),
        child: Column(children: [
          const Icon(Icons.auto_awesome, color: AHColors.gold, size: 40),
          const SizedBox(height: AHSpacing.md),
          const Text('ORION Federis', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AHColors.white)),
          const SizedBox(height: AHSpacing.sm),
          const Text('Intelligence artificielle pour le pilotage des examens fédérés', style: TextStyle(fontSize: 13, color: AHColors.white70), textAlign: TextAlign.center),
        ]),
      ),
      const SizedBox(height: AHSpacing.md),
      ...List.generate(4, (i) => _FListItem(
        title: _orionInsights[i],
        subtitle: 'Confiance: ${80 + i * 3}% • ${12 + i} écoles concernées',
        icon: Icons.auto_awesome, iconColor: AHColors.gold,
      )),
    ]);
  }

  Widget _buildBillingContent() {
    return ListView(padding: const EdgeInsets.all(AHSpacing.lg), children: [
      _FSectionHeader(title: 'Facturation'),
      _FStatRow(items: [
        _FStatMini(label: 'CA total', value: '8.5M FCFA', color: AHColors.success),
        _FStatMini(label: 'En attente', value: '1.2M FCFA', color: AHColors.warning),
        _FStatMini(label: 'Impayés', value: '350K FCFA', color: AHColors.error),
      ]),
      const SizedBox(height: AHSpacing.md),
      ...List.generate(5, (i) => _FListItem(
        title: 'Facture #${6000 + i} — ${_schoolNames[i]}',
        subtitle: '${200 + i * 50}K FCFA • ${i < 3 ? 'Payée' : 'En attente'}',
        icon: Icons.receipt, iconColor: i < 3 ? AHColors.success : AHColors.warning,
      )),
    ]);
  }

  Widget _buildSettingsContent() {
    return ListView(padding: const EdgeInsets.all(AHSpacing.lg), children: [
      _FSectionHeader(title: 'Paramètres Federis'),
      _FSettingsTile(title: 'Nom de la fédération', subtitle: 'Fédération des Écoles Privées', icon: Icons.badge),
      _FSettingsTile(title: 'Année académique', subtitle: '2024-2025', icon: Icons.calendar_month),
      _FSettingsTile(title: 'Frais d\'inscription examen', subtitle: '5 000 FCFA', icon: Icons.payments),
      _FSettingsTile(title: 'Notifications examens', subtitle: null, icon: Icons.notifications, isToggle: true, toggleValue: true),
      _FSettingsTile(title: 'Publication automatique résultats', subtitle: null, icon: Icons.auto_mode, isToggle: true, toggleValue: false),
      _FSettingsTile(title: 'Anonymat des copies', subtitle: null, icon: Icons.visibility_off, isToggle: true, toggleValue: true),
      _FSettingsTile(title: 'Double correction', subtitle: null, icon: Icons.fact_check, isToggle: true, toggleValue: true),
    ]);
  }

  Widget _buildArchivesContent() {
    return ListView(padding: const EdgeInsets.all(AHSpacing.lg), children: [
      _FSectionHeader(title: 'Archives'),
      ...List.generate(5, (i) => _FListItem(
        title: 'Session ${2020 + i}-${2021 + i}',
        subtitle: '${800 + i * 200} candidats • ${3 + i} examens • Taux: ${(65 + i * 2)}%',
        icon: Icons.archive, iconColor: AHColors.gray500,
      )),
    ]);
  }

  Widget _buildSaraContent() {
    return ListView(padding: const EdgeInsets.all(AHSpacing.lg), children: [
      _FSectionHeader(title: 'Sara (IA)'),
      Container(
        width: double.infinity, padding: const EdgeInsets.all(AHSpacing.xl),
        decoration: BoxDecoration(
          gradient: const LinearGradient(colors: [AHColors.navy, AHColors.navyLight], begin: Alignment.topLeft, end: Alignment.bottomRight),
          borderRadius: BorderRadius.circular(AHRadius.lg),
        ),
        child: Column(children: [
          const Icon(Icons.smart_toy, color: AHColors.gold, size: 40),
          const SizedBox(height: AHSpacing.md),
          const Text('Sara — Assistante IA', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AHColors.white)),
          const SizedBox(height: AHSpacing.sm),
          const Text('Génération de sujets, correction automatique et analyse prédictive', style: TextStyle(fontSize: 13, color: AHColors.white70), textAlign: TextAlign.center),
        ]),
      ),
      const SizedBox(height: AHSpacing.md),
      ...List.generate(4, (i) => _FListItem(
        title: _saraFeatures[i],
        subtitle: '${i < 2 ? 'Disponible' : 'En développement'}',
        icon: Icons.smart_toy, iconColor: i < 2 ? AHColors.gold : AHColors.gray400,
      )),
    ]);
  }

  Widget _buildCheckoutContent() {
    return ListView(padding: const EdgeInsets.all(AHSpacing.lg), children: [
      _FSectionHeader(title: 'Paiement'),
      Container(
        width: double.infinity, padding: const EdgeInsets.all(AHSpacing.xl),
        decoration: BoxDecoration(color: AHColors.successLight, borderRadius: BorderRadius.circular(AHRadius.lg),
          border: Border.all(color: AHColors.success.withValues(alpha: 0.3))),
        child: Column(children: [
          const Icon(Icons.payment, color: AHColors.success, size: 40),
          const SizedBox(height: AHSpacing.md),
          const Text('Paiement des frais d\'examen', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AHColors.gray900)),
          const SizedBox(height: AHSpacing.sm),
          const Text('Montant: 5 000 FCFA par candidat', style: TextStyle(fontSize: 14, color: AHColors.gray600)),
          const SizedBox(height: AHSpacing.lg),
          ElevatedButton(onPressed: () {}, style: ElevatedButton.styleFrom(backgroundColor: AHColors.navy, foregroundColor: AHColors.white),
            child: const Text('Procéder au paiement')),
        ]),
      ),
    ]);
  }

  Widget _buildCheckoutSuccessContent() {
    return Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
      Container(width: 80, height: 80, decoration: const BoxDecoration(color: AHColors.successLight, shape: BoxShape.circle),
        child: const Icon(Icons.check_circle, color: AHColors.success, size: 48)),
      const SizedBox(height: AHSpacing.lg),
      const Text('Paiement confirmé !', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: AHColors.gray900)),
      const SizedBox(height: AHSpacing.sm),
      const Text('Votre inscription à l\'examen a été validée.', style: TextStyle(fontSize: 14, color: AHColors.gray500), textAlign: TextAlign.center),
      const SizedBox(height: AHSpacing.xl),
      ElevatedButton(onPressed: () {}, style: ElevatedButton.styleFrom(backgroundColor: AHColors.navy, foregroundColor: AHColors.white),
        child: const Text('Voir mes examens')),
    ]));
  }

  Widget _buildPlatformAdminContent() {
    return ListView(padding: const EdgeInsets.all(AHSpacing.lg), children: [
      _FSectionHeader(title: 'Administration Plateforme'),
      ...List.generate(5, (i) => _FListItem(
        title: _platAdminItems[i],
        subtitle: '${i < 3 ? 'Configuré' : 'À configurer'}',
        icon: Icons.admin_panel_settings, iconColor: i < 3 ? AHColors.success : AHColors.warning,
      )),
    ]);
  }

  Widget _buildPlaceholder(String label) {
    return Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
      Icon(Icons.construction, size: 48, color: AHColors.gray400),
      const SizedBox(height: AHSpacing.md),
      Text(label, style: const TextStyle(fontSize: 16, color: AHColors.gray500)),
    ]));
  }
}

// ═══════════════════════════════════════════════════════════════════════
// WIDGETS
// ═══════════════════════════════════════════════════════════════════════

class _FStatCard extends StatelessWidget {
  const _FStatCard({required this.icon, required this.label, required this.value, required this.color});
  final IconData icon; final String label; final String value; final Color color;
  @override
  Widget build(BuildContext context) {
    return Container(width: 160, padding: const EdgeInsets.all(AHSpacing.md),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.06), borderRadius: BorderRadius.circular(AHRadius.lg), border: Border.all(color: color.withValues(alpha: 0.15))),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(icon, color: color, size: 22), const SizedBox(height: AHSpacing.sm),
        Text(value, style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: color)),
        const SizedBox(height: 2), Text(label, style: const TextStyle(fontSize: 12, color: AHColors.gray600)),
      ]));
  }
}

class _FListItem extends StatelessWidget {
  const _FListItem({required this.title, required this.subtitle, required this.icon, required this.iconColor, this.trailing});
  final String title; final String subtitle; final IconData icon; final Color iconColor; final Widget? trailing;
  @override
  Widget build(BuildContext context) {
    return Container(margin: const EdgeInsets.only(bottom: AHSpacing.sm), padding: const EdgeInsets.all(AHSpacing.md),
      decoration: BoxDecoration(color: AHColors.white, borderRadius: BorderRadius.circular(AHRadius.md), border: Border.all(color: AHColors.gray200)),
      child: Row(children: [
        Container(width: 40, height: 40, decoration: BoxDecoration(color: iconColor.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(AHRadius.md)),
          child: Icon(icon, color: iconColor, size: 20)),
        const SizedBox(width: AHSpacing.md),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AHColors.gray900)),
          const SizedBox(height: 2), Text(subtitle, style: const TextStyle(fontSize: 12, color: AHColors.gray500)),
        ])),
        if (trailing != null) trailing!,
      ]));
  }
}

class _FSectionHeader extends StatelessWidget {
  const _FSectionHeader({required this.title}); final String title;
  @override
  Widget build(BuildContext context) => Padding(padding: const EdgeInsets.only(bottom: AHSpacing.sm), child: Text(title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AHColors.gray800)));
}

class _FSearchBar extends StatelessWidget {
  const _FSearchBar({required this.hintText}); final String hintText;
  @override
  Widget build(BuildContext context) {
    return TextField(decoration: InputDecoration(hintText: hintText, prefixIcon: const Icon(Icons.search, color: AHColors.gray400), filled: true, fillColor: AHColors.gray50,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(AHRadius.md), borderSide: const BorderSide(color: AHColors.gray200)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(AHRadius.md), borderSide: const BorderSide(color: AHColors.gray200)),
      contentPadding: const EdgeInsets.symmetric(horizontal: AHSpacing.md, vertical: AHSpacing.sm)));
  }
}

class _FStatRow extends StatelessWidget {
  const _FStatRow({required this.items}); final List<_FStatMini> items;
  @override
  Widget build(BuildContext context) => Row(children: items.map((i) => Expanded(child: Padding(padding: const EdgeInsets.only(right: AHSpacing.sm), child: i))).toList());
}

class _FStatMini extends StatelessWidget {
  const _FStatMini({required this.label, required this.value, required this.color}); final String label; final String value; final Color color;
  @override
  Widget build(BuildContext context) {
    return Container(padding: const EdgeInsets.all(AHSpacing.md),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.06), borderRadius: BorderRadius.circular(AHRadius.md)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(value, style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: color)),
        const SizedBox(height: 2), Text(label, style: const TextStyle(fontSize: 11, color: AHColors.gray600)),
      ]));
  }
}

class _FSettingsTile extends StatelessWidget {
  const _FSettingsTile({required this.title, this.subtitle, required this.icon, this.isToggle = false, this.toggleValue = false});
  final String title; final String? subtitle; final IconData icon; final bool isToggle; final bool toggleValue;
  @override
  Widget build(BuildContext context) {
    return Container(margin: const EdgeInsets.only(bottom: AHSpacing.sm), padding: const EdgeInsets.all(AHSpacing.md),
      decoration: BoxDecoration(color: AHColors.white, borderRadius: BorderRadius.circular(AHRadius.md), border: Border.all(color: AHColors.gray200)),
      child: Row(children: [
        Icon(icon, color: AHColors.gray600, size: 20), const SizedBox(width: AHSpacing.md),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: AHColors.gray900)),
          if (subtitle != null) Text(subtitle!, style: const TextStyle(fontSize: 12, color: AHColors.gray500)),
        ])),
        if (isToggle) Switch(value: toggleValue, onChanged: (v) {}, activeColor: AHColors.navy)
        else const Icon(Icons.chevron_right, color: AHColors.gray400, size: 20),
      ]));
  }
}

const _schoolNames = ['Lycée Montaigne', 'Collège Mandela', 'École Lumière', 'Institut Pasteur', 'Académie Ségou',
    'École Indépendance', 'Lycée Keita', 'Collège Modibo'];
const _centerNames = ['Centre Bamako', 'Centre Ségou', 'Centre Sikasso', 'Centre Kayes', 'Centre Mopti', 'Centre Gao'];
const _examNames = ['BAC 2025 — Série A', 'BAC 2025 — Série D', 'BEPC 2025', 'CAP 2025', 'BAC 2025 — Série C', 'Entrée 6ème'];
const _candidateFirstNames = ['Amadou', 'Fatou', 'Ibrahim', 'Aïcha', 'Moussa', 'Mariam', 'Oumar', 'Aminata'];
const _candidateLastNames = ['Diallo', 'Touré', 'Keita', 'Coulibaly', 'Traoré', 'Konaté', 'Sissoko', 'Sangaré'];
const _roomNames = ['A101', 'A102', 'B201', 'B202', 'C301', 'Amphithéâtre'];
const _subjectNames = ['Mathématiques', 'Français', 'Physique-Chimie', 'SVT', 'Histoire-Géo', 'Anglais'];
const _correctorNames = ['M. Diallo', 'Mme Touré', 'M. Keita', 'Mme Coulibaly', 'M. Traoré', 'Mme Konaté'];
const _bureauRoles = ['Président', 'Vice-président', 'Secrétaire général', 'Trésorier', 'Responsable examens', 'Responsable communication'];
const _bureauNames = ['M. Sidibé', 'Mme Diarra', 'M. Koné', 'Mme Bah', 'M. Sanogo', 'Mme Coulibaly'];
const _bureauSchools = ['Lycée Montaigne', 'Collège Mandela', 'École Lumière', 'Institut Pasteur', 'Académie Ségou', 'École Indépendance'];
const _conflictTitles = ['Horaire Maths/Physique dupliqué', 'Salle B201 en double réservation', 'Correcteur absent le 15/04'];
const _commTitles = ['Convocation examens', 'Rappel délai inscription', 'Résultats disponibles', 'Calendrier révisé', 'Réunion bureau'];
const _connectServices = ['Academia Helm SSO', 'Service de paiement Orange', 'SMS Gateway', 'Cloud stockage'];
const _docNames = ['Règlement intérieur', 'Calendrier des examens', 'Guide du candidat', 'Procédure de correction', 'Modèle convocation', 'Charte de déontologie'];
const _notifTitles = ['Inscription confirmée', 'Horaire d\'examen publié', 'Résultat disponible', 'Rappel correction', 'Réunion du bureau', 'Nouvelle circulaire'];
const _orionInsights = ['Prédiction taux de réussite', 'Détection anomalie de notes', 'Recommandation centres', 'Optimisation surveillance'];
const _saraFeatures = ['Génération automatique de sujets', 'Correction assistée par IA', 'Analyse prédictive des résultats', 'Génération de rapports'];
const _platAdminItems = ['Gestion des utilisateurs', 'Configuration des rôles', 'Paramètres de sécurité', 'Intégrations externes', 'Sauvegarde des données'];
