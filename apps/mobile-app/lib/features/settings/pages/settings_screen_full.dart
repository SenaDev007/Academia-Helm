import 'package:flutter/material.dart';
import 'package:academia_helm_mobile/core/enums/module_config.dart';
import 'package:academia_helm_mobile/core/widgets/module_page_shell.dart';
import 'package:academia_helm_mobile/core/theme/ah_colors.dart';
import 'package:academia_helm_mobile/core/theme/ah_spacing.dart';

/// Paramètres module screen with 15 sub-tabs.
class SettingsScreenFull extends StatefulWidget {
  const SettingsScreenFull({super.key});

  @override
  State<SettingsScreenFull> createState() => _SettingsScreenFullState();
}

class _SettingsScreenFullState extends State<SettingsScreenFull> {
  @override
  Widget build(BuildContext context) {
    final subTabs = settingsModule.subTabs;

    return StatefulModulePage(
      module: settingsModule,
      visibleSubTabs: subTabs,
      initialSubTabId: subTabs.first.id,
      subTabBuilder: (subTab) {
        switch (subTab.id) {
          case 'set-identity':
            return _buildIdentityContent();
          case 'set-academic-year':
            return _buildAcademicYearContent();
          case 'set-structure':
            return _buildStructureContent();
          case 'set-bilingual':
            return _buildBilingualContent();
          case 'set-features':
            return _buildFeaturesContent();
          case 'set-roles':
            return _buildRolesContent();
          case 'set-communication':
            return _buildCommunicationContent();
          case 'set-billing':
            return _buildBillingContent();
          case 'set-security':
            return _buildSecurityContent();
          case 'set-seals':
            return _buildSealsContent();
          case 'set-orion':
            return _buildOrionContent();
          case 'set-atlas':
            return _buildAtlasContent();
          case 'set-offline':
            return _buildOfflineContent();
          case 'set-devices':
            return _buildDevicesContent();
          case 'set-history':
            return _buildHistoryContent();
          default:
            return _buildPlaceholder(subTab.label);
        }
      },
    );
  }

  // ── Identité de l'établissement ──────────────────────────────────────
  Widget _buildIdentityContent() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(AHSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Identité de l\'établissement', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AHColors.gray900)),
          const SizedBox(height: AHSpacing.md),
          // School logo placeholder
          Center(child: Container(
            width: 100, height: 100,
            decoration: BoxDecoration(color: AHColors.navy.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(AHRadius.lg), border: Border.all(color: AHColors.gray200)),
            child: const Column(mainAxisAlignment: MainAxisAlignment.center, children: [
              Icon(Icons.school, color: AHColors.navy, size: 36),
              SizedBox(height: 4),
              Text('Logo', style: TextStyle(fontSize: 11, color: AHColors.gray500)),
            ]),
          )),
          const SizedBox(height: AHSpacing.lg),
          _FormField(label: 'Nom de l\'établissement', value: 'Lycée Montaigne'),
          _FormField(label: 'Sigle', value: 'LM'),
          _FormField(label: 'Type d\'établissement', value: 'Lycée'),
          _FormField(label: 'Adresse', value: 'Bamako, Quartier Badalabougou'),
          _FormField(label: 'Téléphone', value: '+223 20 XX XX XX'),
          _FormField(label: 'Email', value: 'contact@lycee-montaigne.ml'),
          _FormField(label: 'Site web', value: 'www.lycee-montaigne.ml'),
          _FormField(label: 'N° agrément', value: 'AGR-2020-0456'),
          const SizedBox(height: AHSpacing.lg),
          SizedBox(width: double.infinity, child: ElevatedButton(
            onPressed: () {},
            style: ElevatedButton.styleFrom(backgroundColor: AHColors.navy, foregroundColor: AHColors.white),
            child: const Text('Enregistrer les modifications'),
          )),
        ],
      ),
    );
  }

  // ── Année scolaire ───────────────────────────────────────────────────
  Widget _buildAcademicYearContent() {
    return ListView(
      padding: const EdgeInsets.all(AHSpacing.lg),
      children: [
        const Text('Année scolaire', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AHColors.gray900)),
        const SizedBox(height: AHSpacing.md),
        _SettingsCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Container(padding: const EdgeInsets.symmetric(horizontal: AHSpacing.sm, vertical: 4),
              decoration: BoxDecoration(color: AHColors.success.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(4)),
              child: const Text('Active', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AHColors.success))),
            const SizedBox(width: AHSpacing.sm),
            const Text('2024-2025', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AHColors.gray900)),
          ]),
          const SizedBox(height: AHSpacing.sm),
          const Text('Début: 01/10/2024', style: TextStyle(fontSize: 13, color: AHColors.gray600)),
          const Text('Fin: 30/06/2025', style: TextStyle(fontSize: 13, color: AHColors.gray600)),
          const Text('Trimestres: 3', style: TextStyle(fontSize: 13, color: AHColors.gray600)),
        ])),
        const SizedBox(height: AHSpacing.md),
        _SettingsTile(title: 'Période de l\'année scolaire', subtitle: '01/10/2024 — 30/06/2025', icon: Icons.date_range),
        _SettingsTile(title: 'Nombre de trimestres', subtitle: '3 trimestres', icon: Icons.filter_3),
        _SettingsTile(title: 'Début 1er trimestre', subtitle: '01/10/2024', icon: Icons.calendar_today),
        _SettingsTile(title: 'Début 2ème trimestre', subtitle: '05/01/2025', icon: Icons.calendar_today),
        _SettingsTile(title: 'Début 3ème trimestre', subtitle: '01/04/2025', icon: Icons.calendar_today),
        _SettingsTile(title: 'Jours fériés configurés', subtitle: '12 jours', icon: Icons.event_busy),
        _SettingsTile(title: 'Jours de classe prévus', subtitle: '180 jours', icon: Icons.event_available),
        _SettingsTile(title: 'Vacances de Noël', subtitle: '21/12/2024 — 05/01/2025', icon: Icons.beach_access),
        _SettingsTile(title: 'Vacances de Pâques', subtitle: '29/03/2025 — 13/04/2025', icon: Icons.beach_access),
      ],
    );
  }

  // ── Structure scolaire ───────────────────────────────────────────────
  Widget _buildStructureContent() {
    return ListView(
      padding: const EdgeInsets.all(AHSpacing.lg),
      children: [
        const Text('Structure scolaire', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AHColors.gray900)),
        const SizedBox(height: AHSpacing.md),
        _SettingsTile(title: 'Cycles', subtitle: '2 cycles (Collège, Lycée)', icon: Icons.account_tree),
        _SettingsTile(title: 'Niveaux', subtitle: '7 niveaux (6ème → Terminale)', icon: Icons.layers),
        _SettingsTile(title: 'Classes', subtitle: '24 classes', icon: Icons.class_),
        _SettingsTile(title: 'Spécialités', subtitle: '4 séries (A, C, D, G)', icon: Icons.category),
        _SettingsTile(title: 'Options', subtitle: '8 options configurées', icon: Icons.tune),
        const SizedBox(height: AHSpacing.md),
        _SectionHeader(title: 'Cycles configurés'),
        ...['Collège (6ème — 3ème)', 'Lycée (2nde — Terminale)'].asMap().entries.map((e) => _ListItem(
          title: e.value,
          subtitle: '${[4, 3][e.key]} niveaux • ${[12, 12][e.key]} classes',
          icon: Icons.account_tree, iconColor: AHColors.navy,
        )),
      ],
    );
  }

  // ── Bilinguisme ──────────────────────────────────────────────────────
  Widget _buildBilingualContent() {
    return ListView(
      padding: const EdgeInsets.all(AHSpacing.lg),
      children: [
        const Text('Bilinguisme', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AHColors.gray900)),
        const SizedBox(height: AHSpacing.md),
        _SettingsTile(title: 'Langue principale', subtitle: 'Français', icon: Icons.translate),
        _SettingsTile(title: 'Langue secondaire', subtitle: 'Anglais', icon: Icons.language),
        _SettingsTile(title: 'Mode bilingue', subtitle: null, icon: Icons.translate, isToggle: true, toggleValue: true),
        _SettingsTile(title: 'Enseignement bilingue', subtitle: null, icon: Icons.school, isToggle: true, toggleValue: false),
        _SettingsTile(title: 'Documents bilingues', subtitle: null, icon: Icons.description, isToggle: true, toggleValue: true),
        _SettingsTile(title: 'Bulletins bilingues', subtitle: null, icon: Icons.receipt, isToggle: true, toggleValue: false),
        _SettingsTile(title: 'Communications bilingues', subtitle: null, icon: Icons.campaign, isToggle: true, toggleValue: true),
      ],
    );
  }

  // ── Modules activés ──────────────────────────────────────────────────
  Widget _buildFeaturesContent() {
    return ListView(
      padding: const EdgeInsets.all(AHSpacing.lg),
      children: [
        const Text('Modules activés', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AHColors.gray900)),
        const SizedBox(height: AHSpacing.md),
        ..._featureNames.asMap().entries.map((e) => _FeatureToggle(
          title: e.value,
          description: _featureDescriptions[e.key],
          isEnabled: e.key < 9,
          icon: _featureIcons[e.key],
        )),
      ],
    );
  }

  // ── Rôles & permissions ──────────────────────────────────────────────
  Widget _buildRolesContent() {
    return ListView(
      padding: const EdgeInsets.all(AHSpacing.lg),
      children: [
        const Text('Rôles & permissions', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AHColors.gray900)),
        const SizedBox(height: AHSpacing.md),
        _SectionHeader(title: 'Rôles configurés'),
        ..._roleEntries.map((r) => _ListItem(
          title: r.name,
          subtitle: '${r.userCount} utilisateurs • ${r.permissionCount} permissions',
          icon: Icons.admin_panel_settings, iconColor: AHColors.navy,
        )),
      ],
    );
  }

  // ── Communication ────────────────────────────────────────────────────
  Widget _buildCommunicationContent() {
    return ListView(
      padding: const EdgeInsets.all(AHSpacing.lg),
      children: [
        const Text('Paramètres de communication', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AHColors.gray900)),
        const SizedBox(height: AHSpacing.md),
        _SettingsTile(title: 'Expéditeur SMS', subtitle: 'ACADEMIA', icon: Icons.sms),
        _SettingsTile(title: 'Expéditeur email', subtitle: 'noreply@academia-helm.com', icon: Icons.email),
        _SettingsTile(title: 'Notifications push', subtitle: null, icon: Icons.notifications, isToggle: true, toggleValue: true),
        _SettingsTile(title: 'Notifications SMS', subtitle: null, icon: Icons.sms, isToggle: true, toggleValue: true),
        _SettingsTile(title: 'Notifications email', subtitle: null, icon: Icons.email, isToggle: true, toggleValue: true),
        _SettingsTile(title: 'Rappels automatiques', subtitle: null, icon: Icons.alarm, isToggle: true, toggleValue: true),
        _SettingsTile(title: 'WhatsApp Business', subtitle: null, icon: Icons.message, isToggle: true, toggleValue: false),
      ],
    );
  }

  // ── Facturation ──────────────────────────────────────────────────────
  Widget _buildBillingContent() {
    return ListView(
      padding: const EdgeInsets.all(AHSpacing.lg),
      children: [
        const Text('Paramètres de facturation', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AHColors.gray900)),
        const SizedBox(height: AHSpacing.md),
        _SettingsTile(title: 'Devise', subtitle: 'FCFA', icon: Icons.currency_exchange),
        _SettingsTile(title: 'TVA applicable', subtitle: '18%', icon: Icons.percent),
        _SettingsTile(title: 'Mode de paiement par défaut', subtitle: 'Mobile Money', icon: Icons.payment),
        _SettingsTile(title: 'Échéance de paiement', subtitle: '30 jours', icon: Icons.timer),
        _SettingsTile(title: 'Numérotation factures', subtitle: 'FAC-{YYYY}-{NNN}', icon: Icons.format_list_numbered),
        _SettingsTile(title: 'Paiement en ligne', subtitle: null, icon: Icons.payment, isToggle: true, toggleValue: true),
        _SettingsTile(title: 'Rappels de paiement auto', subtitle: null, icon: Icons.notifications_active, isToggle: true, toggleValue: true),
        _SettingsTile(title: 'Relance automatique', subtitle: null, icon: Icons.send, isToggle: true, toggleValue: false),
      ],
    );
  }

  // ── Sécurité ─────────────────────────────────────────────────────────
  Widget _buildSecurityContent() {
    return ListView(
      padding: const EdgeInsets.all(AHSpacing.lg),
      children: [
        const Text('Sécurité', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AHColors.gray900)),
        const SizedBox(height: AHSpacing.md),
        _SettingsTile(title: 'Authentification à deux facteurs', subtitle: null, icon: Icons.security, isToggle: true, toggleValue: true),
        _SettingsTile(title: 'Durée de session', subtitle: '8 heures', icon: Icons.timer),
        _SettingsTile(title: 'Complexité mot de passe', subtitle: 'Fort (8+ car., maj., min., chiffre)', icon: Icons.password),
        _SettingsTile(title: 'Rotation mot de passe', subtitle: '90 jours', icon: Icons.sync),
        _SettingsTile(title: 'Verrouillage après échecs', subtitle: '5 tentatives', icon: Icons.lock),
        _SettingsTile(title: 'IP autorisées', subtitle: '3 plages configurées', icon: Icons.network_check),
        _SettingsTile(title: 'Chiffrement des données', subtitle: null, icon: Icons.enhanced_encryption, isToggle: true, toggleValue: true),
        _SettingsTile(title: 'Journal d\'audit', subtitle: null, icon: Icons.history, isToggle: true, toggleValue: true),
        _SettingsTile(title: 'Connexion unique (SSO)', subtitle: null, icon: Icons.login, isToggle: true, toggleValue: false),
      ],
    );
  }

  // ── Sceaux & Signatures ──────────────────────────────────────────────
  Widget _buildSealsContent() {
    return ListView(
      padding: const EdgeInsets.all(AHSpacing.lg),
      children: [
        const Text('Sceaux & Signatures', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AHColors.gray900)),
        const SizedBox(height: AHSpacing.md),
        _SettingsCard(child: Column(children: [
          Row(children: [
            Container(width: 64, height: 64,
              decoration: BoxDecoration(color: AHColors.navy.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(AHRadius.md), border: Border.all(color: AHColors.gray200)),
              child: const Icon(Icons.verified, color: AHColors.navy, size: 32)),
            const SizedBox(width: AHSpacing.md),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('Sceau officiel', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AHColors.gray900)),
              const Text('PNG • 200x200px • Configuré', style: TextStyle(fontSize: 12, color: AHColors.gray500)),
            ])),
            TextButton(onPressed: () {}, child: const Text('Modifier')),
          ]),
        ])),
        const SizedBox(height: AHSpacing.sm),
        _SettingsCard(child: Column(children: [
          Row(children: [
            Container(width: 64, height: 64,
              decoration: BoxDecoration(color: AHColors.gold.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(AHRadius.md), border: Border.all(color: AHColors.gray200)),
              child: const Icon(Icons.draw, color: AHColors.gold, size: 32)),
            const SizedBox(width: AHSpacing.md),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('Signature du directeur', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AHColors.gray900)),
              const Text('PNG • 300x100px • Configuré', style: TextStyle(fontSize: 12, color: AHColors.gray500)),
            ])),
            TextButton(onPressed: () {}, child: const Text('Modifier')),
          ]),
        ])),
        const SizedBox(height: AHSpacing.sm),
        _SettingsTile(title: 'Cachet sur les bulletins', subtitle: null, icon: Icons.verified, isToggle: true, toggleValue: true),
        _SettingsTile(title: 'Signature sur les bulletins', subtitle: null, icon: Icons.draw, isToggle: true, toggleValue: true),
        _SettingsTile(title: 'Filigrane sur les documents', subtitle: null, icon: Icons.branding_watermark, isToggle: true, toggleValue: false),
      ],
    );
  }

  // ── ORION ────────────────────────────────────────────────────────────
  Widget _buildOrionContent() {
    return ListView(
      padding: const EdgeInsets.all(AHSpacing.lg),
      children: [
        const Text('Configuration ORION', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AHColors.gray900)),
        const SizedBox(height: AHSpacing.md),
        Container(
          width: double.infinity, padding: const EdgeInsets.all(AHSpacing.xl),
          decoration: BoxDecoration(
            gradient: const LinearGradient(colors: [AHColors.navy, AHColors.navyLight], begin: Alignment.topLeft, end: Alignment.bottomRight),
            borderRadius: BorderRadius.circular(AHRadius.lg),
          ),
          child: Column(children: [
            const Icon(Icons.auto_awesome, color: AHColors.gold, size: 40),
            const SizedBox(height: AHSpacing.md),
            const Text('ORION — Intelligence Artificielle', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AHColors.white)),
            const SizedBox(height: AHSpacing.sm),
            const Text('Pilotage intelligent de votre établissement', style: TextStyle(fontSize: 13, color: AHColors.white70), textAlign: TextAlign.center),
          ]),
        ),
        const SizedBox(height: AHSpacing.md),
        _SettingsTile(title: 'Module ORION', subtitle: null, icon: Icons.auto_awesome, isToggle: true, toggleValue: true),
        _SettingsTile(title: 'Alertes intelligentes', subtitle: null, icon: Icons.notifications_active, isToggle: true, toggleValue: true),
        _SettingsTile(title: 'Recommandations IA', subtitle: null, icon: Icons.lightbulb, isToggle: true, toggleValue: true),
        _SettingsTile(title: 'Analyses prédictives', subtitle: null, icon: Icons.trending_up, isToggle: true, toggleValue: false),
        _SettingsTile(title: 'Fréquence des analyses', subtitle: 'Quotidienne', icon: Icons.schedule),
        _SettingsTile(title: 'Seuil d\'alerte décrochage', subtitle: '3 absences consécutives', icon: Icons.warning),
      ],
    );
  }

  // ── Atlas ────────────────────────────────────────────────────────────
  Widget _buildAtlasContent() {
    return ListView(
      padding: const EdgeInsets.all(AHSpacing.lg),
      children: [
        const Text('Configuration Atlas', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AHColors.gray900)),
        const SizedBox(height: AHSpacing.md),
        Container(
          width: double.infinity, padding: const EdgeInsets.all(AHSpacing.xl),
          decoration: BoxDecoration(
            gradient: const LinearGradient(colors: [AHColors.info, AHColors.infoDark], begin: Alignment.topLeft, end: Alignment.bottomRight),
            borderRadius: BorderRadius.circular(AHRadius.lg),
          ),
          child: Column(children: [
            const Icon(Icons.map, color: AHColors.white, size: 40),
            const SizedBox(height: AHSpacing.md),
            const Text('Atlas — Cartographie scolaire', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AHColors.white)),
            const SizedBox(height: AHSpacing.sm),
            const Text('Géolocalisation et cartographie de votre réseau', style: TextStyle(fontSize: 13, color: AHColors.white70), textAlign: TextAlign.center),
          ]),
        ),
        const SizedBox(height: AHSpacing.md),
        _SettingsTile(title: 'Module Atlas', subtitle: null, icon: Icons.map, isToggle: true, toggleValue: true),
        _SettingsTile(title: 'Géolocalisation élèves', subtitle: null, icon: Icons.location_on, isToggle: true, toggleValue: true),
        _SettingsTile(title: 'Carte des transports', subtitle: null, icon: Icons.directions_bus, isToggle: true, toggleValue: true),
        _SettingsTile(title: 'Zones de desserte', subtitle: '3 zones configurées', icon: Icons.map),
        _SettingsTile(title: 'Rayon de captation', subtitle: '5 km', icon: Icons.radio_button_checked),
      ],
    );
  }

  // ── Mode hors-ligne ──────────────────────────────────────────────────
  Widget _buildOfflineContent() {
    return ListView(
      padding: const EdgeInsets.all(AHSpacing.lg),
      children: [
        const Text('Mode hors-ligne', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AHColors.gray900)),
        const SizedBox(height: AHSpacing.md),
        Container(
          width: double.infinity, padding: const EdgeInsets.all(AHSpacing.xl),
          decoration: BoxDecoration(color: AHColors.warningLight, borderRadius: BorderRadius.circular(AHRadius.lg),
            border: Border.all(color: AHColors.warning.withValues(alpha: 0.3))),
          child: Column(children: [
            const Icon(Icons.cloud_off, color: AHColors.warning, size: 40),
            const SizedBox(height: AHSpacing.md),
            const Text('Mode hors-ligne', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AHColors.gray900)),
            const SizedBox(height: AHSpacing.sm),
            const Text('Continuez à travailler même sans connexion internet', style: TextStyle(fontSize: 13, color: AHColors.gray600), textAlign: TextAlign.center),
          ]),
        ),
        const SizedBox(height: AHSpacing.md),
        _SettingsTile(title: 'Mode hors-ligne', subtitle: null, icon: Icons.cloud_off, isToggle: true, toggleValue: true),
        _SettingsTile(title: 'Synchronisation automatique', subtitle: null, icon: Icons.sync, isToggle: true, toggleValue: true),
        _SettingsTile(title: 'Données en cache', subtitle: '45 Mo', icon: Icons.storage),
        _SettingsTile(title: 'Dernière synchronisation', subtitle: 'Il y a 12 minutes', icon: Icons.cloud_done),
        _SettingsTile(title: 'Fréquence de sync', subtitle: 'Toutes les 15 minutes', icon: Icons.schedule),
        _SettingsTile(title: 'Télécharger toutes les données', subtitle: null, icon: Icons.download, isToggle: false),
      ],
    );
  }

  // ── Appareils ────────────────────────────────────────────────────────
  Widget _buildDevicesContent() {
    return ListView(
      padding: const EdgeInsets.all(AHSpacing.lg),
      children: [
        const Text('Appareils connectés', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AHColors.gray900)),
        const SizedBox(height: AHSpacing.md),
        _StatRow(items: [
          _StatMini(label: 'Appareils', value: '5', color: AHColors.navy),
          _StatMini(label: 'Actifs', value: '3', color: AHColors.success),
          _StatMini(label: 'En attente', value: '2', color: AHColors.warning),
        ]),
        const SizedBox(height: AHSpacing.md),
        ...List.generate(5, (i) => _ListItem(
          title: _deviceNames[i],
          subtitle: '${_deviceTypes[i]} • Dernière connexion: ${8 + i}/03/2025 • ${i < 3 ? 'Approuvé' : 'En attente'}',
          icon: Icons.devices, iconColor: i < 3 ? AHColors.success : AHColors.warning,
        )),
      ],
    );
  }

  // ── Historique ───────────────────────────────────────────────────────
  Widget _buildHistoryContent() {
    return ListView(
      padding: const EdgeInsets.all(AHSpacing.lg),
      children: [
        const Text('Historique des modifications', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AHColors.gray900)),
        const SizedBox(height: AHSpacing.md),
        ...List.generate(10, (i) => _ListItem(
          title: _historyActions[i % _historyActions.length],
          subtitle: '${_historyUsers[i % _historyUsers.length]} • ${8 + i}/03/2025 ${9 + i}h${i * 5 % 60}',
          icon: Icons.history, iconColor: AHColors.gray500,
        )),
      ],
    );
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

class _FormField extends StatelessWidget {
  const _FormField({required this.label, required this.value});
  final String label; final String value;
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AHSpacing.md),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: AHColors.gray600)),
        const SizedBox(height: 4),
        TextField(
          controller: TextEditingController(text: value),
          decoration: InputDecoration(
            filled: true, fillColor: AHColors.gray50,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(AHRadius.md), borderSide: const BorderSide(color: AHColors.gray200)),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(AHRadius.md), borderSide: const BorderSide(color: AHColors.gray200)),
            contentPadding: const EdgeInsets.symmetric(horizontal: AHSpacing.md, vertical: AHSpacing.sm),
          ),
        ),
      ]),
    );
  }
}

class _SettingsCard extends StatelessWidget {
  const _SettingsCard({required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity, padding: const EdgeInsets.all(AHSpacing.md),
      decoration: BoxDecoration(color: AHColors.white, borderRadius: BorderRadius.circular(AHRadius.md), border: Border.all(color: AHColors.gray200)),
      child: child,
    );
  }
}

class _SettingsTile extends StatelessWidget {
  const _SettingsTile({required this.title, this.subtitle, required this.icon, this.isToggle = false, this.toggleValue = false});
  final String title; final String? subtitle; final IconData icon; final bool isToggle; final bool toggleValue;
  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: AHSpacing.sm), padding: const EdgeInsets.all(AHSpacing.md),
      decoration: BoxDecoration(color: AHColors.white, borderRadius: BorderRadius.circular(AHRadius.md), border: Border.all(color: AHColors.gray200)),
      child: Row(children: [
        Icon(icon, color: AHColors.gray600, size: 20), const SizedBox(width: AHSpacing.md),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: AHColors.gray900)),
          if (subtitle != null) Text(subtitle!, style: const TextStyle(fontSize: 12, color: AHColors.gray500)),
        ])),
        if (isToggle) Switch(value: toggleValue, onChanged: (v) {}, activeColor: AHColors.navy)
        else const Icon(Icons.chevron_right, color: AHColors.gray400, size: 20),
      ]),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.title}); final String title;
  @override
  Widget build(BuildContext context) => Padding(padding: const EdgeInsets.only(bottom: AHSpacing.sm),
    child: Text(title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AHColors.gray800)));
}

class _ListItem extends StatelessWidget {
  const _ListItem({required this.title, required this.subtitle, required this.icon, required this.iconColor, this.trailing});
  final String title; final String subtitle; final IconData icon; final Color iconColor; final Widget? trailing;
  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: AHSpacing.sm), padding: const EdgeInsets.all(AHSpacing.md),
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
      ]),
    );
  }
}

class _StatRow extends StatelessWidget {
  const _StatRow({required this.items}); final List<_StatMini> items;
  @override
  Widget build(BuildContext context) => Row(children: items.map((i) => Expanded(child: Padding(padding: const EdgeInsets.only(right: AHSpacing.sm), child: i))).toList());
}

class _StatMini extends StatelessWidget {
  const _StatMini({required this.label, required this.value, required this.color}); final String label; final String value; final Color color;
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

class _FeatureToggle extends StatelessWidget {
  const _FeatureToggle({required this.title, required this.description, required this.isEnabled, required this.icon});
  final String title; final String description; final bool isEnabled; final IconData icon;
  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: AHSpacing.sm), padding: const EdgeInsets.all(AHSpacing.md),
      decoration: BoxDecoration(color: AHColors.white, borderRadius: BorderRadius.circular(AHRadius.md), border: Border.all(color: AHColors.gray200)),
      child: Row(children: [
        Container(width: 40, height: 40, decoration: BoxDecoration(
          color: isEnabled ? AHColors.navy.withValues(alpha: 0.1) : AHColors.gray100,
          borderRadius: BorderRadius.circular(AHRadius.md)),
          child: Icon(icon, color: isEnabled ? AHColors.navy : AHColors.gray400, size: 20)),
        const SizedBox(width: AHSpacing.md),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AHColors.gray900)),
          Text(description, style: const TextStyle(fontSize: 12, color: AHColors.gray500)),
        ])),
        Switch(value: isEnabled, onChanged: (v) {}, activeColor: AHColors.navy),
      ]),
    );
  }
}

class _RoleEntry {
  final String name; final int userCount; final int permissionCount;
  const _RoleEntry({required this.name, required this.userCount, required this.permissionCount});
}

const _featureNames = ['Élèves & Scolarité', 'Finances & Économat', 'Examens & Bulletins', 'Organisation Pédagogique',
    'Personnel & RH', 'Communication', 'Bibliothèque', 'Transport', 'Cantine', 'Infirmerie', 'QHSE', 'EduCast', 'Boutique'];
const _featureDescriptions = ['Gestion des élèves et scolarité', 'Gestion financière et comptabilité', 'Examens, notes et bulletins',
    'Structure pédagogique et enseignants', 'Personnel, RH et paie', 'Messagerie et annonces',
    'Bibliothèque scolaire', 'Transport scolaire', 'Cantine et restauration', 'Infirmerie et santé',
    'Qualité, hygiène, sécurité, environnement', 'Contenu éducatif multimédia', 'Boutique scolaire'];
const _featureIcons = [Icons.school, Icons.account_balance, Icons.quiz, Icons.menu_book, Icons.badge, Icons.campaign,
    Icons.local_library, Icons.directions_bus, Icons.restaurant, Icons.medical_services, Icons.shield, Icons.play_circle, Icons.storefront];

const _roleEntries = [
  _RoleEntry(name: 'Directeur Général', userCount: 1, permissionCount: 48),
  _RoleEntry(name: 'Directeur Adjoint', userCount: 2, permissionCount: 42),
  _RoleEntry(name: 'Directeur Académique', userCount: 1, permissionCount: 35),
  _RoleEntry(name: 'Administrateur', userCount: 3, permissionCount: 40),
  _RoleEntry(name: 'Censeur', userCount: 4, permissionCount: 28),
  _RoleEntry(name: 'Enseignant', userCount: 45, permissionCount: 15),
  _RoleEntry(name: 'Parent', userCount: 312, permissionCount: 8),
  _RoleEntry(name: 'Élève', userCount: 890, permissionCount: 5),
];

const _deviceNames = ['iPhone 15 Pro — M. Diallo', 'Samsung Galaxy S24 — Mme Touré', 'iPad Air — Salle professeurs',
    'Chromebook — Secrétariat', 'PC Bureau — Comptabilité'];
const _deviceTypes = ['iOS 17.4', 'Android 14', 'iPadOS 17.4', 'ChromeOS', 'Windows 11'];

const _historyActions = ['Modification paramètres ORION', 'Ajout utilisateur', 'Modification tarif scolarité',
    'Activation module Transport', 'Changement mot de passe', 'Export bulletins PDF',
    'Modification structure scolaire', 'Mise à jour informations établissement', 'Désactivation module EduCast', 'Configuration notifications'];
const _historyUsers = ['Admin (M. Diallo)', 'Directeur (Mme Keita)', 'Admin (M. Coulibaly)', 'Comptable (M. Traoré)'];
