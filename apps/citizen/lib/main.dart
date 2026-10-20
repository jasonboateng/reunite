import 'package:flutter/material.dart';

import 'screens/home_screen.dart';

const brandGreen = Color(0xFF176B52);
const deepGreen = Color(0xFF104B3D);
const warmCanvas = Color(0xFFF4F6F2);
const ink = Color(0xFF1D2925);

void main() {
  runApp(const ReuniteCitizenApp());
}

class ReuniteCitizenApp extends StatelessWidget {
  const ReuniteCitizenApp({super.key});

  @override
  Widget build(BuildContext context) {
    final colorScheme = ColorScheme.fromSeed(
      seedColor: brandGreen,
      primary: brandGreen,
      secondary: const Color(0xFFD9A34A),
      surface: Colors.white,
      error: const Color(0xFFB5473E),
    );

    return MaterialApp(
      title: 'REUNITE Citizen',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: colorScheme,
        scaffoldBackgroundColor: warmCanvas,
        appBarTheme: const AppBarTheme(
          backgroundColor: warmCanvas,
          foregroundColor: ink,
          surfaceTintColor: Colors.transparent,
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: Colors.white,
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 16,
            vertical: 15,
          ),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: const BorderSide(color: Color(0xFFE0E7E1)),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: const BorderSide(color: Color(0xFFE0E7E1)),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: const BorderSide(color: brandGreen, width: 1.6),
          ),
        ),
        filledButtonTheme: FilledButtonThemeData(
          style: FilledButton.styleFrom(
            backgroundColor: brandGreen,
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 15),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(15),
            ),
            textStyle: const TextStyle(
              fontWeight: FontWeight.w700,
              fontSize: 15,
            ),
          ),
        ),
        textTheme: const TextTheme(
          headlineMedium: TextStyle(
            color: ink,
            fontWeight: FontWeight.w800,
            height: 1.08,
          ),
          headlineSmall: TextStyle(color: ink, fontWeight: FontWeight.w800),
          titleLarge: TextStyle(color: ink, fontWeight: FontWeight.w800),
          titleMedium: TextStyle(color: ink, fontWeight: FontWeight.w700),
          bodyMedium: TextStyle(color: Color(0xFF58645E), height: 1.45),
        ),
      ),
      home: const HomeScreen(),
    );
  }
}
