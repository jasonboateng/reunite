import 'package:flutter/material.dart';

import '../main.dart';
import '../models/family_models.dart';
import '../services/family_api.dart';
import 'family_widgets.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({
    super.key,
    required this.user,
    required this.onOpenCase,
    required this.onViewAll,
    required this.onCreate,
  });
  final FamilyUser user;
  final ValueChanged<FamilyCase> onOpenCase;
  final VoidCallback onViewAll;
  final VoidCallback onCreate;
  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  List<FamilyCase> _cases = const [];
  bool _loading = true;
  String? _error;

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
      final cases = await familyApi.getCases();
      if (!mounted) return;
      setState(() {
        _cases = cases;
        _loading = false;
      });
    } on Object catch (error) {
      if (mounted) {
        setState(() {
          _error = error is FamilyApiException
              ? error.message
              : 'Unable to load your family workspace.';
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final pending = _cases.fold<int>(
      0,
      (sum, item) => sum + item.pendingSightings,
    );
    final caseNeedingReview = _cases.where((item) => item.pendingSightings > 0);
    final reviewCase = caseNeedingReview.isEmpty
        ? null
        : caseNeedingReview.first;
    return RefreshIndicator(
      color: brandTeal,
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 14, 20, 26),
        children: [
          BrandHeader(
            title: 'Family workspace',
            action: IconButton(
              onPressed: _load,
              tooltip: 'Refresh',
              icon: const Icon(Icons.refresh_rounded),
            ),
          ),
          const SizedBox(height: 19),
          Text(
            'Welcome back, ${widget.user.name.split(' ').first}',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: 5),
          Text(
            pending > 0
                ? 'You have $pending ${pending == 1 ? 'sighting' : 'sightings'} waiting for your review.'
                : 'Manage your cases and keep your family updated.',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 18),
          if (_error != null) _ErrorPanel(message: _error!, onRetry: _load),
          if (_loading) const LinearProgressIndicator(minHeight: 2),
          if (!_loading) ...[
            Row(
              children: [
                Expanded(
                  child: _MetricCard(
                    label: 'Cases',
                    value: '${_cases.length}',
                    icon: Icons.folder_outlined,
                    color: brandTeal,
                    onTap: widget.onViewAll,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _MetricCard(
                    label: 'Sightings to review',
                    value: '$pending',
                    icon: Icons.visibility_outlined,
                    color: const Color(0xFF9B641C),
                    highlighted: pending > 0,
                    onTap: reviewCase == null
                        ? null
                        : () => widget.onOpenCase(reviewCase),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 23),
            FilledButton.icon(
              onPressed: widget.onCreate,
              icon: const Icon(Icons.add_rounded),
              label: const Text('Report a missing person'),
            ),
            const SizedBox(height: 24),
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Your cases',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                ),
                if (_cases.length > 4)
                  TextButton(
                    onPressed: widget.onViewAll,
                    child: const Text('See all'),
                  ),
              ],
            ),
            if (_cases.isEmpty)
              _EmptyCases(onCreate: widget.onCreate)
            else
              ..._cases
                  .take(4)
                  .map(
                    (item) => FamilyCaseCard(
                      item: item,
                      onTap: () => widget.onOpenCase(item),
                    ),
                  ),
            const SizedBox(height: 14),
            const PrivacyCard(
              text: 'Reports and sightings remain private until you decide what to share. Public case details require moderator verification.',
            ),
          ],
        ],
      ),
    );
  }
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
    this.highlighted = false,
    this.onTap,
  });
  final String label;
  final String value;
  final IconData icon;
  final Color color;
  final bool highlighted;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) => Card(
    color: highlighted ? const Color(0xFFFFF8EC) : Colors.white,
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(18),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 13),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: highlighted
                    ? const Color(0xFFFFEBC8)
                    : const Color(0xFFE9F2EF),
                borderRadius: BorderRadius.circular(13),
              ),
              child: Icon(icon, color: color, size: 21),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(value, style: Theme.of(context).textTheme.titleLarge),
                  const SizedBox(height: 2),
                  Text(
                    label,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall
                        ?.copyWith(color: const Color(0xFF59655F), height: 1.2),
                  ),
                ],
              ),
            ),
            if (onTap != null)
              const Icon(
                Icons.chevron_right_rounded,
                color: Color(0xFF79857E),
                size: 20,
              ),
          ],
        ),
      ),
    ),
  );
}

class _EmptyCases extends StatelessWidget {
  const _EmptyCases({required this.onCreate});
  final VoidCallback onCreate;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 28),
    child: Column(
      children: [
        const Icon(
          Icons.folder_open_outlined,
          size: 40,
          color: Color(0xFF73807A),
        ),
        const SizedBox(height: 10),
        const Text('No family cases yet'),
        const SizedBox(height: 8),
        TextButton(onPressed: onCreate, child: const Text('Start a report')),
      ],
    ),
  );
}

class _ErrorPanel extends StatelessWidget {
  const _ErrorPanel({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;
  @override
  Widget build(BuildContext context) => Card(
    color: const Color(0xFFFFECEA),
    child: Padding(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(message),
          TextButton(onPressed: onRetry, child: const Text('Try again')),
        ],
      ),
    ),
  );
}
