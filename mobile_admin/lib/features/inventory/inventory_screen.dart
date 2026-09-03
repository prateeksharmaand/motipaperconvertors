import 'package:equatable/equatable.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../core/network/api_client.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/app_toast.dart';
import '../../core/widgets/app_shimmer.dart';
import '../../models/pagination_model.dart';

// ── Models ────────────────────────────────────────────────
class PaperStock extends Equatable {
  final String id;
  final String name;
  final String? brand;
  final int? gsm;
  final String? size;
  final String? unit;
  final double quantity;
  final double? lowStockThreshold;
  final double? costPerUnit;
  final String inventoryType;

  const PaperStock({required this.id, required this.name, this.brand, this.gsm, this.size, this.unit, required this.quantity, this.lowStockThreshold, this.costPerUnit, this.inventoryType = 'in_house'});

  bool get isLowStock => lowStockThreshold != null && quantity <= lowStockThreshold!;

  factory PaperStock.fromJson(Map<String, dynamic> j) => PaperStock(
    id: j['id'] as String,
    name: j['name'] as String? ?? '',
    brand: j['brand'] as String?,
    gsm: j['gsm'] as int?,
    size: j['size'] as String?,
    unit: j['unit'] as String?,
    quantity: double.tryParse(j['quantity']?.toString() ?? '0') ?? 0,
    lowStockThreshold: double.tryParse(j['low_stock_threshold']?.toString() ?? ''),
    costPerUnit: double.tryParse(j['cost_per_unit']?.toString() ?? ''),
    inventoryType: j['inventory_type'] as String? ?? 'in_house',
  );

  @override List<Object?> get props => [id];
}

class InventoryItem extends Equatable {
  final String id;
  final String name;
  final String category;
  final String? unit;
  final double quantity;
  final double? lowStockThreshold;

  const InventoryItem({required this.id, required this.name, required this.category, this.unit, required this.quantity, this.lowStockThreshold});

  bool get isLowStock => lowStockThreshold != null && quantity <= lowStockThreshold!;

  factory InventoryItem.fromJson(Map<String, dynamic> j) => InventoryItem(
    id: j['id'] as String,
    name: j['name'] as String? ?? '',
    category: j['category'] as String? ?? 'other',
    unit: j['unit'] as String?,
    quantity: double.tryParse(j['quantity']?.toString() ?? '0') ?? 0,
    lowStockThreshold: double.tryParse(j['low_stock_threshold']?.toString() ?? ''),
  );

  @override List<Object?> get props => [id];
}

// ── Events & State ────────────────────────────────────────
abstract class InventoryEvent extends Equatable {
  const InventoryEvent();
  @override List<Object?> get props => [];
}
class InventoryTabChanged extends InventoryEvent { final int tab; const InventoryTabChanged(this.tab); @override List<Object?> get props => [tab]; }
class PaperInvTypeChanged extends InventoryEvent { final String invType; const PaperInvTypeChanged(this.invType); @override List<Object?> get props => [invType]; }
class PaperLoadRequested extends InventoryEvent { const PaperLoadRequested(); }
class PaperSearchChanged extends InventoryEvent { final String q; const PaperSearchChanged(this.q); @override List<Object?> get props => [q]; }
class ItemsLoadRequested extends InventoryEvent { const ItemsLoadRequested(); }
class ItemsSearchChanged extends InventoryEvent { final String q; const ItemsSearchChanged(this.q); @override List<Object?> get props => [q]; }
class TransactionsLoadRequested extends InventoryEvent { const TransactionsLoadRequested(); }
class TransactionsNextPage extends InventoryEvent { const TransactionsNextPage(); }

class InventoryState extends Equatable {
  final int tab;
  final String paperInvType; // 'in_house' | 'external'
  final List<PaperStock> papers;
  final bool papersLoading;
  final String paperSearch;
  final List<InventoryItem> items;
  final bool itemsLoading;
  final String itemSearch;
  final int lowStockCount;
  final String? error;
  final List<Map<String, dynamic>> transactions;
  final bool txLoading, txLoadingMore, txHasMore;
  final int txPage;

  const InventoryState({this.tab = 0, this.paperInvType = 'in_house', this.papers = const [], this.papersLoading = false, this.paperSearch = '', this.items = const [], this.itemsLoading = false, this.itemSearch = '', this.lowStockCount = 0, this.error, this.transactions = const [], this.txLoading = false, this.txLoadingMore = false, this.txHasMore = false, this.txPage = 1});

  InventoryState copyWith({int? tab, String? paperInvType, List<PaperStock>? papers, bool? papersLoading, String? paperSearch, List<InventoryItem>? items, bool? itemsLoading, String? itemSearch, int? lowStockCount, String? error, List<Map<String, dynamic>>? transactions, bool? txLoading, bool? txLoadingMore, bool? txHasMore, int? txPage}) => InventoryState(
    tab: tab ?? this.tab, paperInvType: paperInvType ?? this.paperInvType, papers: papers ?? this.papers, papersLoading: papersLoading ?? this.papersLoading, paperSearch: paperSearch ?? this.paperSearch,
    items: items ?? this.items, itemsLoading: itemsLoading ?? this.itemsLoading, itemSearch: itemSearch ?? this.itemSearch,
    lowStockCount: lowStockCount ?? this.lowStockCount, error: error ?? this.error,
    transactions: transactions ?? this.transactions, txLoading: txLoading ?? this.txLoading, txLoadingMore: txLoadingMore ?? this.txLoadingMore, txHasMore: txHasMore ?? this.txHasMore, txPage: txPage ?? this.txPage,
  );

  @override List<Object?> get props => [tab, paperInvType, papers, papersLoading, items, itemsLoading];
}

// ── BLoC ─────────────────────────────────────────────────
class InventoryBloc extends Bloc<InventoryEvent, InventoryState> {
  InventoryBloc() : super(const InventoryState()) {
    on<InventoryTabChanged>(_onTab);
    on<PaperInvTypeChanged>(_onPaperInvType);
    on<PaperLoadRequested>(_onLoadPaper);
    on<PaperSearchChanged>(_onSearchPaper);
    on<ItemsLoadRequested>(_onLoadItems);
    on<ItemsSearchChanged>(_onSearchItems);
    on<TransactionsLoadRequested>(_onLoadTransactions);
    on<TransactionsNextPage>(_onNextTxPage);
  }

  Future<void> _onTab(InventoryTabChanged event, Emitter<InventoryState> emit) async {
    emit(state.copyWith(tab: event.tab));
    if (event.tab == 0 && state.papers.isEmpty) add(const PaperLoadRequested());
    if (event.tab == 1 && state.items.isEmpty) add(const ItemsLoadRequested());
    if (event.tab == 2) add(const TransactionsLoadRequested());
  }

  Future<void> _onPaperInvType(PaperInvTypeChanged event, Emitter<InventoryState> emit) async {
    emit(state.copyWith(paperInvType: event.invType, papers: []));
    add(const PaperLoadRequested());
  }

  Future<void> _onLoadPaper(PaperLoadRequested _, Emitter<InventoryState> emit) async {
    emit(state.copyWith(papersLoading: true));
    try {
      final res = await ApiClient.instance.get('/admin/inventory/paper', queryParameters: {
        'limit': 100,
        'inventory_type': state.paperInvType,
        if (state.paperSearch.isNotEmpty) 'search': state.paperSearch,
      });
      final r = PaginatedResult.fromJson(res.data as Map<String, dynamic>, PaperStock.fromJson);
      emit(state.copyWith(papers: r.data, papersLoading: false, lowStockCount: r.data.where((p) => p.isLowStock).length));
    } catch (e) { emit(state.copyWith(papersLoading: false, error: e.toString())); }
  }

  Future<void> _onSearchPaper(PaperSearchChanged event, Emitter<InventoryState> emit) async {
    emit(state.copyWith(paperSearch: event.q));
    await _onLoadPaper(const PaperLoadRequested(), emit);
  }

  Future<void> _onLoadItems(ItemsLoadRequested _, Emitter<InventoryState> emit) async {
    emit(state.copyWith(itemsLoading: true));
    try {
      final res = await ApiClient.instance.get('/admin/inventory/items', queryParameters: {'limit': 100, if (state.itemSearch.isNotEmpty) 'search': state.itemSearch});
      final r = PaginatedResult.fromJson(res.data as Map<String, dynamic>, InventoryItem.fromJson);
      emit(state.copyWith(items: r.data, itemsLoading: false));
    } catch (e) { emit(state.copyWith(itemsLoading: false, error: e.toString())); }
  }

  Future<void> _onSearchItems(ItemsSearchChanged event, Emitter<InventoryState> emit) async {
    emit(state.copyWith(itemSearch: event.q));
    await _onLoadItems(const ItemsLoadRequested(), emit);
  }

  Future<void> _onLoadTransactions(TransactionsLoadRequested _, Emitter<InventoryState> emit) async {
    emit(state.copyWith(txLoading: true));
    try {
      final res = await ApiClient.instance.get('/admin/inventory/transactions', queryParameters: {'limit': 30, 'page': 1, 'sortDir': 'desc'});
      final data = List<Map<String, dynamic>>.from(res.data['data'] as List? ?? []);
      final total = res.data['total'] as int? ?? data.length;
      emit(state.copyWith(transactions: data, txLoading: false, txPage: 1, txHasMore: data.length < total && data.length >= 30));
    } catch (_) { emit(state.copyWith(txLoading: false)); }
  }

  Future<void> _onNextTxPage(TransactionsNextPage _, Emitter<InventoryState> emit) async {
    if (!state.txHasMore || state.txLoadingMore) return;
    emit(state.copyWith(txLoadingMore: true));
    try {
      final res = await ApiClient.instance.get('/admin/inventory/transactions', queryParameters: {'limit': 30, 'page': state.txPage + 1, 'sortDir': 'desc'});
      final data = List<Map<String, dynamic>>.from(res.data['data'] as List? ?? []);
      emit(state.copyWith(transactions: [...state.transactions, ...data], txLoadingMore: false, txPage: state.txPage + 1, txHasMore: data.length == 30));
    } catch (_) { emit(state.copyWith(txLoadingMore: false)); }
  }
}

// ── Screen ────────────────────────────────────────────────
class InventoryScreen extends StatelessWidget {
  const InventoryScreen({super.key});
  @override
  Widget build(BuildContext context) => BlocProvider(
    create: (_) => InventoryBloc()..add(const PaperLoadRequested()),
    child: const _InventoryView(),
  );
}

class _InventoryView extends StatefulWidget {
  const _InventoryView();
  @override State<_InventoryView> createState() => _InventoryViewState();
}

class _InventoryViewState extends State<_InventoryView> with SingleTickerProviderStateMixin {
  late final _tabCtrl = TabController(length: 3, vsync: this);
  final _searchCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _tabCtrl.addListener(() {
      if (!_tabCtrl.indexIsChanging) {
        _searchCtrl.clear();
        context.read<InventoryBloc>().add(InventoryTabChanged(_tabCtrl.index));
      }
    });
  }

  @override
  void dispose() { _tabCtrl.dispose(); _searchCtrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<InventoryBloc, InventoryState>(
      builder: (context, state) => Scaffold(
        backgroundColor: AppColors.background,
        floatingActionButton: state.tab == 2 ? null : FloatingActionButton(
          heroTag: 'inv-add',
          backgroundColor: AppColors.primary,
          onPressed: () => state.tab == 0 ? _showPaperForm(context, state) : _showItemForm(context),
          child: const Icon(Icons.add, color: Colors.white),
        ),
        body: Column(children: [
          TabBar(
            controller: _tabCtrl,
            tabs: const [Tab(text: 'Paper Stock'), Tab(text: 'Ink & Plates'), Tab(text: 'Transactions')],
            labelColor: AppColors.primary,
            unselectedLabelColor: AppColors.textMuted,
            indicatorColor: AppColors.primary,
          ),
          // Search bar (hidden on transactions tab)
          if (state.tab != 2) Padding(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 4),
            child: TextField(
              controller: _searchCtrl,
              onChanged: (v) {
                if (state.tab == 0) context.read<InventoryBloc>().add(PaperSearchChanged(v));
                else context.read<InventoryBloc>().add(ItemsSearchChanged(v));
              },
              decoration: InputDecoration(
                hintText: state.tab == 0 ? 'Search paper stock…' : 'Search items…',
                prefixIcon: const Icon(Icons.search, size: 20),
                isDense: true,
                suffixIcon: _searchCtrl.text.isNotEmpty ? IconButton(icon: const Icon(Icons.clear, size: 18), onPressed: () { _searchCtrl.clear(); if (state.tab == 0) context.read<InventoryBloc>().add(const PaperSearchChanged('')); else context.read<InventoryBloc>().add(const ItemsSearchChanged('')); }) : null,
              ),
            ),
          ),
          // In House / External toggle for paper tab
          if (state.tab == 0) Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 4),
            child: Row(children: [
              _poolChip(context, state, 'in_house', 'In House'),
              const SizedBox(width: 8),
              _poolChip(context, state, 'external', 'External'),
            ]),
          ),
          Expanded(child: TabBarView(
            controller: _tabCtrl,
            children: [_PaperTab(state: state, onEdit: (p) => _showPaperForm(context, state, existing: p), onRecord: (p) => _showTxnForm(context, paperId: p.id, name: p.name)), _ItemsTab(state: state, onEdit: (item) => _showItemForm(context, existing: item), onRecord: (item) => _showTxnForm(context, itemId: item.id, name: item.name)), _TransactionsTab(state: state)],
          )),
        ]),
      ),
    );
  }

  Widget _poolChip(BuildContext context, InventoryState state, String type, String label) {
    final selected = state.paperInvType == type;
    return GestureDetector(
      onTap: () { if (!selected) context.read<InventoryBloc>().add(PaperInvTypeChanged(type)); },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: selected ? AppColors.primary : AppColors.borderLight,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(label, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: selected ? Colors.white : AppColors.textMuted)),
      ),
    );
  }

  void _showPaperForm(BuildContext context, InventoryState state, {PaperStock? existing}) {
    final bloc = context.read<InventoryBloc>();
    final nameCtrl = TextEditingController(text: existing?.name);
    final brandCtrl = TextEditingController(text: existing?.brand);
    final gsmCtrl = TextEditingController(text: existing?.gsm?.toString());
    final sizeCtrl = TextEditingController(text: existing?.size);
    final unitCtrl = TextEditingController(text: existing?.unit ?? 'sheets');
    final qtyCtrl = TextEditingController(text: existing?.quantity.toStringAsFixed(0));
    final threshCtrl = TextEditingController(text: existing?.lowStockThreshold?.toStringAsFixed(0));
    final costCtrl = TextEditingController(text: existing?.costPerUnit?.toStringAsFixed(2));
    String invType = existing?.inventoryType ?? state.paperInvType;
    bool saving = false;

    showModalBottomSheet(
      context: context, isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => StatefulBuilder(builder: (ctx, setModal) => SafeArea(
        child: Padding(
          padding: EdgeInsets.only(left: 20, right: 20, top: 20, bottom: MediaQuery.of(ctx).viewInsets.bottom + 20),
          child: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text(existing == null ? 'Add Paper Stock' : 'Edit Paper Stock', style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
            const SizedBox(height: 16),
            TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Name *')),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(child: TextField(controller: brandCtrl, decoration: const InputDecoration(labelText: 'Brand'))),
              const SizedBox(width: 12),
              Expanded(child: TextField(controller: gsmCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'GSM'))),
            ]),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(child: TextField(controller: sizeCtrl, decoration: const InputDecoration(labelText: 'Size', hintText: 'e.g. A4, 28x40'))),
              const SizedBox(width: 12),
              Expanded(child: TextField(controller: unitCtrl, decoration: const InputDecoration(labelText: 'Unit'))),
            ]),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(child: TextField(controller: qtyCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Quantity'))),
              const SizedBox(width: 12),
              Expanded(child: TextField(controller: threshCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Reorder Level'))),
            ]),
            const SizedBox(height: 12),
            TextField(controller: costCtrl, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'Cost / Unit (₹)', prefixText: '₹ ')),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              value: invType,
              decoration: const InputDecoration(labelText: 'Inventory Pool'),
              items: const [
                DropdownMenuItem(value: 'in_house', child: Text('In House')),
                DropdownMenuItem(value: 'external', child: Text('External')),
              ],
              onChanged: (v) => setModal(() => invType = v ?? 'in_house'),
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.secondary),
              onPressed: saving || nameCtrl.text.isEmpty ? null : () async {
                setModal(() => saving = true);
                try {
                  final data = {
                    'name': nameCtrl.text,
                    if (brandCtrl.text.isNotEmpty) 'brand': brandCtrl.text,
                    if (gsmCtrl.text.isNotEmpty) 'gsm': int.tryParse(gsmCtrl.text),
                    if (sizeCtrl.text.isNotEmpty) 'size': sizeCtrl.text,
                    'unit': unitCtrl.text.isNotEmpty ? unitCtrl.text : 'sheets',
                    'quantity': double.tryParse(qtyCtrl.text) ?? 0,
                    'lowStockThreshold': double.tryParse(threshCtrl.text) ?? 100,
                    if (costCtrl.text.isNotEmpty) 'costPerUnit': double.tryParse(costCtrl.text),
                    'inventoryType': invType,
                  };
                  if (existing == null) {
                    await ApiClient.instance.post('/admin/inventory/paper', data: data);
                    AppToast.success('Paper stock added');
                  } else {
                    await ApiClient.instance.patch('/admin/inventory/paper/${existing.id}', data: data);
                    AppToast.success('Paper stock updated');
                  }
                  if (ctx.mounted) Navigator.pop(ctx);
                  bloc.add(const PaperLoadRequested());
                } catch (_) { AppToast.error('Failed to save'); setModal(() => saving = false); }
              },
              child: saving ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : Text(existing == null ? 'Add Paper' : 'Save'),
            ),
          ])),
        ),
      )),
    );
  }

  void _showItemForm(BuildContext context, {InventoryItem? existing}) {
    final bloc = context.read<InventoryBloc>();
    final nameCtrl = TextEditingController(text: existing?.name);
    final unitCtrl = TextEditingController(text: existing?.unit ?? 'pcs');
    final qtyCtrl = TextEditingController(text: existing?.quantity.toStringAsFixed(0));
    final threshCtrl = TextEditingController(text: existing?.lowStockThreshold?.toStringAsFixed(0));
    String category = existing?.category ?? 'ink';
    bool saving = false;

    showModalBottomSheet(
      context: context, isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => StatefulBuilder(builder: (ctx, setModal) => SafeArea(
        child: Padding(
          padding: EdgeInsets.only(left: 20, right: 20, top: 20, bottom: MediaQuery.of(ctx).viewInsets.bottom + 20),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text(existing == null ? 'Add Item' : 'Edit Item', style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
            const SizedBox(height: 16),
            TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Name *')),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              value: category,
              decoration: const InputDecoration(labelText: 'Category'),
              items: const [
                DropdownMenuItem(value: 'ink', child: Text('Ink')),
                DropdownMenuItem(value: 'plate', child: Text('Plate')),
                DropdownMenuItem(value: 'consumable', child: Text('Consumable')),
                DropdownMenuItem(value: 'other', child: Text('Other')),
              ],
              onChanged: (v) => setModal(() => category = v ?? 'ink'),
            ),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(child: TextField(controller: unitCtrl, decoration: const InputDecoration(labelText: 'Unit'))),
              const SizedBox(width: 12),
              Expanded(child: TextField(controller: qtyCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Quantity'))),
            ]),
            const SizedBox(height: 12),
            TextField(controller: threshCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Reorder Level')),
            const SizedBox(height: 20),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.secondary),
              onPressed: saving || nameCtrl.text.isEmpty ? null : () async {
                setModal(() => saving = true);
                try {
                  final data = {'name': nameCtrl.text, 'category': category, 'unit': unitCtrl.text.isNotEmpty ? unitCtrl.text : 'pcs', 'quantity': double.tryParse(qtyCtrl.text) ?? 0, 'lowStockThreshold': double.tryParse(threshCtrl.text) ?? 100};
                  if (existing == null) {
                    await ApiClient.instance.post('/admin/inventory/items', data: data);
                    AppToast.success('Item added');
                  } else {
                    await ApiClient.instance.patch('/admin/inventory/items/${existing.id}', data: data);
                    AppToast.success('Item updated');
                  }
                  if (ctx.mounted) Navigator.pop(ctx);
                  bloc.add(const ItemsLoadRequested());
                } catch (_) { AppToast.error('Failed to save'); setModal(() => saving = false); }
              },
              child: saving ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : Text(existing == null ? 'Add Item' : 'Save'),
            ),
          ]),
        ),
      )),
    );
  }

  void _showTxnForm(BuildContext context, {String? paperId, String? itemId, required String name}) {
    final bloc = context.read<InventoryBloc>();
    String txType = 'in';
    final qtyCtrl = TextEditingController();
    final notesCtrl = TextEditingController();
    bool saving = false;

    showModalBottomSheet(
      context: context, isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => StatefulBuilder(builder: (ctx, setModal) => SafeArea(
        child: Padding(
          padding: EdgeInsets.only(left: 20, right: 20, top: 20, bottom: MediaQuery.of(ctx).viewInsets.bottom + 20),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text('Record Transaction', style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
            const SizedBox(height: 4),
            Text(name, style: const TextStyle(fontSize: 13, color: AppColors.textMuted)),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              value: txType,
              decoration: const InputDecoration(labelText: 'Transaction Type'),
              items: const [
                DropdownMenuItem(value: 'in', child: Text('Stock In')),
                DropdownMenuItem(value: 'out', child: Text('Stock Out')),
                DropdownMenuItem(value: 'wastage', child: Text('Wastage')),
                DropdownMenuItem(value: 'adjustment', child: Text('Adjustment')),
              ],
              onChanged: (v) => setModal(() => txType = v ?? 'in'),
            ),
            const SizedBox(height: 12),
            TextField(controller: qtyCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Quantity *')),
            const SizedBox(height: 12),
            TextField(controller: notesCtrl, decoration: const InputDecoration(labelText: 'Notes (optional)')),
            const SizedBox(height: 20),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.secondary),
              onPressed: saving || qtyCtrl.text.isEmpty ? null : () async {
                setModal(() => saving = true);
                try {
                  await ApiClient.instance.post('/admin/inventory/transactions', data: {
                    if (paperId != null) 'paperStockId': paperId,
                    if (itemId != null) 'inventoryItemId': itemId,
                    'type': txType,
                    'quantity': double.tryParse(qtyCtrl.text) ?? 0,
                    if (notesCtrl.text.isNotEmpty) 'notes': notesCtrl.text,
                  });
                  AppToast.success('Transaction recorded');
                  if (ctx.mounted) Navigator.pop(ctx);
                  bloc.add(const PaperLoadRequested());
                  bloc.add(const ItemsLoadRequested());
                  bloc.add(const TransactionsLoadRequested());
                } catch (_) { AppToast.error('Failed to record transaction'); setModal(() => saving = false); }
              },
              child: saving ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Text('Record'),
            ),
          ]),
        ),
      )),
    );
  }
}

// ── Paper tab ─────────────────────────────────────────────
class _PaperTab extends StatelessWidget {
  final InventoryState state;
  final void Function(PaperStock) onEdit;
  final void Function(PaperStock) onRecord;
  const _PaperTab({required this.state, required this.onEdit, required this.onRecord});

  @override
  Widget build(BuildContext context) {
    if (state.papersLoading) return const ShimmerList(count: 6, itemBuilder: ShimmerCard.new);
    if (state.papers.isEmpty) return Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
      const Icon(Icons.inventory_2_outlined, size: 56, color: AppColors.textMuted),
      const SizedBox(height: 12),
      Text('No ${state.paperInvType == 'external' ? 'external' : 'in-house'} paper stock', style: const TextStyle(color: AppColors.textMuted)),
    ]));

    return RefreshIndicator(
      onRefresh: () async => context.read<InventoryBloc>().add(const PaperLoadRequested()),
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
        itemCount: state.papers.length,
        itemBuilder: (_, i) => _PaperCard(paper: state.papers[i], onEdit: () => onEdit(state.papers[i]), onRecord: () => onRecord(state.papers[i])),
      ),
    );
  }
}

class _PaperCard extends StatelessWidget {
  final PaperStock paper;
  final VoidCallback onEdit;
  final VoidCallback onRecord;
  const _PaperCard({required this.paper, required this.onEdit, required this.onRecord});

  @override
  Widget build(BuildContext context) {
    final low = paper.isLowStock;
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(padding: const EdgeInsets.all(14), child: Row(children: [
        Container(width: 4, height: 56, decoration: BoxDecoration(color: low ? AppColors.error : AppColors.primary, borderRadius: BorderRadius.circular(2))),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: Text(paper.name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14))),
            if (low) Container(padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2), decoration: BoxDecoration(color: AppColors.errorLight, borderRadius: BorderRadius.circular(5)), child: const Text('LOW', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: AppColors.error))),
          ]),
          if (paper.brand != null || paper.gsm != null || paper.size != null)
            Text([if (paper.brand != null) paper.brand!, if (paper.gsm != null) '${paper.gsm} GSM', if (paper.size != null) paper.size!].join(' · '), style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
          if (paper.costPerUnit != null) Text('₹${paper.costPerUnit!.toStringAsFixed(2)} / ${paper.unit ?? 'sheet'}', style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
        ])),
        const SizedBox(width: 12),
        Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
          Text(paper.quantity.toStringAsFixed(0), style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: low ? AppColors.error : AppColors.textPrimary)),
          Text(paper.unit ?? 'sheets', style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
        ]),
        PopupMenuButton<String>(
          onSelected: (v) { if (v == 'edit') onEdit(); else if (v == 'txn') onRecord(); },
          itemBuilder: (_) => [
            const PopupMenuItem(value: 'txn', child: Row(children: [Icon(Icons.swap_horiz, size: 18), SizedBox(width: 8), Text('Record Transaction')])),
            const PopupMenuItem(value: 'edit', child: Row(children: [Icon(Icons.edit_outlined, size: 18), SizedBox(width: 8), Text('Edit')])),
          ],
        ),
      ])),
    );
  }
}

// ── Items tab ─────────────────────────────────────────────
class _ItemsTab extends StatelessWidget {
  final InventoryState state;
  final void Function(InventoryItem) onEdit;
  final void Function(InventoryItem) onRecord;
  const _ItemsTab({required this.state, required this.onEdit, required this.onRecord});

  static const _catColors = {'ink': AppColors.primary, 'plate': AppColors.secondary, 'consumable': AppColors.info, 'other': AppColors.textMuted};
  static const _catIcons = {'ink': Icons.water_drop_outlined, 'plate': Icons.layers_outlined, 'consumable': Icons.category_outlined, 'other': Icons.inventory_outlined};

  @override
  Widget build(BuildContext context) {
    if (state.itemsLoading) return const ShimmerList(count: 6, itemBuilder: ShimmerCard.new);
    if (state.items.isEmpty) return const Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [Icon(Icons.category_outlined, size: 56, color: AppColors.textMuted), SizedBox(height: 12), Text('No items', style: TextStyle(color: AppColors.textMuted))]));

    return RefreshIndicator(
      onRefresh: () async => context.read<InventoryBloc>().add(const ItemsLoadRequested()),
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
        itemCount: state.items.length,
        itemBuilder: (_, i) {
          final item = state.items[i];
          final color = _catColors[item.category] ?? AppColors.textMuted;
          final icon = _catIcons[item.category] ?? Icons.inventory_outlined;
          final low = item.isLowStock;
          return Card(
            margin: const EdgeInsets.only(bottom: 8),
            child: ListTile(
              leading: CircleAvatar(backgroundColor: color.withValues(alpha: 0.12), child: Icon(icon, color: color, size: 20)),
              title: Row(children: [
                Expanded(child: Text(item.name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13))),
                if (low) Container(padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2), decoration: BoxDecoration(color: AppColors.errorLight, borderRadius: BorderRadius.circular(5)), child: const Text('LOW', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: AppColors.error))),
              ]),
              subtitle: Text(item.category[0].toUpperCase() + item.category.substring(1), style: const TextStyle(fontSize: 12)),
              trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.end, children: [
                  Text(item.quantity.toStringAsFixed(0), style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: low ? AppColors.error : AppColors.textPrimary)),
                  Text(item.unit ?? 'units', style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
                ]),
                PopupMenuButton<String>(
                  onSelected: (v) { if (v == 'edit') onEdit(item); else if (v == 'txn') onRecord(item); },
                  itemBuilder: (_) => [
                    const PopupMenuItem(value: 'txn', child: Row(children: [Icon(Icons.swap_horiz, size: 18), SizedBox(width: 8), Text('Record Transaction')])),
                    const PopupMenuItem(value: 'edit', child: Row(children: [Icon(Icons.edit_outlined, size: 18), SizedBox(width: 8), Text('Edit')])),
                  ],
                ),
              ]),
            ),
          );
        },
      ),
    );
  }
}

// ── Transactions tab ──────────────────────────────────────
class _TransactionsTab extends StatelessWidget {
  final InventoryState state;
  const _TransactionsTab({required this.state});

  static const _typeColors = {'in': AppColors.success, 'out': AppColors.primary, 'adjustment': AppColors.warning, 'wastage': AppColors.error};
  static const _typeIcons = {'in': Icons.arrow_downward, 'out': Icons.arrow_upward, 'adjustment': Icons.tune, 'wastage': Icons.delete_outline};

  @override
  Widget build(BuildContext context) {
    if (state.txLoading) return const ShimmerList(count: 8, itemBuilder: ShimmerRow.new);
    if (state.transactions.isEmpty) {
      return Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        const Icon(Icons.swap_horiz, size: 56, color: AppColors.textMuted),
        const SizedBox(height: 12),
        const Text('No transactions yet', style: TextStyle(color: AppColors.textMuted)),
        const SizedBox(height: 16),
        ElevatedButton(style: ElevatedButton.styleFrom(backgroundColor: AppColors.secondary), onPressed: () => context.read<InventoryBloc>().add(const TransactionsLoadRequested()), child: const Text('Refresh')),
      ]));
    }

    return RefreshIndicator(
      onRefresh: () async => context.read<InventoryBloc>().add(const TransactionsLoadRequested()),
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 80),
        itemCount: state.transactions.length + 1,
        itemBuilder: (_, i) {
          if (i == state.transactions.length) {
            if (state.txLoadingMore) return const Padding(padding: EdgeInsets.all(16), child: Center(child: CircularProgressIndicator(strokeWidth: 2)));
            if (state.txHasMore) return Padding(padding: const EdgeInsets.symmetric(vertical: 8), child: Center(child: TextButton(onPressed: () => context.read<InventoryBloc>().add(const TransactionsNextPage()), child: const Text('Load more'))));
            return const SizedBox.shrink();
          }
          final tx = state.transactions[i];
          final type = tx['type'] as String? ?? 'out';
          final color = _typeColors[type] ?? AppColors.textMuted;
          final icon = _typeIcons[type] ?? Icons.swap_horiz;
          final qty = double.tryParse(tx['quantity']?.toString() ?? '0') ?? 0;
          final isOut = type == 'out' || type == 'wastage';

          return Card(
            margin: const EdgeInsets.only(bottom: 6),
            child: ListTile(
              dense: true,
              leading: CircleAvatar(radius: 18, backgroundColor: color.withValues(alpha: 0.12), child: Icon(icon, color: color, size: 16)),
              title: Row(children: [
                Expanded(child: Text(tx['paper_name'] as String? ?? tx['item_name'] as String? ?? 'Unknown', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600), maxLines: 1, overflow: TextOverflow.ellipsis)),
                Text('${isOut ? "-" : "+"}${qty.toStringAsFixed(0)}', style: TextStyle(fontWeight: FontWeight.w800, color: color, fontSize: 14)),
              ]),
              subtitle: Row(children: [
                Container(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1), decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(4)), child: Text(type.toUpperCase(), style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: color))),
                const SizedBox(width: 8),
                if (tx['notes'] != null) Expanded(child: Text(tx['notes'] as String, style: const TextStyle(fontSize: 11, color: AppColors.textMuted), maxLines: 1, overflow: TextOverflow.ellipsis)),
              ]),
              trailing: Text(_fmtDate(tx['transacted_at'] as String?), style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
            ),
          );
        },
      ),
    );
  }

  String _fmtDate(String? v) {
    if (v == null) return '—';
    try {
      final d = DateTime.parse(v).toLocal();
      return '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}';
    } catch (_) { return '—'; }
  }
}
