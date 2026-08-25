import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import 'dashboard_bloc.dart';

class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});
  @override
  Widget build(BuildContext context) => BlocProvider(
        create: (_) => DashboardBloc()..add(const DashboardLoadRequested()),
        child: const _DashboardView(),
      );
}

class _DashboardView extends StatelessWidget {
  const _DashboardView();
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Dashboard', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 17)),
        backgroundColor: const Color(0xFF1F2937),
        surfaceTintColor: Colors.transparent,
        actions: [
          IconButton(icon: const Icon(Icons.notifications_outlined, color: Colors.white), onPressed: () {}),
          const SizedBox(width: 8),
        ],
      ),
      body: BlocBuilder<DashboardBloc, DashboardState>(
        builder: (context, state) => RefreshIndicator(
          onRefresh: () async => context.read<DashboardBloc>().add(const DashboardRefreshRequested()),
          child: CustomScrollView(slivers: [
            if (state is DashboardLoading)
              const SliverFillRemaining(child: Center(child: CircularProgressIndicator()))
            else if (state is DashboardError)
              SliverFillRemaining(child: Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                const Icon(Icons.error_outline, size: 48, color: AppColors.error),
                const SizedBox(height: 12),
                Text(state.message, textAlign: TextAlign.center),
                const SizedBox(height: 16),
                ElevatedButton(onPressed: () => context.read<DashboardBloc>().add(const DashboardLoadRequested()), child: const Text('Retry')),
              ])))
            else if (state is DashboardLoaded) ...[

              // ── Stats Cards ──────────────────────────────
              SliverToBoxAdapter(child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 20, 16, 4),
                child: Text('Overview', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
              )),
              SliverPadding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                sliver: SliverGrid(
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2, crossAxisSpacing: 12, mainAxisSpacing: 12, childAspectRatio: 1.65,
                  ),
                  delegate: SliverChildListDelegate([
                    _StatCard(label: 'Active Jobs', value: '${state.summary.activeJobs}', icon: Icons.pending_actions_rounded, color: AppColors.primary),
                    _StatCard(label: 'Due Today', value: '${state.summary.dueToday}', icon: Icons.today_rounded, color: AppColors.warning),
                    _StatCard(label: 'Delivered', value: '${state.summary.deliveredJobs}', icon: Icons.check_circle_rounded, color: AppColors.success),
                    _StatCard(label: 'Outstanding', value: Fmt.money(state.summary.totalOutstanding), icon: Icons.account_balance_wallet_rounded, color: AppColors.error),
                  ]),
                ),
              ),

              // ── Quick Actions ────────────────────────────
              SliverToBoxAdapter(child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 20, 16, 12),
                child: Text('Quick Actions', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
              )),
              SliverToBoxAdapter(child: SizedBox(
                height: 90,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  children: [
                    _ActionTile(icon: Icons.add_box_rounded, label: 'New Job', color: AppColors.primary, onTap: () => context.go('/jobs')),
                    _ActionTile(icon: Icons.person_add_rounded, label: 'New Client', color: AppColors.info, onTap: () => context.go('/clients')),
                    _ActionTile(icon: Icons.receipt_rounded, label: 'Invoice', color: AppColors.secondary, onTap: () => context.go('/billing')),
                    _ActionTile(icon: Icons.inventory_rounded, label: 'Inventory', color: AppColors.success, onTap: () => context.go('/inventory')),
                    _ActionTile(icon: Icons.bar_chart_rounded, label: 'Reports', color: const Color(0xFF0C8599), onTap: () => context.go('/reports')),
                  ],
                ),
              )),

              // ── Recent Jobs ──────────────────────────────
              SliverToBoxAdapter(child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 20, 16, 12),
                child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                  Text('Recent Job Cards', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                  TextButton(onPressed: () => context.go('/jobs'), child: const Text('View All →')),
                ]),
              )),
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                sliver: SliverList(delegate: SliverChildBuilderDelegate(
                  (_, i) {
                    if (state.recentJobs.isEmpty) {
                      return const Card(child: Padding(padding: EdgeInsets.all(24), child: Center(child: Text('No recent jobs', style: TextStyle(color: AppColors.textMuted)))));
                    }
                    if (i >= state.recentJobs.length) return null;
                    return _RecentJobTile(job: state.recentJobs[i]);
                  },
                  childCount: state.recentJobs.isEmpty ? 1 : state.recentJobs.length,
                )),
              ),
            ],
          ]),
        ),
      ),
    );
  }
}


// ── Stat Card ─────────────────────────────────────────────
class _StatCard extends StatelessWidget {
  final String label, value;
  final IconData icon;
  final Color color;
  const _StatCard({required this.label, required this.value, required this.icon, required this.color});

  @override
  Widget build(BuildContext context) => Container(
    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), boxShadow: [BoxShadow(color: color.withValues(alpha: 0.08), blurRadius: 8, offset: const Offset(0, 2))]),
    padding: const EdgeInsets.all(14),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
      Container(padding: const EdgeInsets.all(7), decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(8)),
        child: Icon(icon, color: color, size: 18)),
      Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: color)),
        Text(label, style: const TextStyle(fontSize: 11, color: AppColors.textMuted, fontWeight: FontWeight.w500)),
      ]),
    ]),
  );
}

// ── Action Tile ───────────────────────────────────────────
class _ActionTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;
  const _ActionTile({required this.icon, required this.label, required this.color, required this.onTap});

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(right: 12),
    child: GestureDetector(
      onTap: onTap,
      child: Container(
        width: 76,
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.06), blurRadius: 6, offset: const Offset(0, 2))]),
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          Container(padding: const EdgeInsets.all(10), decoration: BoxDecoration(color: color.withValues(alpha: 0.12), shape: BoxShape.circle),
            child: Icon(icon, color: color, size: 22)),
          const SizedBox(height: 6),
          Text(label, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: AppColors.textSecondary), textAlign: TextAlign.center, maxLines: 1, overflow: TextOverflow.ellipsis),
        ]),
      ),
    ),
  );
}

// ── Recent Job Tile ───────────────────────────────────────
class _RecentJobTile extends StatelessWidget {
  final Map<String, dynamic> job;
  const _RecentJobTile({required this.job});

  @override
  Widget build(BuildContext context) {
    final status = job['status'] as String? ?? 'draft';
    final color = AppColors.statusColors[status] ?? AppColors.textMuted;
    return GestureDetector(
      onTap: () => context.go('/jobs/${job['id']}'),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border(left: BorderSide(color: color, width: 4)),
          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 6, offset: const Offset(0, 2))],
        ),
        child: ListTile(
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          title: Text('#${job['job_number']} ${job['job_type'] ?? ''}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
          subtitle: Text(job['client_company_name'] as String? ?? job['client_name'] as String? ?? '—', style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
          trailing: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20)),
            child: Text(Fmt.statusLabel(status), style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: color)),
          ),
        ),
      ),
    );
  }
}
