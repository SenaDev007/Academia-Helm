/// ============================================================================
/// DYNAMIC FORM DIALOG — Academia Helm Mobile
/// ============================================================================
///
/// A generic create/edit form dialog that can be used by ANY module. It takes
/// a list of field definitions and renders a form, then returns the collected
/// data as a Map. This replaces the need for bespoke modal forms per module.
///

import 'package:flutter/material.dart';

import '../theme/ah_colors.dart';
import '../theme/ah_spacing.dart';

/// Field type for the dynamic form.
enum FieldType {
  text,
  number,
  date,
  dropdown,
  textarea,
  toggle,
  email,
  phone,
}

/// Definition of a single form field.
class FormFieldDef {
  const FormFieldDef({
    required this.key,
    required this.label,
    this.type = FieldType.text,
    this.required = false,
    this.initialValue,
    this.options = const [],
    this.hint,
    this.maxLines = 1,
  });

  final String key;
  final String label;
  final FieldType type;
  final bool required;
  final dynamic initialValue;
  final List<String> options;
  final String? hint;
  final int maxLines;
}

/// Result of the form dialog — null if cancelled, Map otherwise.
typedef FormResult = Map<String, dynamic>?;

/// Shows a dynamic create/edit form dialog.
/// Returns the collected data, or null if the user cancelled.
Future<FormResult> showDynamicFormDialog({
  required BuildContext context,
  required String title,
  required List<FormFieldDef> fields,
  String submitLabel = 'Enregistrer',
  String? subtitle,
}) async {
  return showDialog<FormResult>(
    context: context,
    barrierDismissible: false,
    builder: (ctx) => _DynamicFormDialog(
      title: title,
      subtitle: subtitle,
      fields: fields,
      submitLabel: submitLabel,
    ),
  );
}

class _DynamicFormDialog extends StatefulWidget {
  const _DynamicFormDialog({
    required this.title,
    required this.fields,
    required this.submitLabel,
    this.subtitle,
  });

  final String title;
  final String? subtitle;
  final List<FormFieldDef> fields;
  final String submitLabel;

  @override
  State<_DynamicFormDialog> createState() => _DynamicFormDialogState();
}

class _DynamicFormDialogState extends State<_DynamicFormDialog> {
  late final Map<String, dynamic> _values;
  late final Map<String, TextEditingController> _controllers;
  final _formKey = GlobalKey<FormState>();

  @override
  void initState() {
    super.initState();
    _values = {};
    _controllers = {};
    for (final f in widget.fields) {
      _values[f.key] = f.initialValue;
      if (f.type == FieldType.text ||
          f.type == FieldType.number ||
          f.type == FieldType.email ||
          f.type == FieldType.phone ||
          f.type == FieldType.textarea) {
        _controllers[f.key] = TextEditingController(
          text: f.initialValue?.toString() ?? '',
        );
      }
    }
  }

  @override
  void dispose() {
    for (final c in _controllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.title),
      content: SizedBox(
        width: double.maxFinite,
        child: SingleChildScrollView(
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (widget.subtitle != null) ...[
                  Text(widget.subtitle!,
                      style: const TextStyle(
                          fontSize: 12, color: AHColors.grey500)),
                  const SizedBox(height: AHSpacing.md),
                ],
                ...widget.fields.map(_buildField),
              ],
            ),
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(null),
          child: const Text('Annuler'),
        ),
        ElevatedButton(
          onPressed: _submit,
          style: ElevatedButton.styleFrom(
            backgroundColor: AHColors.navy,
            foregroundColor: Colors.white,
          ),
          child: Text(widget.submitLabel),
        ),
      ],
    );
  }

  Widget _buildField(FormFieldDef f) {
    switch (f.type) {
      case FieldType.text:
      case FieldType.email:
      case FieldType.phone:
        return Padding(
          padding: const EdgeInsets.only(bottom: AHSpacing.sm),
          child: TextFormField(
            controller: _controllers[f.key],
            decoration: InputDecoration(
              labelText: f.required ? '${f.label} *' : f.label,
              hintText: f.hint,
              isDense: true,
              border: const OutlineInputBorder(),
            ),
            keyboardType: f.type == FieldType.email
                ? TextInputType.emailAddress
                : f.type == FieldType.phone
                    ? TextInputType.phone
                    : TextInputType.text,
            validator: f.required
                ? (v) => v == null || v.isEmpty ? 'Requis' : null
                : null,
            onSaved: (v) => _values[f.key] = v,
          ),
        );

      case FieldType.number:
        return Padding(
          padding: const EdgeInsets.only(bottom: AHSpacing.sm),
          child: TextFormField(
            controller: _controllers[f.key],
            decoration: InputDecoration(
              labelText: f.required ? '${f.label} *' : f.label,
              hintText: f.hint,
              isDense: true,
              border: const OutlineInputBorder(),
            ),
            keyboardType: TextInputType.number,
            validator: f.required
                ? (v) => v == null || v.isEmpty ? 'Requis' : null
                : null,
            onSaved: (v) =>
                _values[f.key] = num.tryParse(v ?? '') ?? 0,
          ),
        );

      case FieldType.textarea:
        return Padding(
          padding: const EdgeInsets.only(bottom: AHSpacing.sm),
          child: TextFormField(
            controller: _controllers[f.key],
            decoration: InputDecoration(
              labelText: f.required ? '${f.label} *' : f.label,
              hintText: f.hint,
              isDense: true,
              border: const OutlineInputBorder(),
            ),
            maxLines: f.maxLines,
            validator: f.required
                ? (v) => v == null || v.isEmpty ? 'Requis' : null
                : null,
            onSaved: (v) => _values[f.key] = v,
          ),
        );

      case FieldType.date:
        return Padding(
          padding: const EdgeInsets.only(bottom: AHSpacing.sm),
          child: InkWell(
            onTap: () async {
              final d = await showDatePicker(
                context: context,
                initialDate: DateTime.now(),
                firstDate: DateTime(2000),
                lastDate: DateTime(2100),
              );
              if (d != null) {
                setState(() => _values[f.key] = d.toIso8601String());
              }
            },
            child: InputDecorator(
              decoration: InputDecoration(
                labelText: f.required ? '${f.label} *' : f.label,
                isDense: true,
                border: const OutlineInputBorder(),
                suffixIcon: const Icon(Icons.calendar_today, size: 18),
              ),
              child: Text(
                _values[f.key] != null
                    ? _formatDate(_values[f.key].toString())
                    : (f.hint ?? 'Sélectionner une date'),
                style: TextStyle(
                  color: _values[f.key] != null
                      ? const Color(0xFF0F172A)
                      : AHColors.grey400,
                ),
              ),
            ),
          ),
        );

      case FieldType.dropdown:
        return Padding(
          padding: const EdgeInsets.only(bottom: AHSpacing.sm),
          child: DropdownButtonFormField<String>(
            value: _values[f.key],
            decoration: InputDecoration(
              labelText: f.required ? '${f.label} *' : f.label,
              isDense: true,
              border: const OutlineInputBorder(),
            ),
            items: f.options
                .map((o) => DropdownMenuItem(
                      value: o,
                      child: Text(o),
                    ))
                .toList(),
            onChanged: (v) => setState(() => _values[f.key] = v),
            validator: f.required
                ? (v) => v == null || v.isEmpty ? 'Requis' : null
                : null,
          ),
        );

      case FieldType.toggle:
        return Padding(
          padding: const EdgeInsets.only(bottom: AHSpacing.sm),
          child: SwitchListTile(
            title: Text(f.label),
            value: _values[f.key] == true,
            onChanged: (v) => setState(() => _values[f.key] = v),
            dense: true,
          ),
        );
    }
  }

  void _submit() {
    if (_formKey.currentState?.validate() ?? false) {
      _formKey.currentState?.save();
      // Include controller values for text/number fields
      for (final entry in _controllers.entries) {
        _values[entry.key] ??= entry.value.text;
        if (entry.value.text.isNotEmpty) {
          _values[entry.key] = entry.value.text;
        }
      }
      Navigator.of(context).pop(Map<String, dynamic>.from(_values));
    }
  }

  String _formatDate(String iso) {
    try {
      final d = DateTime.parse(iso);
      return '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';
    } catch (_) {
      return iso;
    }
  }
}
