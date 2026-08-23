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
import 'login_screen.dart';

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
            // Header
            Container(
              padding: const EdgeInsets.all(24),
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Color(0xFF1677FF), Color(0xFF0958D9)],
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Helm Connect',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 28,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Communiquez. Collaborez. Restez connectés.',
                    style: TextStyle(
                      color: Color(0xFFBAE0FF),
                      fontSize: 14,
                      fontStyle: FontStyle.italic,
                    ),
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
                            return ListTile(
                              leading: CircleAvatar(
                                backgroundColor: const Color(0xFFE6F4FF),
                                child: Text(
                                  (tenant['name'] as String?)?.isNotEmpty == true
                                      ? (tenant['name'] as String)[0].toUpperCase()
                                      : '?',
                                  style: const TextStyle(color: Color(0xFF0958D9), fontWeight: FontWeight.bold),
                                ),
                              ),
                              title: Text(tenant['name'] as String? ?? ''),
                              subtitle: Text(tenant['subdomain'] as String? ?? ''),
                              trailing: const Icon(Icons.chevron_right, color: Color(0xFF1677FF)),
                              onTap: () {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (context) => LoginScreen(
                                      tenantSlug: tenant['slug'] as String? ?? '',
                                      tenantName: tenant['name'] as String? ?? '',
                                    ),
                                  ),
                                );
                              },
                            );
                          },
                        ),
            ),
          ],
        ),
      ),
    );
  }
}
