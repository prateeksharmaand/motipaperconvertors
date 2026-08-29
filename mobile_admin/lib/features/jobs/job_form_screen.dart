import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../core/network/api_client.dart';
import '../../core/utils/app_toast.dart';
import '../../core/theme/app_theme.dart';
import '../../models/job_model.dart';

// ── Form data class ────────────────────────────────────────
class JobFormData {
  String? clientId;
  String? machineId;
  String jobType = '';
  String orderType = 'in_house';
  int? quantity;
  String? sheetSize;
  int? sheetCount;
  int? paperGsm;
  String? description;
  int colorsFont = 4;
  int colorsBack = 0;
  bool isOffset = true;
  bool isDigital = false;
  bool isScreen = false;
  int plateCount = 0;
  double? plateCost;
  String? plateSource;
  double? dieCost;
  double? helaCost;
  double? otherCost;
  double? composingAmount;
  bool isNumbering = false;
  int? numberingFrom;
  int? numberingTo;
  bool isBinding = false;
  bool isUV = false;
  bool isFoil = false;
  bool isDieCutting = false;
  bool isHalfCutting = false;
  bool isCreasing = false;
  bool isPasting = false;
  bool isLamination = false;
  String? laminationType;
  bool isFolding = false;
  bool isGumming = false;
  String? printOperatorId;
  String? designerId;
  String? bindingOperatorId;
  String? packingOperatorId;
  String? qcOperatorId;
  double? quotedPrice;
  double? advanceAmount;
  double? approvedRate;
  String? dueDate;
  bool proofRequired = false;
  List<({String paperStockId, int sheetCount, String? paperName})> papers = [];

  Map<String, dynamic> toJson() => {
    if (clientId != null) 'clientId': clientId,
    if (machineId != null) 'machineId': machineId,
    'jobType': jobType,
    'orderType': orderType,
    if (quantity != null) 'quantity': quantity,
    if (sheetSize != null) 'sheetSize': sheetSize,
    if (sheetCount != null) 'sheetCount': sheetCount,
    if (paperGsm != null) 'paperGsm': paperGsm,
    if (description != null && description!.isNotEmpty) 'description': description,
    'colorsFont': colorsFont,
    'colorsBack': colorsBack,
    'isOffset': isOffset,
    'isDigital': isDigital,
    'isScreen': isScreen,
    'plateCount': plateCount,
    if (plateCost != null) 'plateCost': plateCost,
    if (plateSource != null) 'plateSource': plateSource,
    if (dieCost != null) 'dieCost': dieCost,
    if (helaCost != null) 'helaCost': helaCost,
    if (otherCost != null) 'otherCost': otherCost,
    if (composingAmount != null) 'composingAmount': composingAmount,
    'isNumbering': isNumbering,
    if (numberingFrom != null) 'numberingFrom': numberingFrom,
    if (numberingTo != null) 'numberingTo': numberingTo,
    'isBinding': isBinding,
    'isUV': isUV,
    'isFoil': isFoil,
    'isDieCutting': isDieCutting,
    'isHalfCutting': isHalfCutting,
    'isCreasing': isCreasing,
    'isPasting': isPasting,
    'isLamination': isLamination,
    if (isLamination && laminationType != null) 'laminationType': laminationType,
    'isFolding': isFolding,
    'isGumming': isGumming,
    if (printOperatorId != null) 'printOperatorId': printOperatorId,
    if (designerId != null) 'designerId': designerId,
    if (bindingOperatorId != null) 'bindingOperatorId': bindingOperatorId,
    if (packingOperatorId != null) 'packingOperatorId': packingOperatorId,
    if (qcOperatorId != null) 'qcOperatorId': qcOperatorId,
    if (quotedPrice != null) 'quotedPrice': quotedPrice,
    if (advanceAmount != null) 'advanceAmount': advanceAmount,
    if (approvedRate != null) 'approvedRate': approvedRate,
    if (dueDate != null) 'dueDate': dueDate,
    'proofRequired': proofRequired,
    'papers': papers.map((p) => {'paperStockId': p.paperStockId, 'sheetCount': p.sheetCount}).toList(),
  };
}

// ── Drop-down option ───────────────────────────────────────
class _Option { final String id, name; const _Option(this.id, this.name); }

// ── Screen ─────────────────────────────────────────────────
class JobFormScreen extends StatefulWidget {
  final Job? existing; // null = create, non-null = edit
  const JobFormScreen({super.key, this.existing});

  @override
  State<JobFormScreen> createState() => _JobFormScreenState();
}

class _JobFormScreenState extends State<JobFormScreen> {
  final _pageCtrl = PageController();
  int _step = 0;
  bool _saving = false;
  String? _error;

  final _data = JobFormData();

  // Remote data
  List<_Option> _clients = [];
  List<_Option> _machines = [];
  List<_Option> _staff = [];
  List<_Option> _paperStock = [];
  List<String> _jobTypes = [];
  bool _loadingMeta = true;

  @override
  void initState() {
    super.initState();
    _loadMeta();
    if (widget.existing != null) _prefill(widget.existing!);
  }

  void _prefill(Job j) {
    _data.clientId = j.clientId;
    _data.machineId = j.machineId;
    _data.jobType = j.jobType ?? '';
    _data.orderType = j.orderType ?? 'in_house';
    _data.quantity = j.quantity;
    _data.sheetSize = j.sheetSize;
    _data.sheetCount = j.sheetCount;
    _data.isLamination = j.isLamination ?? false;
    _data.laminationType = j.laminationType;
    _data.dueDate = j.dueDate;
    _data.quotedPrice = j.quotedPrice;
    _data.advanceAmount = j.advanceAmount;
    _data.proofRequired = j.proofRequired ?? false;
    _data.printOperatorId = j.printOperatorId;
    _data.designerId = j.designerId;
    _data.bindingOperatorId = j.bindingOperatorId;
    _data.packingOperatorId = j.packingOperatorId;
    _data.qcOperatorId = j.qcOperatorId;
    _data.papers = j.papers.map((p) => (paperStockId: p.paperStockId, sheetCount: p.sheetCount, paperName: p.paperName)).toList();
  }

  Future<void> _loadMeta() async {
    try {
      final results = await Future.wait([
        ApiClient.instance.get('/admin/clients', queryParameters: {'limit': 200}),
        ApiClient.instance.get('/admin/machines', queryParameters: {'limit': 100}),
        ApiClient.instance.get('/admin/users', queryParameters: {'limit': 200, 'status': 'active'}),
        ApiClient.instance.get('/admin/inventory/paper', queryParameters: {'limit': 200}),
        ApiClient.instance.get('/admin/settings/job-types'),
      ]);
      if (!mounted) return;
      setState(() {
        _clients = (results[0].data['data'] as List? ?? []).map((e) => _Option(e['id'] as String, e['company_name'] as String? ?? e['name'] as String? ?? '')).toList();
        _machines = (results[1].data['data'] as List? ?? []).map((e) => _Option(e['id'] as String, e['name'] as String? ?? '')).toList();
        _staff = (results[2].data['data'] as List? ?? []).map((e) => _Option(e['id'] as String, e['name'] as String? ?? '')).toList();
        _paperStock = (results[3].data['data'] as List? ?? []).map((e) => _Option(e['id'] as String, '${e['name']} ${e['gsm'] != null ? "${e['gsm']}gsm" : ""} ${e['size'] ?? ""}'.trim())).toList();
        _jobTypes = (results[4].data as List? ?? []).map((e) => e['name'] as String? ?? '').where((s) => s.isNotEmpty).toList();
        _loadingMeta = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loadingMeta = false);
    }
  }

  void _next() {
    if (_step < 4) {
      _pageCtrl.nextPage(duration: const Duration(milliseconds: 300), curve: Curves.easeInOut);
      setState(() => _step++);
    } else {
      _submit();
    }
  }

  void _back() {
    if (_step > 0) {
      _pageCtrl.previousPage(duration: const Duration(milliseconds: 300), curve: Curves.easeInOut);
      setState(() => _step--);
    }
  }

  Future<void> _submit() async {
    setState(() { _saving = true; _error = null; });
    try {
      if (widget.existing == null) {
        await ApiClient.instance.post('/admin/jobs', data: _data.toJson());
        AppToast.success('Job card created successfully');
      } else {
        await ApiClient.instance.patch('/admin/jobs/${widget.existing!.id}', data: _data.toJson());
        AppToast.success('Job card updated successfully');
      }
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      AppToast.error('Failed to save job card');
      setState(() { _saving = false; _error = e.toString(); });
    }
  }

  @override
  Widget build(BuildContext context) {
    const steps = ['Basic Info', 'Paper & Print', 'Finishing', 'Assignment', 'Pricing'];

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(
          widget.existing == null ? 'New Job Card' : 'Edit Job Card',
          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 17),
        ),
        backgroundColor: const Color(0xFF1F2937),
        surfaceTintColor: Colors.transparent,
        leading: IconButton(icon: const Icon(Icons.close, color: Colors.white), onPressed: () => Navigator.pop(context)),
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: _loadingMeta
          ? const Center(child: CircularProgressIndicator())
          : Column(children: [
              // Step indicator
              _StepBar(current: _step, steps: steps),
              // Error banner
              if (_error != null)
                Container(color: AppColors.errorLight, padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  child: Row(children: [
                    const Icon(Icons.error_outline, color: AppColors.error, size: 16),
                    const SizedBox(width: 8),
                    Expanded(child: Text(_error!, style: const TextStyle(color: AppColors.error, fontSize: 13))),
                    IconButton(icon: const Icon(Icons.close, size: 16), onPressed: () => setState(() => _error = null)),
                  ])),
              // Pages
              Expanded(child: PageView(
                controller: _pageCtrl,
                physics: const NeverScrollableScrollPhysics(),
                children: [
                  _Step1BasicInfo(data: _data, clients: _clients, machines: _machines, jobTypes: _jobTypes, onChange: () => setState(() {})),
                  _Step2PaperPrint(data: _data, paperStock: _paperStock, onChange: () => setState(() {})),
                  _Step3Finishing(data: _data, onChange: () => setState(() {})),
                  _Step4Assignment(data: _data, staff: _staff, onChange: () => setState(() {})),
                  _Step5Pricing(data: _data, onChange: () => setState(() {})),
                ],
              )),
              // Navigation buttons
              SafeArea(child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                child: Row(children: [
                  if (_step > 0)
                    Expanded(child: OutlinedButton(onPressed: _back, child: const Text('Back'))),
                  if (_step > 0) const SizedBox(width: 12),
                  Expanded(flex: 2, child: ElevatedButton(
                    style: ElevatedButton.styleFrom(backgroundColor: AppColors.secondary),
                    onPressed: _saving ? null : _next,
                    child: _saving
                        ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : Text(_step < 4 ? 'Next' : (widget.existing == null ? 'Create Job' : 'Save Changes')),
                  )),
                ]),
              )),
            ]),
    );
  }
}

// ── Step bar ───────────────────────────────────────────────
class _StepBar extends StatelessWidget {
  final int current;
  final List<String> steps;
  const _StepBar({required this.current, required this.steps});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.surface,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: steps.asMap().entries.map((e) {
          final i = e.key;
          final done = i < current;
          final active = i == current;
          final color = done || active ? AppColors.primary : AppColors.border;
          return Expanded(child: Row(children: [
            Container(
              width: 24, height: 24,
              decoration: BoxDecoration(color: done ? AppColors.primary : active ? AppColors.primaryLight : AppColors.borderLight, border: Border.all(color: color, width: 1.5), shape: BoxShape.circle),
              child: Center(child: done
                  ? const Icon(Icons.check, size: 13, color: Colors.white)
                  : Text('${i + 1}', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: active ? AppColors.primary : AppColors.textMuted))),
            ),
            if (i < steps.length - 1)
              Expanded(child: Container(height: 2, color: done ? AppColors.primary : AppColors.border, margin: const EdgeInsets.symmetric(horizontal: 4))),
          ]));
        }).toList()),
        const SizedBox(height: 6),
        Text(steps[current], style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.primary)),
      ]),
    );
  }
}

// ── Shared form helpers ────────────────────────────────────
class _FormSection extends StatelessWidget {
  final String title;
  final List<Widget> children;
  const _FormSection({required this.title, required this.children});
  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    Padding(padding: const EdgeInsets.only(bottom: 10), child: Text(title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textMuted))),
    ...children,
    const SizedBox(height: 20),
  ]);
}

Widget _field(String label, Widget child) => Padding(
  padding: const EdgeInsets.only(bottom: 12),
  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: AppColors.textMuted)),
    const SizedBox(height: 4),
    child,
  ]),
);

Widget _dropdownField<T>(String label, T? value, List<DropdownMenuItem<T>> items, ValueChanged<T?> onChanged) => _field(label, DropdownButtonFormField<T>(
  value: value, items: items, onChanged: onChanged,
  decoration: const InputDecoration(isDense: true, contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10)),
  isExpanded: true,
));

Widget _textField(String label, String? initial, ValueChanged<String> onChanged, {TextInputType? type, String? hint}) => _field(label, TextFormField(
  initialValue: initial,
  onChanged: onChanged,
  keyboardType: type,
  decoration: InputDecoration(hintText: hint, isDense: true, contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10)),
));

Widget _toggle(String label, bool value, ValueChanged<bool> onChanged) => Padding(
  padding: const EdgeInsets.only(bottom: 8),
  child: Row(children: [
    Expanded(child: Text(label, style: const TextStyle(fontSize: 13))),
    Switch.adaptive(value: value, onChanged: onChanged, activeColor: AppColors.primary),
  ]),
);

// ── Step 1: Basic Info ────────────────────────────────────
class _Step1BasicInfo extends StatelessWidget {
  final JobFormData data;
  final List<_Option> clients, machines;
  final List<String> jobTypes;
  final VoidCallback onChange;
  const _Step1BasicInfo({required this.data, required this.clients, required this.machines, required this.jobTypes, required this.onChange});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      _FormSection(title: 'Job Information', children: [
        _field('Job Title *', DropdownButtonFormField<String>(
          value: jobTypes.contains(data.jobType) ? data.jobType : null,
          hint: const Text('Select Job Title', style: TextStyle(color: AppColors.textDisabled)),
          decoration: const InputDecoration(isDense: true, contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10)),
          isExpanded: true,
          items: jobTypes.map((t) => DropdownMenuItem(value: t, child: Text(t))).toList(),
          onChanged: (v) { data.jobType = v ?? ''; onChange(); },
        )),
        _field('Client', DropdownButtonFormField<String>(
          value: clients.any((c) => c.id == data.clientId) ? data.clientId : null,
          hint: const Text('Select Client', style: TextStyle(color: AppColors.textDisabled)),
          decoration: const InputDecoration(isDense: true, contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10)),
          isExpanded: true,
          items: clients.map((c) => DropdownMenuItem(value: c.id, child: Text(c.name, overflow: TextOverflow.ellipsis))).toList(),
          onChanged: (v) { data.clientId = v; onChange(); },
        )),
        _field('Machine', DropdownButtonFormField<String>(
          value: machines.any((m) => m.id == data.machineId) ? data.machineId : null,
          hint: const Text('Select Machine', style: TextStyle(color: AppColors.textDisabled)),
          decoration: const InputDecoration(isDense: true, contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10)),
          isExpanded: true,
          items: machines.map((m) => DropdownMenuItem(value: m.id, child: Text(m.name))).toList(),
          onChanged: (v) { data.machineId = v; onChange(); },
        )),
        _dropdownField('Order Type', data.orderType, const [
          DropdownMenuItem(value: 'in_house', child: Text('In House')),
          DropdownMenuItem(value: 'outsourced', child: Text('Outsourced')),
        ], (v) { data.orderType = v ?? 'in_house'; onChange(); }),
      ]),
      _FormSection(title: 'Quantity & Size', children: [
        Row(children: [
          Expanded(child: _textField('Quantity', data.quantity?.toString(), (v) { data.quantity = int.tryParse(v); onChange(); }, type: TextInputType.number)),
          const SizedBox(width: 12),
          Expanded(child: _textField('Sheet Size', data.sheetSize, (v) { data.sheetSize = v; onChange(); }, hint: 'e.g. A4, 12x18')),
        ]),
        _textField('Sheet Count', data.sheetCount?.toString(), (v) { data.sheetCount = int.tryParse(v); onChange(); }, type: TextInputType.number, hint: 'e.g. 500'),
        _textField('Description', data.description, (v) { data.description = v; onChange(); }, hint: 'Optional notes'),
      ]),
      _FormSection(title: 'Schedule', children: [
        _field('Due Date', InkWell(
          onTap: () async {
            final now = DateTime.now();
            final picked = await showDatePicker(context: context, initialDate: now, firstDate: now, lastDate: now.add(const Duration(days: 365)));
            if (picked != null) { data.dueDate = picked.toIso8601String().substring(0, 10); onChange(); }
          },
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(border: Border.all(color: AppColors.border), borderRadius: BorderRadius.circular(8), color: AppColors.surface),
            child: Row(children: [
              const Icon(Icons.calendar_today_outlined, size: 16, color: AppColors.textMuted),
              const SizedBox(width: 8),
              Text(data.dueDate ?? 'Select due date', style: TextStyle(fontSize: 13, color: data.dueDate == null ? AppColors.textDisabled : AppColors.textPrimary)),
            ]),
          ),
        )),
        _toggle('Proof Required', data.proofRequired, (v) { data.proofRequired = v; onChange(); }),
      ]),
    ]));
  }
}

// ── Step 2: Paper & Print ──────────────────────────────────
class _Step2PaperPrint extends StatelessWidget {
  final JobFormData data;
  final List<_Option> paperStock;
  final VoidCallback onChange;
  const _Step2PaperPrint({required this.data, required this.paperStock, required this.onChange});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      _FormSection(title: 'Paper', children: [
        // Paper lines
        ...data.papers.asMap().entries.map((e) {
          final i = e.key;
          final p = e.value;
          return Card(margin: const EdgeInsets.only(bottom: 8), child: Padding(padding: const EdgeInsets.all(12), child: Column(children: [
            Row(children: [
              Expanded(child: DropdownButtonFormField<String>(
                value: paperStock.any((s) => s.id == p.paperStockId) ? p.paperStockId : null,
                decoration: const InputDecoration(labelText: 'Paper', isDense: true, contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8)),
                isExpanded: true,
                items: paperStock.map((s) => DropdownMenuItem(value: s.id, child: Text(s.name, overflow: TextOverflow.ellipsis))).toList(),
                onChanged: (v) {
                  if (v != null) {
                    final name = paperStock.firstWhere((s) => s.id == v).name;
                    data.papers[i] = (paperStockId: v, sheetCount: p.sheetCount, paperName: name);
                    onChange();
                  }
                },
              )),
              const SizedBox(width: 8),
              SizedBox(width: 80, child: TextFormField(
                initialValue: p.sheetCount > 0 ? '${p.sheetCount}' : '',
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Sheets', isDense: true, contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8)),
                onChanged: (v) {
                  data.papers[i] = (paperStockId: p.paperStockId, sheetCount: int.tryParse(v) ?? 0, paperName: p.paperName);
                  onChange();
                },
              )),
              IconButton(icon: const Icon(Icons.remove_circle_outline, color: AppColors.error, size: 20), onPressed: () { data.papers.removeAt(i); onChange(); }),
            ]),
          ])));
        }),
        OutlinedButton.icon(
          onPressed: paperStock.isEmpty ? null : () { data.papers.add((paperStockId: paperStock.first.id, sheetCount: 0, paperName: paperStock.first.name)); onChange(); },
          icon: const Icon(Icons.add, size: 16),
          label: const Text('Add Paper'),
        ),
      ]),
      _FormSection(title: 'Print Colours', children: [
        Row(children: [
          Expanded(child: _textField('Front Colours', '${data.colorsFont}', (v) { data.colorsFont = int.tryParse(v) ?? 4; onChange(); }, type: TextInputType.number)),
          const SizedBox(width: 12),
          Expanded(child: _textField('Back Colours', '${data.colorsBack}', (v) { data.colorsBack = int.tryParse(v) ?? 0; onChange(); }, type: TextInputType.number)),
        ]),
      ]),
      _FormSection(title: 'Print Technology', children: [
        _toggle('Offset', data.isOffset, (v) { data.isOffset = v; onChange(); }),
        _toggle('Digital', data.isDigital, (v) { data.isDigital = v; onChange(); }),
        _toggle('Screen', data.isScreen, (v) { data.isScreen = v; onChange(); }),
      ]),
      _FormSection(title: 'Plate Details', children: [
        Row(children: [
          Expanded(child: _textField('Plate Count', '${data.plateCount}', (v) { data.plateCount = int.tryParse(v) ?? 0; onChange(); }, type: TextInputType.number)),
          const SizedBox(width: 12),
          Expanded(child: _textField('Plate Cost', data.plateCost?.toString(), (v) { data.plateCost = double.tryParse(v); onChange(); }, type: TextInputType.number)),
        ]),
        _textField('Plate Source', data.plateSource, (v) { data.plateSource = v; onChange(); }, hint: 'e.g. In-house, Vendor'),
        Row(children: [
          Expanded(child: _textField('Die Cost', data.dieCost?.toString(), (v) { data.dieCost = double.tryParse(v); onChange(); }, type: TextInputType.number)),
          const SizedBox(width: 12),
          Expanded(child: _textField('Hela Cost', data.helaCost?.toString(), (v) { data.helaCost = double.tryParse(v); onChange(); }, type: TextInputType.number)),
        ]),
        _textField('Composing Amount', data.composingAmount?.toString(), (v) { data.composingAmount = double.tryParse(v); onChange(); }, type: TextInputType.number),
      ]),
    ]));
  }
}

// ── Step 3: Finishing ──────────────────────────────────────
class _Step3Finishing extends StatelessWidget {
  final JobFormData data;
  final VoidCallback onChange;
  const _Step3Finishing({required this.data, required this.onChange});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      _FormSection(title: 'Finishing Options', children: [
        _toggle('Binding', data.isBinding, (v) { data.isBinding = v; onChange(); }),
        _toggle('UV Coating', data.isUV, (v) { data.isUV = v; onChange(); }),
        _toggle('Foil Stamping', data.isFoil, (v) { data.isFoil = v; onChange(); }),
        _toggle('Die Cutting', data.isDieCutting, (v) { data.isDieCutting = v; onChange(); }),
        _toggle('Half Cutting', data.isHalfCutting, (v) { data.isHalfCutting = v; onChange(); }),
        _toggle('Creasing', data.isCreasing, (v) { data.isCreasing = v; onChange(); }),
        _toggle('Pasting', data.isPasting, (v) { data.isPasting = v; onChange(); }),
        _toggle('Lamination', data.isLamination, (v) { data.isLamination = v; if (!v) data.laminationType = null; onChange(); }),
        if (data.isLamination)
          _dropdownField<String>('Lamination Type', data.laminationType, const [
            DropdownMenuItem(value: 'glass', child: Text('Glass')),
            DropdownMenuItem(value: 'matte', child: Text('Matte')),
          ], (v) { data.laminationType = v; onChange(); }),
        _toggle('Folding', data.isFolding, (v) { data.isFolding = v; onChange(); }),
        _toggle('Gumming', data.isGumming, (v) { data.isGumming = v; onChange(); }),
      ]),
      _FormSection(title: 'Numbering', children: [
        _toggle('Numbering', data.isNumbering, (v) { data.isNumbering = v; onChange(); }),
        if (data.isNumbering)
          Row(children: [
            Expanded(child: _textField('From', data.numberingFrom?.toString(), (v) { data.numberingFrom = int.tryParse(v); onChange(); }, type: TextInputType.number)),
            const SizedBox(width: 12),
            Expanded(child: _textField('To', data.numberingTo?.toString(), (v) { data.numberingTo = int.tryParse(v); onChange(); }, type: TextInputType.number)),
          ]),
      ]),
    ]));
  }
}

// ── Step 4: Assignment ────────────────────────────────────
class _Step4Assignment extends StatelessWidget {
  final JobFormData data;
  final List<_Option> staff;
  final VoidCallback onChange;
  const _Step4Assignment({required this.data, required this.staff, required this.onChange});

  DropdownMenuItem<String> _emptyItem() => const DropdownMenuItem(value: null, child: Text('— Not Assigned —', style: TextStyle(color: AppColors.textMuted)));

  @override
  Widget build(BuildContext context) {
    final items = [_emptyItem(), ...staff.map((s) => DropdownMenuItem(value: s.id, child: Text(s.name, overflow: TextOverflow.ellipsis)))];

    return SingleChildScrollView(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      _FormSection(title: 'Assign Operators', children: [
        _field('Print Operator', DropdownButtonFormField<String>(value: data.printOperatorId, items: items, onChanged: (v) { data.printOperatorId = v; onChange(); }, isExpanded: true, decoration: const InputDecoration(isDense: true, contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10)))),
        _field('Designer', DropdownButtonFormField<String>(value: data.designerId, items: items, onChanged: (v) { data.designerId = v; onChange(); }, isExpanded: true, decoration: const InputDecoration(isDense: true, contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10)))),
        _field('Binding Operator', DropdownButtonFormField<String>(value: data.bindingOperatorId, items: items, onChanged: (v) { data.bindingOperatorId = v; onChange(); }, isExpanded: true, decoration: const InputDecoration(isDense: true, contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10)))),
        _field('Packing Operator', DropdownButtonFormField<String>(value: data.packingOperatorId, items: items, onChanged: (v) { data.packingOperatorId = v; onChange(); }, isExpanded: true, decoration: const InputDecoration(isDense: true, contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10)))),
        _field('QC Operator', DropdownButtonFormField<String>(value: data.qcOperatorId, items: items, onChanged: (v) { data.qcOperatorId = v; onChange(); }, isExpanded: true, decoration: const InputDecoration(isDense: true, contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10)))),
      ]),
    ]));
  }
}

// ── Step 5: Pricing ────────────────────────────────────────
class _Step5Pricing extends StatelessWidget {
  final JobFormData data;
  final VoidCallback onChange;
  const _Step5Pricing({required this.data, required this.onChange});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      _FormSection(title: 'Pricing', children: [
        _textField('Quoted Price (₹)', data.quotedPrice?.toString(), (v) { data.quotedPrice = double.tryParse(v); onChange(); }, type: TextInputType.number),
        _textField('Advance Amount (₹)', data.advanceAmount?.toString(), (v) { data.advanceAmount = double.tryParse(v); onChange(); }, type: TextInputType.number),
        _textField('Approved Rate (₹)', data.approvedRate?.toString(), (v) { data.approvedRate = double.tryParse(v); onChange(); }, type: TextInputType.number),
        _textField('Other Cost (₹)', data.otherCost?.toString(), (v) { data.otherCost = double.tryParse(v); onChange(); }, type: TextInputType.number),
      ]),
      // Summary
      Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Review Summary', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
        const Divider(height: 20),
        _summaryRow('Job Title', data.jobType.isEmpty ? '—' : data.jobType),
        _summaryRow('Order Type', data.orderType == 'in_house' ? 'In House' : 'Outsourced'),
        if (data.quantity != null) _summaryRow('Quantity', '${data.quantity}'),
        if (data.dueDate != null) _summaryRow('Due Date', data.dueDate!),
        _summaryRow('Papers', '${data.papers.length} selected'),
        _summaryRow('Finishing', _getFinishing(data)),
        if (data.quotedPrice != null) _summaryRow('Quoted Price', '₹${data.quotedPrice!.toStringAsFixed(0)}', color: AppColors.primary),
      ]))),
    ]));
  }

  Widget _summaryRow(String label, String value, {Color? color}) => Padding(
    padding: const EdgeInsets.only(bottom: 6),
    child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
      Text(label, style: const TextStyle(fontSize: 13, color: AppColors.textMuted)),
      Text(value, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: color ?? AppColors.textPrimary)),
    ]),
  );

  String _getFinishing(JobFormData d) {
    final opts = <String>[];
    if (d.isBinding) opts.add('Binding');
    if (d.isUV) opts.add('UV');
    if (d.isFoil) opts.add('Foil');
    if (d.isDieCutting) opts.add('Die Cutting');
    if (d.isLamination) opts.add('Lamination${d.laminationType != null ? " (${d.laminationType![0].toUpperCase()}${d.laminationType!.substring(1)})" : ""}');
    if (d.isNumbering) opts.add('Numbering');
    return opts.isEmpty ? 'None' : opts.join(', ');
  }
}
