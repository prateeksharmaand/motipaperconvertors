import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:equatable/equatable.dart';
import 'package:bloc/bloc.dart';
import '../../core/network/api_client.dart';
import '../../core/theme/app_theme.dart';
import '../../models/pagination_model.dart';

// ── Model ─────────────────────────────────────────────────
class Client extends Equatable {
  final String id;
  final String name;
  final String? companyName;
  final String? phone;
  final String? email;
  final String? city;
  final String? gstin;
  final String status;
  final bool emailReminder;

  const Client({required this.id, required this.name, this.companyName, this.phone, this.email, this.city, this.gstin, required this.status, required this.emailReminder});

  factory Client.fromJson(Map<String, dynamic> j) => Client(
    id: j['id'] as String,
    name: j['name'] as String? ?? '',
    companyName: j['company_name'] as String?,
    phone: j['phone'] as String?,
    email: j['email'] as String?,
    city: j['city'] as String?,
    gstin: j['gstin'] as String?,
    status: j['status'] as String? ?? 'active',
    emailReminder: j['email_reminder'] as bool? ?? false,
  );

  @override List<Object?> get props => [id];
}

// ── BLoC ─────────────────────────────────────────────────
abstract class ClientsEvent extends Equatable {
  const ClientsEvent();
  @override List<Object?> get props => [];
}
class ClientsLoadRequested extends ClientsEvent { const ClientsLoadRequested(); }
class ClientsSearchChanged extends ClientsEvent {
  final String query;
  const ClientsSearchChanged(this.query);
  @override List<Object?> get props => [query];
}
class ClientsNextPage extends ClientsEvent { const ClientsNextPage(); }
class ClientDeleted extends ClientsEvent {
  final String id;
  const ClientDeleted(this.id);
  @override List<Object?> get props => [id];
}

class ClientsState extends Equatable {
  final List<Client> clients;
  final bool isLoading, isLoadingMore, hasMore;
  final int page, total;
  final String search;
  final String? error;
  const ClientsState({this.clients = const [], this.isLoading = false, this.isLoadingMore = false, this.hasMore = false, this.page = 1, this.total = 0, this.search = '', this.error});
  ClientsState copyWith({List<Client>? clients, bool? isLoading, bool? isLoadingMore, bool? hasMore, int? page, int? total, String? search, String? error, bool clearError = false}) =>
      ClientsState(clients: clients ?? this.clients, isLoading: isLoading ?? this.isLoading, isLoadingMore: isLoadingMore ?? this.isLoadingMore, hasMore: hasMore ?? this.hasMore, page: page ?? this.page, total: total ?? this.total, search: search ?? this.search, error: clearError ? null : (error ?? this.error));
  @override List<Object?> get props => [clients, isLoading, page, search];
}

class ClientsBloc extends Bloc<ClientsEvent, ClientsState> {
  ClientsBloc() : super(const ClientsState()) {
    on<ClientsLoadRequested>(_onLoad);
    on<ClientsSearchChanged>(_onSearch);
    on<ClientsNextPage>(_onNextPage);
    on<ClientDeleted>(_onDelete);
  }
  Map<String, dynamic> get _params => {'limit': 20, 'sortBy': 'name', if (state.search.isNotEmpty) 'search': state.search};

  Future<void> _onLoad(ClientsLoadRequested _, Emitter<ClientsState> emit) async {
    emit(state.copyWith(isLoading: true, clearError: true));
    try {
      final res = await ApiClient.instance.get('/admin/clients', queryParameters: {..._params, 'page': 1});
      final r = PaginatedResult.fromJson(res.data as Map<String, dynamic>, Client.fromJson);
      emit(state.copyWith(clients: r.data, isLoading: false, page: 1, total: r.total, hasMore: r.hasMore));
    } catch (e) { emit(state.copyWith(isLoading: false, error: e.toString())); }
  }

  Future<void> _onSearch(ClientsSearchChanged event, Emitter<ClientsState> emit) async {
    emit(state.copyWith(search: event.query));
    await _onLoad(const ClientsLoadRequested(), emit);
  }

  Future<void> _onNextPage(ClientsNextPage _, Emitter<ClientsState> emit) async {
    if (!state.hasMore || state.isLoadingMore) return;
    emit(state.copyWith(isLoadingMore: true));
    try {
      final res = await ApiClient.instance.get('/admin/clients', queryParameters: {..._params, 'page': state.page + 1});
      final r = PaginatedResult.fromJson(res.data as Map<String, dynamic>, Client.fromJson);
      emit(state.copyWith(clients: [...state.clients, ...r.data], isLoadingMore: false, page: state.page + 1, hasMore: r.hasMore));
    } catch (_) { emit(state.copyWith(isLoadingMore: false)); }
  }

  Future<void> _onDelete(ClientDeleted event, Emitter<ClientsState> emit) async {
    try {
      await ApiClient.instance.delete('/admin/clients/${event.id}');
      add(const ClientsLoadRequested());
    } catch (e) { emit(state.copyWith(error: 'Failed to delete client')); }
  }
}

// ── Screen ────────────────────────────────────────────────
class ClientsScreen extends StatelessWidget {
  const ClientsScreen({super.key});
  @override
  Widget build(BuildContext context) => BlocProvider(
        create: (_) => ClientsBloc()..add(const ClientsLoadRequested()),
        child: const _ClientsView(),
      );
}

class _ClientsView extends StatefulWidget {
  const _ClientsView();
  @override State<_ClientsView> createState() => _ClientsViewState();
}

class _ClientsViewState extends State<_ClientsView> {
  final _searchCtrl = TextEditingController();
  final _scrollCtrl = ScrollController();
  @override
  void initState() {
    super.initState();
    _scrollCtrl.addListener(() {
      if (_scrollCtrl.position.pixels >= _scrollCtrl.position.maxScrollExtent - 200) {
        context.read<ClientsBloc>().add(const ClientsNextPage());
      }
    });
  }
  @override void dispose() { _searchCtrl.dispose(); _scrollCtrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: BlocBuilder<ClientsBloc, ClientsState>(
        builder: (context, state) => RefreshIndicator(
          onRefresh: () async => context.read<ClientsBloc>().add(const ClientsLoadRequested()),
          child: CustomScrollView(controller: _scrollCtrl, slivers: [
            SliverAppBar(
              floating: true, title: const Text('Clients'),
              backgroundColor: AppColors.surface, surfaceTintColor: Colors.transparent,
              bottom: PreferredSize(
                preferredSize: const Size.fromHeight(56),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                  child: TextField(
                    controller: _searchCtrl,
                    onChanged: (v) => context.read<ClientsBloc>().add(ClientsSearchChanged(v)),
                    decoration: InputDecoration(
                      hintText: 'Search name, phone, company…',
                      prefixIcon: const Icon(Icons.search, size: 20),
                      isDense: true,
                      suffixIcon: _searchCtrl.text.isNotEmpty
                          ? IconButton(icon: const Icon(Icons.clear, size: 18), onPressed: () { _searchCtrl.clear(); context.read<ClientsBloc>().add(const ClientsSearchChanged('')); })
                          : null,
                    ),
                  ),
                ),
              ),
            ),
            SliverToBoxAdapter(child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
              child: Text('${state.total} clients', style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
            )),
            if (state.isLoading)
              const SliverFillRemaining(child: Center(child: CircularProgressIndicator()))
            else if (state.clients.isEmpty)
              SliverFillRemaining(child: Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                const Icon(Icons.people_outline, size: 56, color: AppColors.textMuted),
                const SizedBox(height: 12),
                Text(state.search.isNotEmpty ? 'No clients match "${state.search}"' : 'No clients yet', style: const TextStyle(color: AppColors.textMuted)),
              ])))
            else
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                sliver: SliverList(delegate: SliverChildBuilderDelegate(
                  (_, i) {
                    if (i == state.clients.length) {
                      return state.isLoadingMore ? const Padding(padding: EdgeInsets.all(16), child: Center(child: CircularProgressIndicator(strokeWidth: 2))) : const SizedBox.shrink();
                    }
                    return _ClientTile(client: state.clients[i]);
                  },
                  childCount: state.clients.length + 1,
                )),
              ),
          ]),
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showClientForm(context),
        icon: const Icon(Icons.add),
        label: const Text('New Client'),
      ),
    );
  }

  void _showClientForm(BuildContext context, [Client? existing]) {
    final bloc = context.read<ClientsBloc>();
    final nameCtrl = TextEditingController(text: existing?.name);
    final companyCtrl = TextEditingController(text: existing?.companyName);
    final phoneCtrl = TextEditingController(text: existing?.phone);
    final emailCtrl = TextEditingController(text: existing?.email);
    final cityCtrl = TextEditingController(text: existing?.city);
    bool saving = false;

    showModalBottomSheet(
      context: context, isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => StatefulBuilder(builder: (ctx, setModal) {
        return Padding(
          padding: EdgeInsets.only(left: 20, right: 20, top: 20, bottom: MediaQuery.of(ctx).viewInsets.bottom + 20),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text(existing == null ? 'New Client' : 'Edit Client', style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
            const SizedBox(height: 16),
            TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Name *')),
            const SizedBox(height: 12),
            TextField(controller: companyCtrl, decoration: const InputDecoration(labelText: 'Company Name')),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(child: TextField(controller: phoneCtrl, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Phone'))),
              const SizedBox(width: 12),
              Expanded(child: TextField(controller: emailCtrl, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'Email'))),
            ]),
            const SizedBox(height: 12),
            TextField(controller: cityCtrl, decoration: const InputDecoration(labelText: 'City')),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: saving || nameCtrl.text.isEmpty ? null : () async {
                setModal(() => saving = true);
                try {
                  final data = {'name': nameCtrl.text, 'companyName': companyCtrl.text, 'phone': phoneCtrl.text, 'email': emailCtrl.text, 'city': cityCtrl.text};
                  if (existing == null) {
                    await ApiClient.instance.post('/admin/clients', data: data);
                  } else {
                    await ApiClient.instance.patch('/admin/clients/${existing.id}', data: data);
                  }
                  if (ctx.mounted) Navigator.pop(ctx);
                  bloc.add(const ClientsLoadRequested());
                } catch (_) {
                  setModal(() => saving = false);
                }
              },
              child: saving ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : Text(existing == null ? 'Create Client' : 'Save Changes'),
            ),
          ]),
        );
      }),
    );
  }
}

class _ClientTile extends StatelessWidget {
  final Client client;
  const _ClientTile({required this.client});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        leading: CircleAvatar(
          backgroundColor: AppColors.primaryLight,
          child: Text((client.companyName ?? client.name).substring(0, 1).toUpperCase(),
              style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w700)),
        ),
        title: Text(client.companyName ?? client.name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
        subtitle: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          if (client.companyName != null) Text(client.name, style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
          if (client.phone != null) Text(client.phone!, style: const TextStyle(fontSize: 12)),
        ]),
        trailing: PopupMenuButton<String>(
          onSelected: (v) {
            if (v == 'delete') {
              showDialog(context: context, builder: (_) => AlertDialog(
                title: const Text('Delete Client?'),
                content: const Text('This cannot be undone.'),
                actions: [
                  TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
                  ElevatedButton(style: ElevatedButton.styleFrom(backgroundColor: AppColors.error), onPressed: () { Navigator.pop(context); context.read<ClientsBloc>().add(ClientDeleted(client.id)); }, child: const Text('Delete')),
                ],
              ));
            }
          },
          itemBuilder: (_) => [
            const PopupMenuItem(value: 'delete', child: Row(children: [Icon(Icons.delete_outline, color: AppColors.error, size: 18), SizedBox(width: 8), Text('Delete', style: TextStyle(color: AppColors.error))])),
          ],
        ),
      ),
    );
  }
}
