import 'dart:ui' show ImageFilter;
import '../../core/widgets/shell_scaffold.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/app_toast.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/app_shimmer.dart';
import '../../models/job_model.dart';
import 'job_form_screen.dart';
import 'jobs_bloc.dart';

const _statuses = ['draft','enquiry','quotation','design','approval','print','finishing','qc','ready','delivered','cancelled'];

class JobsScreen extends StatelessWidget {
  const JobsScreen({super.key});
  @override
  Widget build(BuildContext context) => BlocProvider(
        create: (_) => JobsBloc()..add(const JobsLoadRequested()),
        child: const _JobsView(),
      );
}

class _JobsView extends StatefulWidget {
  const _JobsView();
  @override State<_JobsView> createState() => _JobsViewState();
}

class _JobsViewState extends State<_JobsView> {
  final _searchCtrl = TextEditingController();
  final _scrollCtrl = ScrollController();
  bool _fabOpen = false;

  @override
  void initState() {
    super.initState();
    _scrollCtrl.addListener(() {
      if (_scrollCtrl.position.pixels >= _scrollCtrl.position.maxScrollExtent - 200) {
        context.read<JobsBloc>().add(const JobsNextPageRequested());
      }
    });
  }

  @override
  void dispose() { _searchCtrl.dispose(); _scrollCtrl.dispose(); super.dispose(); }

  void _closeFab() => setState(() => _fabOpen = false);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      floatingActionButton: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
        if (_fabOpen) ...[
          Row(mainAxisSize: MainAxisSize.min, children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(color: const Color(0xFF1F2937), borderRadius: BorderRadius.circular(20), boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.18), blurRadius: 6, offset: const Offset(0, 2))]),
              child: const Text('New Job', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: Colors.white)),
            ),
            const SizedBox(width: 10),
            FloatingActionButton.small(
              heroTag: 'new-job',
              backgroundColor: const Color(0xFF7C3AED),
              onPressed: () async {
                _closeFab();
                final created = await Navigator.push<bool>(context, MaterialPageRoute(builder: (_) => BlocProvider.value(value: context.read<JobsBloc>(), child: const JobFormScreen())));
                if (created == true && context.mounted) context.read<JobsBloc>().add(const JobsLoadRequested());
              },
              child: const Icon(Icons.work_rounded, color: Colors.white, size: 20),
            ),
          ]),
          const SizedBox(height: 10),
        ],
        FloatingActionButton(
          heroTag: 'jobs-main',
          backgroundColor: const Color(0xFF7C3AED),
          onPressed: () => setState(() => _fabOpen = !_fabOpen),
          child: AnimatedRotation(
            turns: _fabOpen ? 0.125 : 0,
            duration: const Duration(milliseconds: 200),
            child: const Icon(Icons.add_rounded, color: Colors.white, size: 28),
          ),
        ),
      ]),
      body: Stack(children: [
        BlocBuilder<JobsBloc, JobsState>(
        builder: (context, state) {
          return RefreshIndicator(
            onRefresh: () async => context.read<JobsBloc>().add(const JobsLoadRequested()),
            child: CustomScrollView(controller: _scrollCtrl, slivers: [
              // AppBar
              SliverAppBar(
                floating: false, pinned: true,
                title: const Text('Job Cards'),
                leading: IconButton(icon: const Icon(Icons.menu), onPressed: () => drawerScaffoldKey.currentState?.openDrawer()),
                actions: [
                  if (state.hasActiveFilters)
                    TextButton(onPressed: () => context.read<JobsBloc>().add(const JobsFilterCleared()), child: const Text('Clear', style: TextStyle(color: AppColors.error))),
                  IconButton(icon: const Icon(Icons.sort_outlined), onPressed: () => _showSort(context, state)),
                  IconButton(icon: const Icon(Icons.filter_list_outlined), onPressed: () => _showFilters(context, state)),
                  const SizedBox(width: 8),
                ],
                bottom: PreferredSize(
                  preferredSize: const Size.fromHeight(56),
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                    child: TextField(
                      controller: _searchCtrl,
                      onChanged: (v) => context.read<JobsBloc>().add(JobsSearchChanged(v)),
                      decoration: InputDecoration(
                        hintText: 'Search jobs, client, type…',
                        prefixIcon: const Icon(Icons.search, size: 20),
                        suffixIcon: _searchCtrl.text.isNotEmpty
                            ? IconButton(icon: const Icon(Icons.clear, size: 18), onPressed: () { _searchCtrl.clear(); context.read<JobsBloc>().add(const JobsSearchChanged('')); })
                            : null,
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        isDense: true,
                      ),
                    ),
                  ),
                ),
              ),

              // Active filters chips
              if (state.hasActiveFilters)
                SliverToBoxAdapter(child: _FilterChips(state: state)),

              // Stats row
              SliverToBoxAdapter(child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                child: Text('${state.total} jobs', style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.textMuted)),
              )),

              // Job list
              if (state.isLoading)
                const SliverShimmerList(count: 7, itemBuilder: ShimmerListItem.new)
              else if (state.jobs.isEmpty)
                SliverFillRemaining(child: Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                  const Icon(Icons.work_outline, size: 56, color: AppColors.textMuted),
                  const SizedBox(height: 12),
                  Text(state.hasActiveFilters ? 'No jobs match your filters' : 'No job cards yet', style: const TextStyle(color: AppColors.textMuted)),
                ])))
              else
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                  sliver: SliverList(delegate: SliverChildBuilderDelegate(
                    (_, i) {
                      if (i == state.jobs.length) return state.isLoadingMore ? const Padding(padding: EdgeInsets.all(16), child: Center(child: CircularProgressIndicator(strokeWidth: 2))) : const SizedBox.shrink();
                      return _JobCard(job: state.jobs[i]);
                    },
                    childCount: state.jobs.length + 1,
                  )),
                ),
            ]),
          );
        },
      ),
      // Blur overlay when FAB is open
      if (_fabOpen)
        GestureDetector(
          onTap: _closeFab,
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 3, sigmaY: 3),
            child: Container(color: Colors.black.withValues(alpha: 0.3)),
          ),
        ),
      ]),
    );
  }

  void _showSort(BuildContext ctx, JobsState state) {
    final bloc = ctx.read<JobsBloc>();
    const sortOptions = [
      ('created_at', 'Created Date'),
      ('due_date', 'Due Date'),
      ('job_number', 'Job Number'),
      ('status', 'Status'),
      ('quoted_price', 'Price'),
    ];
    String sortBy = state.sortBy;
    String sortDir = state.sortDir;
    showModalBottomSheet(
      context: ctx,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => StatefulBuilder(builder: (ctx, setM) {
        return Padding(
          padding: const EdgeInsets.all(20),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Sort Jobs', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: Color(0xFF1F2937))),
            const SizedBox(height: 16),
            const Text('Sort By', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF1F2937))),
            const SizedBox(height: 8),
            Wrap(spacing: 8, runSpacing: 8, children: sortOptions.map(((String, String) opt) {
              final selected = sortBy == opt.$1;
              return ChoiceChip(
                label: Text(opt.$2, style: TextStyle(fontSize: 12, color: selected ? Colors.white : const Color(0xFF1F2937), fontWeight: FontWeight.w600)),
                selected: selected,
                onSelected: (_) => setM(() => sortBy = opt.$1),
                selectedColor: const Color(0xFF7C3AED),
                backgroundColor: const Color(0xFFF5F0FF),
                side: BorderSide(color: selected ? const Color(0xFF7C3AED) : AppColors.border),
              );
            }).toList()),
            const SizedBox(height: 16),
            const Text('Direction', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF1F2937))),
            const SizedBox(height: 8),
            Row(children: [
              Expanded(child: OutlinedButton(
                onPressed: () => setM(() => sortDir = 'desc'),
                style: OutlinedButton.styleFrom(
                  side: BorderSide(color: sortDir == 'desc' ? const Color(0xFF7C3AED) : AppColors.border, width: sortDir == 'desc' ? 2 : 1),
                  backgroundColor: sortDir == 'desc' ? const Color(0xFFF5F0FF) : null,
                ),
                child: Text('Newest First', style: TextStyle(color: sortDir == 'desc' ? const Color(0xFF7C3AED) : const Color(0xFF1F2937), fontWeight: sortDir == 'desc' ? FontWeight.w700 : FontWeight.normal)),
              )),
              const SizedBox(width: 12),
              Expanded(child: OutlinedButton(
                onPressed: () => setM(() => sortDir = 'asc'),
                style: OutlinedButton.styleFrom(
                  side: BorderSide(color: sortDir == 'asc' ? const Color(0xFF7C3AED) : AppColors.border, width: sortDir == 'asc' ? 2 : 1),
                  backgroundColor: sortDir == 'asc' ? const Color(0xFFF5F0FF) : null,
                ),
                child: Text('Oldest First', style: TextStyle(color: sortDir == 'asc' ? const Color(0xFF7C3AED) : const Color(0xFF1F2937), fontWeight: sortDir == 'asc' ? FontWeight.w700 : FontWeight.normal)),
              )),
            ]),
            const SizedBox(height: 20),
            SizedBox(width: double.infinity, child: ElevatedButton(
              onPressed: () { Navigator.pop(ctx); bloc.add(JobsSortChanged(sortBy, sortDir)); },
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF7C3AED)),
              child: const Text('Apply Sort'),
            )),
          ]),
        );
      }),
    );
  }

  void _showFilters(BuildContext ctx, JobsState state) {
    final bloc = ctx.read<JobsBloc>();
    String? selectedStatus = state.statusFilter;
    showModalBottomSheet(
      context: ctx,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => StatefulBuilder(
        builder: (context, setModal) => Padding(
          padding: const EdgeInsets.all(20),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              const Text('Filter Jobs', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
              TextButton(onPressed: () { Navigator.pop(context); bloc.add(const JobsFilterCleared()); }, child: const Text('Reset')),
            ]),
            const SizedBox(height: 16),
            const Text('Status', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textMuted)),
            const SizedBox(height: 8),
            Wrap(spacing: 8, runSpacing: 8, children: _statuses.map((s) {
              final color = AppColors.statusColors[s] ?? AppColors.textMuted;
              final selected = selectedStatus == s;
              return FilterChip(
                label: Text(Fmt.statusLabel(s), style: TextStyle(fontSize: 12, color: selected ? Colors.white : color, fontWeight: FontWeight.w600)),
                selected: selected,
                onSelected: (_) => setModal(() => selectedStatus = selected ? null : s),
                backgroundColor: color.withValues(alpha: 0.1),
                selectedColor: color,
                checkmarkColor: Colors.white,
                side: BorderSide(color: color.withValues(alpha: 0.4)),
              );
            }).toList()),
            const SizedBox(height: 24),
            SizedBox(width: double.infinity, child: ElevatedButton(
              onPressed: () { Navigator.pop(context); bloc.add(JobsFilterChanged(status: selectedStatus)); },
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF7C3AED)),
              child: const Text('Apply Filter'),
            )),
            SizedBox(height: MediaQuery.of(context).viewInsets.bottom),
          ]),
        ),
      ),
    );
  }
}

// ── Filter Chips Bar ──────────────────────────────────────
class _FilterChips extends StatelessWidget {
  final JobsState state;
  const _FilterChips({required this.state});
  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 4),
      child: Row(children: [
        if (state.statusFilter != null)
          _chip(context, Fmt.statusLabel(state.statusFilter!), () => context.read<JobsBloc>().add(const JobsFilterChanged())),
        if (state.search.isNotEmpty)
          _chip(context, '"${state.search}"', () { context.read<JobsBloc>().add(const JobsSearchChanged('')); }),
      ]),
    );
  }

  Widget _chip(BuildContext context, String label, VoidCallback onRemove) => Padding(
    padding: const EdgeInsets.only(right: 8),
    child: Chip(
      label: Text(label, style: const TextStyle(fontSize: 12)),
      deleteIcon: const Icon(Icons.close, size: 14),
      onDeleted: onRemove,
      backgroundColor: AppColors.primaryLight,
      side: BorderSide(color: AppColors.primary.withValues(alpha: 0.3)),
    ),
  );
}

// ── Job Card ──────────────────────────────────────────────
class _JobCard extends StatelessWidget {
  final Job job;
  const _JobCard({required this.job});

  @override
  Widget build(BuildContext context) {
    final status = job.status;
    final color = AppColors.statusColors[status] ?? AppColors.textMuted;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.07),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withValues(alpha: 0.2), width: 1),
      ),
      child: InkWell(
        onTap: () => context.push('/jobs/${job.id}'),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(children: [
            const SizedBox(width: 4),
            // Content
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Text('#${job.jobNumber}', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: color)),
                const SizedBox(width: 8),
                Expanded(child: Text(job.jobType ?? '—', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600), maxLines: 1, overflow: TextOverflow.ellipsis)),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(6)),
                  child: Text(Fmt.statusLabel(status), style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: color)),
                ),
              ]),
              const SizedBox(height: 4),
              Text(job.clientCompanyName ?? job.clientName ?? '—', style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
              const SizedBox(height: 6),
              Row(children: [
                if (job.quantity != null) ...[
                  const Icon(Icons.format_list_numbered, size: 12, color: AppColors.textMuted),
                  const SizedBox(width: 3),
                  Text('${job.quantity}', style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
                  const SizedBox(width: 12),
                ],
                if (job.dueDate != null) ...[
                  const Icon(Icons.calendar_today_outlined, size: 12, color: AppColors.textMuted),
                  const SizedBox(width: 3),
                  Text('Due: ${Fmt.date(job.dueDate)}', style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
                ],
                const Spacer(),
                if (job.quotedPrice != null)
                  Text(Fmt.money(job.quotedPrice), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
              ]),
            ])),
            const SizedBox(width: 4),
            const Icon(Icons.chevron_right, size: 18, color: AppColors.textMuted),
          ]),
        ),
      ),
    );
  }
}

