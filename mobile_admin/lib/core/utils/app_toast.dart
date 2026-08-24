import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

/// Global scaffold messenger key — register in MaterialApp.router
final scaffoldMessengerKey = GlobalKey<ScaffoldMessengerState>();

class AppToast {
  AppToast._();

  static void success(String message) => _show(message, AppColors.success, Icons.check_circle_rounded);
  static void error(String message)   => _show(message, AppColors.error,   Icons.error_rounded);
  static void info(String message)    => _show(message, AppColors.primary,  Icons.info_rounded);
  static void warning(String message) => _show(message, AppColors.warning,  Icons.warning_amber_rounded);

  static void _show(String message, Color color, IconData icon) {
    final messenger = scaffoldMessengerKey.currentState;
    if (messenger == null) return;
    messenger.hideCurrentSnackBar();
    messenger.showSnackBar(SnackBar(
      content: Row(children: [
        Icon(icon, color: Colors.white, size: 18),
        const SizedBox(width: 10),
        Expanded(child: Text(message, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w500))),
      ]),
      backgroundColor: color,
      behavior: SnackBarBehavior.floating,
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      duration: const Duration(seconds: 3),
      elevation: 6,
    ));
  }
}
