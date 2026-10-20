import 'package:flutter/material.dart';

import '../main.dart';
import '../models/public_case.dart';
import '../services/citizen_api.dart';
import 'case_detail_screen.dart';

final citizenApi = CitizenApi();

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _searchController = TextEditingController();
  final _api = citizenApi;
  List<PublicCase> _cases = const [];
  bool _loading = true;
  String? _error;
  int _selectedTab = 0;
  String _caseStatusFilter = 'all';

  @override
  void initState() {
    super.initState();
    _loadCases();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadCases() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final cases = await _api.fetchCases();
      if (!mounted) return;
      setState(() {
        _cases = cases;
        _loading = false;
      });
    } on Object catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error is CitizenApiException
            ? error.message
            : 'Could not load public cases. Please try again.';
        _loading = false;
      });
    }
  }

  List<PublicCase> get _visibleCases {
    final query = _searchController.text.trim().toLowerCase();
    return _cases
        .where((item) {
          final matchesStatus =
              _caseStatusFilter == 'all' ||
              (_caseStatusFilter == 'found'
                  ? item.status == 'Found'
                  : item.status != 'Found');
          final matchesQuery =
              query.isEmpty ||
              item.name.toLowerCase().contains(query) ||
              item.id.toLowerCase().contains(query) ||
              (item.region?.toLowerCase().contains(query) ?? false);
          return matchesStatus && matchesQuery;
        })
        .toList(growable: false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: _selectedTab == 0 ? _buildCasesPage() : _buildSafetyPage(),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _selectedTab,
        onDestinationSelected: (index) => setState(() => _selectedTab = index),
        backgroundColor: Colors.white,
        indicatorColor: const Color(0xFFE0F0E8),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.search_rounded),
            label: 'Find people',
          ),
          NavigationDestination(
            icon: Icon(Icons.shield_outlined),
            label: 'Safety',
          ),
        ],
      ),
    );
  }

  Widget _buildCasesPage() {
    final cases = _visibleCases;
    return RefreshIndicator(
      onRefresh: _loadCases,
      color: brandGreen,
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(20, 14, 20, 28),
            sliver: SliverList(
              delegate: SliverChildListDelegate([
                _buildTopBar(),
                const SizedBox(height: 22),
                _buildHero(),
                const SizedBox(height: 22),
                TextField(
                  controller: _searchController,
                  onChanged: (_) => setState(() {}),
                  textInputAction: TextInputAction.search,
                  decoration: InputDecoration(
                    hintText: 'Search by name, case ID, or region',
                    prefixIcon: const Icon(
                      Icons.search_rounded,
                      color: brandGreen,
                    ),
                    suffixIcon: _searchController.text.isEmpty
                        ? null
                        : IconButton(
                            tooltip: 'Clear search',
                            onPressed: () {
                              _searchController.clear();
                              setState(() {});
                            },
                            icon: const Icon(Icons.close_rounded),
                          ),
                  ),
                ),
                const SizedBox(height: 25),
                Wrap(
                  spacing: 8,
                  children: [
                    _caseFilterChip('all', 'All cases', _cases.length),
                    _caseFilterChip(
                      'active',
                      'Current cases',
                      _cases.where((item) => item.status != 'Found').length,
                    ),
                    _caseFilterChip(
                      'found',
                      'Found cases',
                      _cases.where((item) => item.status == 'Found').length,
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        _caseStatusFilter == 'found'
                            ? 'Found cases'
                            : _caseStatusFilter == 'active'
                            ? 'Current cases'
                            : 'Public cases',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                    ),
                    if (!_loading && _error == null)
                      Text(
                        '${cases.length} cases',
                        style: const TextStyle(color: Color(0xFF77827C)),
                      ),
                  ],
                ),
                const SizedBox(height: 12),
                if (_loading)
                  const _LoadingState()
                else if (_error != null)
                  _ErrorState(message: _error!, onRetry: _loadCases)
                else if (cases.isEmpty)
                  _EmptyState(
                    title: _searchController.text.isEmpty
                        ? _caseStatusFilter == 'found'
                              ? 'No found cases yet'
                              : 'No public cases yet'
                        : 'No matching cases',
                    message: _searchController.text.isEmpty
                        ? _caseStatusFilter == 'found'
                              ? 'Cases marked found will remain available here when their family-approved details were public.'
                              : 'Approved cases will appear here. Pull down to refresh.'
                        : 'Try another name, case ID, or region.',
                  )
                else
                  ...cases.map(
                    (item) => Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: _CaseCard(
                        item: item,
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute<void>(
                            builder: (_) => CaseDetailScreen(caseId: item.id),
                          ),
                        ),
                      ),
                    ),
                  ),
                const SizedBox(height: 14),
                const _TrustNote(),
              ]),
            ),
          ),
        ],
      ),
    );
  }

  Widget _caseFilterChip(String value, String label, int count) {
    final selected = _caseStatusFilter == value;
    return FilterChip(
      label: Text('$label ($count)'),
      selected: selected,
      onSelected: (_) => setState(() => _caseStatusFilter = value),
      selectedColor: const Color(0xFFE0F0E8),
      checkmarkColor: brandGreen,
      labelStyle: TextStyle(
        color: selected ? brandGreen : const Color(0xFF5F6B64),
        fontWeight: FontWeight.w700,
      ),
      side: BorderSide(color: selected ? brandGreen : const Color(0xFFDCE4DE)),
      backgroundColor: Colors.white,
    );
  }

  Widget _buildTopBar() {
    return Row(
      children: [
        SizedBox(
          height: 27,
          child: Image.asset(
            'assets/brand/reunite-wordmark.png',
            fit: BoxFit.contain,
            alignment: Alignment.centerLeft,
          ),
        ),
        const SizedBox(width: 12),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'CITIZEN NETWORK',
              style: TextStyle(
                fontSize: 9,
                letterSpacing: 1.6,
                color: brandGreen,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
        const Spacer(),
        IconButton(
          tooltip: 'Refresh cases',
          onPressed: _loading ? null : _loadCases,
          icon: const Icon(Icons.refresh_rounded),
        ),
      ],
    );
  }

  Widget _buildHero() {
    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        gradient: const LinearGradient(
          colors: [deepGreen, brandGreen],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: .14),
              borderRadius: BorderRadius.circular(30),
            ),
            child: const Text(
              'COMMUNITY-POWERED',
              style: TextStyle(
                color: Colors.white,
                fontSize: 10,
                letterSpacing: 1.4,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
          const SizedBox(height: 17),
          Text(
            'Help someone\nfind their way home.',
            style: Theme.of(context).textTheme.headlineMedium
                ?.copyWith(color: Colors.white, fontSize: 29),
          ),
          const SizedBox(height: 9),
          Text(
            'Search family-approved cases or share a sighting with the people who need it.',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: Colors.white.withValues(alpha: .83),
              fontSize: 14,
            ),
          ),
          const SizedBox(height: 17),
          const Row(
            children: [
              Icon(
                Icons.verified_user_outlined,
                color: Color(0xFFE7C480),
                size: 17,
              ),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Sightings stay private until a family approves them.',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w600,
                    fontSize: 12,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSafetyPage() {
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 28),
      children: [
        _buildTopBar(),
        const SizedBox(height: 24),
        Text(
          'Share information safely',
          style: Theme.of(context).textTheme.headlineSmall,
        ),
        const SizedBox(height: 8),
        const Text(
          'A useful sighting can help a family. Keep yourself and the person safe while sharing it.',
        ),
        const SizedBox(height: 20),
        const _SafetyTip(
          icon: Icons.visibility_outlined,
          title: 'Observe from a safe place',
          body: 'Do not approach or follow anyone if it could put you or them at risk.',
        ),
        const _SafetyTip(
          icon: Icons.pin_drop_outlined,
          title: 'Share the place and time',
          body: 'A nearby landmark and accurate observation time help the family assess the report.',
        ),
        const _SafetyTip(
          icon: Icons.lock_outline_rounded,
          title: 'Your report starts private',
          body: 'The family reviews each sighting. It is not shared publicly unless they approve it.',
        ),
        const _SafetyTip(
          icon: Icons.emergency_outlined,
          title: 'Call for urgent help',
          body: 'If someone appears to be in immediate danger, contact local emergency services.',
        ),
        const SizedBox(height: 8),
        OutlinedButton.icon(
          onPressed: () => setState(() => _selectedTab = 0),
          icon: const Icon(Icons.search_rounded),
          label: const Text('Browse public cases'),
          style: OutlinedButton.styleFrom(
            padding: const EdgeInsets.symmetric(vertical: 15),
            foregroundColor: brandGreen,
          ),
        ),
      ],
    );
  }
}

class _CaseCard extends StatelessWidget {
  const _CaseCard({required this.item, required this.onTap});

  final PublicCase item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              _CaseImage(
                imageAssetId: item.imageAssetId,
                width: 88,
                height: 96,
                radius: 15,
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 9,
                        vertical: 5,
                      ),
                      decoration: BoxDecoration(
                        color: item.status == 'Found'
                            ? const Color(0xFFE8F1E8)
                            : const Color(0xFFE6F2EB),
                        borderRadius: BorderRadius.circular(30),
                      ),
                      child: Text(
                        item.status == 'Found'
                            ? 'FOUND'
                            : item.status.toUpperCase(),
                        style: const TextStyle(
                          color: brandGreen,
                          fontWeight: FontWeight.w800,
                          fontSize: 9,
                          letterSpacing: .8,
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      item.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _caseSubtitle(item),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Color(0xFF707B75),
                        fontSize: 12,
                      ),
                    ),
                    const SizedBox(height: 7),
                    Text(
                      'Case ${item.id}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Color(0xFF89938D),
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              const Icon(Icons.chevron_right_rounded, color: brandGreen),
            ],
          ),
        ),
      ),
    );
  }

  String _caseSubtitle(PublicCase item) {
    final parts = <String>[];
    if (item.age != null && item.age!.isNotEmpty)
      parts.add('${item.age} years old');
    if (item.region != null && item.region!.isNotEmpty) parts.add(item.region!);
    if (item.lastSeen != null && item.lastSeen!.isNotEmpty)
      parts.add('Last seen ${item.lastSeen}');
    return parts.isEmpty ? 'Details shared by family' : parts.join('  |  ');
  }
}

class _CaseImage extends StatelessWidget {
  const _CaseImage({
    this.imageAssetId,
    this.width = 130,
    this.height = 150,
    this.radius = 18,
  });

  final String? imageAssetId;
  final double width;
  final double height;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final imageId = imageAssetId;
    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: SizedBox(
        width: width,
        height: height,
        child: imageId == null
            ? const _PhotoPlaceholder()
            : Image.network(
                '${CitizenApi.baseUrl}/api/media/${Uri.encodeComponent(imageId)}',
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => const _PhotoPlaceholder(),
              ),
      ),
    );
  }
}

class _PhotoPlaceholder extends StatelessWidget {
  const _PhotoPlaceholder();

  @override
  Widget build(BuildContext context) {
    return Container(
      color: const Color(0xFFE7EEE8),
      child: const Icon(
        Icons.person_outline_rounded,
        color: Color(0xFF91A197),
        size: 42,
      ),
    );
  }
}

class _LoadingState extends StatelessWidget {
  const _LoadingState();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.symmetric(vertical: 45),
      child: Center(child: CircularProgressIndicator(color: brandGreen)),
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        children: [
          const Icon(
            Icons.wifi_off_rounded,
            color: Color(0xFFB5473E),
            size: 32,
          ),
          const SizedBox(height: 10),
          Text(message, textAlign: TextAlign.center),
          const SizedBox(height: 12),
          TextButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh_rounded),
            label: const Text('Try again'),
          ),
        ],
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.title, required this.message});

  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        children: [
          const Icon(
            Icons.search_off_rounded,
            size: 34,
            color: Color(0xFF8C9991),
          ),
          const SizedBox(height: 8),
          Text(title, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 5),
          Text(message, textAlign: TextAlign.center),
        ],
      ),
    );
  }
}

class _TrustNote extends StatelessWidget {
  const _TrustNote();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(15),
      decoration: BoxDecoration(
        color: const Color(0xFFE9F0EA),
        borderRadius: BorderRadius.circular(16),
      ),
      child: const Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.lock_outline_rounded, color: brandGreen, size: 19),
          SizedBox(width: 10),
          Expanded(
            child: Text(
              'Public cases show only details approved by the family. Sightings you send remain private until reviewed.',
              style: TextStyle(fontSize: 12, height: 1.4),
            ),
          ),
        ],
      ),
    );
  }
}

class _SafetyTip extends StatelessWidget {
  const _SafetyTip({
    required this.icon,
    required this.title,
    required this.body,
  });

  final IconData icon;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(17),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: const Color(0xFFE7F1E9),
              borderRadius: BorderRadius.circular(13),
            ),
            child: Icon(icon, color: brandGreen),
          ),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 4),
                Text(body),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
