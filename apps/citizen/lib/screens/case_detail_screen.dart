import 'package:flutter/material.dart';

import '../main.dart';
import '../models/public_case.dart';
import '../services/citizen_api.dart';
import 'home_screen.dart' show citizenApi;
import 'sighting_form_screen.dart';

class CaseDetailScreen extends StatefulWidget {
  const CaseDetailScreen({super.key, required this.caseId});

  final String caseId;

  @override
  State<CaseDetailScreen> createState() => _CaseDetailScreenState();
}

class _CaseDetailScreenState extends State<CaseDetailScreen> {
  Future<_CasePageData> _load() async {
    final values = await Future.wait<Object>([
      citizenApi.fetchCase(widget.caseId),
      citizenApi.fetchSightings(widget.caseId),
    ]);
    return _CasePageData(
      values[0] as PublicCase,
      values[1] as List<PublicSighting>,
    );
  }

  Future<void> _reportSighting() async {
    final submitted = await Navigator.of(context).push<bool>(
      MaterialPageRoute<bool>(
        builder: (_) => SightingFormScreen(caseId: widget.caseId),
      ),
    );
    if (submitted == true && mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: FutureBuilder<_CasePageData>(
          future: _load(),
          builder: (context, snapshot) {
            if (snapshot.connectionState != ConnectionState.done) {
              return const Center(
                child: CircularProgressIndicator(color: brandGreen),
              );
            }
            if (snapshot.hasError || !snapshot.hasData) {
              return _DetailError(
                message: _errorText(snapshot.error),
                onRetry: () => setState(() {}),
              );
            }
            final data = snapshot.data!;
            return CustomScrollView(
              slivers: [
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
                  sliver: SliverList(
                    delegate: SliverChildListDelegate([
                      _BackBar(onBack: () => Navigator.of(context).maybePop()),
                      const SizedBox(height: 18),
                      _DetailHero(item: data.caseInfo),
                      if (data.caseInfo.status == 'Found') ...[
                        const SizedBox(height: 16),
                        _FoundStatusCard(foundAt: data.caseInfo.foundAt),
                      ],
                      const SizedBox(height: 18),
                      _CaseFacts(item: data.caseInfo),
                      if (data.caseInfo.description.isNotEmpty) ...[
                        const SizedBox(height: 18),
                        _DescriptionCard(
                          description: data.caseInfo.description,
                        ),
                      ],
                      const SizedBox(height: 24),
                      if (data.caseInfo.status != 'Found')
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                'Community sightings',
                                style: Theme.of(context).textTheme.titleLarge,
                              ),
                            ),
                            Text(
                              '${data.sightings.length}',
                              style: const TextStyle(
                                color: Color(0xFF78847D),
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                      if (data.caseInfo.status != 'Found') ...[
                        const SizedBox(height: 11),
                        if (data.sightings.isEmpty)
                          const _NoSightings()
                        else
                          ...data.sightings.map(
                            (sighting) => _SightingCard(sighting: sighting),
                          ),
                        const SizedBox(height: 20),
                        const _PrivacyBanner(),
                        const SizedBox(height: 14),
                        FilledButton.icon(
                          onPressed: _reportSighting,
                          icon: const Icon(Icons.add_location_alt_outlined),
                          label: const Text('Share a sighting'),
                        ),
                      ],
                      if (data.caseInfo.status != 'Found') ...[
                        const SizedBox(height: 8),
                        const Text(
                          'If someone may be in immediate danger, contact local emergency services.',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 12,
                            color: Color(0xFF707B75),
                          ),
                        ),
                      ],
                    ]),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  String _errorText(Object? error) {
    if (error is CitizenApiException) return error.message;
    return 'Could not load this case. Check your connection and try again.';
  }
}

class _CasePageData {
  const _CasePageData(this.caseInfo, this.sightings);

  final PublicCase caseInfo;
  final List<PublicSighting> sightings;
}

class _FoundStatusCard extends StatelessWidget {
  const _FoundStatusCard({this.foundAt});

  final String? foundAt;

  @override
  Widget build(BuildContext context) {
    final date = foundAt == null ? null : DateTime.tryParse(foundAt!);
    final dateLabel = date == null
        ? null
        : '${date.day}/${date.month}/${date.year}';
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(17),
      decoration: BoxDecoration(
        color: const Color(0xFFE8F1E8),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'CASE STATUS UPDATE',
            style: TextStyle(
              color: brandGreen,
              fontSize: 10,
              fontWeight: FontWeight.w800,
              letterSpacing: 1,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'This person has been reported found',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 4),
          const Text(
            'The family-approved case details remain listed for transparency. New sightings are closed.',
          ),
          if (dateLabel != null) ...[
            const SizedBox(height: 6),
            Text('Status updated $dateLabel'),
          ],
        ],
      ),
    );
  }
}

class _BackBar extends StatelessWidget {
  const _BackBar({required this.onBack});

  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        IconButton.filledTonal(
          onPressed: onBack,
          icon: const Icon(Icons.arrow_back_rounded),
          tooltip: 'Go back',
        ),
        const SizedBox(width: 8),
        Text(
          'PUBLIC CASE',
          style: Theme.of(context).textTheme.labelLarge?.copyWith(
            letterSpacing: 1.4,
            color: brandGreen,
            fontWeight: FontWeight.w800,
          ),
        ),
      ],
    );
  }
}

class _DetailHero extends StatelessWidget {
  const _DetailHero({required this.item});

  final PublicCase item;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(24),
          child: SizedBox(
            width: double.infinity,
            height: 250,
            child: item.imageAssetId == null
                ? const _ImagePlaceholder()
                : Image.network(
                    '${CitizenApi.baseUrl}/api/media/${Uri.encodeComponent(item.imageAssetId!)}',
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => const _ImagePlaceholder(),
                  ),
          ),
        ),
        const SizedBox(height: 18),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            color: const Color(0xFFE5F1E8),
            borderRadius: BorderRadius.circular(30),
          ),
          child: Text(
            item.status.toUpperCase(),
            style: const TextStyle(
              color: brandGreen,
              fontWeight: FontWeight.w800,
              fontSize: 10,
              letterSpacing: .8,
            ),
          ),
        ),
        const SizedBox(height: 9),
        Text(item.name, style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 4),
        Text(
          'Case ${item.id}',
          style: const TextStyle(
            color: Color(0xFF7A867F),
            fontSize: 13,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}

class _ImagePlaceholder extends StatelessWidget {
  const _ImagePlaceholder();

  @override
  Widget build(BuildContext context) {
    return Container(
      color: const Color(0xFFE5ECE6),
      child: const Center(
        child: Icon(
          Icons.person_outline_rounded,
          size: 76,
          color: Color(0xFF91A197),
        ),
      ),
    );
  }
}

class _CaseFacts extends StatelessWidget {
  const _CaseFacts({required this.item});

  final PublicCase item;

  @override
  Widget build(BuildContext context) {
    final facts = <(IconData, String, String)>[];
    if (item.age != null && item.age!.isNotEmpty)
      facts.add((Icons.cake_outlined, 'Age', item.age!));
    if (item.region != null && item.region!.isNotEmpty)
      facts.add((Icons.location_on_outlined, 'Region', item.region!));
    if (item.lastSeen != null && item.lastSeen!.isNotEmpty)
      facts.add((Icons.schedule_rounded, 'Last seen', item.lastSeen!));
    if (facts.isEmpty) return const SizedBox.shrink();
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(19),
      ),
      child: Column(
        children: facts
            .map(
              (fact) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 7),
                child: Row(
                  children: [
                    Icon(fact.$1, size: 19, color: brandGreen),
                    const SizedBox(width: 11),
                    SizedBox(
                      width: 78,
                      child: Text(
                        fact.$2,
                        style: const TextStyle(
                          color: Color(0xFF79847E),
                          fontSize: 13,
                        ),
                      ),
                    ),
                    Expanded(
                      child: Text(
                        fact.$3,
                        style: const TextStyle(
                          color: ink,
                          fontWeight: FontWeight.w600,
                          fontSize: 13,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            )
            .toList(),
      ),
    );
  }
}

class _DescriptionCard extends StatelessWidget {
  const _DescriptionCard({required this.description});

  final String description;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(19),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Family-approved details',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 9),
          Text(description, style: const TextStyle(height: 1.5)),
        ],
      ),
    );
  }
}

class _NoSightings extends StatelessWidget {
  const _NoSightings();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
      ),
      child: const Text(
        'No public sightings have been approved for this case yet.',
      ),
    );
  }
}

class _SightingCard extends StatelessWidget {
  const _SightingCard({required this.sighting});

  final PublicSighting sighting;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            sighting.description,
            style: const TextStyle(color: ink, height: 1.45),
          ),
          const SizedBox(height: 9),
          Text(
            '${sighting.location}  |  ${_displayDate(sighting.observedAt)}',
            style: const TextStyle(color: Color(0xFF78847D), fontSize: 12),
          ),
        ],
      ),
    );
  }
}

String _displayDate(String value) {
  final date = DateTime.tryParse(value)?.toLocal();
  if (date == null) return 'Time not provided';
  final hour = date.hour == 0
      ? 12
      : date.hour > 12
      ? date.hour - 12
      : date.hour;
  final minute = date.minute.toString().padLeft(2, '0');
  final period = date.hour >= 12 ? 'PM' : 'AM';
  return '${date.day}/${date.month}/${date.year} at $hour:$minute $period';
}

class _PrivacyBanner extends StatelessWidget {
  const _PrivacyBanner();

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
              'Your sighting is sent to the family privately. It becomes public only if they approve it.',
              style: TextStyle(fontSize: 12, height: 1.4),
            ),
          ),
        ],
      ),
    );
  }
}

class _DetailError extends StatelessWidget {
  const _DetailError({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.cloud_off_rounded, size: 40, color: brandGreen),
            const SizedBox(height: 12),
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 12),
            FilledButton(onPressed: onRetry, child: const Text('Try again')),
          ],
        ),
      ),
    );
  }
}
