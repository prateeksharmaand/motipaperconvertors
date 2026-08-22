import 'package:equatable/equatable.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../core/network/api_client.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../models/pagination_model.dart';

// ── Models ────────────────────────────────────────────────
class Invoice extends Equatable {
  final String id;
  final int invoiceNumber;
  final String? clientName;
  final String status;
  final double total;
  final double amountPaid;
  final double balanceDue;
  final String? dueDate;
  final String? issueDate;

  const Invoice({required this.id, required this.invoiceNumber, this.clientName, required this.status, required this.total, required this.amountPaid, required this.balanceDue, this.dueDate, this.issueDate});

  factory Invoice.fromJson(Map<String, dynamic> j) => Invoice(
    id: j['id'] as String,
    invoiceNumber: j['invoice_number'] as int? ?? 0,
    clientName: j['client_name'] as String?,
    status: j['status'] as String? ?? 'draft',
    total: double.tryParse(j['total']?.toString() ?? '0') ?? 0,
    amountPaid: double.tryParse(j['amount_paid']?.toString() ?? '0') ?? 0,
    balanceDue: double.tryParse(j['balance_due']?.toString() ?? '0') ?? 0,
    dueDate: j['due_date'] as String?,
    issueDate: j['issue_date'] as String?,
  );

  bool get isOverdue {
    if (dueDate == null || status == 'paid') return false;
    return DateTime.tryParse(dueDate!)?.isBefore(DateTime.now()) ?? false;
  }

  @override List<Object?> get props => [id];
}

class Payment extends Equatable {
  final String id;
  final double amount;
  final String paymentMode;
  final String type;
  final String? clientName;
  final String? paymentDate;
  final String? notes;

  const Payment({required this.id, required this.amount, required this.paymentMode, required this.type, this.clientName, this.paymentDate, this.notes});

  factory Payment.fromJson(Map<String, dynamic> j) => Payment(
    id: j['id'] as String,
    amount: double.tryParse(j['amount']?.toString() ?? '0') ?? 0,
    paymentMode: j['payment_mode'] as String? ?? 'cash',
    type: j['type'] as String? ?? 'against_invoice',
    clientName: j['client_name'] as String?,
    paymentDate: j['payment_date'] as String?,
    notes: j['notes'] as String?,
  );

  @override List<Object?> get props => [id];
}

// ── Events & State ────────────────────────────────────────
abstract class BillingEvent extends Equatable {
  const BillingEvent();
  @override List<Object?> get props => [];
}
class BillingTabChanged extends BillingEvent {
  final int tab;
  const BillingTabChanged(this.tab);
  @override List<Object?> get props => [tab];
}
class InvoicesLoadRequested extends BillingEvent { const InvoicesLoadRequested(); }
class InvoicesSearchChanged extends BillingEvent {
  final String query;
  const InvoicesSearchChanged(this.query);
  @override List<Object?> get props => [query];
}
class InvoicesStatusFilterChanged extends BillingEvent {
  final String? status;
  const InvoicesStatusFilterChanged(this.status);
  @override List<Object?> get props => [status];
}
class InvoicesNextPage extends BillingEvent { const InvoicesNextPage(); }
class PaymentsLoadRequested extends BillingEvent { const PaymentsLoadRequested(); }
class PaymentsNextPage extends BillingEvent { const PaymentsNextPage(); }

class BillingState extends Equatable {
  final int tab;
  final List<Invoice> invoices;
  final bool invoicesLoading, invoicesLoadingMore, invoicesHasMore;
  final int invoicePage, invoiceTotal;
  final String invoiceSearch;
  final String? invoiceStatusFilter;
  final List<Payment> payments;
  final bool paymentsLoading, paymentsLoadingMore, paymentsHasMore;
  final int paymentPage;
  final String? error;

  const BillingState({
    this.tab = 0,
    this.invoices = const [], this.invoicesLoading = false, this.invoicesLoadingMore = false, this.invoicesHasMore = false, this.invoicePage = 1, this.invoiceTotal = 0, this.invoiceSearch = '', this.invoiceStatusFilter,
    this.payments = const [], this.paymentsLoading = false, this.paymentsLoadingMore = false, this.paymentsHasMore = false, this.paymentPage = 1,
    this.error,
  });

  BillingState copyWith({
    int? tab, List<Invoice>? invoices, bool? invoicesLoading, bool? invoicesLoadingMore, bool? invoicesHasMore, int? invoicePage, int? invoiceTotal, String? invoiceSearch, String? invoiceStatusFilter, bool clearStatusFilter = false,
    List<Payment>? payments, bool? paymentsLoading, bool? paymentsLoadingMore, bool? paymentsHasMore, int? paymentPage,
    String? error, bool clearError = false,
  }) => BillingState(
    tab: tab ?? this.tab,
    invoices: invoices ?? this.invoices, invoicesLoading: invoicesLoading ?? this.invoicesLoading, invoicesLoadingMore: invoicesLoadingMore ?? this.invoicesLoadingMore, invoicesHasMore: invoicesHasMore ?? this.invoicesHasMore, invoicePage: invoicePage ?? this.invoicePage, invoiceTotal: invoiceTotal ?? this.invoiceTotal, invoiceSearch: invoiceSearch ?? this.invoiceSearch,
    invoiceStatusFilter: clearStatusFilter ? null : (invoiceStatusFilter ?? this.invoiceStatusFilter),
    payments: payments ?? this.payments, paymentsLoading: paymentsLoading ?? this.paymentsLoading, paymentsLoadingMore: paymentsLoadingMore ?? this.paymentsLoadingMore, paymentsHasMore: paymentsHasMore ?? this.paymentsHasMore, paymentPage: paymentPage ?? this.paymentPage,
    error: clearError ? null : (error ?? this.error),
  );

  @override List<Object?> get props => [tab, invoices, invoicesLoading, payments, paymentsLoading, invoiceStatusFilter, invoiceSearch];
}

// ── BLoC ─────────────────────────────────────────────────
class BillingBloc extends Bloc<BillingEvent, BillingState> {
  BillingBloc() : super(const BillingState()) {
    on<BillingTabChanged>(_onTab);
    on<InvoicesLoadRequested>(_onLoadInvoices);
    on<InvoicesSearchChanged>(_onSearchInvoices);
    on<InvoicesStatusFilterChanged>(_onFilterStatus);
    on<InvoicesNextPage>(_onNextInvoicePage);
    on<PaymentsLoadRequested>(_onLoadPayments);
    on<PaymentsNextPage>(_onNextPaymentPage);
  }

  Map<String, dynamic> get _invoiceParams => {
    'limit': 20, 'sortBy': 'created_at', 'sortDir': 'desc',
    if (state.invoiceSearch.isNotEmpty) 'search': state.invoiceSearch,
    if (state.invoiceStatusFilter != null) 'status': state.invoiceStatusFilter,
  };

  Future<void> _onTab(BillingTabChanged event, Emitter<BillingState> emit) async {
    emit(state.copyWith(tab: event.tab));
    if (event.tab == 0 && state.invoices.isEmpty) add(const InvoicesLoadRequested());
    if (event.tab == 1 && state.payments.isEmpty) add(const PaymentsLoadRequested());
  }

  Future<void> _onLoadInvoices(InvoicesLoadRequested _, Emitter<BillingState> emit) async {
    emit(state.copyWith(invoicesLoading: true, clearError: true));
    try {
      final res = await ApiClient.instance.get('/admin/billing/invoices', queryParameters: {..._invoiceParams, 'page': 1});
      final r = PaginatedResult.fromJson(res.data as Map<String, dynamic>, Invoice.fromJson);
      emit(state.copyWith(invoices: r.data, invoicesLoading: false, invoicePage: 1, invoiceTotal: r.total, invoicesHasMore: r.hasMore));
    } catch (e) { emit(state.copyWith(invoicesLoading: false, error: e.toString())); }
  }

  Future<void> _onSearchInvoices(InvoicesSearchChanged event, Emitter<BillingState> emit) async {
    emit(state.copyWith(invoiceSearch: event.query));
    await _onLoadInvoices(const InvoicesLoadRequested(), emit);
  }

  Future<void> _onFilterStatus(InvoicesStatusFilterChanged event, Emitter<BillingState> emit) async {
    emit(state.copyWith(invoiceStatusFilter: event.status, clearStatusFilter: event.status == null));
    await _onLoadInvoices(const InvoicesLoadRequested(), emit);
  }

  Future<void> _onNextInvoicePage(InvoicesNextPage _, Emitter<BillingState> emit) async {
    if (!state.invoicesHasMore || state.invoicesLoadingMore) return;
    emit(state.copyWith(invoicesLoadingMore: true));
    try {
      final res = await ApiClient.instance.get('/admin/billing/invoices', queryParameters: {..._invoiceParams, 'page': state.invoicePage + 1});
      final r = PaginatedResult.fromJson(res.data as Map<String, dynamic>, Invoice.fromJson);
      emit(state.copyWith(invoices: [...state.invoices, ...r.data], invoicesLoadingMore: false, invoicePage: state.invoicePage + 1, invoicesHasMore: r.hasMore));
    } catch (_) { emit(state.copyWith(invoicesLoadingMore: false)); }
  }

  Future<void> _onLoadPayments(PaymentsLoadRequested _, Emitter<BillingState> emit) async {
    emit(state.copyWith(paymentsLoading: true));
    try {
      final res = await ApiClient.instance.get('/admin/billing/payments', queryParameters: {'limit': 20, 'page': 1, 'sortDir': 'desc'});
      final r = PaginatedResult.fromJson(res.data as Map<String, dynamic>, Payment.fromJson);
      emit(state.copyWith(payments: r.data, paymentsLoading: false, paymentPage: 1, paymentsHasMore: r.hasMore));
    } catch (_) { emit(state.copyWith(paymentsLoading: false)); }
  }

  Future<void> _onNextPaymentPage(PaymentsNextPage _, Emitter<BillingState> emit) async {
    if (!state.paymentsHasMore || state.paymentsLoadingMore) return;
    emit(state.copyWith(paymentsLoadingMore: true));
    try {
      final res = await ApiClient.instance.get('/admin/billing/payments', queryParameters: {'limit': 20, 'page': state.paymentPage + 1, 'sortDir': 'desc'});
      final r = PaginatedResult.fromJson(res.data as Map<String, dynamic>, Payment.fromJson);
      emit(state.copyWith(payments: [...state.payments, ...r.data], paymentsLoadingMore: false, paymentPage: state.paymentPage + 1, paymentsHasMore: r.hasMore));
    } catch (_) { emit(state.copyWith(paymentsLoadingMore: false)); }
  }
}

// ── Screen ────────────────────────────────────────────────
class BillingScreen extends StatelessWidget {
  const BillingScreen({super.key});
  @override
  Widget build(BuildContext context) => BlocProvider(
        create: (_) => BillingBloc()..add(const InvoicesLoadRequested()),
        child: const _BillingView(),
      );
}

class _BillingView extends StatefulWidget {
  const _BillingView();
  @override State<_BillingView> createState() => _BillingViewState();
}

class _BillingViewState extends State<_BillingView> with SingleTickerProviderStateMixin {
  late final _tabCtrl = TabController(length: 2, vsync: this);
  final _searchCtrl = TextEditingController();
  final _invoiceScrollCtrl = ScrollController();
  final _paymentScrollCtrl = ScrollController();

  @override
  void initState() {
    super.initState();
    _tabCtrl.addListener(() {
      if (!_tabCtrl.indexIsChanging) context.read<BillingBloc>().add(BillingTabChanged(_tabCtrl.index));
    });
    _invoiceScrollCtrl.addListener(() {
      if (_invoiceScrollCtrl.position.pixels >= _invoiceScrollCtrl.position.maxScrollExtent - 200) {
        context.read<BillingBloc>().add(const InvoicesNextPage());
      }
    });
    _paymentScrollCtrl.addListener(() {
      if (_paymentScrollCtrl.position.pixels >= _paymentScrollCtrl.position.maxScrollExtent - 200) {
        context.read<BillingBloc>().add(const PaymentsNextPage());
      }
    });
  }

  @override
  void dispose() { _tabCtrl.dispose(); _searchCtrl.dispose(); _invoiceScrollCtrl.dispose(); _paymentScrollCtrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<BillingBloc, BillingState>(
      builder: (context, state) => Scaffold(
        backgroundColor: AppColors.background,
        appBar: AppBar(
          title: const Text('Billing'),
          backgroundColor: AppColors.surface,
          surfaceTintColor: Colors.transparent,
          bottom: TabBar(
            controller: _tabCtrl,
            tabs: const [Tab(text: 'Invoices'), Tab(text: 'Payments')],
            labelColor: AppColors.primary,
            unselectedLabelColor: AppColors.textMuted,
            indicatorColor: AppColors.primary,
          ),
        ),
        body: TabBarView(
          controller: _tabCtrl,
          children: [
            _InvoicesTab(state: state, scrollCtrl: _invoiceScrollCtrl, searchCtrl: _searchCtrl),
            _PaymentsTab(state: state, scrollCtrl: _paymentScrollCtrl),
          ],
        ),
      ),
    );
  }
}

// ── Invoices Tab ──────────────────────────────────────────
class _InvoicesTab extends StatelessWidget {
  final BillingState state;
  final ScrollController scrollCtrl;
  final TextEditingController searchCtrl;
  const _InvoicesTab({required this.state, required this.scrollCtrl, required this.searchCtrl});

  static const _statuses = ['draft', 'issued', 'partially_paid', 'paid', 'cancelled'];
  static const _statusColors = {
    'draft': AppColors.textMuted, 'issued': AppColors.info, 'partially_paid': AppColors.warning, 'paid': AppColors.success, 'cancelled': AppColors.error,
  };

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      // Search + filter bar
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
        child: Row(children: [
          Expanded(child: TextField(
            controller: searchCtrl,
            onChanged: (v) => context.read<BillingBloc>().add(InvoicesSearchChanged(v)),
            decoration: InputDecoration(
              hintText: 'Search invoices…',
              prefixIcon: const Icon(Icons.search, size: 20),
              isDense: true,
              suffixIcon: searchCtrl.text.isNotEmpty ? IconButton(icon: const Icon(Icons.clear, size: 18), onPressed: () { searchCtrl.clear(); context.read<BillingBloc>().add(const InvoicesSearchChanged('')); }) : null,
            ),
          )),
        ]),
      ),
      // Status filter chips
      SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.fromLTRB(16, 6, 16, 6),
        child: Row(children: [
          _statusChip(context, state, null, 'All', AppColors.textMuted),
          ..._statuses.map((s) => _statusChip(context, state, s, Fmt.statusLabel(s), _statusColors[s] ?? AppColors.textMuted)),
        ]),
      ),
      // Summary
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        child: Row(children: [
          Text('${state.invoiceTotal} invoices', style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
        ]),
      ),
      // List
      Expanded(child: state.invoicesLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: () async => context.read<BillingBloc>().add(const InvoicesLoadRequested()),
              child: state.invoices.isEmpty
                  ? const Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [Icon(Icons.receipt_long_outlined, size: 56, color: AppColors.textMuted), SizedBox(height: 12), Text('No invoices', style: TextStyle(color: AppColors.textMuted))]))
                  : ListView.builder(
                      controller: scrollCtrl,
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 80),
                      itemCount: state.invoices.length + 1,
                      itemBuilder: (_, i) {
                        if (i == state.invoices.length) return state.invoicesLoadingMore ? const Padding(padding: EdgeInsets.all(16), child: Center(child: CircularProgressIndicator(strokeWidth: 2))) : const SizedBox.shrink();
                        return _InvoiceCard(invoice: state.invoices[i]);
                      },
                    ),
            )),
    ]);
  }

  Widget _statusChip(BuildContext context, BillingState state, String? status, String label, Color color) {
    final selected = state.invoiceStatusFilter == status;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: FilterChip(
        label: Text(label, style: TextStyle(fontSize: 12, color: selected ? Colors.white : color, fontWeight: FontWeight.w600)),
        selected: selected,
        onSelected: (_) => context.read<BillingBloc>().add(InvoicesStatusFilterChanged(selected ? null : status)),
        selectedColor: color, backgroundColor: color.withValues(alpha: 0.1),
        checkmarkColor: Colors.white, side: BorderSide(color: color.withValues(alpha: 0.4)),
      ),
    );
  }
}

class _InvoiceCard extends StatelessWidget {
  final Invoice invoice;
  const _InvoiceCard({required this.invoice});

  static const _statusColors = {
    'draft': AppColors.textMuted, 'issued': AppColors.info, 'partially_paid': AppColors.warning, 'paid': AppColors.success, 'cancelled': AppColors.error,
  };

  @override
  Widget build(BuildContext context) {
    final color = _statusColors[invoice.status] ?? AppColors.textMuted;
    final overdue = invoice.isOverdue;
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Text('#${invoice.invoiceNumber}', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: AppColors.primary)),
            const SizedBox(width: 8),
            Expanded(child: Text(invoice.clientName ?? '—', style: const TextStyle(fontSize: 13, color: AppColors.textSecondary))),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(6)),
              child: Text(Fmt.statusLabel(invoice.status), style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: color)),
            ),
          ]),
          const SizedBox(height: 8),
          Row(children: [
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Total: ${Fmt.money(invoice.total)}', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
              Text('Paid: ${Fmt.money(invoice.amountPaid)}', style: const TextStyle(fontSize: 12, color: AppColors.success)),
            ])),
            Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
              Text(Fmt.money(invoice.balanceDue), style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: invoice.balanceDue > 0 ? AppColors.error : AppColors.success)),
              Text('Balance due', style: const TextStyle(fontSize: 10, color: AppColors.textMuted)),
            ]),
          ]),
          if (invoice.dueDate != null) ...[
            const SizedBox(height: 6),
            Row(children: [
              Icon(overdue ? Icons.warning_amber_outlined : Icons.calendar_today_outlined, size: 13, color: overdue ? AppColors.error : AppColors.textMuted),
              const SizedBox(width: 4),
              Text('Due: ${Fmt.date(invoice.dueDate)}', style: TextStyle(fontSize: 12, color: overdue ? AppColors.error : AppColors.textMuted, fontWeight: overdue ? FontWeight.w600 : FontWeight.normal)),
              if (overdue) ...[const SizedBox(width: 6), Container(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1), decoration: BoxDecoration(color: AppColors.errorLight, borderRadius: BorderRadius.circular(4)), child: const Text('OVERDUE', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: AppColors.error)))],
            ]),
          ],
        ]),
      ),
    );
  }
}

// ── Payments Tab ──────────────────────────────────────────
class _PaymentsTab extends StatelessWidget {
  final BillingState state;
  final ScrollController scrollCtrl;
  const _PaymentsTab({required this.state, required this.scrollCtrl});

  static const _modeIcons = {
    'cash': Icons.money_outlined, 'upi': Icons.smartphone_outlined, 'cheque': Icons.account_balance_outlined,
    'neft': Icons.swap_horiz, 'rtgs': Icons.account_balance_wallet_outlined, 'other': Icons.payment_outlined,
  };

  @override
  Widget build(BuildContext context) {
    if (state.paymentsLoading) return const Center(child: CircularProgressIndicator());
    if (state.payments.isEmpty) return const Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [Icon(Icons.payments_outlined, size: 56, color: AppColors.textMuted), SizedBox(height: 12), Text('No payments recorded', style: TextStyle(color: AppColors.textMuted))]));

    return RefreshIndicator(
      onRefresh: () async => context.read<BillingBloc>().add(const PaymentsLoadRequested()),
      child: ListView.builder(
        controller: scrollCtrl,
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 80),
        itemCount: state.payments.length + 1,
        itemBuilder: (_, i) {
          if (i == state.payments.length) return state.paymentsLoadingMore ? const Padding(padding: EdgeInsets.all(16), child: Center(child: CircularProgressIndicator(strokeWidth: 2))) : const SizedBox.shrink();
          final p = state.payments[i];
          return Card(
            margin: const EdgeInsets.only(bottom: 8),
            child: ListTile(
              leading: CircleAvatar(
                backgroundColor: AppColors.successLight,
                child: Icon(_modeIcons[p.paymentMode] ?? Icons.payment_outlined, color: AppColors.success, size: 20),
              ),
              title: Row(children: [
                Expanded(child: Text(p.clientName ?? '—', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13))),
                Text(Fmt.money(p.amount), style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.success, fontSize: 14)),
              ]),
              subtitle: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('${p.paymentMode.toUpperCase()} · ${Fmt.statusLabel(p.type)}', style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
                if (p.paymentDate != null) Text(Fmt.date(p.paymentDate), style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
                if (p.notes != null && p.notes!.isNotEmpty) Text(p.notes!, style: const TextStyle(fontSize: 11, color: AppColors.textSecondary)),
              ]),
            ),
          );
        },
      ),
    );
  }
}
