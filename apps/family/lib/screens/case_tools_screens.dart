import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:gal/gal.dart';

import '../main.dart';
import '../models/family_models.dart';
import '../services/family_api.dart';
import 'family_widgets.dart';
import 'family_toast.dart';

class PublicProfileScreen extends StatefulWidget {
  const PublicProfileScreen({super.key, required this.caseInfo});
  final FamilyCase caseInfo;
  @override
  State<PublicProfileScreen> createState() => _PublicProfileScreenState();
}

class _PublicProfileScreenState extends State<PublicProfileScreen> {
  static const labels = {
    'name': "Person's name",
    'age': 'Age',
    'region': 'Region',
    'lastSeen': 'Last seen details',
    'summary': 'Family-written summary',
    'photo': 'Person photo',
  };
  final _summary = TextEditingController();
  final Set<String> _fields = {'name'};
  bool _requested = false;
  bool _loading = true;
  bool _busy = false;
  String? _error;
  String? _notice;
  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _summary.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final item = await familyApi.getPublicProfile(widget.caseInfo.id);
      if (!mounted) return;
      setState(() {
        _fields
          ..clear()
          ..addAll(
            item.publicFields.isEmpty ? const ['name'] : item.publicFields,
          );
        _summary.text = item.publicSummary;
        _requested = item.publicRequested;
        _loading = false;
      });
    } on Object catch (error) {
      if (mounted)
        setState(() {
          _error = error is FamilyApiException
              ? error.message
              : 'Unable to load public settings.';
          _loading = false;
        });
    }
  }

  void _toggle(String field, bool enabled) => setState(() {
    enabled ? _fields.add(field) : _fields.remove(field);
  });
  Future<void> _save() async {
    if (_requested && !_fields.contains('name')) {
      setState(
        () =>
            _error = "Include the person's name before requesting publication.",
      );
      return;
    }
    if (_fields.contains('photo') && widget.caseInfo.imageAssetId == null) {
      setState(
        () => _error =
            'Add a person photo in case details before including it publicly.',
      );
      return;
    }
    if (_fields.contains('summary') && _summary.text.trim().length < 10) {
      setState(
        () => _error = 'Write at least 10 characters in the public summary.',
      );
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
      _notice = null;
    });
    try {
      await familyApi.savePublicProfile(
        widget.caseInfo.id,
        fields: _fields.toList(),
        summary: _summary.text.trim(),
        requestPublication: _requested,
      );
      if (mounted)
        setState(
          () => _notice = _requested
              ? 'Public details saved. A moderator must verify the case before it becomes public.'
              : 'Public settings saved. This case remains private.',
        );
      if (mounted) FamilyToast.success(context, _notice!);
    } on Object catch (error) {
      if (mounted)
        setState(
          () => _error = error is FamilyApiException
              ? error.message
              : 'Could not save public settings.',
        );
      if (mounted) FamilyToast.error(context, _error!);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Public details')),
    body: _loading
        ? const Center(child: CircularProgressIndicator(color: brandTeal))
        : ListView(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
            children: [
              BrandHeader(title: widget.caseInfo.name),
              const SizedBox(height: 13),
              const PrivacyCard(
                text: 'Only selected details can appear in public search. Family contact information, private notes, exact coordinates, and sighting evidence stay private.',
              ),
              const SizedBox(height: 20),
              Text(
                'Choose what the public can see',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 8),
              ...labels.entries.map(
                (entry) => CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  value: _fields.contains(entry.key),
                  onChanged:
                      entry.key == 'name' ||
                          (entry.key == 'photo' &&
                              widget.caseInfo.imageAssetId == null)
                      ? null
                      : (value) => _toggle(entry.key, value == true),
                  title: Text(entry.value),
                  subtitle: entry.key == 'name'
                      ? const Text('Required for publication.')
                      : entry.key == 'photo' &&
                            widget.caseInfo.imageAssetId == null
                      ? const Text('Add a photo in Case details first.')
                      : null,
                  controlAffinity: ListTileControlAffinity.leading,
                  activeColor: brandTeal,
                ),
              ),
              if (_fields.contains('summary')) ...[
                const SizedBox(height: 10),
                TextField(
                  controller: _summary,
                  maxLength: 1000,
                  minLines: 3,
                  maxLines: 5,
                  textCapitalization: TextCapitalization.sentences,
                  decoration: const InputDecoration(
                    labelText: 'Public summary',
                    hintText: 'Share only what you want everyone to see.',
                  ),
                ),
              ],
              const SizedBox(height: 8),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                activeColor: brandTeal,
                value: _requested,
                onChanged: widget.caseInfo.status == 'Found'
                    ? null
                    : (value) => setState(() => _requested = value),
                title: const Text('Request publication'),
                subtitle: const Text(
                  'A moderator verifies selected details before anything appears publicly.',
                ),
              ),
              if (widget.caseInfo.visibility == 'public')
                const Padding(
                  padding: EdgeInsets.only(bottom: 12),
                  child: Text(
                    'Changing public settings makes the case private until a moderator reviews it again.',
                  ),
                ),
              if (_error != null) _FormMessage(text: _error!, isError: true),
              if (_notice != null) _FormMessage(text: _notice!),
              FilledButton(
                onPressed: _busy ? null : _save,
                child: Text(_busy ? 'Saving...' : 'Save public settings'),
              ),
            ],
          ),
  );
}

class FlyerScreen extends StatefulWidget {
  const FlyerScreen({super.key, required this.caseInfo});
  final FamilyCase caseInfo;
  @override
  State<FlyerScreen> createState() => _FlyerScreenState();
}

class _FlyerScreenState extends State<FlyerScreen> {
  final _flyerKey = GlobalKey();
  static const labels = {
    'name': "Person's name",
    'age': 'Age',
    'region': 'Region',
    'lastSeen': 'Last seen details',
    'summary': 'Flyer summary',
    'contact': 'Family contact',
  };
  final _summary = TextEditingController();
  final Set<String> _fields = {'name', 'age', 'region', 'lastSeen', 'contact'};
  bool _loading = true;
  bool _busy = false;
  bool _savingImage = false;
  String? _error;
  String? _notice;
  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _summary.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final item = await familyApi.getCase(
        widget.caseInfo.id,
        includeFlyer: true,
      );
      if (mounted)
        setState(() {
          _fields
            ..clear()
            ..addAll(item.flyerFields);
          _summary.text = item.flyerSummary;
          _loading = false;
        });
    } on Object catch (error) {
      if (mounted)
        setState(() {
          _error = error is FamilyApiException
              ? error.message
              : 'Unable to load flyer settings.';
          _loading = false;
        });
    }
  }

  Future<void> _save() async {
    if (_fields.contains('summary') && _summary.text.trim().length < 10) {
      setState(
        () => _error = 'Write at least 10 characters for the flyer summary.',
      );
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
      _notice = null;
    });
    try {
      await familyApi.saveFlyer(
        widget.caseInfo.id,
        fields: _fields.toList(),
        summary: _summary.text.trim(),
      );
      if (mounted) {
        setState(() => _notice = 'Flyer details saved privately.');
        FamilyToast.success(context, _notice!);
      }
    } on Object catch (error) {
      if (mounted)
        setState(
          () => _error = error is FamilyApiException
              ? error.message
              : 'Could not save flyer details.',
        );
      if (mounted) FamilyToast.error(context, _error!);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _saveFlyerImage() async {
    setState(() {
      _savingImage = true;
      _error = null;
      _notice = null;
    });
    try {
      final boundary =
          _flyerKey.currentContext?.findRenderObject()
              as RenderRepaintBoundary?;
      if (boundary == null || boundary.debugNeedsPaint) {
        throw Exception(
          'The flyer preview is still loading. Try again in a moment.',
        );
      }
      final image = await boundary.toImage(pixelRatio: 3);
      final data = await image.toByteData(format: ui.ImageByteFormat.png);
      image.dispose();
      if (data == null)
        throw Exception('The flyer image could not be created.');
      final bytes = data.buffer.asUint8List(
        data.offsetInBytes,
        data.lengthInBytes,
      );

      var hasAccess = await Gal.hasAccess(toAlbum: true);
      if (!hasAccess) hasAccess = await Gal.requestAccess(toAlbum: true);
      if (!hasAccess) {
        throw Exception(
          'Allow REUNITE Family to add images to your gallery, then try again.',
        );
      }
      final safeCaseNumber = widget.caseInfo.caseNumber.replaceAll(
        RegExp(r'[^a-zA-Z0-9-]'),
        '-',
      );
      await Gal.putImageBytes(
        bytes,
        album: 'REUNITE',
        name: 'reunite-$safeCaseNumber',
      );
      if (mounted) {
        setState(() => _notice = 'Flyer image saved to your gallery.');
        FamilyToast.success(context, _notice!);
      }
    } on Object catch (error) {
      if (mounted) {
        setState(
          () => _error = error is GalException
              ? error.type.message
              : error.toString().replaceFirst('Exception: ', ''),
        );
        FamilyToast.error(context, _error!);
      }
    } finally {
      if (mounted) setState(() => _savingImage = false);
    }
  }

  String get _flyerText {
    final item = widget.caseInfo;
    final lines = <String>[
      'MISSING PERSON',
      if (_fields.contains('name')) item.name,
      if (_fields.contains('age') && item.age != 'Unknown') 'Age: ${item.age}',
      if (_fields.contains('region')) 'Region: ${item.region}',
      if (_fields.contains('lastSeen')) 'Last seen: ${item.lastSeen}',
      if (_fields.contains('summary')) _summary.text.trim(),
      if (_fields.contains('contact')) 'Family contact: ${item.contact}',
      '',
      'Case reference: ${item.caseNumber}',
      'REUNITE · REPORT. FIND. REUNITE.',
    ];
    return lines.where((line) => line.isNotEmpty).join('\n');
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Case flyer')),
    body: _loading
        ? const Center(child: CircularProgressIndicator(color: brandTeal))
        : ListView(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
            children: [
              BrandHeader(title: 'Flyer settings'),
              const SizedBox(height: 12),
              Text(
                'Select details',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              ...labels.entries.map(
                (entry) => CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  value: _fields.contains(entry.key),
                  onChanged: entry.key == 'name'
                      ? null
                      : (value) => setState(
                          () => value == true
                              ? _fields.add(entry.key)
                              : _fields.remove(entry.key),
                        ),
                  title: Text(entry.value),
                  controlAffinity: ListTileControlAffinity.leading,
                  activeColor: brandTeal,
                ),
              ),
              if (_fields.contains('summary'))
                TextField(
                  controller: _summary,
                  minLines: 3,
                  maxLines: 5,
                  maxLength: 1000,
                  decoration: const InputDecoration(labelText: 'Flyer summary'),
                ),
              const SizedBox(height: 14),
              Text('Preview', style: Theme.of(context).textTheme.titleLarge),
              RepaintBoundary(
                key: _flyerKey,
                child: Card(
                  elevation: 1,
                  child: Padding(
                    padding: const EdgeInsets.all(18),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Center(
                          child: Image.asset(
                            'assets/brand/reunite-wordmark.png',
                            width: 150,
                            height: 42,
                            fit: BoxFit.contain,
                          ),
                        ),
                        if (widget.caseInfo.imageAssetId != null)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(12),
                              child: Image.network(
                                familyApi.mediaUrl(
                                  widget.caseInfo.imageAssetId!,
                                ),
                                headers: familyApi.mediaHeaders,
                                width: double.infinity,
                                height: 190,
                                fit: BoxFit.cover,
                                errorBuilder: (_, _, _) =>
                                    const SizedBox.shrink(),
                              ),
                            ),
                          ),
                        Text(
                          'MISSING PERSON',
                          style: Theme.of(context).textTheme.labelLarge
                              ?.copyWith(
                                color: brandTeal,
                                letterSpacing: 1.2,
                                fontWeight: FontWeight.w800,
                              ),
                        ),
                        if (_fields.contains('name'))
                          Text(
                            widget.caseInfo.name,
                            style: Theme.of(context).textTheme.headlineSmall,
                          ),
                        if (_fields.contains('age') &&
                            widget.caseInfo.age != 'Unknown')
                          Text('Age: ${widget.caseInfo.age}'),
                        if (_fields.contains('region'))
                          Text('Region: ${widget.caseInfo.region}'),
                        if (_fields.contains('lastSeen'))
                          Text('Last seen: ${widget.caseInfo.lastSeen}'),
                        if (_fields.contains('summary'))
                          Padding(
                            padding: const EdgeInsets.only(top: 8),
                            child: Text(
                              _summary.text.isEmpty
                                  ? 'Flyer summary'
                                  : _summary.text,
                            ),
                          ),
                        if (_fields.contains('contact'))
                          Padding(
                            padding: const EdgeInsets.only(top: 12),
                            child: Text(
                              'If you have information, contact: ${widget.caseInfo.contact}',
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        const SizedBox(height: 10),
                        Text(
                          'Case reference: ${widget.caseInfo.caseNumber}',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              if (_error != null) _FormMessage(text: _error!, isError: true),
              if (_notice != null) _FormMessage(text: _notice!),
              const SizedBox(height: 12),
              FilledButton.icon(
                onPressed: _busy ? null : _save,
                icon: const Icon(Icons.save_outlined),
                label: Text(_busy ? 'Saving...' : 'Save flyer details'),
              ),
              const SizedBox(height: 8),
              OutlinedButton.icon(
                onPressed: _savingImage ? null : _saveFlyerImage,
                icon: const Icon(Icons.photo_library_outlined),
                label: Text(
                  _savingImage
                      ? 'Saving image...'
                      : 'Save flyer image to gallery',
                ),
              ),
              const SizedBox(height: 8),
              OutlinedButton.icon(
                onPressed: () async {
                  await Clipboard.setData(ClipboardData(text: _flyerText));
                  if (mounted)
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text(
                          'Flyer text copied. You can paste it into a message or document.',
                        ),
                      ),
                    );
                },
                icon: const Icon(Icons.copy_all_outlined),
                label: const Text('Copy flyer text'),
              ),
            ],
          ),
  );
}

class ModeratorScreen extends StatefulWidget {
  const ModeratorScreen({super.key, required this.caseInfo});
  final FamilyCase caseInfo;
  @override
  State<ModeratorScreen> createState() => _ModeratorScreenState();
}

class _ModeratorScreenState extends State<ModeratorScreen> {
  final _email = TextEditingController();
  List<ModeratorInvitation> _items = const [];
  String? _inviteUrl;
  String? _error;
  String? _notice;
  bool _loading = true;
  bool _busy = false;
  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final items = await familyApi.getModerators(widget.caseInfo.id);
      if (mounted)
        setState(() {
          _items = items;
          _loading = false;
        });
    } on Object catch (error) {
      if (mounted)
        setState(() {
          _error = error is FamilyApiException
              ? error.message
              : 'Unable to load case access.';
          _loading = false;
        });
    }
  }

  Future<void> _invite() async {
    if (!_email.text.contains('@')) {
      setState(() => _error = 'Enter a valid moderator email address.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
      _notice = null;
      _inviteUrl = null;
    });
    try {
      final data = await familyApi.inviteModerator(
        widget.caseInfo.id,
        _email.text.trim(),
      );
      final url = data['inviteUrl']?.toString();
      setState(() {
        _email.clear();
        _inviteUrl = url;
        _notice = url == null
            ? 'Registered moderator assigned to this case.'
            : data['emailSent'] == true
            ? 'Invitation email sent. You can also share the invitation link.'
            : 'Invitation created. Email delivery is not configured, so share the link below with the invited person.';
      });
      if (mounted) FamilyToast.success(context, _notice!);
      await _load();
    } on Object catch (error) {
      if (mounted)
        setState(
          () => _error = error is FamilyApiException
              ? error.message
              : 'Could not invite this moderator.',
        );
      if (mounted) FamilyToast.error(context, _error!);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _revoke(ModeratorInvitation item) async {
    setState(() {
      _busy = true;
      _error = null;
      _notice = null;
    });
    try {
      await familyApi.revokeModerator(widget.caseInfo.id, item.id);
      setState(() => _notice = 'Moderator access removed.');
      if (mounted) FamilyToast.success(context, _notice!);
      await _load();
    } on Object catch (error) {
      if (mounted)
        setState(
          () => _error = error is FamilyApiException
              ? error.message
              : 'Could not remove moderator access.',
        );
      if (mounted) FamilyToast.error(context, _error!);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Moderator access')),
    body: ListView(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
      children: [
        BrandHeader(title: widget.caseInfo.name),
        const SizedBox(height: 12),
        const PrivacyCard(
          text: 'Each moderator receives access to this case only. Invitations expire after seven days. You can revoke access at any time.',
        ),
        const SizedBox(height: 18),
        Text('Add a moderator', style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 8),
        TextField(
          controller: _email,
          keyboardType: TextInputType.emailAddress,
          decoration: const InputDecoration(
            labelText: 'Moderator email address',
          ),
        ),
        const SizedBox(height: 10),
        FilledButton.icon(
          onPressed: _busy ? null : _invite,
          icon: const Icon(Icons.person_add_alt_1),
          label: Text(_busy ? 'Working...' : 'Assign or invite'),
        ),
        if (_inviteUrl != null) ...[
          const SizedBox(height: 10),
          SelectableText(_inviteUrl!, style: const TextStyle(color: brandTeal)),
          TextButton.icon(
            onPressed: () async {
              await Clipboard.setData(ClipboardData(text: _inviteUrl!));
              if (mounted)
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text(
                      'Invitation link copied. Share it only with the invited person.',
                    ),
                  ),
                );
            },
            icon: const Icon(Icons.copy),
            label: const Text('Copy invitation link'),
          ),
        ],
        if (_error != null) _FormMessage(text: _error!, isError: true),
        if (_notice != null) _FormMessage(text: _notice!),
        const SizedBox(height: 22),
        Text(
          'Invitations and assignments',
          style: Theme.of(context).textTheme.titleLarge,
        ),
        if (_loading)
          const Padding(
            padding: EdgeInsets.all(20),
            child: Center(child: CircularProgressIndicator(color: brandTeal)),
          ),
        if (!_loading && _items.isEmpty)
          const Padding(
            padding: EdgeInsets.only(top: 12),
            child: Text('No moderators assigned yet.'),
          ),
        ..._items.map(
          (item) => Card(
            elevation: 0,
            margin: const EdgeInsets.only(top: 10),
            child: ListTile(
              title: Text(item.email),
              subtitle: Text(
                '${item.status} - invited ${_formatDate(item.createdAt)}${item.expiresAt.isNotEmpty && item.status == 'pending' ? ' - expires ${_formatDate(item.expiresAt)}' : ''}',
              ),
              trailing: item.status == 'accepted' || item.status == 'pending'
                  ? IconButton(
                      tooltip: item.status == 'accepted'
                          ? 'Remove access'
                          : 'Revoke invitation',
                      onPressed: _busy ? null : () => _revoke(item),
                      icon: const Icon(
                        Icons.remove_circle_outline,
                        color: Color(0xFF9B3D35),
                      ),
                    )
                  : const Icon(Icons.history),
            ),
          ),
        ),
      ],
    ),
  );
}

class _FormMessage extends StatelessWidget {
  const _FormMessage({required this.text, this.isError = false});
  final String text;
  final bool isError;
  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(bottom: 10),
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: isError ? const Color(0xFFFFECEA) : const Color(0xFFE5F2E7),
      borderRadius: BorderRadius.circular(12),
    ),
    child: Text(
      text,
      style: TextStyle(
        color: isError ? const Color(0xFF94352E) : const Color(0xFF2B6941),
      ),
    ),
  );
}

String _formatDate(String value) {
  final date = DateTime.tryParse(value)?.toLocal();
  return date == null ? '' : '${date.day}/${date.month}/${date.year}';
}
