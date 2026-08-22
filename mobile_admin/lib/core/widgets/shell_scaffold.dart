import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../theme/app_theme.dart';
import '../utils/responsive.dart';
import '../../features/auth/auth_bloc.dart';
import '../../features/auth/auth_event.dart';
import '../../features/auth/auth_state.dart';

class _NavItem {
  final String label;
  final IconData icon;
  final IconData activeIcon;
  final String path;
  final String? permission;
  const _NavItem({required this.label, required this.icon, required this.activeIcon, required this.path, this.permission});
}

const _allNavItems = [
  _NavItem(label: 'Dashboard',    icon: Icons.dashboard_outlined,     activeIcon: Icons.dashboard,        path: '/'),
  _NavItem(label: 'Job Cards',    icon: Icons.work_outline,           activeIcon: Icons.work,             path: '/jobs',          permission: 'jobs.view'),
  _NavItem(label: 'Clients',      icon: Icons.people_outlined,        activeIcon: Icons.people,           path: '/clients',       permission: 'clients.view'),
  _NavItem(label: 'Quotations',   icon: Icons.request_quote_outlined, activeIcon: Icons.request_quote,    path: '/quotations',    permission: 'quotation.view'),
  _NavItem(label: 'Billing',      icon: Icons.receipt_long_outlined,  activeIcon: Icons.receipt_long,     path: '/billing',       permission: 'billing.view'),
  _NavItem(label: 'Inventory',    icon: Icons.inventory_2_outlined,   activeIcon: Icons.inventory_2,      path: '/inventory',     permission: 'inventory.view'),
  _NavItem(label: 'Staff',        icon: Icons.badge_outlined,         activeIcon: Icons.badge,            path: '/staff',         permission: 'staff.view'),
  _NavItem(label: 'Reports',      icon: Icons.bar_chart_outlined,     activeIcon: Icons.bar_chart,        path: '/reports',       permission: 'reports.view_financial'),
  _NavItem(label: 'Activity Log', icon: Icons.history_outlined,       activeIcon: Icons.history,          path: '/activity-logs', permission: 'activity_log.view'),
  _NavItem(label: 'Sub Admins',   icon: Icons.admin_panel_settings_outlined, activeIcon: Icons.admin_panel_settings, path: '/sub-admins', permission: 'settings.edit'),
  _NavItem(label: 'Machines',     icon: Icons.precision_manufacturing_outlined, activeIcon: Icons.precision_manufacturing, path: '/machines', permission: 'settings.edit'),
  _NavItem(label: 'Settings',     icon: Icons.settings_outlined,      activeIcon: Icons.settings,         path: '/settings',      permission: 'settings.edit'),
];

class ShellScaffold extends StatelessWidget {
  final Widget child;
  const ShellScaffold({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<AuthBloc, AuthState>(
      builder: (context, state) {
        final user = state is AuthAuthenticated ? state.user : null;
        final items = _allNavItems.where((i) => i.permission == null || (user?.hasPerm(i.permission!) ?? false)).toList();
        final phoneItems = items.take(5).toList();

        if (Responsive.showSidebar(context)) {
          return _SidebarLayout(items: items, child: child);
        } else if (Responsive.showNavigationRail(context)) {
          return _RailLayout(items: items, child: child);
        } else {
          return _BottomNavLayout(items: phoneItems, allItems: items, child: child);
        }
      },
    );
  }
}

String _currentPath(BuildContext context) => GoRouterState.of(context).matchedLocation;

bool _isActive(_NavItem item, String path) =>
    item.path == path || (item.path != '/' && path.startsWith(item.path));

// ── Sidebar (large tablet) ────────────────────────────────
class _SidebarLayout extends StatelessWidget {
  final List<_NavItem> items;
  final Widget child;
  const _SidebarLayout({required this.items, required this.child});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Row(
        children: [
          _Sidebar(items: items),
          const VerticalDivider(width: 1, thickness: 1),
          Expanded(child: child),
        ],
      ),
    );
  }
}

class _Sidebar extends StatelessWidget {
  final List<_NavItem> items;
  const _Sidebar({required this.items});

  @override
  Widget build(BuildContext context) {
    final path = _currentPath(context);
    return Container(
      width: 240,
      color: AppColors.sidebarBg,
      child: SafeArea(
        child: Column(
          children: [
            _SidebarHeader(),
            const Divider(color: Colors.white12, height: 1),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(vertical: 8),
                children: items.map((i) => _SidebarItem(item: i, isActive: _isActive(i, path))).toList(),
              ),
            ),
            const Divider(color: Colors.white12, height: 1),
            _LogoutTile(),
          ],
        ),
      ),
    );
  }
}

class _SidebarHeader extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Row(children: [
        Container(
          padding: const EdgeInsets.all(6),
          decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(8)),
          child: const Icon(Icons.print_rounded, color: Colors.white, size: 20),
        ),
        const SizedBox(width: 10),
        const Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('MotiPaper', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 14)),
            Text('Admin Panel', style: TextStyle(color: AppColors.sidebarText, fontSize: 11)),
          ]),
        ),
      ]),
    );
  }
}

class _SidebarItem extends StatelessWidget {
  final _NavItem item;
  final bool isActive;
  const _SidebarItem({required this.item, required this.isActive});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: isActive ? AppColors.primary.withValues(alpha: 0.25) : Colors.transparent,
        borderRadius: BorderRadius.circular(8),
      ),
      child: ListTile(
        dense: true,
        leading: Icon(isActive ? item.activeIcon : item.icon,
            color: isActive ? Colors.white : AppColors.sidebarText, size: 20),
        title: Text(item.label,
            style: TextStyle(
                color: isActive ? Colors.white : AppColors.sidebarText,
                fontWeight: isActive ? FontWeight.w600 : FontWeight.normal,
                fontSize: 13)),
        onTap: () => context.go(item.path),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
    );
  }
}

class _LogoutTile extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(12),
      child: TextButton.icon(
        onPressed: () => context.read<AuthBloc>().add(const AuthLogoutRequested()),
        icon: const Icon(Icons.logout, color: AppColors.sidebarText, size: 18),
        label: const Text('Sign Out', style: TextStyle(color: AppColors.sidebarText)),
      ),
    );
  }
}

// ── Navigation Rail (small tablet) ───────────────────────
class _RailLayout extends StatelessWidget {
  final List<_NavItem> items;
  final Widget child;
  const _RailLayout({required this.items, required this.child});

  @override
  Widget build(BuildContext context) {
    final path = _currentPath(context);
    final selectedIndex = items.indexWhere((i) => _isActive(i, path));

    return Scaffold(
      body: Row(
        children: [
          NavigationRail(
            backgroundColor: AppColors.sidebarBg,
            selectedIndex: selectedIndex < 0 ? 0 : selectedIndex,
            onDestinationSelected: (i) => context.go(items[i].path),
            labelType: NavigationRailLabelType.all,
            selectedIconTheme: const IconThemeData(color: Colors.white),
            unselectedIconTheme: IconThemeData(color: AppColors.sidebarText.withValues(alpha: 0.6)),
            selectedLabelTextStyle: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w600),
            unselectedLabelTextStyle: TextStyle(color: AppColors.sidebarText.withValues(alpha: 0.6), fontSize: 10),
            destinations: items.map((i) => NavigationRailDestination(
              icon: Icon(i.icon), selectedIcon: Icon(i.activeIcon), label: Text(i.label),
            )).toList(),
            trailing: Expanded(child: Align(
              alignment: Alignment.bottomCenter,
              child: Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: IconButton(
                  icon: const Icon(Icons.logout, color: AppColors.sidebarText),
                  onPressed: () => context.read<AuthBloc>().add(const AuthLogoutRequested()),
                ),
              ),
            )),
          ),
          const VerticalDivider(width: 1, thickness: 1),
          Expanded(child: child),
        ],
      ),
    );
  }
}

// ── Bottom Navigation (phones) ────────────────────────────
class _BottomNavLayout extends StatelessWidget {
  final List<_NavItem> items;
  final List<_NavItem> allItems;
  final Widget child;
  const _BottomNavLayout({required this.items, required this.allItems, required this.child});

  @override
  Widget build(BuildContext context) {
    final path = _currentPath(context);
    final selectedIndex = items.indexWhere((i) => _isActive(i, path));

    return Scaffold(
      appBar: AppBar(
        title: const Text('MotiPaper Admin'),
        actions: [
          IconButton(icon: const Icon(Icons.menu), onPressed: () => _showAll(context)),
        ],
      ),
      body: child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: selectedIndex < 0 ? 0 : selectedIndex,
        onDestinationSelected: (i) => context.go(items[i].path),
        destinations: items.map((i) => NavigationDestination(
          icon: Icon(i.icon), selectedIcon: Icon(i.activeIcon), label: i.label,
        )).toList(),
      ),
    );
  }

  void _showAll(BuildContext context) {
    final path = _currentPath(context);
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (sheetCtx) => DraggableScrollableSheet(
        initialChildSize: 0.7, maxChildSize: 0.95, minChildSize: 0.4, expand: false,
        builder: (_, ctrl) => ListView(
          controller: ctrl,
          padding: const EdgeInsets.symmetric(vertical: 8),
          children: [
            Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(2)), margin: const EdgeInsets.only(bottom: 12))),
            ...allItems.map((item) {
              final active = _isActive(item, path);
              return ListTile(
                leading: Icon(active ? item.activeIcon : item.icon, color: active ? AppColors.primary : null),
                title: Text(item.label, style: TextStyle(color: active ? AppColors.primary : null, fontWeight: active ? FontWeight.w600 : null)),
                onTap: () { Navigator.pop(sheetCtx); context.go(item.path); },
              );
            }),
            const Divider(),
            ListTile(
              leading: const Icon(Icons.logout, color: AppColors.error),
              title: const Text('Sign Out', style: TextStyle(color: AppColors.error)),
              onTap: () { Navigator.pop(sheetCtx); context.read<AuthBloc>().add(const AuthLogoutRequested()); },
            ),
          ],
        ),
      ),
    );
  }
}
