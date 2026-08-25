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
  _NavItem(label: 'Settings',     icon: Icons.settings_outlined,          activeIcon: Icons.settings_rounded,       path: '/settings',      permission: 'settings.view'),
  _NavItem(label: 'Tenants',      icon: Icons.business_outlined,          activeIcon: Icons.business_rounded,       path: '/tenants'),
];


String _currentPath(BuildContext context) => GoRouterState.of(context).matchedLocation;
bool _isActive(_NavItem item, String path) =>
    item.path == path || (item.path != '/' && path.startsWith(item.path));

class ShellScaffold extends StatelessWidget {
  final Widget child;
  const ShellScaffold({super.key, required this.child});

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

        if (Responsive.showSidebar(context))       return _SidebarLayout(items: items, child: child);
        if (Responsive.showNavigationRail(context)) return _RailLayout(items: items, child: child);
        return _DrawerLayout(items: items, child: child);
      },
    );
  }
}

// ── Drawer + Bottom Nav layout (phones) ───────────────────
class _DrawerLayout extends StatelessWidget {
  final List<_NavItem> items;
  final Widget child;
  const _DrawerLayout({required this.items, required this.child});

  @override
  Widget build(BuildContext context) {
    final path = _currentPath(context);

    final bottomItems = <_NavItem>[
      items.firstWhere((i) => i.path == '/'),
      if (items.any((i) => i.path == '/jobs')) items.firstWhere((i) => i.path == '/jobs'),
      if (items.any((i) => i.path == '/billing')) items.firstWhere((i) => i.path == '/billing'),
      if (items.any((i) => i.path == '/clients')) items.firstWhere((i) => i.path == '/clients'),
    ];

    final selectedIndex = bottomItems.indexWhere((i) => _isActive(i, path));

    return Scaffold(
      drawer: _AppDrawer(items: items),
      body: SafeArea(bottom: false, child: child),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: AppColors.surface,
          border: const Border(top: BorderSide(color: AppColors.border, width: 1)),
          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.06), blurRadius: 12, offset: const Offset(0, -4))],
        ),
        child: SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Row(children: [
              ...bottomItems.asMap().entries.map((e) {
                final active = selectedIndex == e.key;
                final item = e.value;
                return Expanded(child: _BottomNavItem(
                  icon: active ? item.activeIcon : item.icon,
                  label: item.label,
                  active: active,
                  onTap: () => context.go(item.path),
                ));
              }),
            ]),
          ),
        ),
      ),
    );
  }
}

class _BottomNavItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool active;
  final VoidCallback onTap;
  const _BottomNavItem({required this.icon, required this.label, required this.active, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
          decoration: BoxDecoration(
            color: active ? const Color(0xFFF5F0FF) : Colors.transparent,
            borderRadius: BorderRadius.circular(20),
          ),
          child: Icon(icon, color: active ? const Color(0xFF7C3AED) : AppColors.textMuted, size: 22),
        ),
        const SizedBox(height: 2),
        Text(label, style: TextStyle(
          fontSize: 10, fontWeight: active ? FontWeight.w700 : FontWeight.w500,
          color: active ? const Color(0xFF7C3AED) : AppColors.textMuted,
        )),
      ]),
    );
  }
}

// ── App Drawer ─────────────────────────────────────────────
class _AppDrawer extends StatelessWidget {
  final List<_NavItem> items;
  const _AppDrawer({required this.items});

  @override
  Widget build(BuildContext context) {
    final path = _currentPath(context);
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
              children: items.map((item) {
                final active = _isActive(item, path);
                return Container(
                  margin: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
                  decoration: BoxDecoration(
                    color: active ? const Color(0xFF7C3AED).withValues(alpha: 0.25) : Colors.transparent,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: ListTile(
                    dense: true,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    leading: Icon(active ? item.activeIcon : item.icon, color: active ? Colors.white : AppColors.sidebarText, size: 20),
                    title: Text(item.label, style: TextStyle(color: active ? Colors.white : AppColors.sidebarText, fontWeight: active ? FontWeight.w700 : FontWeight.normal, fontSize: 13)),
                    trailing: active ? Container(width: 4, height: 20, decoration: BoxDecoration(color: const Color(0xFF7C3AED), borderRadius: BorderRadius.circular(2))) : null,
                    onTap: () { Navigator.pop(context); context.go(item.path); },
                  ),
                );
              }).toList(),
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

// ── Sidebar (large tablet) ─────────────────────────────────
class _SidebarLayout extends StatelessWidget {
  final List<_NavItem> items;
  final Widget child;
  const _SidebarLayout({required this.items, required this.child});

  @override
  Widget build(BuildContext context) => Scaffold(
    body: Row(children: [
      _Sidebar(items: items),
      const VerticalDivider(width: 1, thickness: 1),
      Expanded(child: child),
    ]),
  );
}

class _Sidebar extends StatelessWidget {
  final List<_NavItem> items;
  const _Sidebar({required this.items});

  @override
  Widget build(BuildContext context) {
    final path = _currentPath(context);
    return Container(
      width: 260,
      color: AppColors.sidebarBg,
      child: SafeArea(child: Column(children: [
        _SidebarHeader(),
        const Divider(color: Colors.white12, height: 1),
        Expanded(child: ListView(
          padding: const EdgeInsets.symmetric(vertical: 8),
          children: items.map((i) => _SidebarItem(item: i, isActive: _isActive(i, path))).toList(),
        )),
        const Divider(color: Colors.white12, height: 1),
        _SidebarLogout(),
      ])),
    );
  }
}

class _SidebarHeader extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.all(16),
    child: Row(children: [
      Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(10)),
        child: const Icon(Icons.print_rounded, color: Colors.white, size: 22),
      ),
      const SizedBox(width: 12),
      const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('MotiPaper', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 15, letterSpacing: -0.3)),
        Text('Admin Panel', style: TextStyle(color: AppColors.sidebarText, fontSize: 11)),
      ]),
    ]),
  );
}

class _SidebarItem extends StatelessWidget {
  final _NavItem item;
  final bool isActive;
  const _SidebarItem({required this.item, required this.isActive});

  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
    decoration: BoxDecoration(
      color: isActive ? AppColors.primary.withValues(alpha: 0.2) : Colors.transparent,
      borderRadius: BorderRadius.circular(10),
    ),
    child: ListTile(
      dense: true,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      leading: Icon(isActive ? item.activeIcon : item.icon, color: isActive ? Colors.white : AppColors.sidebarText, size: 20),
      title: Text(item.label, style: TextStyle(color: isActive ? Colors.white : AppColors.sidebarText, fontWeight: isActive ? FontWeight.w700 : FontWeight.normal, fontSize: 13)),
      trailing: isActive ? Container(width: 4, height: 20, decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(2))) : null,
      onTap: () => context.go(item.path),
    ),
  );
}

class _SidebarLogout extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.all(12),
    child: ListTile(
      dense: true,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      leading: const Icon(Icons.logout_rounded, color: AppColors.sidebarText, size: 20),
      title: const Text('Sign Out', style: TextStyle(color: AppColors.sidebarText, fontSize: 13)),
      onTap: () => context.read<AuthBloc>().add(const AuthLogoutRequested()),
    ),
  );
}

// ── Navigation Rail (small tablet) ────────────────────────
class _RailLayout extends StatelessWidget {
  final List<_NavItem> items;
  final Widget child;
  const _RailLayout({required this.items, required this.child});

  @override
  Widget build(BuildContext context) {
    final path = _currentPath(context);
    final idx = items.indexWhere((i) => _isActive(i, path));
    return Scaffold(
      body: Row(children: [
        NavigationRail(
          backgroundColor: AppColors.sidebarBg,
          selectedIndex: idx < 0 ? 0 : idx,
          onDestinationSelected: (i) => context.go(items[i].path),
          labelType: NavigationRailLabelType.all,
          selectedIconTheme: const IconThemeData(color: Colors.white, size: 22),
          unselectedIconTheme: IconThemeData(color: AppColors.sidebarText.withValues(alpha: 0.6), size: 22),
          selectedLabelTextStyle: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w700),
          unselectedLabelTextStyle: TextStyle(color: AppColors.sidebarText.withValues(alpha: 0.6), fontSize: 10),
          destinations: items.map((i) => NavigationRailDestination(icon: Icon(i.icon), selectedIcon: Icon(i.activeIcon), label: Text(i.label))).toList(),
          trailing: Expanded(child: Align(
            alignment: Alignment.bottomCenter,
            child: Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: IconButton(icon: const Icon(Icons.logout_rounded, color: AppColors.sidebarText), onPressed: () => context.read<AuthBloc>().add(const AuthLogoutRequested())),
            ),
          )),
        ),
        const VerticalDivider(width: 1, thickness: 1),
        Expanded(child: child),
      ]),
    );
  }
}
