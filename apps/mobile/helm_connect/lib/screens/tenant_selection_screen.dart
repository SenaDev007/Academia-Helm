// ============================================================================
// HELM CONNECT — Tenant Selection Screen (first launch)
// ============================================================================
// À la première installation, l'utilisateur sélectionne son école (tenant).
// Cette sélection est stockée dans SharedPreferences et persiste.
//
// ⭐ Étapes :
//   1. L'utilisateur saisit le nom de son école (ex: "CSPEB-EVEIL D'AFRIQUE EDUCATION")
//   2. Recherche en direct via /api/auth/available-tenants?q=...
//   3. L'utilisateur sélectionne une école → tenant stocké localement
//   4. Redirection vers l'écran de connexion avec ce tenant pré-sélectionné
// ============================================================================

import 'package:flutter/material.dart';
import '../services/api_service.dart';
import 'portal_select_screen.dart';

class TenantSelectionScreen extends StatefulWidget {
  const TenantSelectionScreen({super.key});

  @override
  State<TenantSelectionScreen> createState() => _TenantSelectionScreenState();
}

class _TenantSelectionScreenState extends State<TenantSelectionScreen> {
  final _searchController = TextEditingController();
  List<Map<String, dynamic>> _results = [];
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadDefaultTenants();
  }

  Future<void> _loadDefaultTenants() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final results = await ApiService.searchTenants('');
      setState(() {
        _results = results;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _search(String query) async {
    if (query.trim().isEmpty) {
      _loadDefaultTenants();
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final results = await ApiService.searchTenants(query);
      setState(() {
        _results = results;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            // Header — Helm Connect branded (Royal Blue gradient + logo)
            Container(
              padding: const EdgeInsets.all(24),
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    Color(0xFF0A2A5E),
                    Color(0xFF114FC4),
                    Color(0xFF1C6FE8),
                  ],
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Logo + title row
                  Row(
                    children: [
                      Image.asset(
                        'assets/icons/helm_connect.png',
                        width: 40,
                        height: 40,
                        fit: BoxFit.contain,
                      ),
                      const SizedBox(width: 12),
                      const Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                'Helm',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 24,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              SizedBox(width: 4),
                              Text(
                                'Connect',
                                style: TextStyle(
                                  color: Color(0xFFF5B335),
                                  fontSize: 24,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ],
                          ),
                          Text(
                            'Communiquez • Collaborez • Restez connectés',
                            style: TextStyle(
                              color: Color(0xFFBBDEFB),
                              fontSize: 11,
                              letterSpacing: 1,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 32),
                  const Text(
                    'Sélectionnez votre école',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 20,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Pour continuer, sélectionnez l\'établissement auquel vous appartenez.',
                    style: TextStyle(color: Color(0xFFE6F4FF), fontSize: 14),
                  ),
                ],
              ),
            ),
            // Search bar
            Padding(
              padding: const EdgeInsets.all(16),
              child: TextField(
                controller: _searchController,
                decoration: InputDecoration(
                  hintText: 'Rechercher une école par nom...',
                  prefixIcon: const Icon(Icons.search),
                  suffixIcon: _searchController.text.isNotEmpty
                      ? IconButton(
                          icon: const Icon(Icons.clear),
                          onPressed: () {
                            _searchController.clear();
                            _loadDefaultTenants();
                          },
                        )
                      : null,
                ),
                onChanged: (value) {
                  _search(value);
                },
              ),
            ),
            // Results list
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : _error != null
                      ? Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.error_outline, size: 48, color: Colors.red),
                              const SizedBox(height: 16),
                              Text(_error!, textAlign: TextAlign.center),
                              const SizedBox(height: 16),
                              ElevatedButton(
                                onPressed: _loadDefaultTenants,
                                child: const Text('Réessayer'),
                              ),
                            ],
                          ),
                        )
                      : ListView.builder(
                          itemCount: _results.length,
                          itemBuilder: (context, index) {
                            final tenant = _results[index];
                            final name = tenant['name'] as String? ?? '';
                            final city = tenant['city'] as String? ?? '';
                            final logoUrl = tenant['logoUrl'] as String? ?? '';
                            return Container(
                              margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                              decoration: BoxDecoration(
                                gradient: LinearGradient(
                                  colors: [
                                    const Color(0xFF0A2A5E).withOpacity(0.04),
                                    const Color(0xFF1C6FE8).withOpacity(0.02),
                                  ],
                                ),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: const Color(0xFF0A2A5E).withOpacity(0.1)),
                              ),
                              child: InkWell(
                                onTap: () {
                                  Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (context) => PortalSelectScreen(
                                        tenantSlug: tenant['slug'] as String? ?? '',
                                        tenantName: name,
                                      ),
                                    ),
                                  );
                                },
                                borderRadius: BorderRadius.circular(12),
                                child: Padding(
                                  padding: const EdgeInsets.all(12),
                                  child: Row(
                                    children: [
                                      // School logo or fallback school icon
                                      _buildSchoolLogo(logoUrl, name),
                                      const SizedBox(width: 12),
                                      // Name + city
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              name,
                                              style: const TextStyle(
                                                fontSize: 14,
                                                fontWeight: FontWeight.w700,
                                                color: Color(0xFF0A2A5E),
                                              ),
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                            ),
                                            if (city.isNotEmpty) ...[
                                              const SizedBox(height: 2),
                                              Row(
                                                children: [
                                                  Icon(Icons.location_on, size: 12, color: Colors.grey[400]),
                                                  const SizedBox(width: 2),
                                                  Flexible(
                                                    child: Text(
                                                      city,
                                                      style: TextStyle(
                                                        fontSize: 12,
                                                        color: Colors.grey[500],
                                                      ),
                                                      maxLines: 1,
                                                      overflow: TextOverflow.ellipsis,
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ],
                                          ],
                                        ),
                                      ),
                                      const Icon(Icons.chevron_right, color: Color(0xFF1C6FE8)),
                                    ],
                                  ),
                                ),
                              ),
                            );
                          },
                        ),
            ),
          ],
        ),
      ),
    );
  }

  /// Build school logo: if logoUrl is a valid URL, show the image;
  /// otherwise show a fallback school icon (matches mobile-app pattern).
  Widget _buildSchoolLogo(String logoUrl, String name) {
    if (logoUrl.isNotEmpty && (logoUrl.startsWith('http://') || logoUrl.startsWith('https://'))) {
      return ClipOval(
        child: Image.network(
          logoUrl,
          width: 40,
          height: 40,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => _buildLogoFallback(),
        ),
      );
    }
    return _buildLogoFallback();
  }

  Widget _buildLogoFallback() {
    return Container(
      width: 40,
      height: 40,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            const Color(0xFF0A2A5E).withOpacity(0.14),
            const Color(0xFF1C6FE8).withOpacity(0.08),
          ],
        ),
        shape: BoxShape.circle,
      ),
      child: const Icon(
        Icons.school,
        color: Color(0xFF0A2A5E),
        size: 20,
      ),
    );
  }
}
