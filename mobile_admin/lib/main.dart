import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'core/routing/app_router.dart';
import 'core/theme/app_theme.dart';
import 'features/auth/auth_bloc.dart';
import 'features/auth/auth_event.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
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
      debugShowCheckedModeBanner: false,
    );
  }
}
