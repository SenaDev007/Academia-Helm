// ============================================================================
// HELM CONNECT — Galerie de médias (V9, parité web MediaGalleryModal)
// ============================================================================
// ⭐ Porté du web (V4 Phase 2, lui-même porté de Yeshua Connect) :
//    - grille 3 colonnes (aspect-square, rounded-xl)
//    - lightbox plein écran : navigation ‹ ›, image pincée (zoom), barre
//      infos (nom · taille · conversation) + bouton Télécharger
//    - IMAGE → miniature ; VIDEO → cellule sombre + icône film ;
//      AUDIO → icône musique ; DOCUMENT → icône fichier
// Données : GET /chat/v2/files?type=media&limit=120 (FilesCenterService).
// Si une [conversation] est fournie, la galerie est filtrée sur celle-ci
// (l'icône image de l'en-tête d'une conversation ouvre SA galerie).
// ============================================================================

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';

import '../models/models.dart';
import '../services/api_service.dart';
import '../theme/helm_theme.dart';

class MediaGalleryScreen extends StatefulWidget {
  /// Conversation de filtrage (null = tous les médias de l'utilisateur).
  final Conversation? conversation;

  const MediaGalleryScreen({super.key, this.conversation});

  @override
  State<MediaGalleryScreen> createState() => _MediaGalleryScreenState();
}

class _MediaGalleryScreenState extends State<MediaGalleryScreen> {
  List<Map<String, dynamic>> _files = [];
  bool _loading = true;
  int _lightboxIndex = -1;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      var files = await ApiService.getV2Files(type: 'media', limit: 120);
      if (widget.conversation != null) {
        final convId = widget.conversation!.id;
        // Les canaux partagent id de conversation = id du canal (V6.1).
        files = files
            .where((f) => f['conversationId'] == convId)
            .toList();
      }
      // Tri web : plus récent d'abord.
      files.sort((a, b) {
        final da = DateTime.tryParse('${a['createdAt'] ?? ''}') ?? DateTime(2000);
        final db = DateTime.tryParse('${b['createdAt'] ?? ''}') ?? DateTime(2000);
        return db.compareTo(da);
      });
      if (mounted) setState(() => _files = files);
    } catch (_) {
      if (mounted) setState(() => _files = []);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _abs(String? raw) {
    final url = raw ?? '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    // URL relative → résolution via ApiConfig (miroir absoluteAttachmentUrl)
    return url; // résolue paresseusement dans les widgets réseau
  }

  String _formatSize(dynamic bytes) {
    final b = bytes is num ? bytes.toInt() : null;
    if (b == null || b <= 0) return '';
    if (b < 1024) return '$b o';
    if (b < 1024 * 1024) return '${(b / 1024).round()} Ko';
    return '${(b / (1024 * 1024)).toStringAsFixed(1)} Mo';
  }

  @override
  Widget build(BuildContext context) {
    final title = widget.conversation != null
        ? 'Galerie · ${widget.conversation!.name}'
        : 'Galerie de médias';
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: const Color(0xFF0958D9),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white)),
            Text(
              '${_files.length} éléments partagés',
              style: const TextStyle(fontSize: 10, color: Color(0xFFBAE0FF)),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.white),
            tooltip: 'Rafraîchir',
            onPressed: _load,
          ),
        ],
      ),
      body: Stack(
        children: [
          _loading
              ? const Center(child: CircularProgressIndicator(color: HelmColors.primary))
              : _files.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: const [
                          Icon(Icons.image_outlined, size: 48, color: Color(0xFFCBD5E1)),
                          SizedBox(height: 8),
                          Text('Aucun média partagé', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Color(0xFF334155))),
                          SizedBox(height: 4),
                          Padding(
                            padding: EdgeInsets.symmetric(horizontal: 40),
                            child: Text(
                              'Les images et vidéos des conversations apparaîtront ici.',
                              textAlign: TextAlign.center,
                              style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                            ),
                          ),
                        ],
                      ),
                    )
                  : GridView.builder(
                      padding: const EdgeInsets.all(12),
                      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 3, // ⭐ miroir web grid-cols-3
                        mainAxisSpacing: 8,
                        crossAxisSpacing: 8,
                      ),
                      itemCount: _files.length,
                      itemBuilder: (context, i) => _gridCell(_files[i], i),
                    ),
          // ⭐ Lightbox plein écran (z-75 web) — superposé dans le Stack
          if (_lightboxIndex >= 0) Positioned.fill(child: _buildLightbox()),
        ],
      ),
    );
  }

  Widget _gridCell(Map<String, dynamic> f, int i) {
    final type = '${f['type'] ?? 'DOCUMENT'}';
    final name = '${f['name'] ?? ''}';
    final url = _abs('${f['url'] ?? ''}');
    return GestureDetector(
      onTap: () => setState(() => _lightboxIndex = i),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: Container(
          decoration: BoxDecoration(
            color: type == 'VIDEO' ? const Color(0xFF1E293B) : const Color(0xFFF1F5F9),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: type == 'IMAGE' && url.isNotEmpty
              ? _RemoteImage(url: url)
              : Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      type == 'VIDEO'
                          ? Icons.movie
                          : type == 'AUDIO'
                              ? Icons.music_note
                              : Icons.insert_drive_file_outlined,
                      size: 28,
                      color: type == 'VIDEO'
                          ? const Color(0xFFFFE08A)
                          : type == 'AUDIO'
                              ? const Color(0xFFCFA63A)
                              : const Color(0xFF94A3B8),
                    ),
                    const SizedBox(height: 4),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 6),
                      child: Text(
                        name.isEmpty
                            ? (type == 'VIDEO' ? 'Vidéo' : type == 'AUDIO' ? 'Audio' : 'Fichier')
                            : name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 9,
                          color: type == 'VIDEO' ? Colors.white70 : const Color(0xFF475569),
                        ),
                      ),
                    ),
                  ],
                ),
        ),
      ),
    );
  }

  // ─── Lightbox ──────────────────────────────────────────────────────────────

  Widget _buildLightbox() {
    final f = _files[_lightboxIndex];
    final type = '${f['type'] ?? 'DOCUMENT'}';
    final name = '${f['name'] ?? 'Média'}';
    final convName = '${f['convName'] ?? ''}';
    final size = _formatSize(f['size']);
    return GestureDetector(
      onTap: () => setState(() => _lightboxIndex = -1),
      child: Container(
        color: Colors.black.withOpacity(0.9),
        child: Stack(
          children: [
            // Contenu central
            Center(
              child: GestureDetector(
                onTap: () {},
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (type == 'IMAGE')
                      SizedBox(
                        width: MediaQuery.of(context).size.width * 0.92,
                        height: MediaQuery.of(context).size.height * 0.7,
                        child: InteractiveViewer(
                          maxScale: 4,
                          child: Center(child: _RemoteImage(url: _abs('${f['url'] ?? ''}'), fit: BoxFit.contain)),
                        ),
                      )
                    else
                      SizedBox(
                        width: 200,
                        height: 200,
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              type == 'VIDEO' ? Icons.movie : Icons.music_note,
                              size: 64,
                              color: type == 'VIDEO' ? const Color(0xFFFFE08A) : const Color(0xFFCFA63A),
                            ),
                            const SizedBox(height: 12),
                            Text(
                              'Ouvrir avec le lecteur du téléphone',
                              textAlign: TextAlign.center,
                              style: const TextStyle(fontSize: 11, color: Colors.white70),
                            ),
                          ],
                        ),
                      ),
                    const SizedBox(height: 16),
                    // Barre infos + actions (miroir web)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(30),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          ConstrainedBox(
                            constraints: const BoxConstraints(maxWidth: 200),
                            child: Text(
                              name + (size.isNotEmpty ? ' · $size' : '') + (convName.isNotEmpty ? ' · $convName' : ''),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontSize: 12, color: Colors.white),
                            ),
                          ),
                          const SizedBox(width: 10),
                          _LightboxAction(
                            icon: Icons.download,
                            background: const Color(0xFFFFE08A),
                            iconColor: const Color(0xFF0A2A5E),
                            onTap: () => _download(f),
                          ),
                          if (type != 'IMAGE')
                            _LightboxAction(
                              icon: Icons.play_arrow,
                              background: Colors.white24,
                              iconColor: Colors.white,
                              onTap: () => _download(f),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            // Navigation ‹ › (miroir web)
            if (_lightboxIndex > 0)
              Positioned(
                left: 8,
                top: 0,
                bottom: 0,
                child: Center(
                  child: _LightboxNav(
                    icon: Icons.chevron_left,
                    onTap: () => setState(() => _lightboxIndex--),
                  ),
                ),
              ),
            if (_lightboxIndex < _files.length - 1)
              Positioned(
                right: 8,
                top: 0,
                bottom: 0,
                child: Center(
                  child: _LightboxNav(
                    icon: Icons.chevron_right,
                    onTap: () => setState(() => _lightboxIndex++),
                  ),
                ),
              ),
            // Fermer
            Positioned(
              top: MediaQuery.of(context).padding.top + 8,
              right: 8,
              child: _LightboxNav(icon: Icons.close, onTap: () => setState(() => _lightboxIndex = -1)),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _download(Map<String, dynamic> f) async {
    final raw = '${f['url'] ?? ''}';
    final name = '${f['name'] ?? 'media'}';
    try {
      String url = raw;
      if (!raw.startsWith('http://') && !raw.startsWith('https://')) {
        url = await ApiConfig.resolveFileUrl(raw);
      }
      final res = await http.get(Uri.parse(url));
      if (res.statusCode != 200) throw Exception('HTTP ${res.statusCode}');
      final dir = await getTemporaryDirectory();
      final safe = name.replaceAll(RegExp(r'[^A-Za-z0-9._-]'), '_');
      final file = File('${dir.path}/$safe');
      await file.writeAsBytes(res.bodyBytes);
      await OpenFilex.open(file.path);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Téléchargé'), duration: Duration(seconds: 1)),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Échec: $e')));
      }
    }
  }
}

// ─── Sous-widgets ─────────────────────────────────────────────────────────────

/// Image réseau avec spinner + repli (miroir <img loading="lazy">).
class _RemoteImage extends StatelessWidget {
  final String url;
  final BoxFit fit;
  const _RemoteImage({required this.url, this.fit = BoxFit.cover});

  Future<String> _resolve() async {
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return ApiConfig.resolveFileUrl(url);
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<String>(
      future: _resolve(),
      builder: (context, snap) {
        if (!snap.hasData) {
          return Container(
            color: const Color(0xFFF1F5F9),
            child: const Center(
              child: SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(strokeWidth: 2, color: HelmColors.primary),
              ),
            ),
          );
        }
        return Image.network(
          snap.data!,
          fit: fit,
          loadingBuilder: (context, child, progress) {
            if (progress == null) return child;
            return Container(
              color: const Color(0xFFF1F5F9),
              child: const Center(
                child: SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)),
              ),
            );
          },
          errorBuilder: (context, error, stack) => Container(
            color: const Color(0xFFF1F5F9),
            child: const Center(child: Icon(Icons.broken_image, color: Color(0xFF94A3B8))),
          ),
        );
      },
    );
  }
}

/// Bouton rond de la barre d'actions lightbox (miroir bg-[#FFE08A] download).
class _LightboxAction extends StatelessWidget {
  final IconData icon;
  final Color background;
  final Color iconColor;
  final VoidCallback onTap;
  const _LightboxAction({
    required this.icon,
    required this.background,
    required this.iconColor,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(6),
        decoration: BoxDecoration(color: background, shape: BoxShape.circle),
        child: Icon(icon, size: 16, color: iconColor),
      ),
    );
  }
}

/// Chevron ‹ › / ✕ de navigation lightbox (miroir bg-white/10 web).
class _LightboxNav extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;
  const _LightboxNav({required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.1),
          shape: BoxShape.circle,
        ),
        child: Icon(icon, color: Colors.white),
      ),
    );
  }
}
