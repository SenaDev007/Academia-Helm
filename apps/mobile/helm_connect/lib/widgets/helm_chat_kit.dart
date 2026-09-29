// ============================================================================
// HELM CONNECT — Kit de widgets de conformité web (V9)
// ============================================================================
// But : répliquer EXACTEMENT le design + les rendus du WhatsAppChat.tsx web
// (palette « messaging » #0958D9/#1677FF/#3B9EFF, avatars photos, rendu riche
// Discord @mentions/||spoilers||/```code```, LinkEmbed /api/og, watermark
// Helm, emoji picker 3 catégories identiques, bulle « tape… »).
// ============================================================================

import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;

import '../models/models.dart';
import '../services/api_service.dart';

// ═══════════════════════════════════════════════════════════════════════════
// ⭐ V9 — PALETTE « MESSAGING » DU WEB (WhatsAppChat.tsx, hex exacts)
// ═══════════════════════════════════════════════════════════════════════════
class WebChatColors {
  // Header de conversation + liens forts
  static const Color header = Color(0xFF0958D9);
  static const Color headerSubtitle = Color(0xFFBAE0FF);

  // Boutons primaires (envoyer, CTA, abonnement)
  static const Color primary = Color(0xFF1677FF);
  static const Color primaryHover = Color(0xFF0958D9);

  // Bulles
  static const Color bubbleOwn = Color(0xFF3B9EFF); // + texte blanc
  static const Color bubbleOther = Colors.white; // + border slate-200
  static const Color bubbleOtherBorder = Color(0xFFE2E8F0);

  // Accents de liste
  static const Color activeConversation = Color(0xFFE6F4FF);
  static const Color badgeUnread = Color(0xFF1677FF);
  static const Color pinBanner = Color(0xFFEFF6FF);
  static const Color pinBannerBorder = Color(0xFFDBEAFE);

  // Ticks (web : ✓✓ lu = text-blue-300 sur bulle #3B9EFF)
  static const Color tickRead = Color(0xFF93C5FD);
  static const Color tickDelivered = Color(0xFF94A3B8);
  static const Color tickOnBlue = Colors.white70;

  // Mentions (web renderRichContent)
  static const Color mentionBg = Color(0x261677FF); // rgba(22,119,255,0.15)
  static const Color mentionText = Color(0xFF0958D9);
  static const Color hereBg = Color(0x33F59E0B); // rgba(245,158,11,0.2)
  static const Color hereText = Color(0xFFB45309);

  // Code blocks (web .code-block)
  static const Color codeBg = Color(0xFF0F172A);
  static const Color codeHeader = Color(0xFF0B1322);
  static const Color codeBorder = Color(0xFF1E293B);
  static const Color codeText = Color(0xFFF1F5F9);
  static const Color inlineCodeBg = Color(0xFFF1F5F9);
  static const Color inlineCodeText = Color(0xFF0F172A);

  // Spoiler (web .spoiler-tag)
  static const Color spoilerHidden = Color(0xFF1E293B);
  static const Color spoilerRevealed = Color(0xFF334155);

  // Quote
  static const Color quoteBorder = Color(0xFFCBD5E1);
  static const Color quoteBg = Color(0xFFF8FAFC);
  static const Color quoteText = Color(0xFF475569);

  // Présence
  static const Color online = Color(0xFF4ADE80); // bg-green-400

  // Palette avatars 8 couleurs (web getAvatarColor)
  static const List<Color> avatarPalette = [
    Color(0xFF3B82F6), // bg-blue-500
    Color(0xFF3B9EFF), // bg-[#3B9EFF]
    Color(0xFFF59E0B), // bg-amber-500
    Color(0xFFF43F5E), // bg-rose-500
    Color(0xFF6366F1), // bg-indigo-500
    Color(0xFF8B5CF6), // bg-purple-500
    Color(0xFF06B6D4), // bg-cyan-500
    Color(0xFFF97316), // bg-orange-500
  ];
}

/// Hash djb2 (historique V7 — couleurs « signature » des bulles).
int webHashUserId(String userId) {
  var h = 5381;
  for (var i = 0; i < userId.length; i++) {
    h = (((h << 5) + h + userId.codeUnitAt(i)) & 0x7FFFFFFF);
  }
  return h;
}

/// ⭐ V9 — hash EXACT du web (getAvatarColor) : somme des charCodes du NOM.
///    La couleur d'un même utilisateur est ainsi IDENTIQUE entre web et
///    mobile (conformité FORME) — le web ne connaît que le nom affiché.
int webHashName(String name) {
  var sum = 0;
  for (var i = 0; i < name.length; i++) {
    sum += name.codeUnitAt(i);
  }
  return sum;
}

/// Couleur d'avatar du web : hash du NOM → palette 8 (conforme à 100 %).
Color webAvatarColorByName(String name) =>
    WebChatColors.avatarPalette[webHashName(name) % WebChatColors.avatarPalette.length];

/// Couleur d'avatar par userId (V7, bulles) — conservé pour compat.
Color webAvatarColor(String userId) =>
    WebChatColors.avatarPalette[webHashUserId(userId) % WebChatColors.avatarPalette.length];

// ═══════════════════════════════════════════════════════════════════════════
// ⭐ V9 — AVATAR WEB-CONFORME : photo réseau OU initiales sur palette 8,
//    badge groupe (icône Users pastille #3B9EFF), point présence vert.
// ═══════════════════════════════════════════════════════════════════════════
class HelmAvatar extends StatelessWidget {
  final String name;
  final String? avatarUrl;
  final String? userId;
  final double size;
  final bool isGroup;
  final bool isChannel;
  final bool isOfficialChannel;
  final bool showPresence;
  final bool online;
  final Color? overrideColor;
  final IconData? channelIcon;

  const HelmAvatar({
    super.key,
    required this.name,
    this.avatarUrl,
    this.userId,
    this.size = 44,
    this.isGroup = false,
    this.isChannel = false,
    this.isOfficialChannel = false,
    this.showPresence = false,
    this.online = false,
    this.overrideColor,
    this.channelIcon,
  });

  String get _initials {
    final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts.first[0].toUpperCase();
    return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    // ⭐ Conformité FORME : le web hache le NOM (getAvatarColor), pas
    //    l'userId — même couleur pour un même utilisateur sur web + mobile.
    final color = overrideColor ??
        (isChannel
            ? (isOfficialChannel
                ? const Color(0xFFCFA63A) // dégradé or (officiel)
                : const Color(0xFF3B82F6)) // dégradé bleu→violet
            : webAvatarColorByName(name));
    Widget core;
    final photo = (avatarUrl ?? '').trim();
    if (isChannel) {
      // Web : Megaphone sur dégradé — or (officiel, icône bleu marine) ou
      // bleu→violet (canal libre).
      core = Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: isOfficialChannel
              ? const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [Color(0xFFCFA63A), Color(0xFFFFE08A)],
                )
              : const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [Color(0xFF3B82F6), Color(0xFF9333EA)],
                ),
        ),
        child: Icon(
          channelIcon ?? Icons.campaign,
          color: isOfficialChannel ? const Color(0xFF0A2A5E) : Colors.white,
          size: size * 0.45,
        ),
      );
    } else if (photo.isNotEmpty) {
      // Web : photo → fond slate-200, image object-cover ronde.
      core = CircleAvatar(
        radius: size / 2,
        backgroundColor: const Color(0xFFE2E8F0),
        foregroundImage: NetworkImage(photo),
        onForegroundImageError: (_, __) {},
        child: Text(_initials,
            style: TextStyle(
                color: Colors.white, fontWeight: FontWeight.bold, fontSize: size * 0.38)),
      );
    } else {
      // Web : initiales sur couleur hashée du nom (groupes ET directs).
      core = CircleAvatar(
        radius: size / 2,
        backgroundColor: color,
        child: Text(_initials,
            style: TextStyle(
                color: Colors.white, fontWeight: FontWeight.bold, fontSize: size * 0.38)),
      );
    }
    return Stack(
      clipBehavior: Clip.none,
      children: [
        core,
        // Badge groupe façon web : icône Users dans une pastille #3B9EFF
        if (isGroup)
          Positioned(
            right: -2,
            bottom: -2,
            child: Container(
              width: size * 0.38,
              height: size * 0.38,
              decoration: BoxDecoration(
                color: WebChatColors.bubbleOwn,
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white, width: 1.5),
              ),
              child: Icon(Icons.people, size: size * 0.24, color: Colors.white),
            ),
          ),
        // Point présence vert (DIRECT seulement, façon web)
        if (showPresence)
          Positioned(
            right: 0,
            bottom: 0,
            child: Container(
              width: size * 0.27,
              height: size * 0.27,
              decoration: BoxDecoration(
                color: online ? WebChatColors.online : const Color(0xFFCBD5E1),
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white, width: 2),
              ),
            ),
          ),
      ],
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ⭐ V9 — RENDU RICHE DISCORD (miroir de renderRichContent du web)
//    @mentions (badge bleu) · @here/@everyone/@tous (badge ambre) ·
//    ||spoilers|| (noir, clic pour révéler) · `code inline` ·
//    ```blocs de code``` (header sombre + bouton Copier) · ~~barré~~ ·
//    > citations · gras/italique HTML du RichTextEditor web.
// ═══════════════════════════════════════════════════════════════════════════
class RichMessageContent extends StatelessWidget {
  final String content;
  final bool isOwn;
  final TextStyle? baseStyle;

  const RichMessageContent({
    super.key,
    required this.content,
    required this.isOwn,
    this.baseStyle,
  });

  @override
  Widget build(BuildContext context) {
    final style = baseStyle ??
        TextStyle(
          fontSize: 14,
          height: 1.35,
          color: isOwn ? Colors.white : const Color(0xFF1E293B),
        );
    // 1) Découpe par blocs de code ``` (les blocs ne sont JAMAIS transformés)
    final segments = content.split('```');
    final children = <Widget>[];
    for (var i = 0; i < segments.length; i++) {
      if (i.isOdd) {
        final block = segments[i];
        // Première ligne = étiquette de langue (comme le web)
        final lines = block.split('\n');
        var lang = '';
        var code = block;
        if (lines.length > 1 && lines[0].trim().isNotEmpty && lines[0].trim().length < 20) {
          lang = lines[0].trim();
          code = lines.skip(1).join('\n');
        }
        code = code.trimRight();
        if (code.isEmpty) continue;
        children.add(_CodeBlock(code: code, lang: lang));
        children.add(const SizedBox(height: 4));
      } else if (segments[i].isNotEmpty) {
        children.addAll(_renderPlainSegment(segments[i], style));
      }
    }
    if (children.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: children,
    );
  }

  List<Widget> _renderPlainSegment(String text, TextStyle style) {
    final out = <Widget>[];
    // Normalise le HTML du RichTextEditor web (div/br → \n)
    final normalized = text
        .replaceAll(RegExp(r'<div[^>]*>'), '\n')
        .replaceAll('</div>', '')
        .replaceAll(RegExp(r'<br\s*/?>'), '\n');

    final lines = normalized.split('\n');
    var quoteBuffer = <String>[];

    void flushQuote() {
      if (quoteBuffer.isEmpty) return;
      out.add(Container(
        margin: const EdgeInsets.only(top: 4, bottom: 4),
        padding: const EdgeInsets.only(left: 8, top: 2, bottom: 2),
        decoration: BoxDecoration(
          border: const Border(left: BorderSide(color: WebChatColors.quoteBorder, width: 3)),
          color: WebChatColors.quoteBg,
          borderRadius: BorderRadius.circular(2),
        ),
        child: Text(
          quoteBuffer.join('\n').trim(),
          style: style.copyWith(color: WebChatColors.quoteText, fontSize: 13),
        ),
      ));
      quoteBuffer = [];
    }

    for (final rawLine in lines) {
      final line = rawLine.trim();
      if (line.startsWith('>') && line.length > 1) {
        quoteBuffer.add(line.substring(1).trim());
        continue;
      }
      flushQuote();
      if (line.isEmpty) {
        out.add(const SizedBox(height: 4));
        continue;
      }
      out.add(_RichLine(line: line, isOwn: isOwn, style: style));
      out.add(const SizedBox(height: 2));
    }
    flushQuote();
    return out;
  }
}

/// Une ligne de texte riche — tokenize mentions/spoilers/code inline/barré/HTML.
class _RichLine extends StatelessWidget {
  final String line;
  final bool isOwn;
  final TextStyle style;

  const _RichLine({required this.line, required this.isOwn, required this.style});

  @override
  Widget build(BuildContext context) {
    return Text.rich(
      TextSpan(children: _parseTokens(line)),
      softWrap: true,
    );
  }

  List<InlineSpan> _parseTokens(String text) {
    // <b>/<strong>/<i>/<em>/<u> du web + ~~barré~~ + `code` + @mentions + ||spoiler||
    final pattern = RegExp(
      r'<(b|strong)>(.*?)</\1>'
      r'|<(i|em)>(.*?)</\3>'
      r'|<u>(.*?)</u>'
      r'|~~(.*?)~~'
      r'`([^`\n]+)`'
      r'\|\|(.*?)\|\|'
      r'(@(?:here|everyone|tous)\b)'
      r'|(@[A-Za-zÀ-ÿ0-9_.-]{1,40})',
      multiLine: false,
      dotAll: false,
      caseSensitive: false,
    );
    final spans = <InlineSpan>[];
    var last = 0;
    final base = style;

    for (final m in pattern.allMatches(text)) {
      if (m.start > last) spans.add(TextSpan(text: text.substring(last, m.start), style: base));
      final whole = m.group(0)!;
      if (m.group(1) != null) {
        spans.add(TextSpan(text: m.group(2), style: base.copyWith(fontWeight: FontWeight.bold)));
      } else if (m.group(3) != null) {
        spans.add(TextSpan(text: m.group(4), style: base.copyWith(fontStyle: FontStyle.italic)));
      } else if (m.group(5) != null) {
        spans.add(TextSpan(text: m.group(5), style: base.copyWith(decoration: TextDecoration.underline)));
      } else if (m.group(6) != null) {
        spans.add(TextSpan(text: m.group(6), style: base.copyWith(decoration: TextDecoration.lineThrough)));
      } else if (m.group(7) != null) {
        spans.add(WidgetSpan(
          alignment: PlaceholderAlignment.middle,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
            decoration: BoxDecoration(
              color: WebChatColors.inlineCodeBg,
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(m.group(7)!,
                style: base.copyWith(
                    fontFamily: 'monospace',
                    fontSize: 13,
                    color: WebChatColors.inlineCodeText)),
          ),
        ));
      } else if (m.group(8) != null) {
        spans.add(WidgetSpan(
          alignment: PlaceholderAlignment.middle,
          child: _Spoiler(text: m.group(8)!, isOwn: isOwn, style: base),
        ));
      } else if (m.group(9) != null) {
        // @here / @everyone / @tous — badge ambre
        spans.add(WidgetSpan(
          alignment: PlaceholderAlignment.middle,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
            decoration: BoxDecoration(
              color: WebChatColors.hereBg,
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(whole,
                style: base.copyWith(fontWeight: FontWeight.w600, color: WebChatColors.hereText)),
          ),
        ));
      } else if (m.group(10) != null) {
        // @mention — badge bleu Helm
        spans.add(WidgetSpan(
          alignment: PlaceholderAlignment.middle,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
            decoration: BoxDecoration(
              color: WebChatColors.mentionBg,
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(whole,
                style: base.copyWith(fontWeight: FontWeight.w600, color: WebChatColors.mentionText)),
          ),
        ));
      }
      last = m.end;
    }
    if (last < text.length) spans.add(TextSpan(text: text.substring(last), style: base));
    return spans;
  }
}

/// ||spoiler|| — noir, clic pour révéler (web .spoiler-tag).
class _Spoiler extends StatefulWidget {
  final String text;
  final bool isOwn;
  final TextStyle style;
  const _Spoiler({required this.text, required this.isOwn, required this.style});

  @override
  State<_Spoiler> createState() => _SpoilerState();
}

class _SpoilerState extends State<_Spoiler> {
  bool _revealed = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => setState(() => _revealed = !_revealed),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
        decoration: BoxDecoration(
          color: _revealed ? WebChatColors.spoilerRevealed : WebChatColors.spoilerHidden,
          borderRadius: BorderRadius.circular(4),
        ),
        child: Text(
          _revealed ? widget.text : '                               ',
          style: widget.style.copyWith(
            color: _revealed
                ? const Color(0xFFF1F5F9)
                : const Color(0x00000000),
            fontSize: 13,
          ),
        ),
      ),
    );
  }
}

/// Bloc de code façon web : fond #0f172a, header #0b1322 + langage + Copier.
class _CodeBlock extends StatelessWidget {
  final String code;
  final String lang;
  const _CodeBlock({required this.code, required this.lang});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 4),
      decoration: BoxDecoration(
        color: WebChatColors.codeBg,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: WebChatColors.codeBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: const BoxDecoration(
              color: WebChatColors.codeHeader,
              borderRadius: BorderRadius.vertical(top: Radius.circular(8)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    lang.isEmpty ? 'code' : lang,
                    style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 10),
                  ),
                ),
                GestureDetector(
                  onTap: () {
                    Clipboard.setData(ClipboardData(text: code));
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Code copié'), duration: Duration(seconds: 1)),
                    );
                  },
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: const [
                      Icon(Icons.copy, size: 12, color: Color(0xFF94A3B8)),
                      SizedBox(width: 4),
                      Text('Copier', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 10)),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(8),
            child: Text(
              code,
              style: const TextStyle(
                fontFamily: 'monospace',
                fontSize: 12,
                color: WebChatColors.codeText,
                height: 1.4,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ⭐ V9 — LINK EMBED (miroir web : première URL → GET /api/og → carte 280px)
// ═══════════════════════════════════════════════════════════════════════════
final RegExp _urlRegex = RegExp(r'''https?://[^\s<>"']+''');

/// Extrait la première URL d'un texte (pour l'embed + la suppression auto).
String? extractFirstUrl(String text) {
  final m = _urlRegex.firstMatch(text);
  return m?.group(0);
}

class LinkEmbedCard extends StatefulWidget {
  final String url;
  const LinkEmbedCard({super.key, required this.url});

  @override
  State<LinkEmbedCard> createState() => _LinkEmbedCardState();
}

class _LinkEmbedCardState extends State<LinkEmbedCard> {
  Map<String, dynamic>? _og;
  bool _loading = true;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    _fetchOg();
  }

  Future<void> _fetchOg() async {
    try {
      final data = await ApiService.fetchOgPreview(widget.url);
      if (mounted) {
        setState(() {
          _og = data;
          _loading = false;
          _failed = data.isEmpty;
        });
      }
    } catch (_) {
      if (mounted) setState(() { _loading = false; _failed = true; });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return Container(
        margin: const EdgeInsets.only(top: 6),
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: const SizedBox(
          height: 40,
          child: Center(child: SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))),
        ),
      );
    }
    if (_failed || _og == null) return const SizedBox.shrink();
    final title = (_og!['title'] as String?) ?? '';
    final desc = (_og!['description'] as String?) ?? '';
    final image = (_og!['image'] as String?) ?? '';
    final domain = Uri.tryParse(widget.url)?.host ?? widget.url;
    return Container(
      margin: const EdgeInsets.only(top: 6),
      constraints: const BoxConstraints(maxWidth: 280),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (image.isNotEmpty)
            Image.network(
              image,
              height: 120,
              width: double.infinity,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => const SizedBox.shrink(),
            ),
          Padding(
            padding: const EdgeInsets.all(8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (title.isNotEmpty)
                  Text(title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF0F172A))),
                if (desc.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(desc,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                ],
                const SizedBox(height: 4),
                Row(
                  children: [
                    const Icon(Icons.link, size: 11, color: Color(0xFF94A3B8)),
                    const SizedBox(width: 3),
                    Expanded(
                      child: Text(domain,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ⭐ V9 — WATERMARK HELM (miroir HelmWatermark.tsx : motif tuilé + opacité)
// ═══════════════════════════════════════════════════════════════════════════
class HelmWatermark extends StatelessWidget {
  final Widget child;
  final double opacity; // 0.05 messages / 0.08 écran vide (comme le web)

  const HelmWatermark({super.key, required this.child, this.opacity = 0.05});

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      painter: _HelmWatermarkPainter(opacity: opacity),
      child: child,
    );
  }
}

class _HelmWatermarkPainter extends CustomPainter {
  final double opacity;
  _HelmWatermarkPainter({required this.opacity});

  static const _icons = [
    Icons.chat_bubble_outline,
    Icons.phone_outlined,
    Icons.mail_outline,
    Icons.campaign_outlined,
    Icons.videocam_outlined,
    Icons.mic_none,
    Icons.attach_file,
    Icons.groups_outlined,
  ];

  @override
  void paint(Canvas canvas, Size size) {
    const tile = 120.0;
    final paint = Paint()
      ..color = const Color(0xFF1677FF).withOpacity(opacity)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.6
      ..strokeCap = StrokeCap.round;
    final rows = (size.height / tile).ceil() + 1;
    final cols = (size.width / tile).ceil() + 1;
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        final cx = c * tile + (r.isOdd ? tile / 2 : 0);
        if (cx > size.width + 24) continue;
        final cy = r * tile;
        final icon = _icons[(r * 3 + c) % _icons.length];
        final builder = TextPainter(
          textDirection: TextDirection.ltr,
        );
        builder.text = TextSpan(
          text: String.fromCharCode(icon.codePoint),
          style: TextStyle(
            fontFamily: icon.fontFamily,
            package: icon.fontPackage,
            fontSize: 26,
            color: const Color(0xFF1677FF).withOpacity(opacity),
          ),
        );
        builder.layout();
        builder.paint(canvas, Offset(cx - builder.width / 2, cy - builder.height / 2));
      }
    }
    // léger filet diagonal (rappel du blason tuilé du web)
    final line = Paint()
      ..color = const Color(0xFF1677FF).withOpacity(opacity * 0.5)
      ..strokeWidth = 0.7;
    for (var d = -size.height; d < size.width + size.height; d += tile * 2) {
      canvas.drawLine(Offset(d.toDouble(), 0), Offset(d.toDouble() + size.height, size.height), line);
    }
  }

  @override
  bool shouldRepaint(covariant _HelmWatermarkPainter old) => old.opacity != opacity;
}

// ═══════════════════════════════════════════════════════════════════════════
// ⭐ V9 — EMOJI PICKER (3 catégories IDENTIQUES au web : Sourire/Gestes/Objets)
// ═══════════════════════════════════════════════════════════════════════════
class ChatEmojiPicker extends StatelessWidget {
  final ValueChanged<String> onEmojiSelected;
  const ChatEmojiPicker({super.key, required this.onEmojiSelected});

  static const categories = <({String label, List<String> emojis})>[
    (
      label: '😊 Sourire',
      emojis: ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🥸','🤩','🥳','😏','😒','😞','😔','😟','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗','🤔','🤭','🤫','🤥','😶','😐','😑','😬','🙄','😯','😴','🤤','😪'],
    ),
    (
      label: '👍 Gestes',
      emojis: ['👍','👎','👌','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','👇','☝️','👋','🤚','🖐','✋','🖖','👏','🙌','🤝','🙏','✍️','💪','🦾','🦵','🦿','🤲','🤳','💅','👀','👁','👄','💋','🦷','👅','👂','🦻','👃','🧠','🦴','❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟'],
    ),
    (
      label: '🎉 Objets',
      emojis: ['🎉','🎊','🎈','🎂','🎁','🎀','🏆','🥇','🥈','🥉','⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🏓','🏸','🥅','🏒','🏑','🥍','🎯','🎮','🎲','🧩','♟','♠️','♥️','♦️','♣️','🍔','🍟','🍕','🌭','🥪','🌮','🌯','🥙','🧆','🥚','🍳','🥘','🍲','🥣','🥗','🍿','🧈','🧂','🥫','🍱','🍘','🍙','🍚','🍛','🍜','🍝','🍠','🍢','🍣','🍤','🍥','🥮','🍡','🥟'],
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(maxHeight: 300),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Row(
              children: [
                const Text('Emojis',
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold)),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.close, size: 18),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
          ),
          Flexible(
            child: ListView.builder(
              shrinkWrap: true,
              itemCount: categories.length,
              itemBuilder: (context, catIndex) {
                final cat = categories[catIndex];
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      child: Text(cat.label,
                          style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF64748B))),
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                      child: Wrap(
                        children: cat.emojis
                            .map((e) => InkWell(
                                  borderRadius: BorderRadius.circular(6),
                                  onTap: () => onEmojiSelected(e),
                                  child: Container(
                                    width: 36,
                                    height: 36,
                                    alignment: Alignment.center,
                                    child: Text(e, style: const TextStyle(fontSize: 22)),
                                  ),
                                ))
                            .toList(),
                      ),
                    ),
                    const SizedBox(height: 4),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ⭐ V9 — BULLE « TAPE… » en bas de liste (web : avatar + 3 points bounce)
// ═══════════════════════════════════════════════════════════════════════════
class TypingBubble extends StatelessWidget {
  final String name;
  final String? avatarUrl;
  final String? userId;

  const TypingBubble({super.key, required this.name, this.avatarUrl, this.userId});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 12, bottom: 6, top: 2),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          HelmAvatar(
            name: name,
            avatarUrl: avatarUrl,
            userId: userId,
            size: 32,
          ),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(16),
                topRight: Radius.circular(16),
                bottomLeft: Radius.circular(4),
                bottomRight: Radius.circular(16),
              ),
              border: Border.all(color: WebChatColors.bubbleOtherBorder),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                _BouncingDot(delay: 0),
                const SizedBox(width: 3),
                _BouncingDot(delay: 150),
                const SizedBox(width: 3),
                _BouncingDot(delay: 300),
                const SizedBox(width: 6),
                Text(
                  name.isEmpty ? 'tape…' : '$name tape…',
                  style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _BouncingDot extends StatelessWidget {
  final int delay;
  const _BouncingDot({required this.delay});

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: const Duration(milliseconds: 600),
      curve: Curves.easeOut,
      builder: (context, v, child) => Transform.translate(
        offset: Offset(0, -3 * v),
        child: child,
      ),
      child: Container(
        width: 6,
        height: 6,
        decoration: const BoxDecoration(color: Color(0xFF94A3B8), shape: BoxShape.circle),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ⭐ V9 — SLASH COMMANDS (miroir web : /me /shrug /tableflip /unflip /lenny
//    /spoiler /code — les commandes inconnues restent du texte normal)
// ═══════════════════════════════════════════════════════════════════════════
String applySlashCommand(String input) {
  final trimmed = input.trim();
  final spaceIdx = trimmed.indexOf(' ');
  final cmd = spaceIdx == -1 ? trimmed : trimmed.substring(0, spaceIdx);
  final rest = spaceIdx == -1 ? '' : trimmed.substring(spaceIdx + 1).trim();
  switch (cmd.toLowerCase()) {
    case '/me':
      return rest; // italique via rendu (préfixe aucun markup — web rend en italique)
    case '/shrug':
      return '${rest.isEmpty ? '' : '$rest '}\u00AF\\_(\u30C4)_/\u00AF';
    case '/tableflip':
      return '(╯°□°）╯︵ ┻━┻ ${rest.isEmpty ? '' : rest}';
    case '/unflip':
      return '┬─┬\u00AF\\(°\u30C4\u00AF)/ ┬─┬ ${rest.isEmpty ? '' : rest}';
    case '/lenny':
      return '( ͡° ͜ʖ ͡°) ${rest.isEmpty ? '' : rest}';
    case '/spoiler':
      return '||$rest||';
    case '/code':
      return '```\n$rest\n```';
    default:
      return input;
  }
}

/// Vrai si la commande doit OUVRIR un modal (web : /poll, /announce).
bool isModalSlashCommand(String input) {
  final t = input.trim().toLowerCase();
  return t == '/poll' || t.startsWith('/poll ') || t == '/announce' || t.startsWith('/announce ');
}
