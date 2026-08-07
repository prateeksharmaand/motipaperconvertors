import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../auth/providers/auth_provider.dart';

class ShellScreen extends ConsumerWidget {
  final Widget child;
  const ShellScreen({super.key, required this.child});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final role = ref.watch(authStateNotifierProvider).valueOrNull?.role ?? '';
    final isOperator = role == 'staff' || role == 'operator';

    return Scaffold(
      body: child,
      bottomNavigationBar: NavigationBar(
        destinations: [
          const NavigationDestination(icon: Icon(Icons.list_alt), label: 'Jobs'),
          if (!isOperator) const NavigationDestination(icon: Icon(Icons.request_quote), label: 'Quotes'),
          const NavigationDestination(icon: Icon(Icons.qr_code_scanner), label: 'Scan'),
          if (!isOperator) const NavigationDestination(icon: Icon(Icons.people), label: 'Clients'),
        ],
        onDestinationSelected: (i) {
          if (isOperator) {
            ['/jobs', '/scan'][i] == '/scan' ? context.go('/scan') : context.go('/jobs');
          } else {
            ['/jobs', '/quotations/new', '/scan', '/clients'][i].let((path) => context.go(path));
          }
        },
      ),
    );
  }
}

extension<T> on T {
  R let<R>(R Function(T) block) => block(this);
}
