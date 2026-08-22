import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../features/auth/auth_bloc.dart';
import '../../features/auth/auth_state.dart';
import '../../features/auth/login_screen.dart';
import '../../features/dashboard/dashboard_screen.dart';
import '../../features/jobs/jobs_screen.dart';
import '../../features/jobs/job_detail_screen.dart';
import '../../features/clients/clients_screen.dart';
import '../../features/billing/billing_screen.dart';
import '../../features/inventory/inventory_screen.dart';
import '../../features/staff/staff_screen.dart';
import '../../features/reports/reports_screen.dart';
import '../../features/activity_logs/activity_log_screen.dart';
import '../../features/settings/settings_screen.dart';
import '../../features/quotations/quotations_screen.dart';
import '../../features/sub_admins/sub_admins_screen.dart';
import '../../features/machines/machines_screen.dart';
import '../widgets/shell_scaffold.dart';

GoRouter createRouter(BuildContext context) {
  final authBloc = context.read<AuthBloc>();

  return GoRouter(
    initialLocation: '/',
    refreshListenable: _BlocListenable(authBloc),
    redirect: (ctx, state) {
      final authState = authBloc.state;
      final isLoggedIn = authState is AuthAuthenticated;
      final isLoginPage = state.matchedLocation == '/login';

      if (authState is AuthInitial || authState is AuthLoading) return null;
      if (!isLoggedIn && !isLoginPage) return '/login';
      if (isLoggedIn && isLoginPage) return '/';
      return null;
    },
    routes: [
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
      ShellRoute(
        builder: (context, state, child) => ShellScaffold(child: child),
        routes: [
          GoRoute(path: '/', builder: (_, __) => const DashboardScreen()),
          GoRoute(
            path: '/jobs',
            builder: (_, __) => const JobsScreen(),
            routes: [
              GoRoute(
                path: ':id',
                builder: (_, state) => JobDetailScreen(jobId: state.pathParameters['id']!),
              ),
            ],
          ),
          GoRoute(path: '/clients',       builder: (_, __) => const ClientsScreen()),
          GoRoute(path: '/quotations',    builder: (_, __) => const QuotationsScreen()),
          GoRoute(path: '/billing',       builder: (_, __) => const BillingScreen()),
          GoRoute(path: '/inventory',     builder: (_, __) => const InventoryScreen()),
          GoRoute(path: '/staff',         builder: (_, __) => const StaffScreen()),
          GoRoute(path: '/reports',       builder: (_, __) => const ReportsScreen()),
          GoRoute(path: '/activity-logs', builder: (_, __) => const ActivityLogScreen()),
          GoRoute(path: '/settings',      builder: (_, __) => const SettingsScreen()),
          GoRoute(path: '/sub-admins',    builder: (_, __) => const SubAdminsScreen()),
          GoRoute(path: '/machines',      builder: (_, __) => const MachinesScreen()),
        ],
      ),
    ],
  );
}

// Makes GoRouter listen to BLoC changes
class _BlocListenable extends ChangeNotifier {
  _BlocListenable(AuthBloc bloc) {
    bloc.stream.listen((_) => notifyListeners());
  }
}
