import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import 'features/auth/providers/auth_provider.dart';
import 'features/auth/screens/login_screen.dart';
import 'features/jobs/screens/jobs_list_screen.dart';
import 'features/jobs/screens/job_detail_screen.dart';
import 'features/jobs/screens/qr_scan_screen.dart';
import 'features/quotations/screens/quotation_screen.dart';
import 'features/shell/screens/shell_screen.dart';

part 'router.g.dart';

@riverpod
GoRouter router(RouterRef ref) {
  final authState = ref.watch(authStateProvider);

  return GoRouter(
    initialLocation: '/jobs',
    redirect: (context, state) {
      final isLoggedIn = authState.valueOrNull?.accessToken != null;
      final isLoginRoute = state.matchedLocation == '/login';
      if (!isLoggedIn && !isLoginRoute) return '/login';
      if (isLoggedIn && isLoginRoute) return '/jobs';
      return null;
    },
    routes: [
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
      ShellRoute(
        builder: (_, __, child) => ShellScreen(child: child),
        routes: [
          GoRoute(
            path: '/jobs',
            builder: (_, __) => const JobsListScreen(),
            routes: [
              GoRoute(path: ':id', builder: (_, s) => JobDetailScreen(jobId: s.pathParameters['id']!)),
            ],
          ),
          GoRoute(path: '/quotations/:jobId', builder: (_, s) => QuotationScreen(jobId: s.pathParameters['jobId']!)),
          GoRoute(path: '/scan', builder: (_, __) => const QrScanScreen()),
        ],
      ),
    ],
  );
}
