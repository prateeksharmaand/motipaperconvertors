import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/app_shimmer.dart';
import '../../core/widgets/shell_scaffold.dart';
import 'dashboard_bloc.dart';

class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});
  @override
  Widget build(BuildContext context) => BlocProvider(
        create: (_) => DashboardBloc()..add(const DashboardLoadRequested()),
        child: const _DashboardView(),
      );
}

class _DashboardView extends StatefulWidget {
  const _DashboardView();
  @override
  State<_DashboardView> createState() => _DashboardViewState();
}

class _DashboardViewState extends State<_DashboardView> {
  final _scrollCtrl = ScrollController();
  bool _fabVisible = true;
  bool _fabExpanded = false;

  @override
  void initState() {
    super.initState();
    _scrollCtrl.addListener(() {
      final scrollingDown = _scrollCtrl.position.userScrollDirection.name == 'reverse';
      final scrollingUp = _scrollCtrl.position.userScrollDirection.name == 'forward';
      if (scrollingDown && _fabVisible) setState(() => _fabVisible = false);
      if (scrollingUp && !_fabVisible) setState(() => _fabVisible = true);
    });
  }

  @override
  void dispose() { _scrollCtrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Dashboard', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 17)),
        backgroundColor: const Color(0xFF1F2937),
        surfaceTintColor: Colors.transparent,
        leading: IconButton(icon: const Icon(Icons.menu, color: Colors.white), onPressed: () => drawerScaffoldKey.currentState?.openDrawer()),
        actions: [
          IconButton(icon: const Icon(Icons.notifications_outlined, color: Colors.white), onPressed: () {}),
          const SizedBox(width: 8),
        ],
      ),
      floatingActionButton: AnimatedSlide(
        duration: const Duration(milliseconds: 250),
        offset: _fabVisible ? Offset.zero : const Offset(0, 2),
        child: AnimatedOpacity(
          duration: const Duration(milliseconds: 250),
          opacity: _fabVisible ? 1 : 0,
          child: _fabExpanded ? _QuickActionsFab(onClose: () => setState(() => _fabExpanded = false)) : FloatingActionButton(
            backgroundColor: const Color(0xFF7C3AED),
            child: const Icon(Icons.add_rounded, color: Colors.white, size: 28),
            onPressed: () => setState(() => _fabExpanded = true),
          ),
        ),
      ),
      body: GestureDetector(
        onTap: () { if (_fabExpanded) setState(() => _fabExpanded = false); },
        child: BlocBuilder<DashboardBloc, DashboardState>(
          builder: (context, state) => RefreshIndicator(
            onRefresh: () async => context.read<DashboardBloc>().add(const DashboardRefreshRequested()),
            child: CustomScrollView(controller: _scrollCtrl, slivers: [
              if (state is DashboardLoading)
                SliverToBoxAdapter(child: Column(children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 20, 16, 12),
                    child: GridView.count(crossAxisCount: 2, crossAxisSpacing: 12, mainAxisSpacing: 12, childAspectRatio: 1.5, shrinkWrap: true, physics: const NeverScrollableScrollPhysics(),
                      children: List.generate(4, (_) => const ShimmerStatCard())),
                  ),
                  const ShimmerCard(height: 180),
                  const SizedBox(height: 12),
                  const ShimmerCard(height: 180),
                  const SizedBox(height: 12),
                  ...List.generate(4, (_) => const Padding(padding: EdgeInsets.symmetric(vertical: 4, horizontal: 0), child: ShimmerListItem())),
                ]))
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
                      crossAxisCount: 2, crossAxisSpacing: 12, mainAxisSpacing: 12, childAspectRatio: 1.5,
                    ),
                    delegate: SliverChildListDelegate([
                      _StatCard(label: 'Active Jobs', value: '${state.summary.activeJobs}', icon: Icons.pending_actions_rounded, color: AppColors.primary),
                      _StatCard(label: 'Due Today', value: '${state.summary.dueToday}', icon: Icons.today_rounded, color: AppColors.warning),
                      _StatCard(label: 'Delivered', value: '${state.summary.deliveredJobs}', icon: Icons.check_circle_rounded, color: AppColors.success),
                      _StatCard(label: 'Outstanding', value: Fmt.money(state.summary.totalOutstanding), icon: Icons.account_balance_wallet_rounded, color: AppColors.error),
                    ]),
                  ),
                ),

                // ── Charts ───────────────────────────────────
                if (state.jobsByStatus.isNotEmpty || state.monthlyJobs.isNotEmpty)
                  SliverToBoxAdapter(child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
                    child: Text('Analytics', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                  )),
                if (state.jobsByStatus.isNotEmpty)
                  SliverToBoxAdapter(child: _StatusDonutChart(data: state.jobsByStatus)),
                if (state.monthlyJobs.isNotEmpty)
                  SliverToBoxAdapter(child: _MonthlyBarChart(data: state.monthlyJobs)),

                // ── Recent Jobs ──────────────────────────────
                SliverToBoxAdapter(child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 20, 16, 12),
                  child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                    Text('Recent Job Cards', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                    TextButton(onPressed: () => context.go('/jobs'), child: const Text('View All →')),
                  ]),
                )),
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 100),
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
      ),
    );
  }
}

// ── Quick Actions Speed Dial ──────────────────────────────
class _QuickActionsFab extends StatelessWidget {
  final VoidCallback onClose;
  const _QuickActionsFab({required this.onClose});

  static const _actions = [
    (icon: Icons.work_rounded,        label: 'New Job',    color: Color(0xFF7C3AED), path: '/jobs'),
    (icon: Icons.person_add_rounded,  label: 'New Client', color: Color(0xFF1971C2), path: '/clients'),
    (icon: Icons.receipt_rounded,     label: 'Invoice',    color: Color(0xFF7048E8), path: '/billing'),
    (icon: Icons.inventory_rounded,   label: 'Inventory',  color: Color(0xFF2B8A3E), path: '/inventory'),
    (icon: Icons.bar_chart_rounded,   label: 'Reports',    color: Color(0xFF0C8599), path: '/reports'),
  ];

  @override
  Widget build(BuildContext context) {
    return Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
      ..._actions.map((a) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(color: const Color(0xFF1F2937), borderRadius: BorderRadius.circular(20), boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.18), blurRadius: 6, offset: const Offset(0, 2))]),
            child: Text(a.label, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: Colors.white)),
          ),
          const SizedBox(width: 10),
          FloatingActionButton.small(
            heroTag: a.label,
            backgroundColor: a.color,
            onPressed: () { onClose(); context.go(a.path); },
            child: Icon(a.icon, color: Colors.white, size: 20),
          ),
        ]),
      )),
      FloatingActionButton(
        heroTag: 'main-fab',
        backgroundColor: const Color(0xFF7C3AED),
        onPressed: onClose,
        child: const Icon(Icons.close_rounded, color: Colors.white),
      ),
    ]);
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
        FittedBox(fit: BoxFit.scaleDown, alignment: Alignment.centerLeft,
          child: Text(value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: color))),
        Text(label, style: const TextStyle(fontSize: 11, color: AppColors.textMuted, fontWeight: FontWeight.w500), overflow: TextOverflow.ellipsis),
      ]),
    ]),
  );
}

// ── Action Tile ───────────────────────────────────────────

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
          color: color.withValues(alpha: 0.07),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withValues(alpha: 0.2), width: 1),
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

// ── Jobs by Status — Donut Chart ──────────────────────────
class _StatusDonutChart extends StatelessWidget {
  final List<Map<String, dynamic>> data;
  const _StatusDonutChart({required this.data});

  @override
  Widget build(BuildContext context) {
    final filtered = data.where((d) => (int.tryParse(d['count']?.toString() ?? '') ?? 0) > 0).toList();
    final sections = filtered.map((d) {
      final status = d['status'] as String? ?? '';
      final count = int.tryParse(d['count']?.toString() ?? '') ?? 0;
      final color = AppColors.statusColors[status] ?? AppColors.textMuted;
      return PieChartSectionData(value: count.toDouble(), color: color, title: '', radius: 36);
    }).toList();

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppColors.border)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Jobs by Status', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
        const SizedBox(height: 12),
        Row(children: [
          SizedBox(
            height: 120, width: 120,
            child: PieChart(PieChartData(sections: sections, centerSpaceRadius: 32, sectionsSpace: 2)),
          ),
          const SizedBox(width: 16),
          Expanded(child: Wrap(spacing: 8, runSpacing: 6, children: filtered.map((d) {
            final status = d['status'] as String? ?? '';
            final count = d['count'];
            final color = AppColors.statusColors[status] ?? AppColors.textMuted;
            return Row(mainAxisSize: MainAxisSize.min, children: [
              Container(width: 10, height: 10, decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(2))),
              const SizedBox(width: 4),
              Text('${Fmt.statusLabel(status)} ($count)', style: const TextStyle(fontSize: 11, color: AppColors.textSecondary)),
            ]);
          }).toList())),
        ]),
      ]),
    );
  }
}

// ── Jobs per Month — Bar Chart ────────────────────────────
class _MonthlyBarChart extends StatelessWidget {
  final List<Map<String, dynamic>> data;
  const _MonthlyBarChart({required this.data});

  @override
  Widget build(BuildContext context) {
    final bars = data.asMap().entries.map((e) => BarChartGroupData(
      x: e.key,
      barRods: [BarChartRodData(
        toY: (int.tryParse(e.value['count']?.toString() ?? '') ?? 0).toDouble(),
        color: const Color(0xFF7C3AED),
        width: 18,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(4)),
      )],
    )).toList();

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppColors.border)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Jobs Created (Last 6 Months)', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
        const SizedBox(height: 16),
        SizedBox(height: 140, child: BarChart(BarChartData(
          barGroups: bars,
          gridData: FlGridData(show: true, drawVerticalLine: false, horizontalInterval: 1, getDrawingHorizontalLine: (_) => const FlLine(color: AppColors.border, strokeWidth: 1)),
          borderData: FlBorderData(show: false),
          titlesData: FlTitlesData(
            leftTitles: AxisTitles(sideTitles: SideTitles(showTitles: true, reservedSize: 28, getTitlesWidget: (v, _) => Text(v.toInt().toString(), style: const TextStyle(fontSize: 10, color: AppColors.textMuted)))),
            bottomTitles: AxisTitles(sideTitles: SideTitles(showTitles: true, getTitlesWidget: (v, _) {
              final idx = v.toInt();
              if (idx < 0 || idx >= data.length) return const SizedBox.shrink();
              final month = (data[idx]['month'] as String? ?? '').replaceFirst(RegExp(r'^\d{4}-'), '');
              return Padding(padding: const EdgeInsets.only(top: 4), child: Text(month, style: const TextStyle(fontSize: 10, color: AppColors.textMuted)));
            })),
            rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          ),
          barTouchData: BarTouchData(touchTooltipData: BarTouchTooltipData(getTooltipItem: (_, __, rod, ___) => BarTooltipItem(rod.toY.toInt().toString(), const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 12)))),
        ))),
      ]),
    );
  }
}
