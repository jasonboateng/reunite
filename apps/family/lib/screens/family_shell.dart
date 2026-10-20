import 'package:flutter/material.dart';

import '../main.dart';
import '../models/family_models.dart';
import 'case_workspace_screen.dart';
import 'dashboard_screen.dart';
import 'family_cases_screen.dart';
import 'family_notifications_screen.dart';
import 'family_widgets.dart';

class FamilyShell extends StatefulWidget {
  const FamilyShell({super.key, required this.user, required this.onSignOut});
  final FamilyUser user;
  final VoidCallback onSignOut;
  @override
  State<FamilyShell> createState() => _FamilyShellState();
}

class _FamilyShellState extends State<FamilyShell> {
  int _tab = 0;
  int _unread = 0;

  void _openCase(FamilyCase item) => Navigator.of(context).push(
    MaterialPageRoute<void>(
      builder: (_) => CaseWorkspaceScreen(initialCase: item),
    ),
  );

  @override
  Widget build(BuildContext context) {
    final pages = [
      DashboardScreen(
        user: widget.user,
        onOpenCase: _openCase,
        onViewAll: () => setState(() => _tab = 1),
        onCreate: () => Navigator.of(context).push<void>(
          MaterialPageRoute(builder: (_) => const CaseWorkspaceScreen()),
        ),
      ),
      FamilyCasesScreen(
        onOpenCase: _openCase,
        onCreate: () => Navigator.of(context).push(
          MaterialPageRoute<void>(builder: (_) => const CaseWorkspaceScreen()),
        ),
      ),
      FamilyNotificationsScreen(
        onUnreadChanged: (count) {
          if (mounted) setState(() => _unread = count);
        },
        onOpenCase: (id, reference) => _openCase(
          FamilyCase(
            id: id,
            caseNumber: reference,
            name: reference,
            age: 'Unknown',
            region: '',
            lastSeen: '',
            status: 'Review',
          ),
        ),
      ),
      _AccountTab(
        user: widget.user,
        onSignOut: () async {
          await familyApi.signOut();
          widget.onSignOut();
        },
      ),
    ];
    return Scaffold(
      body: SafeArea(
        child: IndexedStack(index: _tab, children: pages),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (index) => setState(() => _tab = index),
        backgroundColor: Colors.white,
        indicatorColor: const Color(0xFFE1F0EF),
        destinations: [
          const NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home_rounded),
            label: 'Home',
          ),
          const NavigationDestination(
            icon: Icon(Icons.folder_open_outlined),
            selectedIcon: Icon(Icons.folder_rounded),
            label: 'Cases',
          ),
          NavigationDestination(
            icon: Badge(
              isLabelVisible: _unread > 0,
              label: Text(_unread > 9 ? '9+' : '$_unread'),
              child: const Icon(Icons.notifications_outlined),
            ),
            selectedIcon: Badge(
              isLabelVisible: _unread > 0,
              label: Text(_unread > 9 ? '9+' : '$_unread'),
              child: const Icon(Icons.notifications_rounded),
            ),
            label: 'Updates',
          ),
          const NavigationDestination(
            icon: Icon(Icons.person_outline_rounded),
            label: 'Account',
          ),
        ],
      ),
    );
  }
}

class _AccountTab extends StatelessWidget {
  const _AccountTab({required this.user, required this.onSignOut});
  final FamilyUser user;
  final VoidCallback onSignOut;

  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.all(20),
    children: [
      const BrandHeader(title: 'Account'),
      const SizedBox(height: 18),
      Card(
        elevation: 0,
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const CircleAvatar(
                radius: 24,
                backgroundColor: Color(0xFFE1F0EF),
                child: Icon(Icons.person_outline, color: brandTeal),
              ),
              const SizedBox(height: 15),
              Text(user.name, style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 5),
              Text(user.email),
              const SizedBox(height: 14),
              const Text(
                'Family reporter',
                style: TextStyle(color: brandTeal, fontWeight: FontWeight.w700),
              ),
            ],
          ),
        ),
      ),
      const SizedBox(height: 16),
      const PrivacyCard(
        text: 'Your case reports, family contacts, sighting locations, and evidence are private to your account.',
      ),
      const SizedBox(height: 22),
      OutlinedButton.icon(
        onPressed: onSignOut,
        icon: const Icon(Icons.logout_rounded),
        label: const Text('Sign out'),
      ),
    ],
  );
}
