import 'package:flutter/material.dart';

import '../main.dart';
import '../models/family_models.dart';
import '../services/family_api.dart';
import 'family_widgets.dart';
import 'family_toast.dart';

class FamilyNotificationsScreen extends StatefulWidget {
  const FamilyNotificationsScreen({
    super.key,
    required this.onUnreadChanged,
    required this.onOpenCase,
  });
  final ValueChanged<int> onUnreadChanged;
  final void Function(String caseId, String caseNumber) onOpenCase;
  @override
  State<FamilyNotificationsScreen> createState() =>
      _FamilyNotificationsScreenState();
}

class _FamilyNotificationsScreenState extends State<FamilyNotificationsScreen> {
  List<FamilyNotification> _items = const [];
  bool _loading = true;
  String? _error;
  bool _busy = false;
  int _unread = 0;
  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final knownIds = _items.map((item) => item.id).toSet();
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await familyApi.getNotifications();
      final items = (data['items'] as List? ?? const [])
          .whereType<Map>()
          .map(
            (item) =>
                FamilyNotification.fromJson(Map<String, dynamic>.from(item)),
          )
          .toList();
      final unread = (data['unreadCount'] as num?)?.toInt() ?? 0;
      if (mounted)
        setState(() {
          _items = items;
          _unread = unread;
          _loading = false;
        });
      widget.onUnreadChanged(unread);
      final newItems = items.where((item) => !knownIds.contains(item.id));
      if (mounted && knownIds.isNotEmpty && newItems.isNotEmpty) {
        final latest = newItems.first;
        FamilyToast.info(context, '${latest.title}: ${latest.message}');
      }
    } on Object catch (error) {
      if (mounted)
        setState(() {
          _error = error is FamilyApiException
              ? error.message
              : 'Unable to load your updates.';
          _loading = false;
        });
      if (mounted) {
        FamilyToast.error(
          context,
          error is FamilyApiException
              ? error.message
              : 'Unable to load your updates.',
        );
      }
    }
  }

  Future<void> _markRead(FamilyNotification item) async {
    if (item.readAt != null) return;
    setState(() => _busy = true);
    try {
      await familyApi.markNotificationRead(item.id);
      setState(() {
        _items = _items
            .map(
              (entry) => entry.id == item.id
                  ? FamilyNotification(
                      id: entry.id,
                      type: entry.type,
                      title: entry.title,
                      message: entry.message,
                      caseId: entry.caseId,
                      caseNumber: entry.caseNumber,
                      createdAt: entry.createdAt,
                      readAt: DateTime.now().toIso8601String(),
                    )
                  : entry,
            )
            .toList();
        _unread = (_unread - 1).clamp(0, 99999);
      });
      widget.onUnreadChanged(_unread);
      if (mounted) FamilyToast.success(context, 'Update marked as read.');
    } on Object catch (error) {
      if (mounted)
        setState(
          () => _error = error is FamilyApiException
              ? error.message
              : 'Could not update this notification.',
        );
      if (mounted) {
        FamilyToast.error(
          context,
          error is FamilyApiException
              ? error.message
              : 'Could not update this notification.',
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _markAllRead() async {
    setState(() => _busy = true);
    try {
      await familyApi.markAllNotificationsRead();
      final now = DateTime.now().toIso8601String();
      setState(() {
        _items = _items
            .map(
              (entry) => FamilyNotification(
                id: entry.id,
                type: entry.type,
                title: entry.title,
                message: entry.message,
                caseId: entry.caseId,
                caseNumber: entry.caseNumber,
                createdAt: entry.createdAt,
                readAt: entry.readAt ?? now,
              ),
            )
            .toList();
        _unread = 0;
      });
      widget.onUnreadChanged(0);
      if (mounted) FamilyToast.success(context, 'All updates marked as read.');
    } on Object catch (error) {
      if (mounted)
        setState(
          () => _error = error is FamilyApiException
              ? error.message
              : 'Could not update notifications.',
        );
      if (mounted) {
        FamilyToast.error(
          context,
          error is FamilyApiException
              ? error.message
              : 'Could not update notifications.',
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => RefreshIndicator(
    color: brandTeal,
    onRefresh: _load,
    child: ListView(
      padding: const EdgeInsets.fromLTRB(20, 14, 20, 24),
      children: [
        BrandHeader(
          title: 'Updates',
          action: _unread > 0
              ? TextButton(
                  onPressed: _busy ? null : _markAllRead,
                  child: const Text('Read all'),
                )
              : null,
        ),
        const SizedBox(height: 18),
        Text(
          _unread == 0
              ? "You're up to date."
              : '$_unread unread update${_unread == 1 ? '' : 's'}',
          style: Theme.of(context).textTheme.titleLarge,
        ),
        const SizedBox(height: 13),
        if (_loading)
          const Center(
            child: Padding(
              padding: EdgeInsets.all(30),
              child: CircularProgressIndicator(color: brandTeal),
            ),
          ),
        if (_error != null)
          Text(_error!, style: const TextStyle(color: Color(0xFF94352E))),
        if (!_loading && _error == null && _items.isEmpty)
          const PrivacyCard(
            text: 'New sightings and review decisions for your cases will appear here.',
          ),
        if (!_loading && _error == null)
          ..._items.map(
            (item) => Card(
              elevation: 0,
              color: item.readAt == null
                  ? const Color(0xFFEAF3F1)
                  : Colors.white,
              margin: const EdgeInsets.only(bottom: 10),
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            item.title,
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                        ),
                        if (item.readAt == null)
                          const Icon(Icons.circle, size: 8, color: brandTeal),
                      ],
                    ),
                    const SizedBox(height: 5),
                    Text(item.message),
                    const SizedBox(height: 8),
                    Text(
                      '${item.caseNumber}  ·  ${_date(item.createdAt)}',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        if (item.readAt == null)
                          TextButton(
                            onPressed: _busy ? null : () => _markRead(item),
                            child: const Text('Mark read'),
                          ),
                        TextButton(
                          onPressed: () async {
                            await _markRead(item);
                            if (item.caseId.isNotEmpty && mounted)
                              widget.onOpenCase(item.caseId, item.caseNumber);
                          },
                          child: const Text('Open case'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
      ],
    ),
  );
  String _date(String value) {
    final date = DateTime.tryParse(value)?.toLocal();
    return date == null ? '' : '${date.day}/${date.month}/${date.year}';
  }
}
