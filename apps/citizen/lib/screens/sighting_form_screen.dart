import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';

import '../main.dart';
import '../services/citizen_api.dart';
import '../services/sighting_draft_store.dart';
import 'home_screen.dart' show citizenApi;

class SightingFormScreen extends StatefulWidget {
  const SightingFormScreen({super.key, required this.caseId});

  final String caseId;

  @override
  State<SightingFormScreen> createState() => _SightingFormScreenState();
}

class _SightingFormScreenState extends State<SightingFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _descriptionController = TextEditingController();
  final _locationController = TextEditingController();
  final _latitudeController = TextEditingController();
  final _longitudeController = TextEditingController();
  final _picker = ImagePicker();
  final _draftStore = SightingDraftStore();

  DateTime _observedAt = DateTime.now();
  XFile? _photo;
  String? _photoPath;
  bool _locating = false;
  bool _submitting = false;
  bool _savingDraft = false;
  bool _draftSaved = false;
  String? _error;
  Timer? _draftSaveTimer;

  @override
  void initState() {
    super.initState();
    _descriptionController.addListener(_scheduleDraftSave);
    _locationController.addListener(_scheduleDraftSave);
    _latitudeController.addListener(_scheduleDraftSave);
    _longitudeController.addListener(_scheduleDraftSave);
    _restoreDraft();
  }

  @override
  void dispose() {
    _draftSaveTimer?.cancel();
    _descriptionController.dispose();
    _locationController.dispose();
    _latitudeController.dispose();
    _longitudeController.dispose();
    super.dispose();
  }

  Future<void> _restoreDraft() async {
    try {
      final draft = await _draftStore.load(widget.caseId);
      if (!mounted || draft == null) return;
      _descriptionController.text = draft.description;
      _locationController.text = draft.location;
      _latitudeController.text = draft.latitude;
      _longitudeController.text = draft.longitude;
      _observedAt = draft.observedAt;
      _photoPath = draft.photoPath;
      if (_photoPath != null) _photo = XFile(_photoPath!);
      setState(() => _draftSaved = true);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Your saved sighting draft is ready.')),
      );
    } on Object {
      // Draft restoration is best-effort; the form remains usable without it.
    }
  }

  void _scheduleDraftSave() {
    if (!mounted) return;
    _draftSaveTimer?.cancel();
    setState(() => _draftSaved = false);
    _draftSaveTimer = Timer(const Duration(milliseconds: 600), _saveDraft);
  }

  Future<void> _saveDraft() async {
    if (!mounted) return;
    setState(() => _savingDraft = true);
    try {
      await _draftStore.save(
        SightingDraft(
          caseId: widget.caseId,
          description: _descriptionController.text,
          observedAt: _observedAt,
          location: _locationController.text,
          latitude: _latitudeController.text,
          longitude: _longitudeController.text,
          photoPath: _photoPath,
        ),
      );
      if (mounted) setState(() => _draftSaved = true);
    } on Object {
      if (mounted) setState(() => _draftSaved = false);
    } finally {
      if (mounted) setState(() => _savingDraft = false);
    }
  }

  Future<void> _saveDraftNow() async {
    _draftSaveTimer?.cancel();
    await _saveDraft();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          _draftSaved
              ? 'Draft saved on this device.'
              : 'Could not save the draft. Check device storage and try again.',
        ),
      ),
    );
  }

  Future<void> _chooseDateTime() async {
    final now = DateTime.now();
    final date = await showDatePicker(
      context: context,
      initialDate: _observedAt,
      firstDate: DateTime(now.year - 5),
      lastDate: now,
      helpText: 'When did you see them?',
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(_observedAt),
    );
    if (time == null || !mounted) return;
    setState(() {
      _observedAt = DateTime(
        date.year,
        date.month,
        date.day,
        time.hour,
        time.minute,
      );
    });
    _scheduleDraftSave();
  }

  Future<void> _useCurrentLocation() async {
    setState(() {
      _locating = true;
      _error = null;
    });
    try {
      if (!await Geolocator.isLocationServiceEnabled()) {
        throw const CitizenApiException(
          'Turn on location services, or enter the coordinates manually.',
        );
      }

      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied) {
        throw const CitizenApiException(
          'Location permission was denied. You can enter coordinates manually.',
        );
      }
      if (permission == LocationPermission.deniedForever) {
        throw const CitizenApiException(
          'Allow location access in your phone settings, or enter coordinates manually.',
        );
      }

      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 20),
        ),
      );
      if (!mounted) return;
      setState(() {
        _latitudeController.text = position.latitude.toStringAsFixed(6);
        _longitudeController.text = position.longitude.toStringAsFixed(6);
      });
    } on Object catch (error) {
      if (!mounted) return;
      setState(
        () => _error = error is CitizenApiException
            ? error.message
            : 'Could not get your location. Enter it manually.',
      );
    } finally {
      if (mounted) setState(() => _locating = false);
    }
  }

  Future<void> _pickPhoto(ImageSource source) async {
    try {
      final photo = await _picker.pickImage(
        source: source,
        imageQuality: 85,
        maxWidth: 1800,
      );
      if (photo != null && mounted) {
        final durablePath = await _draftStore.persistPhoto(
          widget.caseId,
          photo.path,
        );
        if (!mounted) return;
        setState(() {
          _photo = XFile(durablePath);
          _photoPath = durablePath;
        });
        await _saveDraft();
      }
    } catch (_) {
      if (mounted) {
        setState(
          () => _error = 'Could not open that image. Try another photo.',
        );
      }
    }
  }

  Future<void> _showPhotoOptions() async {
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: const Icon(Icons.photo_library_outlined),
                title: const Text('Choose from gallery'),
                onTap: () {
                  Navigator.pop(context);
                  _pickPhoto(ImageSource.gallery);
                },
              ),
              ListTile(
                leading: const Icon(Icons.camera_alt_outlined),
                title: const Text('Take a photo'),
                onTap: () {
                  Navigator.pop(context);
                  _pickPhoto(ImageSource.camera);
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      await _saveDraft();
      String? imageAssetId;
      final photo = _photo;
      if (photo != null) {
        imageAssetId = await citizenApi.uploadSightingPhoto(
          caseId: widget.caseId,
          photo: photo,
        );
      }
      final message = await citizenApi.submitSighting(
        caseId: widget.caseId,
        description: _descriptionController.text.trim(),
        observedAt: _observedAt,
        location: _locationController.text.trim(),
        latitude: double.parse(_latitudeController.text.trim()),
        longitude: double.parse(_longitudeController.text.trim()),
        imageAssetId: imageAssetId,
      );
      try {
        await _draftStore.delete(widget.caseId);
      } on Object {
        // A local cleanup issue must not turn a successful send into a retry.
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message), backgroundColor: brandGreen),
      );
      Navigator.of(context).pop(true);
    } on Object catch (error) {
      if (!mounted) return;
      setState(
        () => _error = error is CitizenApiException
            ? error.message
            : 'Could not submit this sighting. Please try again.',
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          onPressed: () async {
            _draftSaveTimer?.cancel();
            await _saveDraft();
            if (context.mounted) Navigator.of(context).maybePop();
          },
          icon: const Icon(Icons.arrow_back_rounded),
        ),
        title: const Text(
          'Share a sighting',
          style: TextStyle(fontWeight: FontWeight.w800),
        ),
      ),
      body: SafeArea(
        top: false,
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 6, 20, 30),
            children: [
              Container(
                padding: const EdgeInsets.all(15),
                decoration: BoxDecoration(
                  color: const Color(0xFFE9F0EA),
                  borderRadius: BorderRadius.circular(17),
                ),
                child: const Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(Icons.lock_outline_rounded, color: brandGreen),
                    SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Your report goes to the family for review. Your location and photo are not shared publicly unless the family approves the sighting.',
                        style: TextStyle(fontSize: 12, height: 1.45),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 21),
              const _FieldLabel('What did you see?'),
              TextFormField(
                controller: _descriptionController,
                minLines: 4,
                maxLines: 7,
                maxLength: 2000,
                textCapitalization: TextCapitalization.sentences,
                decoration: const InputDecoration(
                  hintText: 'Describe the person and what happened. Stay at a safe distance.',
                ),
                validator: (value) {
                  if (value == null || value.trim().length < 10) {
                    return 'Please add at least 10 characters.';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),
              const _FieldLabel('When did you see them?'),
              OutlinedButton.icon(
                onPressed: _chooseDateTime,
                icon: const Icon(Icons.calendar_month_outlined),
                label: Text(_formatDateTime(_observedAt)),
                style: OutlinedButton.styleFrom(
                  alignment: Alignment.centerLeft,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 15,
                    vertical: 15,
                  ),
                  foregroundColor: ink,
                  side: const BorderSide(color: Color(0xFFE0E7E1)),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                ),
              ),
              const SizedBox(height: 17),
              const _FieldLabel('Where did you see them?'),
              TextFormField(
                controller: _locationController,
                maxLength: 200,
                textCapitalization: TextCapitalization.words,
                decoration: const InputDecoration(
                  hintText: 'Nearby landmark or area',
                ),
                validator: (value) => value == null || value.trim().isEmpty
                    ? 'Add a place or nearby landmark.'
                    : null,
              ),
              const SizedBox(height: 4),
              OutlinedButton.icon(
                onPressed: _locating || _submitting
                    ? null
                    : _useCurrentLocation,
                icon: _locating
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.my_location_rounded),
                label: Text(
                  _locating ? 'Getting location...' : 'Use my current location',
                ),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  foregroundColor: brandGreen,
                  side: const BorderSide(color: Color(0xFFBCD6C8)),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(15),
                  ),
                ),
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: _CoordinateField(
                      label: 'Latitude',
                      controller: _latitudeController,
                      min: -90,
                      max: 90,
                    ),
                  ),
                  const SizedBox(width: 11),
                  Expanded(
                    child: _CoordinateField(
                      label: 'Longitude',
                      controller: _longitudeController,
                      min: -180,
                      max: 180,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              const _FieldLabel('Photo evidence (optional)'),
              if (_photo == null)
                OutlinedButton.icon(
                  onPressed: _submitting ? null : _showPhotoOptions,
                  icon: const Icon(Icons.add_a_photo_outlined),
                  label: const Text('Add a photo'),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    foregroundColor: ink,
                    side: const BorderSide(color: Color(0xFFE0E7E1)),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(15),
                    ),
                  ),
                )
              else
                Container(
                  height: 170,
                  clipBehavior: Clip.antiAlias,
                  decoration: BoxDecoration(
                    color: const Color(0xFFE5ECE6),
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      Image.file(
                        File(_photo!.path),
                        fit: BoxFit.cover,
                        errorBuilder: (_, _, _) => const Center(
                          child: Icon(Icons.image_outlined, size: 42),
                        ),
                      ),
                      Positioned(
                        top: 8,
                        right: 8,
                        child: IconButton.filledTonal(
                          onPressed: _submitting
                              ? null
                              : () {
                                  setState(() {
                                    _photo = null;
                                    _photoPath = null;
                                  });
                                  _scheduleDraftSave();
                                },
                          icon: const Icon(Icons.close_rounded),
                          tooltip: 'Remove photo',
                        ),
                      ),
                    ],
                  ),
                ),
              const SizedBox(height: 23),
              Row(
                children: [
                  OutlinedButton.icon(
                    onPressed: _submitting || _savingDraft
                        ? null
                        : _saveDraftNow,
                    icon: _savingDraft
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.save_outlined),
                    label: const Text('Save draft'),
                  ),
                  const SizedBox(width: 12),
                  if (_draftSaved && !_savingDraft)
                    const Expanded(
                      child: Text(
                        'Saved on this device',
                        style: TextStyle(
                          color: brandGreen,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 14),
              if (_error != null) ...[
                Container(
                  margin: const EdgeInsets.only(bottom: 14),
                  padding: const EdgeInsets.all(13),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFE9E6),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Text(
                    _error!,
                    style: const TextStyle(color: Color(0xFF9F352E)),
                  ),
                ),
              ],
              FilledButton.icon(
                onPressed: _submitting ? null : _submit,
                icon: _submitting
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          color: Colors.white,
                          strokeWidth: 2,
                        ),
                      )
                    : const Icon(Icons.send_rounded),
                label: Text(
                  _submitting
                      ? 'Sending sighting...'
                      : _error == null
                      ? 'Send sighting'
                      : 'Retry sending',
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _FieldLabel extends StatelessWidget {
  const _FieldLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(
        text,
        style: Theme.of(context).textTheme.titleSmall
            ?.copyWith(fontWeight: FontWeight.w800, color: ink),
      ),
    );
  }
}

class _CoordinateField extends StatelessWidget {
  const _CoordinateField({
    required this.label,
    required this.controller,
    required this.min,
    required this.max,
  });

  final String label;
  final TextEditingController controller;
  final double min;
  final double max;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _FieldLabel(label),
        TextFormField(
          controller: controller,
          keyboardType: const TextInputType.numberWithOptions(
            decimal: true,
            signed: true,
          ),
          decoration: const InputDecoration(
            hintText: '0.000000',
            counterText: '',
          ),
          validator: (value) {
            final parsed = double.tryParse(value?.trim() ?? '');
            if (parsed == null || parsed < min || parsed > max) {
              return 'Enter a valid value.';
            }
            return null;
          },
        ),
      ],
    );
  }
}

String _formatDateTime(DateTime date) {
  final hour = date.hour == 0
      ? 12
      : date.hour > 12
      ? date.hour - 12
      : date.hour;
  final minute = date.minute.toString().padLeft(2, '0');
  final period = date.hour >= 12 ? 'PM' : 'AM';
  return '${date.day}/${date.month}/${date.year} at $hour:$minute $period';
}
