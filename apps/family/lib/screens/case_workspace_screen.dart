import 'package:flutter/material.dart';

import '../main.dart';
import '../models/family_models.dart';
import '../services/family_api.dart';
import 'case_form_screen.dart';
import 'case_tools_screens.dart';
import 'family_widgets.dart';
import 'family_toast.dart';
import 'sighting_review_screen.dart';

class CaseWorkspaceScreen extends StatefulWidget {
  const CaseWorkspaceScreen({super.key, this.initialCase});
  final FamilyCase? initialCase;
  @override
  State<CaseWorkspaceScreen> createState() => _CaseWorkspaceScreenState();
}

class _CaseWorkspaceScreenState extends State<CaseWorkspaceScreen> {
  FamilyCase? _case;
  bool _loading = false;
  String? _error;
  bool get _creating =>
      widget.initialCase == null || widget.initialCase!.id.isEmpty;

  @override
  void initState() {
    super.initState();
    _case = widget.initialCase;
    if (!_creating) _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final item = await familyApi.getCase(widget.initialCase!.id);
      if (mounted) {
        setState(() {
          _case = item;
          _loading = false;
        });
      }
    } on Object catch (error) {
      if (mounted) {
        setState(() {
          _error = error is FamilyApiException
              ? error.message
              : 'Unable to load this case.';
          _loading = false;
        });
      }
    }
  }

  Future<void> _edit() async {
    final changed = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => CaseFormScreen(existingCase: _case)),
    );
    if (changed == true) await _load();
  }

  Future<void> _open(Widget page) async {
    await Navigator.of(context)
        .push<void>(MaterialPageRoute(builder: (_) => page));
    await _load();
  }

  Future<void> _markFound() async {
    final note = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Mark this person found?'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'This closes new public sightings. Family-approved public details remain visible for transparency.',
            ),
            const SizedBox(height: 12),
            TextField(
              controller: note,
              maxLength: 500,
              maxLines: 3,
              decoration: const InputDecoration(
                labelText: 'Optional resolution note',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Mark found'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted || _case == null) {
      note.dispose();
      return;
    }
    try {
      final message = await familyApi.markFound(_case!.id, note: note.text);
      if (mounted) {
        FamilyToast.success(context, message);
        await _load();
      }
    } on Object catch (error) {
      if (mounted) {
        FamilyToast.error(
          context,
          error is FamilyApiException
              ? error.message
              : 'Could not close this case.',
        );
      }
    } finally {
      note.dispose();
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_creating) {
      return CaseFormScreen(
        onCreated: (item) => Navigator.of(context).pop(item),
      );
    }
    final item = _case;
    return Scaffold(
      appBar: AppBar(title: const Text('Case workspace')),
      body: _loading && item == null
          ? const Center(child: CircularProgressIndicator(color: brandTeal))
          : _error != null && item == null
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(22),
                child: Text(_error!),
              ),
            )
          : item == null
          ? const SizedBox.shrink()
          : ListView(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 30),
              children: [
                BrandHeader(title: item.caseNumber),
                const SizedBox(height: 20),
                Card(
                  elevation: 0,
                  child: Padding(
                    padding: const EdgeInsets.all(17),
                    child: Row(
                      children: [
                        if (item.imageAssetId != null)
                          ClipRRect(
                            borderRadius: BorderRadius.circular(12),
                            child: Image.network(
                              familyApi.mediaUrl(item.imageAssetId!),
                              headers: familyApi.mediaHeaders,
                              width: 74,
                              height: 82,
                              fit: BoxFit.cover,
                              errorBuilder: (_, _, _) =>
                                  const _PersonPlaceholder(),
                            ),
                          )
                        else
                          const _PersonPlaceholder(),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                item.name,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: Theme.of(context).textTheme.titleLarge,
                              ),
                              const SizedBox(height: 3),
                              Text(
                                [
                                  if (item.age.isNotEmpty &&
                                      item.age != 'Unknown')
                                    '${item.age} years old',
                                  if (item.region.isNotEmpty) item.region,
                                ].join('  |  '),
                                style: Theme.of(context).textTheme.bodyMedium,
                              ),
                              const SizedBox(height: 8),
                              _StatusPill(text: item.status),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                if (item.status == 'Found') ...[
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: const Color(0xFFE8F3E9),
                      borderRadius: BorderRadius.circular(15),
                      border: Border.all(color: const Color(0xFFD5E7D8)),
                    ),
                    child: const Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(
                          Icons.check_circle_outline,
                          color: Color(0xFF28623D),
                        ),
                        SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'This person is marked found. New public sightings are closed. Family-approved public details remain visible for transparency.',
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
                if (item.reviewNote.isNotEmpty)
                  Container(
                    margin: const EdgeInsets.only(top: 12),
                    padding: const EdgeInsets.all(13),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFF1D8),
                      borderRadius: BorderRadius.circular(13),
                    ),
                    child: Text(
                      '${item.reviewState == 'declined' ? 'Review declined' : 'Changes requested'}: ${item.reviewNote}',
                    ),
                  ),
                const SizedBox(height: 19),
                Text(
                  'Manage this case',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 10),
                _ActionTile(
                  icon: Icons.edit_outlined,
                  title: 'Case details',
                  subtitle: 'Edit report, contact, and person photo',
                  onTap: _case!.status == 'Found' ? null : _edit,
                ),
                _ActionTile(
                  icon: Icons.visibility_outlined,
                  title: 'Review sightings',
                  subtitle: item.pendingSightings > 0
                      ? '${item.pendingSightings} ${item.pendingSightings == 1 ? 'sighting' : 'sightings'} waiting for review'
                      : '${item.approvedSightings} approved ${item.approvedSightings == 1 ? 'sighting' : 'sightings'}',
                  emphasized: item.pendingSightings > 0,
                  onTap: () => _open(SightingReviewScreen(caseInfo: item)),
                ),
                _ActionTile(
                  icon: Icons.public_outlined,
                  title: 'Public details',
                  subtitle: item.visibility == 'public'
                      ? 'Currently visible to the public'
                      : item.publicRequested
                      ? 'Publication requested'
                      : 'Choose what can be shared',
                  onTap: () => _open(PublicProfileScreen(caseInfo: item)),
                ),
                _ActionTile(
                  icon: Icons.description_outlined,
                  title: 'Create a flyer',
                  subtitle: 'Choose flyer details and preview it',
                  onTap: () => _open(FlyerScreen(caseInfo: item)),
                ),
                _ActionTile(
                  icon: Icons.group_add_outlined,
                  title: 'Moderator access',
                  subtitle: 'Assign a registered moderator or invite by email',
                  onTap: () => _open(ModeratorScreen(caseInfo: item)),
                ),
                const SizedBox(height: 12),
                if (item.status != 'Found')
                  OutlinedButton.icon(
                    onPressed: _markFound,
                    icon: const Icon(Icons.check_circle_outline),
                    label: const Text('Mark this person found'),
                  ),
                if (_error != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 12),
                    child: Text(
                      _error!,
                      style: const TextStyle(color: Color(0xFF94352E)),
                    ),
                  ),
              ],
            ),
    );
  }
}

class _ActionTile extends StatelessWidget {
  const _ActionTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
    this.emphasized = false,
  });
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback? onTap;
  final bool emphasized;
  @override
  Widget build(BuildContext context) => Card(
    margin: const EdgeInsets.only(bottom: 9),
    color: emphasized ? const Color(0xFFFFF8EC) : Colors.white,
    child: ListTile(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      enabled: onTap != null,
      contentPadding: const EdgeInsets.symmetric(horizontal: 15, vertical: 5),
      leading: Container(
        width: 42,
        height: 42,
        decoration: BoxDecoration(
          color: emphasized ? const Color(0xFFFFEBC8) : const Color(0xFFE9F2EF),
          borderRadius: BorderRadius.circular(13),
        ),
        child: Icon(
          icon,
          color: emphasized ? const Color(0xFF9B641C) : brandTeal,
        ),
      ),
      title: Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
      subtitle: Padding(
        padding: const EdgeInsets.only(top: 3),
        child: Text(subtitle),
      ),
      trailing: const Icon(
        Icons.chevron_right_rounded,
        color: Color(0xFF75817B),
      ),
      onTap: onTap,
    ),
  );
}

class _PersonPlaceholder extends StatelessWidget {
  const _PersonPlaceholder();
  @override
  Widget build(BuildContext context) => Container(
    width: 74,
    height: 82,
    decoration: BoxDecoration(
      color: const Color(0xFFEAF0ED),
      borderRadius: BorderRadius.circular(12),
    ),
    child: const Icon(Icons.person_outline, color: Color(0xFF6D7973), size: 34),
  );
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.text});
  final String text;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
    decoration: BoxDecoration(
      color: text == 'Found'
          ? const Color(0xFFE5F2E7)
          : text == 'Active'
          ? const Color(0xFFE4F1EE)
          : const Color(0xFFFFF1D8),
      borderRadius: BorderRadius.circular(20),
    ),
    child: Text(
      text,
      style: TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.w700,
        color: text == 'Found'
            ? const Color(0xFF28623D)
            : text == 'Active'
            ? brandTeal
            : const Color(0xFF895812),
      ),
    ),
  );
}
