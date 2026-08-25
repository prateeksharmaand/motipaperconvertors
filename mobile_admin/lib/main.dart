import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'core/notifications/fcm_service.dart';
import 'core/routing/app_router.dart';
import 'core/theme/app_theme.dart';
import 'package:google_fonts/google_fonts.dart';
import 'core/utils/app_toast.dart';
import 'features/auth/auth_bloc.dart';
import 'features/auth/auth_event.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Disable runtime font fetching — use bundled/system fonts instead
  GoogleFonts.config.allowRuntimeFetching = false;
  // Firebase init — only runs if google-services.json / GoogleService-Info.plist present
  try {
    await Firebase.initializeApp();
    await FcmService.init();
  } catch (_) {
    // Graceful degradation — app works without Firebase configured
  }
  runApp(const MotiPaperAdminApp());
}

class MotiPaperAdminApp extends StatelessWidget {
  const MotiPaperAdminApp({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider<AuthBloc>(
      create: (_) => AuthBloc()..add(const AuthStarted()),
      child: const _AppView(),
    );
  }
}

class _AppView extends StatefulWidget {
  const _AppView();
  @override
  State<_AppView> createState() => _AppViewState();
}

class _AppViewState extends State<_AppView> {
  late final _router = createRouter(context);

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'MotiPaper Admin',
      theme: AppTheme.lightTheme,
      routerConfig: _router,
      scaffoldMessengerKey: scaffoldMessengerKey,
      debugShowCheckedModeBanner: false,
    );
  }
}
