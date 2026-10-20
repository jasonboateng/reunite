import 'package:flutter/material.dart';

import '../main.dart';
import '../models/family_models.dart';
import '../services/family_api.dart';

class BrandHeader extends StatelessWidget {
  const BrandHeader({super.key, required this.title, this.action});

  final String title;
  final Widget? action;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      Image.asset(
        'assets/brand/reunite-wordmark.png',
        height: 24,
        fit: BoxFit.contain,
      ),
      const SizedBox(width: 14),
      Expanded(
        child: Text(
          title,
          style: Theme.of(context).textTheme.titleMedium
              ?.copyWith(fontWeight: FontWeight.w600),
          overflow: TextOverflow.ellipsis,
        ),
      ),
      ?action,
    ],
  );
}

class PrivacyCard extends StatelessWidget {
  const PrivacyCard({super.key, required this.text});

  final String text;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(15),
    decoration: BoxDecoration(
      color: const Color(0xFFEAF3F1),
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: const Color(0xFFD8E8E2)),
    ),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Icon(Icons.lock_outline, size: 19, color: brandTeal),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            text,
            style: Theme.of(context).textTheme.bodySmall
                ?.copyWith(height: 1.45),
          ),
        ),
      ],
    ),
  );
}

class FamilyCaseCard extends StatelessWidget {
  const FamilyCaseCard({super.key, required this.item, required this.onTap});

  final FamilyCase item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Card(
    margin: const EdgeInsets.only(bottom: 12),
    child: InkWell(
      borderRadius: BorderRadius.circular(18),
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.all(13),
        child: Row(
          children: [
            if (item.imageAssetId != null)
              ClipRRect(
                borderRadius: BorderRadius.circular(13),
                child: Image.network(
                  '${FamilyApi.baseUrl}/api/media/${Uri.encodeComponent(item.imageAssetId!)}',
                  headers: familyApi.mediaHeaders,
                  width: 64,
                  height: 76,
                  fit: BoxFit.cover,
                  loadingBuilder: (context, child, progress) =>
                      progress == null ? child : const _PhotoPlaceholder(),
                  errorBuilder: (_, _, _) => const _PhotoPlaceholder(),
                ),
              )
            else
              const _PhotoPlaceholder(),
            const SizedBox(width: 13),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.name.isEmpty ? 'Unnamed case' : item.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Case ${_shortCaseReference(item.caseNumber)}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: const Color(0xFF69756F),
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  if (item.region.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      item.region,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall
                          ?.copyWith(color: const Color(0xFF69756F)),
                    ),
                  ],
                  const SizedBox(height: 7),
                  Wrap(
                    spacing: 6,
                    runSpacing: 5,
                    children: [
                      _StatusChip(
                        label: item.status,
                        tone: _statusTone(item.status),
                      ),
                      if (item.pendingSightings > 0)
                        _StatusChip(
                          label:
                              '${item.pendingSightings} ${item.pendingSightings == 1 ? 'sighting' : 'sightings'} to review',
                          tone: _StatusTone.attention,
                        ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(width: 4),
            const Icon(
              Icons.chevron_right_rounded,
              color: Color(0xFF75817B),
              size: 21,
            ),
          ],
        ),
      ),
    ),
  );
}

class _PhotoPlaceholder extends StatelessWidget {
  const _PhotoPlaceholder();

  @override
  Widget build(BuildContext context) => Container(
    width: 64,
    height: 76,
    decoration: BoxDecoration(
      color: const Color(0xFFEAF0ED),
      borderRadius: BorderRadius.circular(13),
    ),
    child: const Icon(Icons.person_outline_rounded, color: Color(0xFF6D7973)),
  );
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.label, required this.tone});

  final String label;
  final _StatusTone tone;

  @override
  Widget build(BuildContext context) {
    final (background, foreground) = switch (tone) {
      _StatusTone.attention => (
        const Color(0xFFFFF1D8),
        const Color(0xFF895812),
      ),
      _StatusTone.found => (const Color(0xFFE7F3E9), const Color(0xFF28623D)),
      _StatusTone.neutral => (const Color(0xFFECEFED), const Color(0xFF58645E)),
      _StatusTone.brand => (const Color(0xFFE4F1EE), brandTeal),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: foreground,
          fontSize: 11,
          height: 1.1,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

enum _StatusTone { attention, found, neutral, brand }

_StatusTone _statusTone(String status) {
  switch (status.toLowerCase()) {
    case 'found':
      return _StatusTone.found;
    case 'review':
    case 'pending':
    case 'draft':
      return _StatusTone.attention;
    case 'closed':
    case 'inactive':
      return _StatusTone.neutral;
    default:
      return _StatusTone.brand;
  }
}

String _shortCaseReference(String value) {
  if (value.length <= 14) return value;
  return '${value.substring(0, 11)}…';
}
