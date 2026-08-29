import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../theme/app_theme.dart';
import '../../features/auth/auth_bloc.dart';
import '../../features/auth/auth_event.dart';
import '../../features/auth/auth_state.dart';
import '../../features/dashboard/dashboard_screen.dart';
import '../../features/jobs/jobs_screen.dart';
import '../../features/clients/clients_screen.dart';
import '../../features/billing/billing_screen.dart';

final GlobalKey<ScaffoldState> drawerScaffoldKey = GlobalKey<ScaffoldState>();

class MainShell extends StatefulWidget {
  final Widget? child;
  const MainShell({this.child, super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _currentIndex = 0;
  final List<String> _mainRoutes = ['/', '/jobs', '/billing', '/clients'];

  // Cache screen instances to prevent reloading
  late final List<Widget> _screens = const [
    DashboardScreen(),
    JobsScreen(),
    BillingScreen(),
    ClientsScreen(),
  ];

  void _onBottomNavTap(int index) {
    setState(() => _currentIndex = index);
    context.go(_mainRoutes[index]);
  }

  String _getMainTabTitle(int index) {
    const titles = ['Dashboard', 'Job Cards', 'Billing', 'Clients'];
    return titles[index];
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<AuthBloc, AuthState>(
      builder: (context, state) {
        final user = state is AuthAuthenticated ? state.user : null;
        final items = _allNavItems.where((i) {
          if (i.path == '/tenants') return user?.isSuperAdmin ?? false;
          if (i.permission == null) return true;
          return user?.hasPerm(i.permission!) ?? false;
        }).toList();

        final currentLocation = GoRouterState.of(context).matchedLocation;
        final isMainTab = _mainRoutes.contains(currentLocation);

        // Sync _currentIndex when navigating via drawer
        if (isMainTab) {
          final newIndex = _mainRoutes.indexOf(currentLocation);
          if (newIndex != -1 && newIndex != _currentIndex) {
            Future.microtask(() => setState(() => _currentIndex = newIndex));
          }
        }

        // Routes that provide their own AppBar (e.g. job detail with SliverAppBar)
        final bool childOwnsAppBar = currentLocation.startsWith('/jobs/') && currentLocation != '/jobs/';

        return PopScope(
          canPop: isMainTab || childOwnsAppBar,
          onPopInvokedWithResult: (didPop, result) {
            if (!didPop && !isMainTab && !childOwnsAppBar) {
              context.go('/');
            }
          },
          child: Scaffold(
            key: drawerScaffoldKey,
            backgroundColor: AppColors.background,
            appBar: isMainTab ? AppBar(
              leading: IconButton(icon: const Icon(Icons.menu, color: Colors.white), onPressed: () => drawerScaffoldKey.currentState?.openDrawer()),
              title: Text(_getMainTabTitle(_currentIndex), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 17)),
              backgroundColor: const Color(0xFF1F2937),
              surfaceTintColor: Colors.transparent,
              actions: [
                IconButton(
                  icon: const Icon(Icons.settings_outlined, color: Colors.white),
                  onPressed: () => context.go('/settings'),
                ),
              ],
            ) : childOwnsAppBar ? null : AppBar(
              backgroundColor: const Color(0xFF1F2937),
              foregroundColor: Colors.white,
              surfaceTintColor: Colors.transparent,
              leading: IconButton(icon: const Icon(Icons.arrow_back, color: Colors.white), onPressed: () => context.go('/')),
              title: Text(
                _routeTitles[currentLocation] ?? items.firstWhere((i) => i.path == currentLocation, orElse: () => _allNavItems.first).label,
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 17),
              ),
            ),
            body: Stack(children: [
              // Keep all main-tab screens alive in the tree at all times.
              // Offstage hides them without disposing, so initState / API calls
              // don't fire again when returning from a drawer route.
              Offstage(
                offstage: !isMainTab,
                child: IndexedStack(
                  index: _currentIndex,
                  children: _screens,
                ),
              ),
              if (!isMainTab) widget.child ?? const SizedBox.shrink(),
            ]),
            bottomNavigationBar: isMainTab ? BottomNavigationBar(
              currentIndex: _currentIndex,
              onTap: _onBottomNavTap,
              type: BottomNavigationBarType.fixed,
              backgroundColor: AppColors.surface,
              selectedItemColor: AppColors.primary,
              unselectedItemColor: AppColors.textMuted,
              items: const [
                BottomNavigationBarItem(icon: Icon(Icons.home_outlined), activeIcon: Icon(Icons.home_rounded), label: 'Dashboard'),
                BottomNavigationBarItem(icon: Icon(Icons.work_outline), activeIcon: Icon(Icons.work_rounded), label: 'Job Cards'),
                BottomNavigationBarItem(icon: Icon(Icons.receipt_long_outlined), activeIcon: Icon(Icons.receipt_long_rounded), label: 'Billing'),
                BottomNavigationBarItem(icon: Icon(Icons.people_outlined), activeIcon: Icon(Icons.people_rounded), label: 'Clients'),
              ],
            ) : null,
            drawer: _AppDrawer(items: items),
          ),
        );
      },
    );
  }
}

// ── Navigation Item ───────────────────────────────────────
class _NavItem {
  final String label;
  final IconData icon;
  final IconData activeIcon;
  final String path;
  final String? permission;
  const _NavItem({required this.label, required this.icon, required this.activeIcon, required this.path, this.permission});
}

const _routeTitles = {
  '/settings':      'Settings',
  '/activity-logs': 'Activity Log',
  '/sub-admins':    'Sub Admins',
  '/machines':      'Machines',
  '/tenants':       'Tenants',
  '/reports':       'Reports',
  '/staff':         'Staff',
  '/inventory':     'Inventory',
  '/quotations':    'Quotations',
  '/proofs':        'Proofs',
};

const _allNavItems = [
  _NavItem(label: 'Dashboard',    icon: Icons.home_outlined,              activeIcon: Icons.home_rounded,           path: '/'),
  _NavItem(label: 'Job Cards',    icon: Icons.work_outline,               activeIcon: Icons.work_rounded,           path: '/jobs',          permission: 'jobs.view'),
  _NavItem(label: 'Clients',      icon: Icons.people_outlined,            activeIcon: Icons.people_rounded,         path: '/clients',       permission: 'clients.view'),
  _NavItem(label: 'Quotations',   icon: Icons.request_quote_outlined,     activeIcon: Icons.request_quote_rounded,  path: '/quotations',    permission: 'quotation.view'),
  _NavItem(label: 'Billing',      icon: Icons.receipt_long_outlined,      activeIcon: Icons.receipt_long_rounded,   path: '/billing',       permission: 'billing.view'),
  _NavItem(label: 'Inventory',    icon: Icons.inventory_2_outlined,       activeIcon: Icons.inventory_2_rounded,    path: '/inventory',     permission: 'inventory.view'),
  _NavItem(label: 'Staff',        icon: Icons.badge_outlined,             activeIcon: Icons.badge_rounded,          path: '/staff',         permission: 'staff.view'),
  _NavItem(label: 'Reports',      icon: Icons.bar_chart_outlined,         activeIcon: Icons.bar_chart_rounded,      path: '/reports',       permission: 'reports.view_financial'),
  _NavItem(label: 'Proofs',       icon: Icons.image_search_outlined,      activeIcon: Icons.image_search_rounded,   path: '/proofs',        permission: 'jobs.view'),
  _NavItem(label: 'Activity Log', icon: Icons.history_outlined,           activeIcon: Icons.history_rounded,        path: '/activity-logs', permission: 'activity_log.view'),
  _NavItem(label: 'Sub Admins',   icon: Icons.admin_panel_settings_outlined, activeIcon: Icons.admin_panel_settings_rounded, path: '/sub-admins', permission: 'settings.edit'),
  _NavItem(label: 'Machines',     icon: Icons.precision_manufacturing_outlined, activeIcon: Icons.precision_manufacturing_rounded, path: '/machines', permission: 'settings.edit'),
  _NavItem(label: 'Tenants',      icon: Icons.business_outlined,          activeIcon: Icons.business_rounded,       path: '/tenants'),
];

// ── App Drawer ─────────────────────────────────────────────
class _AppDrawer extends StatelessWidget {
  final List<_NavItem> items;
  const _AppDrawer({required this.items});

  @override
  Widget build(BuildContext context) {
    return Drawer(
      backgroundColor: AppColors.sidebarBg,
      child: SafeArea(
        child: Column(children: [
          // Header
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 16),
            child: Row(children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(color: const Color(0xFF7C3AED), borderRadius: BorderRadius.circular(10)),
                child: const Icon(Icons.print_rounded, color: Colors.white, size: 22),
              ),
              const SizedBox(width: 12),
              const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('MotiPaper', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 15)),
                Text('Admin Panel', style: TextStyle(color: AppColors.sidebarText, fontSize: 11)),
              ]),
            ]),
          ),
          const Divider(color: Colors.white12, height: 1),
          // Nav items
          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(vertical: 8),
              children: items.map((item) => _DrawerItem(item: item)).toList(),
            ),
          ),
          const Divider(color: Colors.white12, height: 1),
          // Logout
          ListTile(
            dense: true,
            leading: const Icon(Icons.logout_rounded, color: AppColors.sidebarText, size: 20),
            title: const Text('Sign Out', style: TextStyle(color: AppColors.sidebarText, fontSize: 13)),
            onTap: () { Navigator.pop(context); context.read<AuthBloc>().add(const AuthLogoutRequested()); },
          ),
          const SizedBox(height: 8),
        ]),
      ),
    );
  }
}

class _DrawerItem extends StatelessWidget {
  final _NavItem item;
  const _DrawerItem({required this.item});

  @override
  Widget build(BuildContext context) {
    final isActive = GoRouterState.of(context).matchedLocation == item.path ||
                     (item.path != '/' && GoRouterState.of(context).matchedLocation.startsWith(item.path));

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
      decoration: BoxDecoration(
        color: isActive ? const Color(0xFF7C3AED).withValues(alpha: 0.25) : Colors.transparent,
        borderRadius: BorderRadius.circular(10),
      ),
      child: ListTile(
        dense: true,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        leading: Icon(isActive ? item.activeIcon : item.icon, color: isActive ? Colors.white : AppColors.sidebarText, size: 20),
        title: Text(item.label, style: TextStyle(color: isActive ? Colors.white : AppColors.sidebarText, fontWeight: isActive ? FontWeight.w700 : FontWeight.normal, fontSize: 13)),
        trailing: isActive ? Container(width: 4, height: 20, decoration: BoxDecoration(color: const Color(0xFF7C3AED), borderRadius: BorderRadius.circular(2))) : null,
        onTap: () { Navigator.pop(context); context.go(item.path); },
      ),
    );
  }
}
