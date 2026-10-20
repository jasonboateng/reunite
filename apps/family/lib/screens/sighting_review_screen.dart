import 'package:flutter/material.dart';

import '../main.dart';
import '../models/family_models.dart';
import '../services/family_api.dart';
import 'family_widgets.dart';
import 'family_toast.dart';

class SightingReviewScreen extends StatefulWidget {
  const SightingReviewScreen({super.key, required this.caseInfo});
  final FamilyCase caseInfo;
  @override
  State<SightingReviewScreen> createState() => _SightingReviewScreenState();
}

class _SightingReviewScreenState extends State<SightingReviewScreen> {
  List<FamilySighting> _items = const [];
  bool _loading = true;
  String? _error;
  String _busyId = '';
  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final items = await familyApi.getSightings(widget.caseInfo.id);
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
              : 'Unable to load this case’s sightings.';
          _loading = false;
        });
    }
  }

  Future<void> _review(FamilySighting item, String decision) async {
    setState(() {
      _busyId = item.id;
      _error = null;
    });
    try {
      await familyApi.reviewSighting(widget.caseInfo.id, item.id, decision);
      if (mounted) {
        FamilyToast.success(
          context,
          decision == 'approved'
              ? 'Sighting approved.'
              : 'Sighting declined.',
        );
      }
      await _load();
    } on Object catch (error) {
      if (mounted)
        setState(
          () => _error = error is FamilyApiException
              ? error.message
              : 'Could not update this sighting.',
        );
      if (mounted) FamilyToast.error(context, _error!);
    } finally {
      if (mounted) setState(() => _busyId = '');
    }
  }

  Future<void> _visibility(FamilySighting item, bool value) async {
    setState(() {
      _busyId = item.id;
      _error = null;
    });
    try {
      await familyApi.setSightingPublic(widget.caseInfo.id, item.id, value);
      if (mounted) {
        FamilyToast.success(
          context,
          value ? 'Sighting shared publicly.' : 'Sighting hidden from public view.',
        );
      }
      await _load();
    } on Object catch (error) {
      if (mounted)
        setState(
          () => _error = error is FamilyApiException
              ? error.message
              : 'Could not update sighting visibility.',
        );
      if (mounted) FamilyToast.error(context, _error!);
    } finally {
      if (mounted) setState(() => _busyId = '');
    }
  }

  @override
  Widget build(BuildContext context) {
    final pending = _items
        .where((item) => item.status == 'pending-family-review')
        .toList();
    final reviewed = _items
        .where((item) => item.status != 'pending-family-review')
        .toList();
    return Scaffold(
      appBar: AppBar(title: const Text('Review sightings')),
      body: RefreshIndicator(
        color: brandTeal,
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(18, 8, 18, 28),
          children: [
            BrandHeader(title: widget.caseInfo.name),
            const SizedBox(height: 12),
            const PrivacyCard(
              text: 'Exact coordinates and evidence are private to your family. Approving a sighting and making it public are separate decisions.',
            ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Text(
                  _error!,
                  style: const TextStyle(color: Color(0xFF94352E)),
                ),
              ),
            if (_loading)
              const Padding(
                padding: EdgeInsets.all(24),
                child: Center(
                  child: CircularProgressIndicator(color: brandTeal),
                ),
              ),
            if (!_loading && _items.isEmpty)
              const Padding(
                padding: EdgeInsets.only(top: 24),
                child: Text(
                  'No sightings have been submitted for this case yet.',
                ),
              ),
            if (pending.isNotEmpty) ...[
              const SizedBox(height: 20),
              Text(
                'Needs your decision · ${pending.length}',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 9),
              ...pending.map(
                (item) => _SightingCard(
                  item: item,
                  busy: _busyId == item.id,
                  onReview: (decision) => _review(item, decision),
                  onVisibility: null,
                ),
              ),
            ],
            if (reviewed.isNotEmpty) ...[
              const SizedBox(height: 20),
              Text(
                'Reviewed · ${reviewed.length}',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 9),
              ...reviewed.map(
                (item) => _SightingCard(
                  item: item,
                  busy: _busyId == item.id,
                  onReview: null,
                  onVisibility: item.status == 'approved'
                      ? (value) => _visibility(item, value)
                      : null,
                  canPublish:
                      widget.caseInfo.status == 'Active' &&
                      widget.caseInfo.visibility == 'public',
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _SightingCard extends StatelessWidget {
  const _SightingCard({
    required this.item,
    required this.busy,
    required this.onReview,
    required this.onVisibility,
    this.canPublish = false,
  });
  final FamilySighting item;
  final bool busy;
  final ValueChanged<String>? onReview;
  final ValueChanged<bool>? onVisibility;
  final bool canPublish;
  @override
  Widget build(BuildContext context) {
    final pending = item.status == 'pending-family-review';
    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(15),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Sighting ${item.id.substring(0, item.id.length > 8 ? 8 : item.id.length)}',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                _StateTag(status: item.status),
              ],
            ),
            const SizedBox(height: 10),
            Text(item.description),
            if (item.imageAssetId != null)
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: Image.network(
                    familyApi.mediaUrl(item.imageAssetId!),
                    headers: familyApi.mediaHeaders,
                    width: double.infinity,
                    height: 200,
                    fit: BoxFit.cover,
                    errorBuilder: (_, _, _) => const SizedBox(
                      height: 80,
                      child: Center(
                        child: Icon(Icons.image_not_supported_outlined),
                      ),
                    ),
                  ),
                ),
              ),
            const SizedBox(height: 12),
            _Fact(label: 'Observed', value: _formatDate(item.observedAt)),
            _Fact(label: 'Place', value: item.location),
            _Fact(
              label: 'Coordinates - private',
              value:
                  '${item.latitude.toStringAsFixed(5)}, ${item.longitude.toStringAsFixed(5)}',
            ),
            _Fact(label: 'Submitted', value: _formatDate(item.submittedAt)),
            if (pending && onReview != null) ...[
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: busy ? null : () => onReview!('rejected'),
                      child: const Text('Reject'),
                    ),
                  ),
                  const SizedBox(width: 9),
                  Expanded(
                    child: FilledButton(
                      onPressed: busy ? null : () => onReview!('approved'),
                      child: Text(busy ? 'Saving...' : 'Approve'),
                    ),
                  ),
                ],
              ),
            ],
            if (!pending && item.status == 'approved') ...[
              const Divider(height: 22),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                value: item.isPublic,
                onChanged: busy || !canPublish ? null : onVisibility,
                title: const Text('Visible on public case'),
                subtitle: Text(
                  canPublish
                      ? 'Only the case summary and place will be public. Coordinates stay private.'
                      : 'The case must be public and active before a sighting can be published.',
                ),
                activeColor: brandTeal,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _Fact extends StatelessWidget {
  const _Fact({required this.label, required this.value});
  final String label;
  final String value;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 5),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 142,
          child: Text(label, style: Theme.of(context).textTheme.bodySmall),
        ),
        Expanded(child: Text(value)),
      ],
    ),
  );
}

class _StateTag extends StatelessWidget {
  const _StateTag({required this.status});
  final String status;
  @override
  Widget build(BuildContext context) {
    final text = status == 'pending-family-review'
        ? 'Pending review'
        : status == 'approved'
        ? 'Approved'
        : 'Rejected';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: status == 'approved'
            ? const Color(0xFFE5F2E7)
            : status == 'rejected'
            ? const Color(0xFFFFECEA)
            : const Color(0xFFFFF1D8),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        text,
        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700),
      ),
    );
  }
}

String _formatDate(String value) {
  final date = DateTime.tryParse(value)?.toLocal();
  return date == null
      ? 'Not available'
      : '${date.day}/${date.month}/${date.year}  ${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
}
