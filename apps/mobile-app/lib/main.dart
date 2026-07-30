import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'dart:ui';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:async';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:firebase_core/firebase_core.dart';

void main() {
  FlutterError.onError = (FlutterErrorDetails details) {
    FlutterError.presentError(details);
    debugPrint('🔥 FLUTTER ERROR: ${details.exception}');
  };

  PlatformDispatcher.instance.onError = (error, stack) {
    debugPrint('🔥 PLATFORM ERROR: $error');
    return true;
  };

  runZonedGuarded(() {
    WidgetsFlutterBinding.ensureInitialized();
    runApp(const DiagnosticApp());
  }, (error, stack) {
    debugPrint('🔥 ZONE ERROR: $error');
  });
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
  bool _hasError = false;
  String _errorText = '';

  void _log(String msg) {
    debugPrint(msg);
    if (mounted) {
      setState(() {
        _logs.add(msg);
        _status = msg;
      });
    }
  }

  void _setError(String error) {
    if (mounted) {
      setState(() {
        _hasError = true;
        _errorText = error;
      });
    }
  }

  @override
  void initState() {
    super.initState();
    _runDiagnostics();
  }

  Future<void> _runDiagnostics() async {
    _log('✅ Step 1: Flutter bindings OK');
    await Future.delayed(const Duration(milliseconds: 500));

    _log('✅ Step 2: App started');
    await Future.delayed(const Duration(milliseconds: 500));

    try {
      _log('Testing SharedPreferences...');
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('test', 'ok');
      _log('✅ SharedPreferences OK');
    } catch (e, st) {
      _log('❌ SharedPreferences FAILED: $e');
      _setError('SharedPreferences: $e\n\n$st');
      return;
    }

    try {
      _log('Testing Hive...');
      await Hive.initFlutter();
      _log('✅ Hive OK');
    } catch (e, st) {
      _log('❌ Hive FAILED: $e');
      _setError('Hive: $e\n\n$st');
      return;
    }

    try {
      _log('Testing SecureStorage...');
      const storage = FlutterSecureStorage(
        aOptions: AndroidOptions(encryptedSharedPreferences: true),
      );
      await storage.write(key: 'test', value: 'ok');
      _log('✅ SecureStorage OK');
    } catch (e, st) {
      _log('❌ SecureStorage FAILED: $e');
      _setError('SecureStorage: $e\n\n$st');
      return;
    }

    try {
      _log('Testing Firebase...');
      await Firebase.initializeApp();
      _log('✅ Firebase OK');
    } catch (e, st) {
      _log('❌ Firebase FAILED: $e');
      _setError('Firebase: $e\n\n$st');
      return;
    }

    _log('═══════════════════════');
    _log('✅ ALL TESTS PASSED!');
    _log('═══════════════════════');
  }

  @override
  Widget build(BuildContext context) {
    if (_hasError) {
      return Scaffold(
        backgroundColor: Colors.red[900],
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('❌ ERREUR DÉTECTÉE',
                  style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold)),
                const SizedBox(height: 16),
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(color: Colors.black54, borderRadius: BorderRadius.circular(8)),
                    child: SingleChildScrollView(
                      child: SelectableText(_errorText,
                        style: const TextStyle(color: Colors.redAccent, fontSize: 13, fontFamily: 'monospace')),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: const Color(0xFF0B2F73),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Academia Helm',
                style: TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.bold)),
              const Text('Diagnostic v1.3.0',
                style: TextStyle(color: Color(0xFFF5B335), fontSize: 14)),
              const SizedBox(height: 24),
              Text('Status: $_status',
                style: const TextStyle(color: Colors.white70, fontSize: 14)),
              const SizedBox(height: 16),
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: Colors.black38, borderRadius: BorderRadius.circular(8)),
                  child: ListView.builder(
                    itemCount: _logs.length,
                    itemBuilder: (context, index) {
                      final log = _logs[index];
                      return Text(log,
                        style: TextStyle(
                          color: log.startsWith('❌') ? Colors.red[300] : log.startsWith('✅') ? Colors.green[300] : Colors.white70,
                          fontSize: 12, fontFamily: 'monospace'));
                    },
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
