import 'package:flutter/material.dart';

import '../main.dart';

enum FamilyToastKind { success, error, info }

class FamilyToast {
  static void success(BuildContext context, String message) =>
      _show(context, message, FamilyToastKind.success);

  static void error(BuildContext context, String message) =>
      _show(context, message, FamilyToastKind.error);

  static void info(BuildContext context, String message) =>
      _show(context, message, FamilyToastKind.info);

  static void _show(BuildContext context, String message, FamilyToastKind kind) {
    final messenger = ScaffoldMessenger.maybeOf(context);
    if (messenger == null) return;
    final (color, icon) = switch (kind) {
      FamilyToastKind.success => (brandTeal, Icons.check_circle_outline),
      FamilyToastKind.error => (const Color(0xFFB5473E), Icons.error_outline),
      FamilyToastKind.info => (const Color(0xFF315B73), Icons.notifications_none),
    };
    messenger
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          behavior: SnackBarBehavior.floating,
          backgroundColor: color,
          duration: Duration(seconds: kind == FamilyToastKind.error ? 6 : 4),
          content: Row(
            children: [
              Icon(icon, color: Colors.white, size: 20),
              const SizedBox(width: 10),
              Expanded(child: Text(message)),
            ],
          ),
        ),
      );
  }
}
