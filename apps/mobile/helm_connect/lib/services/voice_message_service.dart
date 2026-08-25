// ============================================================================
// HELM CONNECT — Voice Message Service (V3-11)
// ============================================================================
// Records audio messages using flutter_sound and uploads them via
// ApiService.sendAttachment with type=AUDIO.
//
// Lifecycle:
//   1. startRecording() — opens the microphone and writes to a temp file
//   2. stopRecording() — returns the File path + duration in seconds
//   3. uploadVoice(File file, conversationId) — uploads to backend
//   4. Playback is handled by the chat bubble using audioplayers
//
// Duration is tracked by a manual Timer (1s ticks) instead of relying on
// flutter_sound's disposition callback, which may not fire on every platform.
// ============================================================================

import 'dart:async';
import 'dart:io';
import 'package:flutter_sound/flutter_sound.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';
import 'api_service.dart';

class VoiceMessageService {
  static const _codec = Codec.aacMP4;
  FlutterSoundRecorder? _recorder;
  bool _isRecording = false;
  bool _isPaused = false;
  String? _currentPath;
  Timer? _stopwatchTimer;
  int _elapsedSeconds = 0;

  bool get isRecording => _isRecording;
  bool get isPaused => _isPaused;
  int get elapsedSeconds => _elapsedSeconds;

  /// Request microphone permission (must be called before recording).
  Future<bool> requestPermission() async {
    final status = await Permission.microphone.request();
    return status.isGranted;
  }

  /// Start a new recording. Returns true if recording started successfully.
  Future<bool> startRecording() async {
    if (_isRecording) return false;

    final hasPermission = await requestPermission();
    if (!hasPermission) return false;

    try {
      _recorder = await FlutterSoundRecorder().openRecorder();

      // Create a temp file path
      final tempDir = await getTemporaryDirectory();
      final timestamp = DateTime.now().millisecondsSinceEpoch;
      _currentPath = '${tempDir.path}/voice_$timestamp.mp4';

      await _recorder!.startRecorder(
        toFile: _currentPath,
        codec: _codec,
        sampleRate: 44100,
        numChannels: 1,
        bitRate: 64000,
      );

      _isRecording = true;
      _isPaused = false;
      _elapsedSeconds = 0;

      // Start a periodic timer to track the elapsed duration (1-second ticks).
      // The UI listens to a ValueNotifier-style pattern: it polls `elapsedSeconds`.
      _stopwatchTimer = Timer.periodic(const Duration(seconds: 1), (_) {
        if (!_isPaused) {
          _elapsedSeconds++;
          // Notify any listeners via the external callback (set by the UI).
          _onTick?.call(_elapsedSeconds);
        }
      });

      return true;
    } catch (e) {
      print('WARN: startRecording failed: $e');
      _isRecording = false;
      return false;
    }
  }

  /// Optional tick callback — set by the UI to update its display.
  /// Receives the current elapsed duration in seconds.
  void Function(int seconds)? _onTick;
  set onTick(void Function(int seconds)? cb) => _onTick = cb;

  /// Pause the current recording (timer pauses too).
  Future<void> pauseRecording() async {
    if (!_isRecording || _isPaused || _recorder == null) return;
    try {
      await _recorder!.pauseRecorder();
      _isPaused = true;
    } catch (e) {
      print('WARN: pauseRecording failed: $e');
    }
  }

  /// Resume a paused recording.
  Future<void> resumeRecording() async {
    if (!_isRecording || !_isPaused || _recorder == null) return;
    try {
      await _recorder!.resumeRecorder();
      _isPaused = false;
    } catch (e) {
      print('WARN: resumeRecording failed: $e');
    }
  }

  /// Stop the current recording. Returns the file + duration in seconds.
  /// Returns null if no recording was in progress.
  Future<VoiceRecording?> stopRecording() async {
    if (!_isRecording || _recorder == null) return null;
    try {
      final path = await _recorder!.stopRecorder();
      _stopwatchTimer?.cancel();
      _stopwatchTimer = null;
      _isRecording = false;
      _isPaused = false;
      final durationSeconds = _elapsedSeconds;
      _elapsedSeconds = 0;
      _onTick = null;

      if (path == null || path.isEmpty) return null;
      final file = File(path);
      if (!await file.exists()) return null;

      return VoiceRecording(
        file: file,
        durationSeconds: durationSeconds,
        path: path,
      );
    } catch (e) {
      print('WARN: stopRecording failed: $e');
      _stopwatchTimer?.cancel();
      _isRecording = false;
      _isPaused = false;
      return null;
    }
  }

  /// Cancel the current recording (deletes the temp file).
  Future<void> cancelRecording() async {
    if (_isRecording && _recorder != null) {
      try {
        await _recorder!.stopRecorder();
      } catch (_) {}
    }
    _stopwatchTimer?.cancel();
    _stopwatchTimer = null;
    _isRecording = false;
    _isPaused = false;
    _elapsedSeconds = 0;
    _onTick = null;
    // Delete the temp file
    if (_currentPath != null) {
      try {
        final file = File(_currentPath!);
        if (await file.exists()) await file.delete();
      } catch (_) {}
      _currentPath = null;
    }
  }

  /// Upload a voice recording to a conversation.
  /// Returns the backend response (the new message object).
  Future<Map<String, dynamic>> uploadVoice({
    required String conversationId,
    required VoiceRecording recording,
  }) async {
    final fileName = 'voice_${DateTime.now().millisecondsSinceEpoch}.mp4';
    return ApiService.sendAttachment(
      conversationId: conversationId,
      file: recording.file,
      type: 'AUDIO',
      fileName: fileName,
      mimeType: 'audio/mp4',
    );
  }

  /// Format duration as M:SS
  static String formatDuration(int seconds) {
    final m = seconds ~/ 60;
    final s = seconds % 60;
    return '$m:${s.toString().padLeft(2, '0')}';
  }

  void dispose() {
    _stopwatchTimer?.cancel();
    _recorder?.closeRecorder();
  }
}

class VoiceRecording {
  final File file;
  final int durationSeconds;
  final String path;

  VoiceRecording({
    required this.file,
    required this.durationSeconds,
    required this.path,
  });
}
