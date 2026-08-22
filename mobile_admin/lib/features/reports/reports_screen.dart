import 'package:equatable/equatable.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../core/network/api_client.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/utils/responsive.dart';

// ── State ─────────────────────────────────────────────────
class ReportsState extends Equatable {
  final int tab;
  final bool isLoading;
  final Map<String, dynamic> summary;
  final List<Map<String, dynamic>> jobsByStatus;
  final List<Map<String, dynamic>> monthlyRevenue;
  final List<Map<String, dynamic>> clientRevenue;
  final List<Map<String, dynamic>> staffOutput;
  final List<Map<String, dynamic>> paperConsumption;
  final List<Map<String, dynamic>> machines;
  final Map<String, dynamic> outstanding;
  final List<Map<String, dynamic>> profitability;
  final String? error;

  const ReportsState({
    this.tab = 0, this.isLoading = false, this.summary = const {}, this.jobsByStatus = const [],
    this.monthlyRevenue = const [], this.clientRevenue = const [], this.staffOutput = const [],
    this.paperConsumption = const [], this.machines = const [], this.outstanding = const {},
    this.profitability = const [], this.error,
  });

  ReportsState copyWith({int? tab, bool? isLoading, Map<String, dynamic>? summary, List<Map<String, dynamic>>? jobsByStatus, List<Map<String, dynamic>>? monthlyRevenue, List<Map<String, dynamic>>? clientRevenue, List<Map<String, dynamic>>? staffOutput, List<Map<String, dynamic>>? paperConsumption, List<Map<String, dynamic>>? machines, Map<String, dynamic>? outstanding, List<Map<String, dynamic>>? profitability, String? error}) => ReportsState(
    tab: tab ?? this.tab, isLoading: isLoading ?? this.isLoading, summary: summary ?? this.summary,
    jobsByStatus: jobsByStatus ?? this.jobsByStatus, monthlyRevenue: monthlyRevenue ?? this.monthlyRevenue,
    clientRevenue: clientRevenue ?? this.clientRevenue, staffOutput: staffOutput ?? this.staffOutput,
    paperConsumption: paperConsumption ?? this.paperConsumption, machines: machines ?? this.machines,
    outstanding: outstanding ?? this.outstanding, profitability: profitability ?? this.profitability, error: error,
  );

  @override List<Object?> get props => [tab, isLoading];
}

// ── Events ────────────────────────────────────────────────
abstract class ReportsEvent extends Equatable {
  const ReportsEvent();
  @override List<Object?> get props => [];
}
class ReportsTabChanged extends ReportsEvent { final int tab; const ReportsTabChanged(this.tab); @override List<Object?> get props => [tab]; }
class ReportsLoadRequested extends ReportsEvent { const ReportsLoadRequested(); }

// ── BLoC ─────────────────────────────────────────────────
class ReportsBloc extends Bloc<ReportsEvent, ReportsState> {
  ReportsBloc() : super(const ReportsState()) {
    on<ReportsTabChanged>(_onTab);
    on<ReportsLoadRequested>(_onLoad);
  }

  Future<void> _onTab(ReportsTabChanged event, Emitter<ReportsState> emit) async {
    emit(state.copyWith(tab: event.tab));
  }

  Future<void> _onLoad(ReportsLoadRequested _, Emitter<ReportsState> emit) async {
    emit(state.copyWith(isLoading: true));
    try {
      final results = await Future.wait([
        ApiClient.instance.get('/admin/reports/summary'),
        ApiClient.instance.get('/admin/reports/jobs-by-status'),
        ApiClient.instance.get('/admin/reports/monthly-revenue', queryParameters: {'months': '12'}),
        ApiClient.instance.get('/admin/reports/revenue-by-client'),
        ApiClient.instance.get('/admin/reports/staff-output'),
        ApiClient.instance.get('/admin/reports/paper-consumption'),
        ApiClient.instance.get('/admin/reports/machine-utilization'),
        ApiClient.instance.get('/admin/reports/outstanding-payments'),
        ApiClient.instance.get('/admin/reports/job-profitability'),
      ]);

      emit(state.copyWith(
        isLoading: false,
        summary: results[0].data as Map<String, dynamic>? ?? {},
        jobsByStatus: List<Map<String, dynamic>>.from(results[1].data as List? ?? []),
        monthlyRevenue: List<Map<String, dynamic>>.from(results[2].data as List? ?? []),
        clientRevenue: List<Map<String, dynamic>>.from(results[3].data as List? ?? []),
        staffOutput: List<Map<String, dynamic>>.from(results[4].data as List? ?? []),
        paperConsumption: List<Map<String, dynamic>>.from(results[5].data as List? ?? []),
        machines: List<Map<String, dynamic>>.from(results[6].data as List? ?? []),
        outstanding: results[7].data as Map<String, dynamic>? ?? {},
        profitability: List<Map<String, dynamic>>.from((results[8].data as Map?)?['jobs'] as List? ?? []),
      ));
    } catch (e) {
      emit(state.copyWith(isLoading: false, error: e.toString()));
    }
  }
}

// ── Screen ────────────────────────────────────────────────
const _tabs = [
  'Pipeline', 'Revenue', 'Clients', 'Outstanding',
  'Profitability', 'Paper', 'Machines', 'Staff',
];

class ReportsScreen extends StatelessWidget {
  const ReportsScreen({super.key});
  @override
  Widget build(BuildContext context) => BlocProvider(
        create: (_) => ReportsBloc()..add(const ReportsLoadRequested()),
        child: const _ReportsView(),
      );
}

class _ReportsView extends StatefulWidget {
  const _ReportsView();
  @override State<_ReportsView> createState() => _ReportsViewState();
}

class _ReportsViewState extends State<_ReportsView> with SingleTickerProviderStateMixin {
  late final _tabCtrl = TabController(length: _tabs.length, vsync: this);

  @override
  void initState() {
    super.initState();
    _tabCtrl.addListener(() {
      if (!_tabCtrl.indexIsChanging) context.read<ReportsBloc>().add(ReportsTabChanged(_tabCtrl.index));
    });
  }

  @override
  void dispose() { _tabCtrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<ReportsBloc, ReportsState>(
      builder: (context, state) => Scaffold(
        backgroundColor: AppColors.background,
        appBar: AppBar(
          title: const Text('Reports'),
          backgroundColor: AppColors.surface, surfaceTintColor: Colors.transparent,
          actions: [
            IconButton(icon: const Icon(Icons.refresh_outlined), onPressed: () => context.read<ReportsBloc>().add(const ReportsLoadRequested())),
            const SizedBox(width: 8),
          ],
          bottom: TabBar(
            controller: _tabCtrl, isScrollable: true, tabAlignment: TabAlignment.start,
            tabs: _tabs.map((t) => Tab(text: t)).toList(),
            labelColor: AppColors.primary, unselectedLabelColor: AppColors.textMuted, indicatorColor: AppColors.primary,
          ),
        ),
        body: state.isLoading
            ? const Center(child: CircularProgressIndicator())
            : state.error != null
                ? Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                    const Icon(Icons.error_outline, size: 48, color: AppColors.error),
                    const SizedBox(height: 12), Text(state.error!),
                    const SizedBox(height: 16),
                    ElevatedButton(onPressed: () => context.read<ReportsBloc>().add(const ReportsLoadRequested()), child: const Text('Retry')),
                  ]))
                : TabBarView(
                    controller: _tabCtrl,
                    children: [
                      _PipelineTab(data: state.jobsByStatus),
                      _RevenueTab(data: state.monthlyRevenue),
                      _ClientsTab(data: state.clientRevenue),
                      _OutstandingTab(data: state.outstanding),
                      _ProfitabilityTab(data: state.profitability),
                      _PaperTab(data: state.paperConsumption),
                      _MachinesTab(data: state.machines),
                      _StaffTab(data: state.staffOutput),
                    ],
                  ),
      ),
    );
  }
}

// ── Shared widgets ────────────────────────────────────────
class _SectionHeader extends StatelessWidget {
  final String title;
  const _SectionHeader(this.title);
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
    child: Text(title, style: Theme.of(context).textTheme.titleLarge),
  );
}

Widget _statRow(String label, String value, {Color valueColor = AppColors.textPrimary}) =>
    Padding(padding: const EdgeInsets.only(bottom: 8), child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
      Text(label, style: const TextStyle(fontSize: 13, color: AppColors.textMuted)),
      Text(value, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: valueColor)),
    ]));

// ── 1. Pipeline tab ───────────────────────────────────────
class _PipelineTab extends StatelessWidget {
  final List<Map<String, dynamic>> data;
  const _PipelineTab({required this.data});

  @override
  Widget build(BuildContext context) {
    if (data.isEmpty) return const Center(child: Text('No data', style: TextStyle(color: AppColors.textMuted)));
    final cols = Responsive.gridCrossAxisCount(context, phone: 2, tablet: 3, large: 4);
    return ListView(padding: const EdgeInsets.all(16), children: [
      GridView.builder(
        shrinkWrap: true, physics: const NeverScrollableScrollPhysics(),
        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: cols, crossAxisSpacing: 10, mainAxisSpacing: 10, childAspectRatio: 1.6),
        itemCount: data.length,
        itemBuilder: (_, i) {
          final row = data[i];
          final status = row['status'] as String? ?? '';
          final color = AppColors.statusColors[status] ?? AppColors.textMuted;
          return Card(child: Padding(padding: const EdgeInsets.all(12), child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Text(Fmt.statusLabel(status), style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: color)),
            Text('${row['count'] ?? 0}', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: color)),
            if ((row['total_value'] as num? ?? 0) > 0)
              Text(Fmt.money(row['total_value']), style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
          ])));
        },
      ),
      const SizedBox(height: 20),
      _SectionHeader('Jobs by Status'),
      Card(child: Padding(padding: const EdgeInsets.all(16), child: SizedBox(
        height: data.length * 44.0,
        child: BarChart(BarChartData(
          barGroups: data.asMap().entries.map((e) {
            final color = AppColors.statusColors[e.value['status'] as String? ?? ''] ?? AppColors.textMuted;
            return BarChartGroupData(x: e.key, barRods: [BarChartRodData(toY: (e.value['count'] as num? ?? 0).toDouble(), color: color, width: 20, borderRadius: const BorderRadius.vertical(top: Radius.circular(4)))]);
          }).toList(),
          titlesData: FlTitlesData(
            bottomTitles: AxisTitles(sideTitles: SideTitles(showTitles: true, getTitlesWidget: (v, _) {
              final i = v.toInt();
              if (i >= data.length) return const SizedBox.shrink();
              return Padding(padding: const EdgeInsets.only(top: 4), child: Text(Fmt.statusLabel(data[i]['status'] as String? ?? '').substring(0, 3), style: const TextStyle(fontSize: 9, color: AppColors.textMuted)));
            })),
            leftTitles: AxisTitles(sideTitles: SideTitles(showTitles: true, reservedSize: 28, getTitlesWidget: (v, _) => Text('${v.toInt()}', style: const TextStyle(fontSize: 9, color: AppColors.textMuted)))),
            topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          ),
          gridData: FlGridData(drawVerticalLine: false, horizontalInterval: 1, getDrawingHorizontalLine: (_) => FlLine(color: AppColors.border, strokeWidth: 0.5)),
          borderData: FlBorderData(show: false),
        )),
      ))),
    ]);
  }
}

// ── 2. Monthly Revenue tab ────────────────────────────────
class _RevenueTab extends StatelessWidget {
  final List<Map<String, dynamic>> data;
  const _RevenueTab({required this.data});

  @override
  Widget build(BuildContext context) {
    if (data.isEmpty) return const Center(child: Text('No data', style: TextStyle(color: AppColors.textMuted)));
    final totalRevenue = data.fold(0.0, (s, r) => s + (double.tryParse(r['revenue']?.toString() ?? '0') ?? 0));
    final totalCollected = data.fold(0.0, (s, r) => s + (double.tryParse(r['collected']?.toString() ?? '0') ?? 0));

    return ListView(padding: const EdgeInsets.all(16), children: [
      Row(children: [
        Expanded(child: Card(child: Padding(padding: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('12M Revenue', style: TextStyle(fontSize: 12, color: AppColors.textMuted)),
          Text(Fmt.money(totalRevenue), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.primary)),
        ])))),
        const SizedBox(width: 10),
        Expanded(child: Card(child: Padding(padding: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('12M Collected', style: TextStyle(fontSize: 12, color: AppColors.textMuted)),
          Text(Fmt.money(totalCollected), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.success)),
        ])))),
      ]),
      const SizedBox(height: 16),
      Card(child: Padding(padding: const EdgeInsets.fromLTRB(12, 16, 12, 8), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Revenue vs Collected', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
        const SizedBox(height: 16),
        SizedBox(height: 220, child: LineChart(LineChartData(
          lineBarsData: [
            LineChartBarData(spots: data.asMap().entries.map((e) => FlSpot(e.key.toDouble(), (double.tryParse(e.value['revenue']?.toString() ?? '0') ?? 0))).toList(), isCurved: true, color: AppColors.primary, barWidth: 2.5, dotData: const FlDotData(show: false), belowBarData: BarAreaData(show: true, color: AppColors.primary.withValues(alpha: 0.08))),
            LineChartBarData(spots: data.asMap().entries.map((e) => FlSpot(e.key.toDouble(), (double.tryParse(e.value['collected']?.toString() ?? '0') ?? 0))).toList(), isCurved: true, color: AppColors.success, barWidth: 2.5, dotData: const FlDotData(show: false)),
          ],
          titlesData: FlTitlesData(
            bottomTitles: AxisTitles(sideTitles: SideTitles(showTitles: true, interval: 2, getTitlesWidget: (v, _) {
              final i = v.toInt();
              if (i >= data.length || i % 2 != 0) return const SizedBox.shrink();
              final m = data[i]['month'] as String? ?? '';
              return Padding(padding: const EdgeInsets.only(top: 4), child: Text(m.length >= 7 ? m.substring(5) : m, style: const TextStyle(fontSize: 9, color: AppColors.textMuted)));
            })),
            leftTitles: AxisTitles(sideTitles: SideTitles(showTitles: true, reservedSize: 44, getTitlesWidget: (v, _) => Text('₹${(v / 1000).toStringAsFixed(0)}k', style: const TextStyle(fontSize: 9, color: AppColors.textMuted)))),
            topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          ),
          gridData: FlGridData(drawVerticalLine: false, getDrawingHorizontalLine: (_) => FlLine(color: AppColors.border, strokeWidth: 0.5)),
          borderData: FlBorderData(show: false),
        ))),
        const SizedBox(height: 8),
        Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          _legend(AppColors.primary, 'Revenue'),
          const SizedBox(width: 16),
          _legend(AppColors.success, 'Collected'),
        ]),
      ]))),
    ]);
  }

  Widget _legend(Color c, String label) => Row(mainAxisSize: MainAxisSize.min, children: [
    Container(width: 12, height: 3, decoration: BoxDecoration(color: c, borderRadius: BorderRadius.circular(2))),
    const SizedBox(width: 6),
    Text(label, style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
  ]);
}

// ── 3. Clients Revenue tab ────────────────────────────────
class _ClientsTab extends StatelessWidget {
  final List<Map<String, dynamic>> data;
  const _ClientsTab({required this.data});

  @override
  Widget build(BuildContext context) {
    if (data.isEmpty) return const Center(child: Text('No data', style: TextStyle(color: AppColors.textMuted)));
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: data.length + 1,
      itemBuilder: (_, i) {
        if (i == 0) return Padding(padding: const EdgeInsets.only(bottom: 12), child: Row(children: [
          Expanded(child: Text('Client', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.textMuted))),
          const SizedBox(width: 8),
          const Text('Billed', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.textMuted)),
          const SizedBox(width: 16),
          const Text('Outstanding', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.textMuted)),
        ]));
        final r = data[i - 1];
        final outstanding = double.tryParse(r['total_outstanding']?.toString() ?? '0') ?? 0;
        return Card(margin: const EdgeInsets.only(bottom: 8), child: Padding(padding: const EdgeInsets.all(12), child: Row(children: [
          CircleAvatar(radius: 16, backgroundColor: AppColors.primaryLight, child: Text((r['client_name'] as String? ?? '?').substring(0, 1).toUpperCase(), style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w700, fontSize: 13))),
          const SizedBox(width: 10),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(r['client_name'] as String? ?? '—', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13), maxLines: 1, overflow: TextOverflow.ellipsis),
            Text('${r['total_invoices'] ?? 0} invoices', style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
          ])),
          const SizedBox(width: 8),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Text(Fmt.money(r['total_billed']), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.primary)),
            Text(Fmt.money(outstanding), style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: outstanding > 0 ? AppColors.error : AppColors.success)),
          ]),
        ])));
      },
    );
  }
}

// ── 4. Outstanding tab ────────────────────────────────────
class _OutstandingTab extends StatelessWidget {
  final Map<String, dynamic> data;
  const _OutstandingTab({required this.data});

  @override
  Widget build(BuildContext context) {
    final invoices = List<Map<String, dynamic>>.from(data['invoices'] as List? ?? []);
    final summary = data['summary'] as Map? ?? {};
    if (invoices.isEmpty) return const Center(child: Text('No outstanding invoices', style: TextStyle(color: AppColors.textMuted)));

    return ListView(padding: const EdgeInsets.all(16), children: [
      Row(children: [
        Expanded(child: Card(child: Padding(padding: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Total Outstanding', style: TextStyle(fontSize: 12, color: AppColors.textMuted)),
          Text(Fmt.money(summary['total_outstanding']), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.error)),
        ])))),
        const SizedBox(width: 10),
        Expanded(child: Card(child: Padding(padding: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Open Invoices', style: TextStyle(fontSize: 12, color: AppColors.textMuted)),
          Text('${summary['count'] ?? invoices.length}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.warning)),
        ])))),
      ]),
      const SizedBox(height: 16),
      ...invoices.map((inv) {
        final urgency = inv['urgency'] as String? ?? 'upcoming';
        final urgencyColor = urgency == 'overdue' ? AppColors.error : urgency == 'due_today' ? AppColors.warning : AppColors.info;
        return Card(margin: const EdgeInsets.only(bottom: 8), child: Padding(padding: const EdgeInsets.all(12), child: Row(children: [
          Container(width: 4, height: 48, decoration: BoxDecoration(color: urgencyColor, borderRadius: BorderRadius.circular(2))),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(inv['client_name'] as String? ?? '—', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
            Text('Invoice #${inv['invoice_number']}', style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
            if (inv['due_date'] != null) Text('Due: ${Fmt.date(inv['due_date'])}', style: TextStyle(fontSize: 11, color: urgencyColor, fontWeight: FontWeight.w500)),
          ])),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Text(Fmt.money(inv['balance_due']), style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: urgencyColor)),
            Container(margin: const EdgeInsets.only(top: 4), padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2), decoration: BoxDecoration(color: urgencyColor.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(5)), child: Text(urgency.replaceAll('_', ' ').toUpperCase(), style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: urgencyColor))),
          ]),
        ])));
      }),
    ]);
  }
}

// ── 5. Profitability tab ──────────────────────────────────
class _ProfitabilityTab extends StatelessWidget {
  final List<Map<String, dynamic>> data;
  const _ProfitabilityTab({required this.data});

  @override
  Widget build(BuildContext context) {
    if (data.isEmpty) return const Center(child: Text('No data', style: TextStyle(color: AppColors.textMuted)));
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: data.length,
      itemBuilder: (_, i) {
        final j = data[i];
        final margin = double.tryParse(j['actual_margin']?.toString() ?? '0') ?? 0;
        final pct = double.tryParse(j['margin_percent']?.toString() ?? '0') ?? 0;
        final color = margin >= 0 ? AppColors.success : AppColors.error;
        return Card(margin: const EdgeInsets.only(bottom: 8), child: Padding(padding: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Text('#${j['job_number']}', style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
            const SizedBox(width: 8),
            Expanded(child: Text(j['title'] as String? ?? '—', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13), maxLines: 1, overflow: TextOverflow.ellipsis)),
            Text('${pct.toStringAsFixed(1)}%', style: TextStyle(fontWeight: FontWeight.w800, color: color, fontSize: 14)),
          ]),
          const SizedBox(height: 8),
          Row(children: [
            Expanded(child: _statRow('Quoted', Fmt.money(j['quoted_price']))),
            const SizedBox(width: 16),
            Expanded(child: _statRow('Margin', Fmt.money(margin), valueColor: color)),
          ]),
          if (j['client_name'] != null) Text(j['client_name'] as String, style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
        ])));
      },
    );
  }
}

// ── 6. Paper Consumption tab ──────────────────────────────
class _PaperTab extends StatelessWidget {
  final List<Map<String, dynamic>> data;
  const _PaperTab({required this.data});

  @override
  Widget build(BuildContext context) {
    if (data.isEmpty) return const Center(child: Text('No data', style: TextStyle(color: AppColors.textMuted)));
    final maxSheets = data.fold(0.0, (m, r) => (double.tryParse(r['total_sheets']?.toString() ?? '0') ?? 0) > m ? (double.tryParse(r['total_sheets']?.toString() ?? '0') ?? 0) : m);
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: data.length,
      itemBuilder: (_, i) {
        final r = data[i];
        final sheets = double.tryParse(r['total_sheets']?.toString() ?? '0') ?? 0;
        final pct = maxSheets > 0 ? sheets / maxSheets : 0.0;
        return Card(margin: const EdgeInsets.only(bottom: 8), child: Padding(padding: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: Text('${r['paper_name']} ${r['gsm'] != null ? "${r['gsm']}gsm" : ""}', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13))),
            Text('${sheets.toStringAsFixed(0)} ${r['unit'] ?? 'sheets'}', style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.info, fontSize: 13)),
          ]),
          const SizedBox(height: 6),
          if (r['size'] != null) Text(r['size'] as String, style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
          const SizedBox(height: 6),
          LinearProgressIndicator(value: pct, backgroundColor: AppColors.border, color: AppColors.info, minHeight: 4, borderRadius: BorderRadius.circular(2)),
          const SizedBox(height: 4),
          Text('Used in ${r['usage_count'] ?? 0} job(s)', style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
        ])));
      },
    );
  }
}

// ── 7. Machines tab ───────────────────────────────────────
class _MachinesTab extends StatelessWidget {
  final List<Map<String, dynamic>> data;
  const _MachinesTab({required this.data});

  @override
  Widget build(BuildContext context) {
    if (data.isEmpty) return const Center(child: Text('No data', style: TextStyle(color: AppColors.textMuted)));
    final cols = Responsive.gridCrossAxisCount(context, phone: 1, tablet: 2, large: 3);
    return GridView.builder(
      padding: const EdgeInsets.all(16),
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: cols, crossAxisSpacing: 10, mainAxisSpacing: 10, childAspectRatio: 1.5),
      itemCount: data.length,
      itemBuilder: (_, i) {
        final m = data[i];
        final total = m['total_jobs'] as int? ?? 0;
        final done = m['completed_jobs'] as int? ?? 0;
        final active = m['active_jobs'] as int? ?? 0;
        final pct = total > 0 ? done / total : 0.0;
        return Card(child: Padding(padding: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            const Icon(Icons.precision_manufacturing_outlined, size: 18, color: AppColors.secondary),
            const SizedBox(width: 8),
            Expanded(child: Text(m['machine_name'] as String? ?? '—', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13), maxLines: 1, overflow: TextOverflow.ellipsis)),
          ]),
          const Spacer(),
          Row(children: [
            _mStat('Total', '$total', AppColors.textPrimary),
            const SizedBox(width: 12),
            _mStat('Done', '$done', AppColors.success),
            const SizedBox(width: 12),
            _mStat('Active', '$active', AppColors.info),
          ]),
          const SizedBox(height: 8),
          LinearProgressIndicator(value: pct, backgroundColor: AppColors.border, color: AppColors.secondary, minHeight: 5, borderRadius: BorderRadius.circular(3)),
          const SizedBox(height: 4),
          Text('${(pct * 100).toStringAsFixed(0)}% completion rate', style: const TextStyle(fontSize: 10, color: AppColors.textMuted)),
        ])));
      },
    );
  }

  Widget _mStat(String l, String v, Color c) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    Text(l, style: const TextStyle(fontSize: 10, color: AppColors.textMuted)),
    Text(v, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: c)),
  ]);
}

// ── 8. Staff Output tab ───────────────────────────────────
class _StaffTab extends StatelessWidget {
  final List<Map<String, dynamic>> data;
  const _StaffTab({required this.data});

  @override
  Widget build(BuildContext context) {
    if (data.isEmpty) return const Center(child: Text('No data', style: TextStyle(color: AppColors.textMuted)));
    final maxJobs = data.fold(0, (m, r) => (r['total_jobs'] as int? ?? 0) > m ? (r['total_jobs'] as int? ?? 0) : m);
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: data.length,
      itemBuilder: (_, i) {
        final r = data[i];
        final total = r['total_jobs'] as int? ?? 0;
        final done = r['completed_jobs'] as int? ?? 0;
        final pct = maxJobs > 0 ? total / maxJobs : 0.0;
        return Card(margin: const EdgeInsets.only(bottom: 8), child: Padding(padding: const EdgeInsets.all(14), child: Row(children: [
          CircleAvatar(backgroundColor: AppColors.successLight, child: Text((r['operator_name'] as String? ?? '?').substring(0, 1).toUpperCase(), style: const TextStyle(color: AppColors.success, fontWeight: FontWeight.w700))),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(r['operator_name'] as String? ?? '—', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
            const SizedBox(height: 6),
            LinearProgressIndicator(value: pct, backgroundColor: AppColors.border, color: AppColors.success, minHeight: 4, borderRadius: BorderRadius.circular(2)),
            const SizedBox(height: 4),
            Text('$done of $total completed', style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
          ])),
          const SizedBox(width: 12),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Text('$total', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: AppColors.primary)),
            const Text('jobs', style: TextStyle(fontSize: 11, color: AppColors.textMuted)),
          ]),
        ])));
      },
    );
  }
}
