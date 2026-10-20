import 'package:flutter/material.dart';

import '../main.dart';
import '../models/family_models.dart';
import '../services/family_api.dart';
import 'family_widgets.dart';

class FamilyCasesScreen extends StatefulWidget {
  const FamilyCasesScreen({
    super.key,
    required this.onOpenCase,
    required this.onCreate,
  });
  final ValueChanged<FamilyCase> onOpenCase;
  final VoidCallback onCreate;
  @override
  State<FamilyCasesScreen> createState() => _FamilyCasesScreenState();
}

class _FamilyCasesScreenState extends State<FamilyCasesScreen> {
  final _search = TextEditingController();
  List<FamilyCase> _cases = const [];
  String _filter = 'all';
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final items = await familyApi.getCases();
      if (mounted) {
        setState(() {
          _cases = items;
          _loading = false;
        });
      }
    } on Object catch (error) {
      if (mounted) {
        setState(() {
          _error = error is FamilyApiException
              ? error.message
              : 'Unable to load your cases.';
          _loading = false;
        });
      }
    }
  }

  List<FamilyCase> get _visibleCases {
    final query = _search.text.trim().toLowerCase();
    return _cases
        .where((item) {
          final matchesFilter =
              _filter == 'all' ||
              (_filter == 'found'
                  ? item.status.toLowerCase() == 'found'
                  : item.status.toLowerCase() != 'found');
          final matchesQuery =
              query.isEmpty ||
              item.name.toLowerCase().contains(query) ||
              item.caseNumber.toLowerCase().contains(query) ||
              item.region.toLowerCase().contains(query);
          return matchesFilter && matchesQuery;
        })
        .toList(growable: false);
  }

  @override
  Widget build(BuildContext context) {
    final visibleCases = _visibleCases;
    return RefreshIndicator(
      color: brandTeal,
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 14, 20, 24),
        children: [
          BrandHeader(
            title: 'Your cases',
            action: IconButton(
              onPressed: widget.onCreate,
              tooltip: 'New report',
              icon: const Icon(Icons.add_circle_outline_rounded),
            ),
          ),
          const SizedBox(height: 20),
          Text(
            'Case management',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: 6),
          const Text(
            'Open a case to edit details, review sightings, and manage sharing.',
          ),
          const SizedBox(height: 18),
          TextField(
            controller: _search,
            onChanged: (_) => setState(() {}),
            textInputAction: TextInputAction.search,
          style: Theme.of(context).textTheme.bodyMedium,
            decoration: InputDecoration(
            hintText: 'Search person, case number, or region',
              prefixIcon: const Icon(Icons.search_rounded, color: brandTeal),
              suffixIcon: _search.text.isEmpty
                  ? null
                  : IconButton(
                      tooltip: 'Clear search',
                      onPressed: () {
                        _search.clear();
                        setState(() {});
                      },
                      icon: const Icon(Icons.close_rounded),
                    ),
            ),
          ),
          const SizedBox(height: 13),
          Wrap(
            spacing: 8,
            children: [
            _filterChip('all', 'All', _cases.length),
              _filterChip(
                'active',
                'Current',
                _cases
                    .where((item) => item.status.toLowerCase() != 'found')
                    .length,
              ),
              _filterChip(
                'found',
                'Found',
                _cases
                    .where((item) => item.status.toLowerCase() == 'found')
                    .length,
              ),
            ],
          ),
          const SizedBox(height: 17),
          if (!_loading && _error == null)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Text(
                '${visibleCases.length} ${visibleCases.length == 1 ? 'case' : 'cases'}',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: const Color(0xFF68746D),
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          if (_loading)
            const Center(
              child: Padding(
                padding: EdgeInsets.all(28),
                child: CircularProgressIndicator(color: brandTeal),
              ),
            ),
          if (_error != null)
            _MessageCard(
              message: _error!,
              action: TextButton(onPressed: _load, child: const Text('Retry')),
            ),
          if (!_loading && _error == null && _cases.isEmpty)
            _MessageCard(
              message: 'No reports have been created under this account yet.',
              action: FilledButton.icon(
                onPressed: widget.onCreate,
                icon: const Icon(Icons.add),
                label: const Text('Create a report'),
              ),
            ),
          if (!_loading &&
              _error == null &&
              _cases.isNotEmpty &&
              visibleCases.isEmpty)
            _MessageCard(
              message: 'No cases match your search. Try another name or case number.',
              action: TextButton(
                onPressed: () {
                  _search.clear();
                  setState(() => _filter = 'all');
                },
                child: const Text('Clear filters'),
              ),
            ),
          if (!_loading && _error == null)
            ...visibleCases.map(
              (item) => FamilyCaseCard(
                item: item,
                onTap: () => widget.onOpenCase(item),
              ),
            ),
        ],
      ),
    );
  }

  Widget _filterChip(String value, String label, int count) {
    final selected = _filter == value;
    return FilterChip(
      label: Text('$label ($count)'),
      selected: selected,
      onSelected: (_) => setState(() => _filter = value),
      selectedColor: const Color(0xFFE1F0EA),
      checkmarkColor: brandTeal,
      side: BorderSide(color: selected ? brandTeal : const Color(0xFFDCE3DE)),
      labelStyle: TextStyle(
        color: selected ? brandTeal : const Color(0xFF59655F),
        fontWeight: FontWeight.w600,
      ),
      backgroundColor: Colors.white,
    );
  }
}

class _MessageCard extends StatelessWidget {
  const _MessageCard({required this.message, required this.action});
  final String message;
  final Widget action;
  @override
  Widget build(BuildContext context) => Card(
    elevation: 0,
    child: Padding(
      padding: const EdgeInsets.all(18),
      child: Column(
        children: [
          Text(message, textAlign: TextAlign.center),
          const SizedBox(height: 8),
          action,
        ],
      ),
    ),
  );
}
