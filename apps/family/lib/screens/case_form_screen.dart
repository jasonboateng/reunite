import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../main.dart';
import '../models/family_models.dart';
import '../services/family_api.dart';
import 'family_toast.dart';

class CaseFormScreen extends StatefulWidget {
  const CaseFormScreen({super.key, this.existingCase, this.onCreated});
  final FamilyCase? existingCase;
  final ValueChanged<FamilyCase>? onCreated;
  @override
  State<CaseFormScreen> createState() => _CaseFormScreenState();
}

class _CaseFormScreenState extends State<CaseFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _age = TextEditingController();
  final _region = TextEditingController();
  final _lastSeen = TextEditingController();
  final _contact = TextEditingController();
  final _notes = TextEditingController();
  final _evidence = TextEditingController();
  final _picker = ImagePicker();
  String _caseType = 'Missing person';
  String? _imageAssetId;
  XFile? _photo;
  bool _removePhoto = false;
  bool _busy = false;
  String? _error;
  bool get _editing => widget.existingCase != null;

  @override
  void initState() {
    super.initState();
    final item = widget.existingCase;
    if (item != null) {
      _name.text = item.name;
      _age.text = item.age == 'Unknown' ? '' : item.age;
      _region.text = item.region;
      _lastSeen.text = item.lastSeen;
      _contact.text = item.contact;
      _notes.text = item.description;
      _imageAssetId = item.imageAssetId;
    }
  }

  @override
  void dispose() {
    _name.dispose();
    _age.dispose();
    _region.dispose();
    _lastSeen.dispose();
    _contact.dispose();
    _notes.dispose();
    _evidence.dispose();
    super.dispose();
  }

  Future<void> _pickPhoto() async {
    try {
      final selected = await _picker.pickImage(
        source: ImageSource.gallery,
        imageQuality: 85,
        maxWidth: 1800,
      );
      if (selected != null && mounted)
        setState(() {
          _photo = selected;
          _removePhoto = false;
        });
    } catch (_) {
      if (mounted)
        setState(
          () => _error = 'Could not open that photo. Try another image.',
        );
    }
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      var imageAssetId = _removePhoto ? null : _imageAssetId;
      if (_photo != null)
        imageAssetId = await familyApi.uploadCasePhoto(
          photo: _photo!,
          caseId: _editing ? widget.existingCase!.id : null,
        );
      if (_editing) {
        final item = widget.existingCase!;
        final message = await familyApi.updateCase(item.id, {
          'name': _name.text.trim(),
          'age': _age.text.trim().isEmpty ? 'Unknown' : _age.text.trim(),
          'region': _region.text.trim(),
          'lastSeen': _lastSeen.text.trim(),
          'description': _notes.text.trim(),
          'contact': _contact.text.trim(),
          'imageAssetId': imageAssetId,
        });
        if (!mounted) return;
        FamilyToast.success(context, message);
        Navigator.of(context).pop(true);
      } else {
        final message = await familyApi.createReport({
          'fullName': _name.text.trim(),
          if (_age.text.trim().isNotEmpty) 'age': int.parse(_age.text.trim()),
          'region': _region.text.trim(),
          'caseType': _caseType,
          'lastSeen': _lastSeen.text.trim(),
          'contact': _contact.text.trim(),
          'notes': _notes.text.trim(),
          if (_evidence.text.trim().isNotEmpty)
            'evidence': [_evidence.text.trim()],
          if (imageAssetId != null) 'imageAssetId': imageAssetId,
        });
        if (!mounted) return;
        FamilyToast.success(context, message);
        final created = FamilyCase(
          id: '',
          caseNumber: 'Submitted',
          name: _name.text.trim(),
          age: _age.text.trim().isEmpty ? 'Unknown' : _age.text.trim(),
          region: _region.text.trim(),
          lastSeen: _lastSeen.text.trim(),
          status: 'Review',
        );
        if (widget.onCreated != null) {
          widget.onCreated!(created);
        } else {
          Navigator.of(context).pop(created);
        }
      }
    } on FormatException {
      if (mounted) {
        const message = 'Enter a valid age, or leave it blank.';
        setState(() => _error = message);
        FamilyToast.error(context, message);
      }
    } on Object catch (error) {
      if (mounted) {
        final message = error is FamilyApiException
            ? error.message
            : 'Could not save this report. Check your connection and try again.';
        setState(() => _error = message);
        FamilyToast.error(context, message);
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Text(_editing ? 'Case details' : 'New family report'),
    ),
    body: Form(
      key: _formKey,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 10, 20, 30),
        children: [
          Text(
            _editing ? 'Update case details' : 'Report a missing person',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: 7),
          const Text(
            'The report is private to your family account and is reviewed before it can appear publicly.',
          ),
          const SizedBox(height: 17),
          if (_error != null)
            Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(13),
              decoration: BoxDecoration(
                color: const Color(0xFFFFECEA),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                _error!,
                style: const TextStyle(color: Color(0xFF94352E)),
              ),
            ),
          _field(
            _name,
            "Missing person's full name",
            required: true,
            maxLength: 120,
          ),
          _field(
            _age,
            'Age (optional)',
            keyboardType: TextInputType.number,
            maxLength: 3,
            validator: (value) {
              if (value == null || value.trim().isEmpty) return null;
              final age = int.tryParse(value);
              return age == null || age < 0 || age > 120
                  ? 'Enter 0 to 120 or leave blank.'
                  : null;
            },
          ),
          _field(_region, 'Region', required: true, maxLength: 100),
          if (!_editing) ...[
            const SizedBox(height: 5),
            DropdownButtonFormField<String>(
              value: _caseType,
              decoration: const InputDecoration(labelText: 'Case type'),
              items: const [
                DropdownMenuItem(
                  value: 'Missing person',
                  child: Text('Missing person'),
                ),
                DropdownMenuItem(
                  value: 'Critical risk',
                  child: Text('Critical risk'),
                ),
                DropdownMenuItem(
                  value: 'Medical concern',
                  child: Text('Medical concern'),
                ),
              ],
              onChanged: (value) =>
                  setState(() => _caseType = value ?? 'Missing person'),
            ),
          ],
          _field(
            _lastSeen,
            'Where and when they were last seen',
            required: true,
            maxLength: 200,
          ),
          _field(
            _contact,
            'Family contact details',
            required: true,
            maxLength: 100,
            keyboardType: TextInputType.phone,
          ),
          _field(
            _notes,
            'Private report notes',
            required: true,
            minLength: 10,
            maxLength: 5000,
            maxLines: 5,
            hint: 'Describe clothing, distinguishing features, and what happened.',
          ),
          if (!_editing)
            _field(_evidence, 'Evidence notes (optional)', maxLength: 500),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: _busy ? null : _pickPhoto,
            icon: const Icon(Icons.photo_library_outlined),
            label: Text(
              _photo != null || (!_removePhoto && _imageAssetId != null)
                  ? 'Change person photo'
                  : 'Add person photo',
            ),
          ),
          if (_photo != null)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(14),
                child: Image.file(
                  File(_photo!.path),
                  height: 220,
                  fit: BoxFit.cover,
                ),
              ),
            )
          else if (!_removePhoto && _imageAssetId != null)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(14),
                child: Image.network(
                  familyApi.mediaUrl(_imageAssetId!),
                  headers: familyApi.mediaHeaders,
                  height: 220,
                  fit: BoxFit.cover,
                  errorBuilder: (_, _, _) => const SizedBox(
                    height: 100,
                    child: Center(
                      child: Icon(Icons.image_not_supported_outlined),
                    ),
                  ),
                ),
              ),
            ),
          if (_imageAssetId != null || _photo != null)
            TextButton.icon(
              onPressed: _busy
                  ? null
                  : () => setState(() {
                      _photo = null;
                      _removePhoto = true;
                    }),
              icon: const Icon(Icons.delete_outline),
              label: const Text('Remove photo'),
            ),
          const SizedBox(height: 15),
          FilledButton.icon(
            onPressed: _busy ? null : _save,
            icon: _busy
                ? const SizedBox(
                    width: 17,
                    height: 17,
                    child: CircularProgressIndicator(
                      color: Colors.white,
                      strokeWidth: 2,
                    ),
                  )
                : const Icon(Icons.save_outlined),
            label: Text(
              _busy
                  ? 'Saving report...'
                  : _editing
                  ? 'Save case details'
                  : 'Submit private report',
            ),
          ),
          if (!_editing)
            const Padding(
              padding: EdgeInsets.only(top: 10),
              child: Text(
                'If you add a photo, upload completes before report submission. Do not include unnecessary sensitive information.',
                style: TextStyle(fontSize: 12),
              ),
            ),
        ],
      ),
    ),
  );

  Widget _field(
    TextEditingController controller,
    String label, {
    bool required = false,
    int? minLength,
    int? maxLength,
    int maxLines = 1,
    TextInputType? keyboardType,
    String? hint,
    String? Function(String?)? validator,
  }) => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: TextFormField(
      controller: controller,
      keyboardType: keyboardType,
      maxLength: maxLength,
      minLines: maxLines == 1 ? 1 : maxLines,
      maxLines: maxLines,
      textCapitalization: TextCapitalization.sentences,
      decoration: InputDecoration(labelText: label, hintText: hint),
      validator:
          validator ??
          (value) {
            final text = value?.trim() ?? '';
            if (required && text.isEmpty) return 'This field is required.';
            if (minLength != null && text.length < minLength)
              return 'Enter at least $minLength characters.';
            return null;
          },
    ),
  );
}
