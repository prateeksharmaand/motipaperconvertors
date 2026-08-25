import '../../core/widgets/shell_scaffold.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../core/network/api_client.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/app_toast.dart';
import '../../core/widgets/app_shimmer.dart';
import '../../core/utils/formatters.dart';
import '../../models/pagination_model.dart';

// ── Model ─────────────────────────────────────────────────
class Quotation extends Equatable {
  final String id;
  final int quotationNumber;
  final String? jobTitle;
  final String? clientName;
  final String status;
  final double total;
  final double? marginPercent;
  final double? gstPercent;
  final String? createdAt;

  const Quotation({required this.id, required this.quotationNumber, this.jobTitle, this.clientName, required this.status, required this.total, this.marginPercent, this.gstPercent, this.createdAt});

  factory Quotation.fromJson(Map<String, dynamic> j) => Quotation(
    id: j['id'] as String,
    quotationNumber: j['quotation_number'] as int? ?? 0,
    jobTitle: j['job_title'] as String? ?? j['job_type'] as String?,
    clientName: j['client_name'] as String?,
    status: j['status'] as String? ?? 'draft',
    total: double.tryParse(j['total']?.toString() ?? '0') ?? 0,
    marginPercent: double.tryParse(j['margin_percent']?.toString() ?? ''),
    gstPercent: double.tryParse(j['gst_percent']?.toString() ?? ''),
    createdAt: j['created_at'] as String?,
  );

  @override List<Object?> get props => [id];
}

// ── BLoC ─────────────────────────────────────────────────
abstract class QuotationsEvent extends Equatable {
  const QuotationsEvent();
  @override List<Object?> get props => [];
}
class QuotationsLoadRequested extends QuotationsEvent { const QuotationsLoadRequested(); }
class QuotationsNextPage extends QuotationsEvent { const QuotationsNextPage(); }

class QuotationsState extends Equatable {
  final List<Quotation> items;
  final bool isLoading, isLoadingMore, hasMore;
  final int page, total;
  final String? error;
  const QuotationsState({this.items = const [], this.isLoading = false, this.isLoadingMore = false, this.hasMore = false, this.page = 1, this.total = 0, this.error});
  QuotationsState copyWith({List<Quotation>? items, bool? isLoading, bool? isLoadingMore, bool? hasMore, int? page, int? total, String? error}) =>
      QuotationsState(items: items ?? this.items, isLoading: isLoading ?? this.isLoading, isLoadingMore: isLoadingMore ?? this.isLoadingMore, hasMore: hasMore ?? this.hasMore, page: page ?? this.page, total: total ?? this.total, error: error ?? this.error);
  @override List<Object?> get props => [items, isLoading, page];
}

class QuotationsBloc extends Bloc<QuotationsEvent, QuotationsState> {
  QuotationsBloc() : super(const QuotationsState()) {
    on<QuotationsLoadRequested>(_onLoad);
    on<QuotationsNextPage>(_onNextPage);
  }

  Future<void> _onLoad(QuotationsLoadRequested _, Emitter<QuotationsState> emit) async {
    emit(state.copyWith(isLoading: true));
    try {
      final res = await ApiClient.instance.get('/admin/quotations', queryParameters: {'limit': 20, 'page': 1, 'sortDir': 'desc'});
      final r = PaginatedResult.fromJson(res.data as Map<String, dynamic>, Quotation.fromJson);
      emit(state.copyWith(items: r.data, isLoading: false, page: 1, total: r.total, hasMore: r.hasMore));
    } catch (e) { emit(state.copyWith(isLoading: false, error: e.toString())); }
  }

  Future<void> _onNextPage(QuotationsNextPage _, Emitter<QuotationsState> emit) async {
    if (!state.hasMore || state.isLoadingMore) return;
    emit(state.copyWith(isLoadingMore: true));
    try {
      final res = await ApiClient.instance.get('/admin/quotations', queryParameters: {'limit': 20, 'page': state.page + 1, 'sortDir': 'desc'});
      final r = PaginatedResult.fromJson(res.data as Map<String, dynamic>, Quotation.fromJson);
      emit(state.copyWith(items: [...state.items, ...r.data], isLoadingMore: false, page: state.page + 1, hasMore: r.hasMore));
    } catch (_) { emit(state.copyWith(isLoadingMore: false)); }
  }
}

// ── Screen ────────────────────────────────────────────────
class QuotationsScreen extends StatelessWidget {
  const QuotationsScreen({super.key});
  @override
  Widget build(BuildContext context) => BlocProvider(
        create: (_) => QuotationsBloc()..add(const QuotationsLoadRequested()),
        child: const _QuotationsView(),
      );
}

class _QuotationsView extends StatefulWidget {
  const _QuotationsView();
  @override State<_QuotationsView> createState() => _QuotationsViewState();
}

class _QuotationsViewState extends State<_QuotationsView> {
  final _scrollCtrl = ScrollController();

  @override
  void initState() {
    super.initState();
    _scrollCtrl.addListener(() {
      if (_scrollCtrl.position.pixels >= _scrollCtrl.position.maxScrollExtent - 200) {
        context.read<QuotationsBloc>().add(const QuotationsNextPage());
      }
    });
  }

  @override
  void dispose() { _scrollCtrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<QuotationsBloc, QuotationsState>(
      builder: (context, state) => Scaffold(
        backgroundColor: AppColors.background,
        body: RefreshIndicator(
          onRefresh: () async => context.read<QuotationsBloc>().add(const QuotationsLoadRequested()),
          child: CustomScrollView(controller: _scrollCtrl, slivers: [
            SliverAppBar(floating: true, leading: IconButton(icon: const Icon(Icons.menu), color: AppColors.textPrimary, onPressed: () => drawerScaffoldKey.currentState?.openDrawer()), title: const Text('Quotations'), backgroundColor: AppColors.surface, surfaceTintColor: Colors.transparent),
            SliverToBoxAdapter(child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
              child: Text('${state.total} quotations', style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
            )),
            if (state.isLoading)
              const SliverShimmerList(count: 6, itemBuilder: ShimmerCard.new)
            else if (state.items.isEmpty)
              SliverFillRemaining(child: Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                const Icon(Icons.request_quote_outlined, size: 56, color: AppColors.textMuted),
                const SizedBox(height: 12),
                const Text('No quotations yet', style: TextStyle(color: AppColors.textMuted)),
              ])))
            else
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 80),
                sliver: SliverList(delegate: SliverChildBuilderDelegate(
                  (_, i) {
                    if (i == state.items.length) return state.isLoadingMore ? const Padding(padding: EdgeInsets.all(16), child: Center(child: CircularProgressIndicator(strokeWidth: 2))) : const SizedBox.shrink();
                    final q = state.items[i];
                    return _QuotationCard(q: q, onTap: () => _showDetail(context, q));
                  },
                  childCount: state.items.length + 1,
                )),
              ),
          ]),
        ),
        floatingActionButton: FloatingActionButton.extended(
          onPressed: () => _showCreateSheet(context),
          icon: const Icon(Icons.add),
          label: const Text('New Quotation'),
        ),
      ),
    );
  }

  void _showDetail(BuildContext context, Quotation q) {
    showModalBottomSheet(
      context: context, isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => DraggableScrollableSheet(
        initialChildSize: 0.5, maxChildSize: 0.9, minChildSize: 0.35, expand: false,
        builder: (_, ctrl) => ListView(controller: ctrl, padding: const EdgeInsets.all(20), children: [
          Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(2)), margin: const EdgeInsets.only(bottom: 16))),
          Text('Quotation #${q.quotationNumber}', style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
          const SizedBox(height: 16),
          _row('Client', q.clientName ?? '—'),
          _row('Job', q.jobTitle ?? '—'),
          _row('Total', Fmt.money(q.total), bold: true),
          if (q.marginPercent != null) _row('Margin', '${q.marginPercent!.toStringAsFixed(1)}%'),
          if (q.gstPercent != null) _row('GST', '${q.gstPercent!.toStringAsFixed(0)}%'),
          _row('Status', Fmt.statusLabel(q.status)),
          _row('Created', Fmt.date(q.createdAt)),
        ]),
      ),
    );
  }

  Widget _row(String l, String v, {bool bold = false}) => Padding(
    padding: const EdgeInsets.only(bottom: 10),
    child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
      Text(l, style: const TextStyle(fontSize: 13, color: AppColors.textMuted)),
      Text(v, style: TextStyle(fontSize: 13, fontWeight: bold ? FontWeight.w800 : FontWeight.w600, color: bold ? AppColors.primary : AppColors.textPrimary)),
    ]),
  );

  void _showCreateSheet(BuildContext context) {
    final bloc = context.read<QuotationsBloc>();
    // Fetch jobs for selection
    List<Map<String, dynamic>> jobs = [];
    String? selectedJobId;
    double paperCost = 0, plateCost = 0, printingCost = 0, margin = 15, gst = 18, discount = 0;
    bool loading = true;

    showModalBottomSheet(
      context: context, isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => StatefulBuilder(builder: (ctx, setModal) {
        if (loading) {
          ApiClient.instance.get('/admin/jobs', queryParameters: {'limit': 100, 'sortDir': 'desc'}).then((res) {
            jobs = List<Map<String, dynamic>>.from(res.data['data'] as List? ?? []);
            if (ctx.mounted) setModal(() => loading = false);
          }).catchError((_) { if (ctx.mounted) setModal(() => loading = false); });
        }

        double rawCost = paperCost + plateCost + printingCost;
        double withMargin = rawCost * (1 + margin / 100);
        double afterDiscount = withMargin - discount;
        double gstAmount = afterDiscount * gst / 100;
        double total = afterDiscount + gstAmount;

        return Padding(
          padding: EdgeInsets.only(left: 20, right: 20, top: 20, bottom: MediaQuery.of(ctx).viewInsets.bottom + 20),
          child: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            const Text('New Quotation', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
            const SizedBox(height: 16),
            if (loading) const Center(child: CircularProgressIndicator())
            else DropdownButtonFormField<String>(
              initialValue: selectedJobId,
              hint: const Text('Select Job Card', style: TextStyle(color: AppColors.textDisabled)),
              decoration: const InputDecoration(labelText: 'Job Card'),
              isExpanded: true,
              items: jobs.map((j) => DropdownMenuItem(value: j['id'] as String, child: Text('#${j['job_number']} ${j['job_type'] ?? ''}', overflow: TextOverflow.ellipsis))).toList(),
              onChanged: (v) => setModal(() => selectedJobId = v),
            ),
            const SizedBox(height: 16),
            const Text('Costs', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textMuted)),
            const SizedBox(height: 8),
            Row(children: [
              Expanded(child: TextField(keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'Paper Cost'), onChanged: (v) => setModal(() => paperCost = double.tryParse(v) ?? 0))),
              const SizedBox(width: 8),
              Expanded(child: TextField(keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'Plate Cost'), onChanged: (v) => setModal(() => plateCost = double.tryParse(v) ?? 0))),
            ]),
            const SizedBox(height: 8),
            TextField(keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'Printing Cost'), onChanged: (v) => setModal(() => printingCost = double.tryParse(v) ?? 0)),
            const SizedBox(height: 12),
            const Text('Margin & Tax', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textMuted)),
            const SizedBox(height: 8),
            Row(children: [
              Expanded(child: TextField(keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'Margin %'), controller: TextEditingController(text: '15'), onChanged: (v) => setModal(() => margin = double.tryParse(v) ?? 0))),
              const SizedBox(width: 8),
              Expanded(child: TextField(keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'GST %'), controller: TextEditingController(text: '18'), onChanged: (v) => setModal(() => gst = double.tryParse(v) ?? 0))),
              const SizedBox(width: 8),
              Expanded(child: TextField(keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'Discount ₹'), onChanged: (v) => setModal(() => discount = double.tryParse(v) ?? 0))),
            ]),
            const SizedBox(height: 16),
            Container(padding: const EdgeInsets.all(14), decoration: BoxDecoration(color: AppColors.primaryLight, borderRadius: BorderRadius.circular(10)), child: Column(children: [
              _calcRow('Raw Cost', rawCost),
              _calcRow('+ Margin (${margin.toStringAsFixed(0)}%)', rawCost * margin / 100),
              _calcRow('- Discount', -discount, color: AppColors.error),
              _calcRow('+ GST (${gst.toStringAsFixed(0)}%)', gstAmount),
              const Divider(),
              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                const Text('Total', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                Text(Fmt.money(total), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: AppColors.primary)),
              ]),
            ])),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: selectedJobId == null ? null : () async {
                try {
                  await ApiClient.instance.post('/admin/quotations', data: {
                    'jobId': selectedJobId,
                    'paperCost': paperCost,
                    'plateCost': plateCost,
                    'printingCost': printingCost,
                    'marginPercent': margin,
                    'discountAmount': discount,
                    'gstPercent': gst,
                  });
                  AppToast.success('Quotation created successfully');
                  if (ctx.mounted) Navigator.pop(ctx);
                  bloc.add(const QuotationsLoadRequested());
                } catch (_) { AppToast.error('Failed to create quotation'); }
              },
              child: const Text('Create Quotation'),
            ),
          ])),
        );
      }),
    );
  }

  Widget _calcRow(String label, double value, {Color? color}) => Padding(
    padding: const EdgeInsets.only(bottom: 4),
    child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
      Text(label, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
      Text(Fmt.money(value.abs()), style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: color ?? AppColors.textPrimary)),
    ]),
  );
}

class _QuotationCard extends StatelessWidget {
  final Quotation q;
  final VoidCallback onTap;
  const _QuotationCard({required this.q, required this.onTap});

  static const _statusColors = {'draft': AppColors.textMuted, 'sent': AppColors.info, 'accepted': AppColors.success, 'rejected': AppColors.error};

  @override
  Widget build(BuildContext context) {
    final color = _statusColors[q.status] ?? AppColors.textMuted;
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(children: [
            Container(width: 4, height: 48, decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(2))),
            const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Text('#${q.quotationNumber}', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: AppColors.primary)),
                const SizedBox(width: 8),
                Expanded(child: Text(q.jobTitle ?? '—', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13), maxLines: 1, overflow: TextOverflow.ellipsis)),
                Container(padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3), decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(5)), child: Text(Fmt.statusLabel(q.status), style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: color))),
              ]),
              const SizedBox(height: 4),
              Text(q.clientName ?? '—', style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
              const SizedBox(height: 4),
              Row(children: [
                Text(Fmt.money(q.total), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: AppColors.primary)),
                if (q.marginPercent != null) ...[const SizedBox(width: 8), Text('${q.marginPercent!.toStringAsFixed(0)}% margin', style: const TextStyle(fontSize: 11, color: AppColors.textMuted))],
              ]),
            ])),
            const Icon(Icons.chevron_right, size: 18, color: AppColors.textMuted),
          ]),
        ),
      ),
    );
  }
}
