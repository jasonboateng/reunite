import 'package:flutter/material.dart';

import '../main.dart';
import '../models/family_models.dart';
import '../services/family_api.dart';

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key, required this.onAuthenticated});
  final ValueChanged<FamilyUser> onAuthenticated;
  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _register = false;
  bool _busy = false;
  bool _obscure = true;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final user = _register
          ? await familyApi.register(
              name: _name.text,
              email: _email.text,
              password: _password.text,
            )
          : await familyApi.signIn(_email.text, _password.text);
      widget.onAuthenticated(user);
    } on FamilyApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } catch (_) {
      if (mounted)
        setState(
          () => _error = 'Could not reach REUNITE. Check your internet connection and try again.',
        );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(22),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 460),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Image.asset(
                  'assets/brand/reunite-wordmark.png',
                  width: 145,
                  height: 40,
                  fit: BoxFit.contain,
                  alignment: Alignment.centerLeft,
                ),
                const SizedBox(height: 30),
                Text(
                  _register ? 'Create your family account' : 'Family sign in',
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                const SizedBox(height: 8),
                Text(
                  _register
                      ? 'Create a private space to report a case and work with your family.'
                      : 'Manage your reports and review incoming sightings.',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: 24),
                if (_error != null) _ErrorBanner(message: _error!),
                Form(
                  key: _formKey,
                  child: Column(
                    children: [
                      if (_register) ...[
                        TextFormField(
                          controller: _name,
                          textCapitalization: TextCapitalization.words,
                          decoration: const InputDecoration(
                            labelText: 'Your name',
                          ),
                          validator: (value) => (value?.trim().length ?? 0) < 2
                              ? 'Enter your name.'
                              : null,
                        ),
                        const SizedBox(height: 13),
                      ],
                      TextFormField(
                        controller: _email,
                        keyboardType: TextInputType.emailAddress,
                        autofillHints: const [AutofillHints.email],
                        decoration: const InputDecoration(
                          labelText: 'Email address',
                        ),
                        validator: (value) =>
                            value == null || !value.contains('@')
                            ? 'Enter a valid email.'
                            : null,
                      ),
                      const SizedBox(height: 13),
                      TextFormField(
                        controller: _password,
                        obscureText: _obscure,
                        autofillHints: [
                          _register
                              ? AutofillHints.newPassword
                              : AutofillHints.password,
                        ],
                        decoration: InputDecoration(
                          labelText: 'Password',
                          helperText: _register
                              ? 'Use at least 12 characters.'
                              : null,
                          suffixIcon: IconButton(
                            onPressed: () =>
                                setState(() => _obscure = !_obscure),
                            icon: Icon(
                              _obscure
                                  ? Icons.visibility_outlined
                                  : Icons.visibility_off_outlined,
                            ),
                          ),
                        ),
                        validator: (value) =>
                            (value?.length ?? 0) < (_register ? 12 : 1)
                            ? (_register
                                  ? 'Password must be at least 12 characters.'
                                  : 'Enter your password.')
                            : null,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 18),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: _busy ? null : _submit,
                    child: Text(
                      _busy
                          ? 'Please wait...'
                          : _register
                          ? 'Create account'
                          : 'Sign in',
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Center(
                  child: TextButton(
                    onPressed: _busy
                        ? null
                        : () => setState(() {
                            _register = !_register;
                            _error = null;
                          }),
                    child: Text(
                      _register
                          ? 'Already have an account? Sign in'
                          : 'New to REUNITE? Create an account',
                    ),
                  ),
                ),
                const SizedBox(height: 24),
                const _PrivacyNote(),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message});
  final String message;
  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    margin: const EdgeInsets.only(bottom: 14),
    padding: const EdgeInsets.all(13),
    decoration: BoxDecoration(
      color: const Color(0xFFFFECEA),
      borderRadius: BorderRadius.circular(12),
    ),
    child: Text(message, style: const TextStyle(color: Color(0xFF94352E))),
  );
}

class _PrivacyNote extends StatelessWidget {
  const _PrivacyNote();
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(14),
    ),
    child: const Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(Icons.lock_outline, color: brandTeal, size: 19),
        SizedBox(width: 9),
        Expanded(
          child: Text(
            'Family reports stay private until you choose the details to share and a moderator verifies the case.',
          ),
        ),
      ],
    ),
  );
}
