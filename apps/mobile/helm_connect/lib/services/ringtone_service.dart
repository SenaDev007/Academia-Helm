// ============================================================================
// RINGTONE SERVICE — Soft phone ringtones for Helm Connect mobile (V3-11)
// ============================================================================
// Mirrors the web WhatsAppChat.tsx ringtone logic (Web Audio API) but for
// Flutter using the audioplayers package. Two distinct soft tones:
//   - Outgoing (caller): single gentle G4 beep every 2s ("calling... calling...")
//   - Incoming (callee): classic double-ring C5+E5 chord every 3s (ring ring)
//
// ⭐ V3-11 FIX: Previous implementation used BytesSource + lowLatency mode
//   which fails silently on many Android devices because the AudioTrack
//   can't be reconfigured for repeated short clips. We now WRITE the WAV
//   to a temp file and play it with the default (media player) mode, which
//   is more reliable across Android 9-14.
//
// Pattern:
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

  /// Pre-generated WAV file paths for the two ringtone modes.
  String? _outgoingWavPath;
  String? _incomingWavPath;

  /// Generate a short WAV file in memory with the given frequencies.
  Uint8List _generateWav({
    required List<({double freq, double start, double duration, double volume})> tones,
    required double totalDuration,
    required int sampleRate,
  }) {
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
    writeUint16(1);  // PCM
    writeUint16(1);  // mono
    writeUint32(sampleRate);
    writeUint32(sampleRate * 2); // byte rate
    writeUint16(2);  // block align
    writeUint16(16); // bits per sample
    writeString('data');
    writeUint32(dataSize);

    for (int i = 0; i < numSamples; i++) {
      final t = i / sampleRate;
      double sample = 0;
      for (final tone in tones) {
        if (t >= tone.start && t < tone.start + tone.duration) {
          final localT = t - tone.start;
          final progress = localT / tone.duration;
          final envelope = math.sin(math.pi * progress);
          sample += math.sin(2 * math.pi * tone.freq * localT) * tone.volume * envelope;
        }
      }
      final clamped = (sample * 32767).clamp(-32768, 32767).toInt();
      bytes.add(clamped & 0xFF);
      bytes.add((clamped >> 8) & 0xFF);
    }

    return Uint8List.fromList(bytes);
  }

  /// ⭐ V3-11: Generate the WAV files ONCE and write them to temp dir.
  ///   Subsequent plays reuse the same file path (no regeneration).
  Future<void> _ensureWavsGenerated() async {
    if (_outgoingWavPath != null && _incomingWavPath != null &&
        await File(_outgoingWavPath!).exists() && await File(_incomingWavPath!).exists()) {
      return;
    }
    try {
      final tempDir = await getTemporaryDirectory();
      // Outgoing: single gentle G4 (392 Hz) beep, 0.5s, low volume
      final outgoingWav = _generateWav(
        tones: [
          (freq: 392.0, start: 0.0, duration: 0.5, volume: 0.08),
        ],
        totalDuration: 0.5,
        sampleRate: 22050,
      );
      final outgoingPath = '${tempDir.path}/helm_ringtone_outgoing.wav';
      await File(outgoingPath).writeAsBytes(outgoingWav);
      _outgoingWavPath = outgoingPath;

      // Incoming: two short rings (C5 + E5 chord) every 3s
      final incomingWav = _generateWav(
        tones: [
          (freq: 523.25, start: 0.0, duration: 0.4, volume: 0.10),
          (freq: 659.25, start: 0.0, duration: 0.4, volume: 0.08),
          (freq: 523.25, start: 0.6, duration: 0.4, volume: 0.10),
          (freq: 659.25, start: 0.6, duration: 0.4, volume: 0.08),
        ],
        totalDuration: 1.0,
        sampleRate: 22050,
      );
      final incomingPath = '${tempDir.path}/helm_ringtone_incoming.wav';
      await File(incomingPath).writeAsBytes(incomingWav);
      _incomingWavPath = incomingPath;

      debugPrint('SUCCESS: Ringtone WAVs generated at $outgoingPath and $incomingPath');
    } catch (e) {
      debugPrint('WARN: Ringtone WAV generation failed: $e');
    }
  }

  /// Start playing the ringtone in the given mode.
  Future<void> start({required String mode}) async {
    if (_isPlaying && _currentMode == mode) return;
    await stop();

    try {
      await _ensureWavsGenerated();
      final wavPath = mode == 'incoming' ? _incomingWavPath : _outgoingWavPath;
      if (wavPath == null) {
        debugPrint('WARN: Ringtone WAV path is null — cannot play');
        return;
      }

      final loopInterval = mode == 'incoming'
          ? const Duration(seconds: 3)
          : const Duration(seconds: 2);

      // ⭐ V3-11: Use default media player mode (not lowLatency) for reliability
      await _player.setReleaseMode(ReleaseMode.stop);
      await _player.setVolume(0.5);
      // Use DeviceFileSource — reliable on Android 9-14
      await _player.play(DeviceFileSource(wavPath));

      _timer = Timer.periodic(loopInterval, (_) async {
        try {
          await _player.stop();
          await _player.play(DeviceFileSource(wavPath));
        } catch (e) {
          debugPrint('WARN: Ringtone loop play failed: $e');
        }
      });

      _isPlaying = true;
      _currentMode = mode;
      debugPrint('SUCCESS: Ringtone started (mode=$mode)');
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
