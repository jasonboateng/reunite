import 'package:flutter/material.dart';

import 'models/family_models.dart';
import 'screens/auth_screen.dart';
import 'screens/family_shell.dart';
import 'services/family_api.dart';

const brandTeal = Color(0xFF1A6B6B);
const brandBlue = Color(0xFF59B5CF);
const ink = Color(0xFF171717);
const canvas = Color(0xFFF7F6F2);
final familyApi = FamilyApi();

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const ReuniteFamilyApp());
}

class ReuniteFamilyApp extends StatelessWidget {
  const ReuniteFamilyApp({super.key});

  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'REUNITE Family',
    debugShowCheckedModeBanner: false,
    theme: ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: brandTeal,
        primary: brandTeal,
        secondary: brandBlue,
        surface: Colors.white,
        error: const Color(0xFFB5473E),
      ),
      scaffoldBackgroundColor: canvas,
      cardTheme: CardThemeData(
        color: Colors.white,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18),
          side: const BorderSide(color: Color(0xFFE4E8E5)),
        ),
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: canvas,
        foregroundColor: ink,
        surfaceTintColor: Colors.transparent,
        centerTitle: false,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 15,
        ),
        labelStyle: const TextStyle(color: Color(0xFF56635D)),
        hintStyle: const TextStyle(color: Color(0xFF87928C)),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: Color(0xFFDCE3DE)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: Color(0xFFDCE3DE)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: brandTeal, width: 1.7),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: Color(0xFFB5473E)),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: Color(0xFFB5473E), width: 1.7),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: brandTeal,
          foregroundColor: Colors.white,
          minimumSize: const Size(48, 50),
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 13),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: brandTeal,
          minimumSize: const Size(44, 46),
          side: const BorderSide(color: Color(0xFFC8D8D0)),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(13),
          ),
        ),
      ),
      textTheme: const TextTheme(
        headlineSmall: TextStyle(
          color: ink,
          fontSize: 27,
          height: 1.12,
          fontWeight: FontWeight.w800,
        ),
        titleLarge: TextStyle(
          color: ink,
          fontSize: 21,
          height: 1.2,
          fontWeight: FontWeight.w800,
        ),
        titleMedium: TextStyle(
          color: ink,
          fontSize: 16,
          fontWeight: FontWeight.w700,
        ),
        bodyMedium: TextStyle(color: Color(0xFF535D59), height: 1.45),
      ),
    ),
    home: const FamilyGate(),
  );
}

class FamilyGate extends StatefulWidget {
  const FamilyGate({super.key});
  @override
  State<FamilyGate> createState() => _FamilyGateState();
}

class _FamilyGateState extends State<FamilyGate> {
  FamilyUser? _user;
  bool _checking = true;

  @override
  void initState() {
    super.initState();
    familyApi
        .restoreSession()
        .then((user) {
          if (!mounted) return;
          setState(() {
            _user = user;
            _checking = false;
          });
        })
        .catchError((_) {
          if (mounted) setState(() => _checking = false);
        });
  }

  void _authenticated(FamilyUser user) => setState(() => _user = user);
  void _signedOut() => setState(() => _user = null);

  @override
  Widget build(BuildContext context) {
    if (_checking) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator(color: brandTeal)),
      );
    }
    return _user == null
        ? AuthScreen(onAuthenticated: _authenticated)
        : FamilyShell(user: _user!, onSignOut: _signedOut);
  }
}
