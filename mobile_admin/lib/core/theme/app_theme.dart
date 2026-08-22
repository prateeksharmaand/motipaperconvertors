import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppColors {
  AppColors._();

  static const primary = Color(0xFF3B5BDB);
  static const primaryLight = Color(0xFFEEF2FF);
  static const secondary = Color(0xFF7C3AED);

  static const success = Color(0xFF2B8A3E);
  static const successLight = Color(0xFFD3F9D8);
  static const warning = Color(0xFFE67700);
  static const warningLight = Color(0xFFFFF3BF);
  static const error = Color(0xFFC92A2A);
  static const errorLight = Color(0xFFFFE3E3);
  static const info = Color(0xFF1971C2);
  static const infoLight = Color(0xFFDBEAFE);

  static const surface = Color(0xFFFFFFFF);
  static const background = Color(0xFFF8F9FA);
  static const cardBg = Color(0xFFFFFFFF);

  static const textPrimary = Color(0xFF111827);
  static const textSecondary = Color(0xFF374151);
  static const textMuted = Color(0xFF6B7280);
  static const textDisabled = Color(0xFF9CA3AF);

  static const border = Color(0xFFE5E7EB);
  static const borderLight = Color(0xFFF3F4F6);

  static const sidebarBg = Color(0xFF1F2937);
  static const sidebarText = Color(0xFFD1D5DB);
  static const sidebarActive = Color(0xFF3B5BDB);

  // Job status colors
  static const Map<String, Color> statusColors = {
    'draft':     Color(0xFFADB5BD),
    'enquiry':   Color(0xFF868E96),
    'quotation': Color(0xFF1971C2),
    'design':    Color(0xFF7048E8),
    'approval':  Color(0xFFF59F00),
    'print':     Color(0xFF2F9E44),
    'finishing': Color(0xFF0C8599),
    'qc':        Color(0xFFE67700),
    'ready':     Color(0xFF2B8A3E),
    'delivered': Color(0xFF1864AB),
    'cancelled': Color(0xFFC92A2A),
  };
}

class AppTheme {
  AppTheme._();

  static ThemeData get lightTheme {
    final base = ThemeData.light(useMaterial3: true);
    return base.copyWith(
      colorScheme: ColorScheme.fromSeed(
        seedColor: AppColors.primary,
        surface: AppColors.surface,
      ),
      scaffoldBackgroundColor: AppColors.background,
      textTheme: GoogleFonts.interTextTheme(base.textTheme).copyWith(
        displayLarge: GoogleFonts.inter(fontSize: 32, fontWeight: FontWeight.w800, color: AppColors.textPrimary),
        headlineLarge: GoogleFonts.inter(fontSize: 24, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
        headlineMedium: GoogleFonts.inter(fontSize: 20, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
        headlineSmall: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
        titleLarge: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
        titleMedium: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w500, color: AppColors.textSecondary),
        bodyLarge: GoogleFonts.inter(fontSize: 14, color: AppColors.textPrimary),
        bodyMedium: GoogleFonts.inter(fontSize: 13, color: AppColors.textSecondary),
        bodySmall: GoogleFonts.inter(fontSize: 12, color: AppColors.textMuted),
        labelLarge: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: AppColors.surface,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
        scrolledUnderElevation: 1,
        shadowColor: AppColors.border,
        titleTextStyle: GoogleFonts.inter(fontSize: 17, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
        surfaceTintColor: Colors.transparent,
      ),
      cardTheme: CardThemeData(
        color: AppColors.cardBg,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: AppColors.border, width: 1),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.surface,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: AppColors.error),
        ),
        hintStyle: GoogleFonts.inter(fontSize: 13, color: AppColors.textDisabled),
        labelStyle: GoogleFonts.inter(fontSize: 13, color: AppColors.textMuted),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          elevation: 0,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
          textStyle: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.primary,
          side: const BorderSide(color: AppColors.border),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          textStyle: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w500),
        ),
      ),
      dividerTheme: const DividerThemeData(color: AppColors.border, thickness: 1),
      chipTheme: ChipThemeData(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
        labelStyle: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }
}
