// ============================================================================
// RINGTONE SERVICE — Soft phone ringtones for Yeshua Connect mobile (V3-6)
// ============================================================================
// Mirrors the web WhatsAppChat.tsx ringtone logic (Web Audio API) but for
// Flutter using the audioplayers package. Two distinct soft tones:
//   - Outgoing (caller): single gentle G4 beep every 2s ("calling... calling...")
//   - Incoming (callee): classic double-ring C5+E5 chord every 3s (ring ring)
//
// The tones are generated as low-volume sine waves via AudioPlayer's setVolume
// + repeated play. Since we don't have a bundled audio asset, we synthesize
// the tones using a tiny WAV data URI generated in-memory.
//
// Pattern:
//   - Singleton instance per CallService
//   - Fire-and-forget (errors logged, never thrown)
//   - Auto-stops when the call state transitions to active/idle
// ============================================================================
import 'dart:async';
import 'dart:math' as math;
import 'dart:typed_data';
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/foundation.dart';

class RingtoneService {
  static final RingtoneService _instance = RingtoneService._internal();
  factory RingtoneService() => _instance;
  RingtoneService._internal();

  final AudioPlayer _player = AudioPlayer();
  Timer? _timer;
  bool _isPlaying = false;
  String? _currentMode;

  /// Pre-generated WAV bytes for the two ringtone modes.
  Uint8List? _outgoingWav;
  Uint8List? _incomingWav;

  /// Generate a short WAV file in memory with the given frequencies.
  Uint8List _generateWav({
    required List<({double freq, double start, double duration, double volume})> tones,
    required double totalDuration,
    required int sampleRate,
  }) {
    final numSamples = (totalDuration * sampleRate).round();
    final dataSize = numSamples * 2; // 16-bit mono
    // Use a list of bytes instead of ByteData.setString (which doesn't exist)
    final bytes = <int>[];

    // WAV header (44 bytes) — write strings as ASCII byte values
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
    writeUint16(1);  // PCM
    writeUint16(1);  // mono
    writeUint32(sampleRate);
    writeUint32(sampleRate * 2); // byte rate
    writeUint16(2);  // block align
    writeUint16(16); // bits per sample
    writeString('data');
    writeUint32(dataSize);

    // Generate samples
    for (int i = 0; i < numSamples; i++) {
      final t = i / sampleRate;
      double sample = 0;
      for (final tone in tones) {
        if (t >= tone.start && t < tone.start + tone.duration) {
          final localT = t - tone.start;
          final progress = localT / tone.duration;
          // Soft sine wave with gentle attack/release envelope
          final envelope = math.sin(math.pi * progress); // 0 → 1 → 0
          sample += math.sin(2 * math.pi * tone.freq * localT) * tone.volume * envelope;
        }
      }
      // Clamp + convert to 16-bit signed
      final clamped = (sample * 32767).clamp(-32768, 32767).toInt();
      bytes.add(clamped & 0xFF);
      bytes.add((clamped >> 8) & 0xFF);
    }

    return Uint8List.fromList(bytes);
  }

  Future<void> _ensureWavsGenerated() async {
    if (_outgoingWav != null && _incomingWav != null) return;

    // Outgoing: single gentle G4 (392 Hz) beep, 0.5s, low volume
    _outgoingWav = _generateWav(
      tones: [
        (freq: 392.0, start: 0.0, duration: 0.5, volume: 0.05),
      ],
      totalDuration: 0.5,
      sampleRate: 22050,
    );

    // Incoming: two short rings (C5 + E5 chord) every 3s
    _incomingWav = _generateWav(
      tones: [
        (freq: 523.25, start: 0.0, duration: 0.4, volume: 0.06),
        (freq: 659.25, start: 0.0, duration: 0.4, volume: 0.04),
        (freq: 523.25, start: 0.6, duration: 0.4, volume: 0.06),
        (freq: 659.25, start: 0.6, duration: 0.4, volume: 0.04),
      ],
      totalDuration: 1.0,
      sampleRate: 22050,
    );
  }

  /// Start playing the ringtone in the given mode.
  Future<void> start({required String mode}) async {
    if (_isPlaying && _currentMode == mode) return;
    await stop();

    try {
      await _ensureWavsGenerated();
      final wav = mode == 'incoming' ? _incomingWav! : _outgoingWav!;
      final loopInterval = mode == 'incoming'
          ? const Duration(seconds: 3)
          : const Duration(seconds: 2);

      await _player.setVolume(0.3);
      await _player.setReleaseMode(ReleaseMode.stop);
      await _player.setPlayerMode(PlayerMode.lowLatency);

      await _player.play(BytesSource(wav));

      _timer = Timer.periodic(loopInterval, (_) async {
        try {
          await _player.stop();
          await _player.play(BytesSource(wav));
        } catch (e) {
          debugPrint('⚠️ Ringtone loop play failed: $e');
        }
      });

      _isPlaying = true;
      _currentMode = mode;
    } catch (e) {
      debugPrint('⚠️ Ringtone start failed: $e');
    }
  }

  /// Stop the ringtone.
  Future<void> stop() async {
    _timer?.cancel();
    _timer = null;
    try {
      await _player.stop();
    } catch (e) {
      debugPrint('⚠️ Ringtone stop failed: $e');
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
