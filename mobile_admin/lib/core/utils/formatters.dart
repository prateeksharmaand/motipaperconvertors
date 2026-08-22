import 'package:intl/intl.dart';

class Fmt {
  static final _currency = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 2);
  static final _date = DateFormat('dd/MM/yyyy');
  static final _dateTime = DateFormat('dd/MM/yyyy HH:mm');
  static final _month = DateFormat('MMM yyyy');

  static String money(dynamic value) {
    final n = double.tryParse(value?.toString() ?? '0') ?? 0;
    return _currency.format(n);
  }

  static String date(dynamic value) {
    if (value == null) return '—';
    try {
      final d = value is DateTime ? value : DateTime.parse(value.toString());
      return _date.format(d.toLocal());
    } catch (_) { return '—'; }
  }

  static String dateTime(dynamic value) {
    if (value == null) return '—';
    try {
      final d = value is DateTime ? value : DateTime.parse(value.toString());
      return _dateTime.format(d.toLocal());
    } catch (_) { return '—'; }
  }

  static String month(dynamic value) {
    if (value == null) return '—';
    try {
      final d = value is DateTime ? value : DateTime.parse('$value-01');
      return _month.format(d);
    } catch (_) { return value.toString(); }
  }

  static String number(dynamic value) {
    final n = int.tryParse(value?.toString() ?? '0') ?? 0;
    return NumberFormat('#,##,###', 'en_IN').format(n);
  }

  static String statusLabel(String status) {
    return status.split('_').map((w) => w[0].toUpperCase() + w.substring(1)).join(' ');
  }
}
