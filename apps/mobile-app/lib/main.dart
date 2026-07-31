import 'package:flutter/material.dart';
void main() => runApp(const MyApp());
class MyApp extends StatelessWidget {
  const MyApp({super.key});
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: ThemeData(useMaterial3: true, colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF0B2F73))),
      home: Scaffold(
        backgroundColor: const Color(0xFF0B2F73),
        body: const Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.school, color: Color(0xFFF5B335), size: 64),
              SizedBox(height: 24),
              Text('Academia Helm', style: TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.bold)),
              SizedBox(height: 8),
              Text('Pure Dart v1.3.7', style: TextStyle(color: Color(0xFFF5B335), fontSize: 14)),
            ],
          ),
        ),
      ),
    );
  }
}
