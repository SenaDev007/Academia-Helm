// ============================================================================
// RINGTONE SERVICE — Sonneries IDENTIQUES à Yeshua Connect (V6)
// ============================================================================
// ⭐ V6 (demande explicite : « la même sonnerie » partout) :
//
//   • ENTRANT (audio ET vidéo) = le bi-bip WebAudio de Yeshua Connect (web,
//     IncomingCallOverlay) : deux bursts sinusoïdaux — 880 Hz à t=0 puis
//     660 Hz à t=0,45 s — chacun 0,4 s avec l'enveloppe exponentielle EXACTE
//     0,001 → 0,25 (en 0,03 s) → 0,001 (à 0,38 s), répétés toutes les 2 s.
//
//   • SORTANT (audio ET vidéo) = le FICHIER ringback.wav de Yeshua Connect
//     (public/sounds/ringback.wav — 6 s, 8 kHz, mono, 16 bits — copie
//     octet-octet dans assets/sounds/), joué EN BOUCLE à volume 0,5.
//
//   Comme dans Yeshua : même son pour l'audio et la vidéo, pas de sonnerie
//   distincte par type d'appel — la distinction visuelle reste à l'écran.
//
// Implémentation Flutter : audioplayers.
//   - Sortant : AssetSource + ReleaseMode.loop (boucle NATIVE du fichier,
//     exactement comme <audio loop> sur le web).
//   - Entrant : WAV généré en mémoire avec les paramètres exacts de Yeshua
//     (fréquences, offsets, enveloppe exponentielle), rejoué toutes les 2 s
//     via un Timer.periodic — l'équivalent fidèle du setInterval(playBurst,
//     2000) de Yeshua.
//
// Pattern :
//   - Singleton instance per CallService
//   - Fire-and-forget (errors logged, never thrown)
//   - Auto-stops when the call state transitions to active/idle
// ============================================================================
import 'dart:async';
import 'dart:io';
import 'dart:math' as math;
import 'dart:typed_data';
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';

class RingtoneService {
  static final RingtoneService _instance = RingtoneService._internal();
  factory RingtoneService() => _instance;
  RingtoneService._internal();

  final AudioPlayer _player = AudioPlayer();
  Timer? _timer;
  bool _isPlaying = false;
  String? _currentMode;

  /// WAV du bi-bip ENTRANT Yeshua (généré en mémoire, paramètres exacts).
  String? _incomingWavPath;

  /// ─── Enveloppe exponentielle EXACTE de Yeshua (WebAudio) ───────────────
  ///   gain(t) = 0,001 … 0,03 s → rampes EXPONENTIELLES → 0,25, puis → 0,001
  ///   à 0,38 s, constant jusqu'à 0,4 s.
  double _yeshuaEnvelope(double localT) {
    if (localT < 0) return 0.0001;
    if (localT < 0.03) {
      // exponentialRamp 0.001 → 0.25 sur 0,03 s
      return 0.001 * math.pow(0.25 / 0.001, localT / 0.03);
    }
    if (localT < 0.38) {
      // exponentialRamp 0.25 → 0.001 de 0,03 s à 0,38 s
      final t = (localT - 0.03) / 0.35;
      return 0.25 * math.pow(0.001 / 0.25, t);
    }
    if (localT < 0.40) return 0.001;
    return 0.0001; // silence après 0,4 s (osc.stop)
  }

  /// Génère le WAV du bi-bip Yeshua : 880 Hz @ 0 s + 660 Hz @ 0,45 s,
  /// chacun 0,4 s, 44 100 Hz / 16 bits / mono (burst de 0,85 s).
  Uint8List _generateYeshuaIncomingWav({int sampleRate = 44100}) {
    const double totalDuration = 0.85;
    final numSamples = (totalDuration * sampleRate).round();
    final dataSize = numSamples * 2; // 16-bit mono
    final bytes = <int>[];

    void writeString(String s) {
      for (int i = 0; i < s.length; i++) {
        bytes.add(s.codeUnitAt(i));
      }
    }

    void writeUint32(int v) {
      bytes.add(v & 0xFF);
      bytes.add((v >> 8) & 0xFF);
      bytes.add((v >> 16) & 0xFF);
      bytes.add((v >> 24) & 0xFF);
    }

    void writeUint16(int v) {
      bytes.add(v & 0xFF);
      bytes.add((v >> 8) & 0xFF);
    }

    writeString('RIFF');
    writeUint32(36 + dataSize);
    writeString('WAVE');
    writeString('fmt ');
    writeUint32(16); // fmt chunk size
    writeUint16(1); // PCM
    writeUint16(1); // mono
    writeUint32(sampleRate);
    writeUint32(sampleRate * 2); // byte rate
    writeUint16(2); // block align
    writeUint16(16); // bits per sample
    writeString('data');
    writeUint32(dataSize);

    // Les DEUX bursts de Yeshua : [880 Hz @ 0] et [660 Hz @ 0,45 s]
    const bursts = [
      (freq: 880.0, offset: 0.0),
      (freq: 660.0, offset: 0.45),
    ];

    for (int i = 0; i < numSamples; i++) {
      final t = i / sampleRate;
      double sample = 0;
      for (final b in bursts) {
        final localT = t - b.offset;
        if (localT >= 0 && localT < 0.4) {
          final env = _yeshuaEnvelope(localT);
          sample += math.sin(2 * math.pi * b.freq * localT) * env;
        }
      }
      final clamped = (sample * 32767).clamp(-32768, 32767).toInt();
      bytes.add(clamped & 0xFF);
      bytes.add((clamped >> 8) & 0xFF);
    }

    return Uint8List.fromList(bytes);
  }

  /// Génère (une seule fois) le WAV entrant dans le répertoire temporaire.
  Future<void> _ensureIncomingWav() async {
    if (_incomingWavPath != null && await File(_incomingWavPath!).exists()) {
      return;
    }
    try {
      final tempDir = await getTemporaryDirectory();
      final wav = _generateYeshuaIncomingWav();
      final path = '${tempDir.path}/helm_ringtone_yeshua_incoming.wav';
      await File(path).writeAsBytes(wav);
      _incomingWavPath = path;
      debugPrint('RingtoneService: bi-bip Yeshua (880/660 Hz) généré → $path');
    } catch (e) {
      debugPrint('WARN: Yeshua incoming WAV generation failed: $e');
    }
  }

  /// Start playing the ringtone in the given mode.
  Future<void> start({required String mode}) async {
    if (_isPlaying && _currentMode == mode) return;
    await stop();

    try {
      if (mode == 'incoming') {
        // ── Yeshua : bi-bip 880/660 Hz, burst de 0,85 s TOUTES LES 2 s ──
        await _ensureIncomingWav();
        final wavPath = _incomingWavPath;
        if (wavPath == null) {
          debugPrint('WARN: incoming WAV path is null — cannot play');
          return;
        }
        await _player.setReleaseMode(ReleaseMode.stop);
        await _player.setVolume(1.0); // le gain est DÉJÀ dans l'enveloppe (0,25 max, comme Yeshua)
        await _player.play(DeviceFileSource(wavPath));
        // setInterval(playBurst, 2000) — le burst dure 0,85 s, pause 1,15 s.
        _timer = Timer.periodic(const Duration(seconds: 2), (_) async {
          try {
            await _player.stop();
            await _player.play(DeviceFileSource(wavPath));
          } catch (e) {
            debugPrint('WARN: ringtone loop play failed: $e');
          }
        });
      } else {
        // ── Yeshua : ringback.wav (fichier réel), boucle, volume 0,5 ──
        // ReleaseMode.loop = boucle NATIVE du fichier 6 s — l'équivalent
        // exact du <audio src="/sounds/ringback.wav" loop> du web Yeshua.
        await _player.setReleaseMode(ReleaseMode.loop);
        await _player.setVolume(0.5);
        await _player.play(AssetSource('sounds/ringback.wav'));
      }

      _isPlaying = true;
      _currentMode = mode;
      debugPrint('SUCCESS: Yeshua ringtone started (mode=$mode)');
    } catch (e) {
      debugPrint('WARN: Ringtone start failed: $e');
    }
  }

  /// Stop the ringtone.
  Future<void> stop() async {
    _timer?.cancel();
    _timer = null;
    try {
      await _player.stop();
      await _player.setReleaseMode(ReleaseMode.stop);
    } catch (e) {
      debugPrint('WARN: Ringtone stop failed: $e');
    }
    _isPlaying = false;
    _currentMode = null;
  }

  /// Dispose the player.
  void dispose() {
    _timer?.cancel();
    _player.dispose();
  }
}
