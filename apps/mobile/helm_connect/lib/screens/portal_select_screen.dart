// ============================================================================
// HELM CONNECT — Portal Selection Screen
// ============================================================================
// After selecting the school, the user chooses their portal:
//   - Parent d'élève
//   - Enseignant
//   - Administration (école)
// Then redirects to LoginScreen with the portal + tenant info.
// ============================================================================

import 'package:flutter/material.dart';

enum PortalType { parent, teacher, school }

class PortalSelectScreen extends StatefulWidget {
  final String tenantSlug;
  final String tenantName;

  const PortalSelectScreen({
    super.key,
    required this.tenantSlug,
    required this.tenantName,
  });

  @override
  State<PortalSelectScreen> createState() => _PortalSelectScreenState();
}

class _PortalSelectScreenState extends State<PortalSelectScreen> {
  PortalType? _selectedPortal;

  void _continue() {
    if (_selectedPortal == null) return;

    final portalLabel = switch (_selectedPortal) {
      PortalType.parent => 'parent',
      PortalType.teacher => 'teacher',
      PortalType.school => 'school',
    };

    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => LoginScreen(
          tenantSlug: widget.tenantSlug,
          tenantName: widget.tenantName,
          portal: portalLabel,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Choisir votre profil'),
        backgroundColor: const Color(0xFF0A2A5E),
        foregroundColor: Colors.white,
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Tenant banner
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFFE6F4FF),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFBAE0FF)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.school, color: Color(0xFF0958D9)),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Établissement sélectionné',
                            style: TextStyle(fontSize: 11, color: Color(0xFF667085), fontWeight: FontWeight.w500),
                          ),
                          Text(
                            widget.tenantName,
                            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF0958D9)),
                          ),
                        ],
                      ),
                    ),
                    TextButton(
                      onPressed: () => Navigator.pop(context),
                      child: const Text('Changer', style: TextStyle(color: Color(0xFF1677FF))),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 32),
              // Portal options
              const Text(
                'Sélectionnez votre profil',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF172033)),
              ),
              const SizedBox(height: 8),
              const Text(
                'Choisissez le profil correspondant à votre rôle dans l\'établissement.',
                style: TextStyle(color: Color(0xFF667085), fontSize: 14),
              ),
              const SizedBox(height: 24),
              // Parent
              _buildPortalCard(
                portal: PortalType.parent,
                icon: Icons.family_restroom,
                title: 'Parent d\'élève',
                subtitle: 'Suivez la scolarité de votre enfant, communiquez avec les enseignants',
                color: const Color(0xFF10B981),
              ),
              const SizedBox(height: 12),
              // Teacher
              _buildPortalCard(
                portal: PortalType.teacher,
                icon: Icons.cast_for_education,
                title: 'Enseignant',
                subtitle: 'Gérez vos classes, cahier journal, devoirs et communications',
                color: const Color(0xFF1677FF),
              ),
              const SizedBox(height: 12),
              // School administration
              _buildPortalCard(
                portal: PortalType.school,
                icon: Icons.business,
                title: 'Administration scolaire',
                subtitle: 'Pilotez l\'établissement, gérez élèves, finances, RH et communication',
                color: const Color(0xFF7C3AED),
              ),
              const Spacer(),
              // Continue button
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  onPressed: _selectedPortal == null ? null : _continue,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0A2A5E),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: const Text('Continuer', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildPortalCard({
    required PortalType portal,
    required IconData icon,
    required String title,
    required String subtitle,
    required Color color,
  }) {
    final isSelected = _selectedPortal == portal;
    return GestureDetector(
      onTap: () => setState(() => _selectedPortal = portal),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isSelected ? color.withOpacity(0.05) : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSelected ? color : const Color(0xFFE2E8F0),
            width: isSelected ? 2 : 1,
          ),
          boxShadow: isSelected
              ? [BoxShadow(color: color.withOpacity(0.1), blurRadius: 8, spreadRadius: 1)]
              : null,
        ),
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: color.withOpacity(0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: color, size: 24),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: isSelected ? color : const Color(0xFF172033),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    subtitle,
                    style: const TextStyle(fontSize: 12, color: Color(0xFF667085)),
                  ),
                ],
              ),
            ),
            if (isSelected)
              Icon(Icons.check_circle, color: color, size: 24),
          ],
        ),
      ),
    );
  }
}
