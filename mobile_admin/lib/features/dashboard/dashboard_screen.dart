import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/utils/responsive.dart';
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
      body: BlocBuilder<DashboardBloc, DashboardState>(
        builder: (context, state) => RefreshIndicator(
          onRefresh: () async => context.read<DashboardBloc>().add(const DashboardRefreshRequested()),
          child: CustomScrollView(slivers: [
            SliverAppBar(
              floating: true,
              title: const Text('Dashboard'),
              backgroundColor: AppColors.surface,
              surfaceTintColor: Colors.transparent,
              actions: [
                IconButton(icon: const Icon(Icons.refresh_outlined), onPressed: () => context.read<DashboardBloc>().add(const DashboardRefreshRequested())),
                const SizedBox(width: 8),
              ],
            ),
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
            else if (state is DashboardLoaded)
              SliverPadding(
                padding: Responsive.pagePadding(context),
                sliver: SliverList(delegate: SliverChildListDelegate([
                  _Banner(),
                  const SizedBox(height: 20),
                  _StatsGrid(summary: state.summary),
                  const SizedBox(height: 24),
                  _QuickActions(),
                  const SizedBox(height: 24),
                  _RecentJobs(jobs: state.recentJobs),
                  const SizedBox(height: 24),
                ])),
              ),
          ]),
        ),
      ),
    );
  }
}

class _Banner extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(20),
    decoration: BoxDecoration(
      gradient: LinearGradient(colors: [AppColors.primary, AppColors.primary.withValues(alpha: 0.75)], begin: Alignment.topLeft, end: Alignment.bottomRight),
      borderRadius: BorderRadius.circular(16),
    ),
    child: Row(children: [
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Welcome back!', style: Theme.of(context).textTheme.headlineSmall?.copyWith(color: Colors.white)),
        const SizedBox(height: 4),
        Text('MotiPaper Convertors', style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Colors.white70)),
      ])),
      const Icon(Icons.print_rounded, color: Colors.white38, size: 52),
    ]),
  );
}

class _StatsGrid extends StatelessWidget {
  final DashboardSummary summary;
  const _StatsGrid({required this.summary});
  @override
  Widget build(BuildContext context) {
    final cols = Responsive.gridCrossAxisCount(context, phone: 2, tablet: 3, large: 4);
    final stats = [
      (label: 'Total Jobs',  value: '${summary.totalJobs}',              icon: Icons.work_outline,              color: AppColors.primary),
      (label: 'Active',      value: '${summary.activeJobs}',             icon: Icons.pending_actions,           color: AppColors.info),
      (label: 'Due Today',   value: '${summary.dueToday}',               icon: Icons.today_outlined,            color: AppColors.warning),
      (label: 'Delivered',   value: '${summary.deliveredJobs}',          icon: Icons.check_circle_outline,      color: AppColors.success),
      (label: 'Billed',      value: Fmt.money(summary.totalBilled),      icon: Icons.receipt_long_outlined,     color: AppColors.secondary),
      (label: 'Outstanding', value: Fmt.money(summary.totalOutstanding), icon: Icons.account_balance_outlined,  color: AppColors.error),
    ];
    return GridView.builder(
      shrinkWrap: true, physics: const NeverScrollableScrollPhysics(),
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: cols, crossAxisSpacing: 12, mainAxisSpacing: 12, childAspectRatio: 1.55),
      itemCount: stats.length,
      itemBuilder: (_, i) {
        final s = stats[i];
        return Card(child: Padding(padding: const EdgeInsets.all(14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Container(padding: const EdgeInsets.all(6), decoration: BoxDecoration(color: s.color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(8)), child: Icon(s.icon, color: s.color, size: 18)),
            Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(s.value, style: Theme.of(context).textTheme.headlineMedium?.copyWith(color: s.color, fontWeight: FontWeight.w800, fontSize: 20)),
              Text(s.label, style: Theme.of(context).textTheme.bodySmall),
            ]),
          ])));
      },
    );
  }
}

class _QuickActions extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    Text('Quick Actions', style: Theme.of(context).textTheme.titleLarge),
    const SizedBox(height: 12),
    Wrap(spacing: 10, runSpacing: 10, children: [
      ActionChip(avatar: const Icon(Icons.add_circle_outline, size: 16, color: AppColors.primary), label: const Text('New Job'),     onPressed: () => context.go('/jobs'),    backgroundColor: AppColors.primaryLight, side: BorderSide(color: AppColors.primary.withValues(alpha: 0.3))),
      ActionChip(avatar: const Icon(Icons.person_add_outlined,  size: 16, color: AppColors.primary), label: const Text('New Client'), onPressed: () => context.go('/clients'),backgroundColor: AppColors.primaryLight, side: BorderSide(color: AppColors.primary.withValues(alpha: 0.3))),
      ActionChip(avatar: const Icon(Icons.receipt_outlined,     size: 16, color: AppColors.secondary), label: const Text('Invoice'), onPressed: () => context.go('/billing'), backgroundColor: const Color(0xFFF5F3FF), side: BorderSide(color: AppColors.secondary.withValues(alpha: 0.3))),
      ActionChip(avatar: const Icon(Icons.bar_chart_outlined,   size: 16, color: AppColors.success), label: const Text('Reports'),   onPressed: () => context.go('/reports'), backgroundColor: AppColors.successLight, side: BorderSide(color: AppColors.success.withValues(alpha: 0.3))),
    ]),
  ]);
}

class _RecentJobs extends StatelessWidget {
  final List<Map<String, dynamic>> jobs;
  const _RecentJobs({required this.jobs});
  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
      Text('Recent Job Cards', style: Theme.of(context).textTheme.titleLarge),
      TextButton(onPressed: () => context.go('/jobs'), child: const Text('View All')),
    ]),
    const SizedBox(height: 8),
    Card(child: jobs.isEmpty
      ? const Padding(padding: EdgeInsets.all(24), child: Center(child: Text('No jobs yet')))
      : ListView.separated(
          shrinkWrap: true, physics: const NeverScrollableScrollPhysics(),
          itemCount: jobs.length,
          separatorBuilder: (_, __) => const Divider(height: 1),
          itemBuilder: (_, i) {
            final j = jobs[i];
            final status = j['status'] as String? ?? 'draft';
            final color = AppColors.statusColors[status] ?? AppColors.textMuted;
            return ListTile(
              onTap: () => context.go('/jobs/${j['id']}'),
              leading: Container(width: 4, height: 40, decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(2))),
              title: Text('#${j['job_number']} ${j['job_type'] ?? ''}', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
              subtitle: Text(j['client_company_name'] as String? ?? j['client_name'] as String? ?? '—', style: const TextStyle(fontSize: 12)),
              trailing: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(6)),
                child: Text(Fmt.statusLabel(status), style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: color)),
              ),
            );
          },
        )),
  ]);
}
