import 'package:equatable/equatable.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../core/network/api_client.dart';
import '../../core/theme/app_theme.dart';
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

  const PaperStock({required this.id, required this.name, this.brand, this.gsm, this.size, this.unit, required this.quantity, this.lowStockThreshold, this.costPerUnit});

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
class PaperLoadRequested extends InventoryEvent { const PaperLoadRequested(); }
class PaperSearchChanged extends InventoryEvent { final String q; const PaperSearchChanged(this.q); @override List<Object?> get props => [q]; }
class ItemsLoadRequested extends InventoryEvent { const ItemsLoadRequested(); }
class ItemsSearchChanged extends InventoryEvent { final String q; const ItemsSearchChanged(this.q); @override List<Object?> get props => [q]; }

class InventoryState extends Equatable {
  final int tab;
  final List<PaperStock> papers;
  final bool papersLoading;
  final String paperSearch;
  final List<InventoryItem> items;
  final bool itemsLoading;
  final String itemSearch;
  final int lowStockCount;
  final String? error;

  const InventoryState({this.tab = 0, this.papers = const [], this.papersLoading = false, this.paperSearch = '', this.items = const [], this.itemsLoading = false, this.itemSearch = '', this.lowStockCount = 0, this.error});

  InventoryState copyWith({int? tab, List<PaperStock>? papers, bool? papersLoading, String? paperSearch, List<InventoryItem>? items, bool? itemsLoading, String? itemSearch, int? lowStockCount, String? error}) => InventoryState(
    tab: tab ?? this.tab, papers: papers ?? this.papers, papersLoading: papersLoading ?? this.papersLoading, paperSearch: paperSearch ?? this.paperSearch,
    items: items ?? this.items, itemsLoading: itemsLoading ?? this.itemsLoading, itemSearch: itemSearch ?? this.itemSearch,
    lowStockCount: lowStockCount ?? this.lowStockCount, error: error ?? this.error,
  );

  @override List<Object?> get props => [tab, papers, papersLoading, items, itemsLoading];
}

// ── BLoC ─────────────────────────────────────────────────
class InventoryBloc extends Bloc<InventoryEvent, InventoryState> {
  InventoryBloc() : super(const InventoryState()) {
    on<InventoryTabChanged>(_onTab);
    on<PaperLoadRequested>(_onLoadPaper);
    on<PaperSearchChanged>(_onSearchPaper);
    on<ItemsLoadRequested>(_onLoadItems);
    on<ItemsSearchChanged>(_onSearchItems);
  }

  Future<void> _onTab(InventoryTabChanged event, Emitter<InventoryState> emit) async {
    emit(state.copyWith(tab: event.tab));
    if (event.tab == 0 && state.papers.isEmpty) add(const PaperLoadRequested());
    if (event.tab == 1 && state.items.isEmpty) add(const ItemsLoadRequested());
  }

  Future<void> _onLoadPaper(PaperLoadRequested _, Emitter<InventoryState> emit) async {
    emit(state.copyWith(papersLoading: true));
    try {
      final res = await ApiClient.instance.get('/admin/inventory/paper', queryParameters: {'limit': 100, if (state.paperSearch.isNotEmpty) 'search': state.paperSearch});
      final r = PaginatedResult.fromJson(res.data as Map<String, dynamic>, PaperStock.fromJson);
      final lowCount = r.data.where((p) => p.isLowStock).length;
      emit(state.copyWith(papers: r.data, papersLoading: false, lowStockCount: lowCount));
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
  late final _tabCtrl = TabController(length: 2, vsync: this);
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
        appBar: AppBar(
          title: Row(children: [
            const Text('Inventory'),
            if (state.lowStockCount > 0) ...[
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(color: AppColors.error, borderRadius: BorderRadius.circular(10)),
                child: Text('${state.lowStockCount} low stock', style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700)),
              ),
            ],
          ]),
          backgroundColor: AppColors.surface, surfaceTintColor: Colors.transparent,
          bottom: TabBar(
            controller: _tabCtrl,
            tabs: const [Tab(text: 'Paper Stock'), Tab(text: 'Ink & Plates')],
            labelColor: AppColors.primary, unselectedLabelColor: AppColors.textMuted, indicatorColor: AppColors.primary,
          ),
        ),
        body: Column(children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: TextField(
              controller: _searchCtrl,
              onChanged: (v) {
                if (state.tab == 0) context.read<InventoryBloc>().add(PaperSearchChanged(v));
                else context.read<InventoryBloc>().add(ItemsSearchChanged(v));
              },
              decoration: InputDecoration(
                hintText: state.tab == 0 ? 'Search paper stock…' : 'Search items…',
                prefixIcon: const Icon(Icons.search, size: 20), isDense: true,
                suffixIcon: _searchCtrl.text.isNotEmpty ? IconButton(icon: const Icon(Icons.clear, size: 18), onPressed: () { _searchCtrl.clear(); if (state.tab == 0) context.read<InventoryBloc>().add(const PaperSearchChanged('')); else context.read<InventoryBloc>().add(const ItemsSearchChanged('')); }) : null,
              ),
            ),
          ),
          Expanded(child: TabBarView(
            controller: _tabCtrl,
            children: [_PaperTab(state: state), _ItemsTab(state: state)],
          )),
        ]),
      ),
    );
  }
}

// ── Paper tab ─────────────────────────────────────────────
class _PaperTab extends StatelessWidget {
  final InventoryState state;
  const _PaperTab({required this.state});

  @override
  Widget build(BuildContext context) {
    if (state.papersLoading) return const Center(child: CircularProgressIndicator());
    if (state.papers.isEmpty) return const Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [Icon(Icons.inventory_2_outlined, size: 56, color: AppColors.textMuted), SizedBox(height: 12), Text('No paper stock', style: TextStyle(color: AppColors.textMuted))]));

    return RefreshIndicator(
      onRefresh: () async => context.read<InventoryBloc>().add(const PaperLoadRequested()),
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 80),
        itemCount: state.papers.length,
        itemBuilder: (_, i) => _PaperCard(paper: state.papers[i]),
      ),
    );
  }
}

class _PaperCard extends StatelessWidget {
  final PaperStock paper;
  const _PaperCard({required this.paper});

  @override
  Widget build(BuildContext context) {
    final low = paper.isLowStock;
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(children: [
          Container(
            width: 4, height: 56,
            decoration: BoxDecoration(color: low ? AppColors.error : AppColors.primary, borderRadius: BorderRadius.circular(2)),
          ),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(child: Text(paper.name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14))),
              if (low) Container(padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2), decoration: BoxDecoration(color: AppColors.errorLight, borderRadius: BorderRadius.circular(5)), child: const Text('LOW', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: AppColors.error))),
            ]),
            if (paper.brand != null || paper.gsm != null)
              Text([if (paper.brand != null) paper.brand!, if (paper.gsm != null) '${paper.gsm} GSM', if (paper.size != null) paper.size!].join(' · '), style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
          ])),
          const SizedBox(width: 12),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Text('${paper.quantity.toStringAsFixed(0)}', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: low ? AppColors.error : AppColors.textPrimary)),
            Text(paper.unit ?? 'sheets', style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
          ]),
        ]),
      ),
    );
  }
}

// ── Items tab ─────────────────────────────────────────────
class _ItemsTab extends StatelessWidget {
  final InventoryState state;
  const _ItemsTab({required this.state});

  static const _catColors = {
    'ink': AppColors.primary, 'plate': AppColors.secondary, 'consumable': AppColors.info, 'other': AppColors.textMuted,
  };
  static const _catIcons = {
    'ink': Icons.water_drop_outlined, 'plate': Icons.layers_outlined, 'consumable': Icons.category_outlined, 'other': Icons.inventory_outlined,
  };

  @override
  Widget build(BuildContext context) {
    if (state.itemsLoading) return const Center(child: CircularProgressIndicator());
    if (state.items.isEmpty) return const Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [Icon(Icons.category_outlined, size: 56, color: AppColors.textMuted), SizedBox(height: 12), Text('No items', style: TextStyle(color: AppColors.textMuted))]));

    return RefreshIndicator(
      onRefresh: () async => context.read<InventoryBloc>().add(const ItemsLoadRequested()),
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 80),
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
              trailing: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('${item.quantity.toStringAsFixed(0)}', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: low ? AppColors.error : AppColors.textPrimary)),
                Text(item.unit ?? 'units', style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
              ]),
            ),
          );
        },
      ),
    );
  }
}
