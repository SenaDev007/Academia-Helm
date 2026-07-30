import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'dart:async';
import 'dart:ui';

/// ============================================================================
/// MINIMAL MAIN — Diagnostic build to isolate crash-on-launch
/// ============================================================================
/// This version removes ALL plugins (Firebase, Hive, Riverpod, SecureStorage)
/// to determine if the crash is caused by:
///   A) The Android project configuration (if this still crashes)
///   B) Our Dart initialization code (if this works)
/// ============================================================================

void main() {
  // Catch ALL Dart errors and display them on screen
  FlutterError.onError = (FlutterErrorDetails details) {
    FlutterError.presentError(details);
    debugPrint('🔥 Flutter Error: ${details.exception}');
    debugPrint('Stack: ${details.stack}');
  };

  // Catch async errors not caught by FlutterError
  PlatformDispatcher.instance.onError = (error, stack) {
    debugPrint('🔥 Platform Error: $error');
    debugPrint('Stack: $stack');
    return true;
  };

  WidgetsFlutterBinding.ensureInitialized();

  // Set orientation
  SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
  ]);

  runApp(const DiagnosticApp());
}

class DiagnosticApp extends StatelessWidget {
  const DiagnosticApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Academia Helm',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF0B2F73)),
      ),
      home: const DiagnosticScreen(),
    );
  }
}

class DiagnosticScreen extends StatefulWidget {
  const DiagnosticScreen({super.key});

  @override
  State<DiagnosticScreen> createState() => _DiagnosticScreenState();
}

class _DiagnosticScreenState extends State<DiagnosticScreen> {
  String _status = 'Starting...';
  final List<String> _logs = [];

  void _log(String msg) {
    debugPrint(msg);
    setState(() {
      _logs.add(msg);
      _status = msg;
    });
  }

  @override
  void initState() {
    super.initState();
    _runDiagnostics();
  }

  Future<void> _runDiagnostics() async {
    _log('✅ Flutter bindings OK');

    try {
      _log('Testing Firebase...');
      // Don't actually import Firebase - just test if the app can load
      _log('✅ Firebase check skipped (minimal build)');
    } catch (e) {
      _log('❌ Firebase: $e');
    }

    try {
      _log('Testing Hive...');
      _log('✅ Hive check skipped (minimal build)');
    } catch (e) {
      _log('❌ Hive: $e');
    }

    try {
      _log('Testing SecureStorage...');
      _log('✅ SecureStorage check skipped (minimal build)');
    } catch (e) {
      _log('❌ SecureStorage: $e');
    }

    _log('✅ All checks passed!');
    _log('If you see this, the Android config is OK.');
    _log('The crash was in the plugin initialization.');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0B2F73),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Academia Helm',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const Text(
                'Diagnostic Build',
                style: TextStyle(
                  color: Color(0xFFF5B335),
                  fontSize: 14,
                ),
              ),
              const SizedBox(height: 32),
              Text(
                'Status: $_status',
                style: const TextStyle(color: Colors.white70, fontSize: 14),
              ),
              const SizedBox(height: 16),
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.black.withOpacity(0.3),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: ListView.builder(
                    itemCount: _logs.length,
                    itemBuilder: (context, index) {
                      final log = _logs[index];
                      return Padding(
                        padding: const EdgeInsets.symmetric(vertical: 2),
                        child: Text(
                          log,
                          style: TextStyle(
                            color: log.startsWith('❌')
                                ? Colors.red[300]
                                : log.startsWith('✅')
                                    ? Colors.green[300]
                                    : Colors.white70,
                            fontSize: 12,
                            fontFamily: 'monospace',
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'v1.2.9-diagnostic',
                style: TextStyle(color: Colors.white38, fontSize: 11),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
