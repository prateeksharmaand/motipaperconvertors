import 'package:flutter/material.dart';
import '../../core/network/api_client.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';

class LineItem {
  String description;
  double qty;
  double rate;
  double get amount => qty * rate;
  LineItem({this.description = '', this.qty = 1, this.rate = 0});
}

class CreateInvoiceSheet extends StatefulWidget {
  const CreateInvoiceSheet({super.key});
  @override
  State<CreateInvoiceSheet> createState() => _CreateInvoiceSheetState();
}

class _CreateInvoiceSheetState extends State<CreateInvoiceSheet> {
  String? _clientId;
  String? _jobId;
  List<Map<String, dynamic>> _clients = [];
  List<Map<String, dynamic>> _jobs = [];
  final List<LineItem> _lines = [LineItem()];
  double _gstPct = 18;
  double _discount = 0;
  String _invoiceType = 'job_work';
  bool _loading = true;
  bool _saving = false;
  String? _error;

  String? _dueDate;

  @override
  void initState() {
    super.initState();
    _loadMeta();
  }

  Future<void> _loadMeta() async {
    try {
      final results = await Future.wait([
        ApiClient.instance.get('/admin/clients', queryParameters: {'limit': 200}),
        ApiClient.instance.get('/admin/jobs', queryParameters: {'limit': 100, 'sortDir': 'desc'}),
      ]);
      if (!mounted) return;
      setState(() {
        _clients = List<Map<String, dynamic>>.from(results[0].data['data'] as List? ?? []);
        _jobs = List<Map<String, dynamic>>.from(results[1].data['data'] as List? ?? []);
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  double get _subtotal => _lines.fold(0, (s, l) => s + l.amount);
  double get _gstAmount => (_subtotal - _discount) * _gstPct / 100;
  double get _total => _subtotal - _discount + _gstAmount;

  Future<void> _submit() async {
    if (_clientId == null) { setState(() => _error = 'Select a client'); return; }
    if (_lines.every((l) => l.description.isEmpty || l.amount == 0)) { setState(() => _error = 'Add at least one line item'); return; }
    setState(() { _saving = true; _error = null; });
    try {
      await ApiClient.instance.post('/admin/billing/invoices', data: {
        'clientId': _clientId,
        if (_jobId != null) 'jobId': _jobId,
        'invoiceType': _invoiceType,
        'lineItems': _lines.where((l) => l.description.isNotEmpty).map((l) => {'description': l.description, 'qty': l.qty, 'rate': l.rate, 'amount': l.amount}).toList(),
        'discountAmount': _discount,
        'gstPercent': _gstPct,
        'subTotal': _subtotal,
        'gstAmount': _gstAmount,
        'total': _total,
        if (_dueDate != null) 'dueDate': _dueDate,
      });
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      setState(() { _saving = false; _error = 'Failed to create invoice'; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.92, maxChildSize: 0.97, minChildSize: 0.5, expand: false,
      builder: (_, ctrl) => Column(children: [
        // Handle
        Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(2)), margin: const EdgeInsets.only(top: 12, bottom: 4))),
        // Header
        Padding(padding: const EdgeInsets.fromLTRB(20, 8, 8, 8), child: Row(children: [
          const Expanded(child: Text('New Invoice', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700))),
          IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(context)),
        ])),
        const Divider(height: 1),
        // Body
        Expanded(child: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(controller: ctrl, padding: const EdgeInsets.all(20), children: [
              if (_error != null) Container(margin: const EdgeInsets.only(bottom: 12), padding: const EdgeInsets.all(10), decoration: BoxDecoration(color: AppColors.errorLight, borderRadius: BorderRadius.circular(8)), child: Text(_error!, style: const TextStyle(color: AppColors.error, fontSize: 13))),
              // Client
              DropdownButtonFormField<String>(
                initialValue: _clientId,
                hint: const Text('Select Client *', style: TextStyle(color: AppColors.textDisabled)),
                decoration: const InputDecoration(labelText: 'Client'),
                isExpanded: true,
                items: _clients.map((c) => DropdownMenuItem(value: c['id'] as String, child: Text(c['company_name'] as String? ?? c['name'] as String? ?? '', overflow: TextOverflow.ellipsis))).toList(),
                onChanged: (v) => setState(() => _clientId = v),
              ),
              const SizedBox(height: 12),
              // Job (optional)
              DropdownButtonFormField<String>(
                initialValue: _jobId,
                hint: const Text('Link to Job Card (optional)', style: TextStyle(color: AppColors.textDisabled)),
                decoration: const InputDecoration(labelText: 'Job Card'),
                isExpanded: true,
                items: [const DropdownMenuItem(value: null, child: Text('— None —')), ..._jobs.map((j) => DropdownMenuItem(value: j['id'] as String, child: Text('#${j['job_number']} ${j['job_type'] ?? ''}', overflow: TextOverflow.ellipsis)))],
                onChanged: (v) => setState(() => _jobId = v),
              ),
              const SizedBox(height: 12),
              // Invoice type
              DropdownButtonFormField<String>(
                initialValue: _invoiceType,
                decoration: const InputDecoration(labelText: 'Invoice Type'),
                items: const [
                  DropdownMenuItem(value: 'job_work', child: Text('Job Work')),
                  DropdownMenuItem(value: 'goods', child: Text('Goods')),
                ],
                onChanged: (v) => setState(() => _invoiceType = v ?? 'job_work'),
              ),
              const SizedBox(height: 12),
              // Due date
              InkWell(
                onTap: () async {
                  final now = DateTime.now();
                  final picked = await showDatePicker(context: context, initialDate: now.add(const Duration(days: 15)), firstDate: now, lastDate: now.add(const Duration(days: 365)));
                  if (picked != null && mounted) setState(() => _dueDate = picked.toIso8601String().substring(0, 10));
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                  decoration: BoxDecoration(border: Border.all(color: AppColors.border), borderRadius: BorderRadius.circular(8)),
                  child: Row(children: [
                    const Icon(Icons.calendar_today_outlined, size: 16, color: AppColors.textMuted),
                    const SizedBox(width: 8),
                    Text(_dueDate != null ? 'Due: ${Fmt.date(_dueDate)}' : 'Set Due Date (optional)', style: TextStyle(fontSize: 13, color: _dueDate == null ? AppColors.textDisabled : AppColors.textPrimary)),
                  ]),
                ),
              ),
              const SizedBox(height: 20),
              // Line items
              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                const Text('Line Items', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                TextButton.icon(
                  onPressed: () => setState(() => _lines.add(LineItem())),
                  icon: const Icon(Icons.add, size: 16),
                  label: const Text('Add Line'),
                ),
              ]),
              ..._lines.asMap().entries.map((e) {
                final i = e.key;
                final line = e.value;
                return Card(margin: const EdgeInsets.only(bottom: 8), child: Padding(padding: const EdgeInsets.all(12), child: Column(children: [
                  Row(children: [
                    Expanded(child: TextFormField(
                      initialValue: line.description,
                      decoration: const InputDecoration(labelText: 'Description', isDense: true, contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8)),
                      onChanged: (v) => setState(() => _lines[i].description = v),
                    )),
                    if (_lines.length > 1) IconButton(icon: const Icon(Icons.remove_circle_outline, color: AppColors.error, size: 20), onPressed: () => setState(() => _lines.removeAt(i))),
                  ]),
                  const SizedBox(height: 8),
                  Row(children: [
                    Expanded(child: TextFormField(
                      initialValue: '${line.qty}',
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      decoration: const InputDecoration(labelText: 'Qty', isDense: true, contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8)),
                      onChanged: (v) => setState(() => _lines[i].qty = double.tryParse(v) ?? 1),
                    )),
                    const SizedBox(width: 8),
                    Expanded(child: TextFormField(
                      initialValue: line.rate > 0 ? '${line.rate}' : '',
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      decoration: const InputDecoration(labelText: 'Rate ₹', isDense: true, contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8)),
                      onChanged: (v) => setState(() => _lines[i].rate = double.tryParse(v) ?? 0),
                    )),
                    const SizedBox(width: 8),
                    SizedBox(width: 80, child: Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                      const Text('Amount', style: TextStyle(fontSize: 11, color: AppColors.textMuted)),
                      Text(Fmt.money(line.amount), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                    ])),
                  ]),
                ])));
              }),
              const SizedBox(height: 12),
              // Tax & discount
              const Divider(),
              const Text('Tax & Discount', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
              const SizedBox(height: 10),
              Row(children: [
                Expanded(child: TextFormField(
                  initialValue: '$_gstPct',
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(labelText: 'GST %', suffixText: '%', isDense: true, contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8)),
                  onChanged: (v) => setState(() => _gstPct = double.tryParse(v) ?? 18),
                )),
                const SizedBox(width: 12),
                Expanded(child: TextFormField(
                  initialValue: '$_discount',
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(labelText: 'Discount ₹', prefixText: '₹ ', isDense: true, contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8)),
                  onChanged: (v) => setState(() => _discount = double.tryParse(v) ?? 0),
                )),
              ]),
              const SizedBox(height: 16),
              // Totals
              Container(padding: const EdgeInsets.all(14), decoration: BoxDecoration(color: AppColors.primaryLight, borderRadius: BorderRadius.circular(10)), child: Column(children: [
                _totalRow('Subtotal', _subtotal),
                if (_discount > 0) _totalRow('Discount', -_discount, color: AppColors.error),
                _totalRow('GST (${_gstPct.toStringAsFixed(0)}%)', _gstAmount),
                const Divider(),
                Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                  const Text('Total', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                  Text(Fmt.money(_total), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 20, color: AppColors.primary)),
                ]),
              ])),
              const SizedBox(height: 20),
              ElevatedButton(
                onPressed: _saving ? null : _submit,
                child: _saving ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Text('Create Invoice'),
              ),
            ])),
      ]),
    );
  }

  Widget _totalRow(String label, double value, {Color? color}) => Padding(
    padding: const EdgeInsets.only(bottom: 6),
    child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
      Text(label, style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
      Text(Fmt.money(value.abs()), style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: color ?? AppColors.textPrimary)),
    ]),
  );
}
