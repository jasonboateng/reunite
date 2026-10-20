import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';

import '../models/family_models.dart';

class FamilyApi {
  FamilyApi({http.Client? client, FlutterSecureStorage? storage})
    : _client = client ?? http.Client(),
      _storage = storage ?? const FlutterSecureStorage();

  static const baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://reunite-k2eg.onrender.com',
  );
  static const _sessionKey = 'reunite_session';
  final http.Client _client;
  final FlutterSecureStorage _storage;
  String? _sessionCookie;

  Future<FamilyUser?> restoreSession() async {
    _sessionCookie = await _storage.read(key: _sessionKey);
    if (_sessionCookie == null) return null;
    try {
      final data = await _get('/api/auth/me');
      final user = FamilyUser.fromJson(_map(data['user']));
      if (user.role != 'family' &&
          !(data['user'] is Map &&
              ((data['user'] as Map)['roles'] as List? ?? const []).contains(
                'family',
              ))) {
        await signOut();
        return null;
      }
      return user;
    } on FamilyApiException catch (error) {
      if (error.statusCode == 401) await _clearSession();
      return null;
    }
  }

  Future<FamilyUser> signIn(String email, String password) async {
    final response = await _client.post(
      _uri('/api/auth/login'),
      headers: _jsonHeaders,
      body: jsonEncode({'email': email.trim(), 'password': password}),
    );
    return _saveSessionResponse(response);
  }

  Future<FamilyUser> register({
    required String name,
    required String email,
    required String password,
  }) async {
    final response = await _client.post(
      _uri('/api/auth/register'),
      headers: _jsonHeaders,
      body: jsonEncode({
        'name': name.trim(),
        'email': email.trim(),
        'password': password,
      }),
    );
    return _saveSessionResponse(response);
  }

  Future<FamilyUser> _saveSessionResponse(http.Response response) async {
    final data = _decode(response);
    final setCookie = response.headers['set-cookie'];
    final session = setCookie?.split(';').first.split('=').skip(1).join('=');
    if (session == null || session.isEmpty)
      throw const FamilyApiException(
        'The sign-in service did not create a session.',
      );
    _sessionCookie = Uri.decodeComponent(session);
    await _storage.write(key: _sessionKey, value: _sessionCookie);
    final user = FamilyUser.fromJson(_map(data['user']));
    if (user.role != 'family' &&
        !(data['user'] is Map &&
            ((data['user'] as Map)['roles'] as List? ?? const []).contains(
              'family',
            ))) {
      await signOut();
      throw const FamilyApiException(
        'This account does not have family access.',
      );
    }
    return user;
  }

  Future<void> signOut() async {
    try {
      await _post('/api/auth/logout', const {});
    } catch (_) {}
    await _clearSession();
  }

  Future<void> _clearSession() async {
    _sessionCookie = null;
    await _storage.delete(key: _sessionKey);
  }

  Future<List<FamilyCase>> getCases() async {
    final data = await _get('/api/family/cases');
    return _list(data['items']).map(FamilyCase.fromJson).toList();
  }

  Future<FamilyCase> getCase(String id, {bool includeFlyer = false}) async {
    final data = await _get(
      '/api/family/cases/${_segment(id)}${includeFlyer ? '/flyer' : ''}',
    );
    return FamilyCase.fromJson(_map(data['case']));
  }

  Future<FamilyCase> getPublicProfile(String id) async {
    final data = await _get('/api/family/cases/${_segment(id)}/public-profile');
    return FamilyCase.fromJson(_map(data['case']));
  }

  Future<List<FamilySighting>> getSightings(String caseId) async {
    final data = await _get('/api/family/cases/${_segment(caseId)}/sightings');
    return _list(data['items']).map(FamilySighting.fromJson).toList();
  }

  Future<List<ModeratorInvitation>> getModerators(String caseId) async {
    final data = await _get('/api/family/cases/${_segment(caseId)}/moderators');
    return _list(data['items']).map(ModeratorInvitation.fromJson).toList();
  }

  Future<Map<String, dynamic>> getNotifications() =>
      _get('/api/family/notifications');

  Future<String> createReport(Map<String, dynamic> report) async {
    final data = await _post('/api/reports', report);
    return data['message']?.toString() ?? 'Report saved privately for review.';
  }

  Future<String> updateCase(String id, Map<String, dynamic> fields) async {
    final data = await _put('/api/family/cases/${_segment(id)}', fields);
    return data['message']?.toString() ?? 'Case details saved.';
  }

  Future<String> markFound(String id, {String note = ''}) async {
    final data = await _patch('/api/family/cases/${_segment(id)}/status', {
      'status': 'Found',
      if (note.trim().isNotEmpty) 'note': note.trim(),
    });
    return data['message']?.toString() ?? 'Case marked found.';
  }

  Future<void> savePublicProfile(
    String id, {
    required List<String> fields,
    required String summary,
    required bool requestPublication,
  }) async {
    await _put('/api/family/cases/${_segment(id)}/public-profile', {
      'fields': fields,
      'summary': summary,
      'requestPublication': requestPublication,
    });
  }

  Future<void> saveFlyer(
    String id, {
    required List<String> fields,
    required String summary,
  }) async {
    await _put('/api/family/cases/${_segment(id)}/flyer', {
      'fields': fields,
      'summary': summary,
    });
  }

  Future<void> reviewSighting(
    String caseId,
    String sightingId,
    String decision,
  ) async {
    await _patch(
      '/api/family/cases/${_segment(caseId)}/sightings/${_segment(sightingId)}/review',
      {'decision': decision},
    );
  }

  Future<void> setSightingPublic(
    String caseId,
    String sightingId,
    bool isPublic,
  ) async {
    await _patch(
      '/api/family/cases/${_segment(caseId)}/sightings/${_segment(sightingId)}/visibility',
      {'public': isPublic},
    );
  }

  Future<Map<String, dynamic>> inviteModerator(String caseId, String email) =>
      _post('/api/family/cases/${_segment(caseId)}/moderators/invitations', {
        'email': email.trim(),
      });

  Future<void> revokeModerator(String caseId, String invitationId) async {
    await _delete(
      '/api/family/cases/${_segment(caseId)}/moderators/invitations/${_segment(invitationId)}',
    );
  }

  Future<void> markNotificationRead(String id) async =>
      _patch('/api/family/notifications/${_segment(id)}/read', const {});
  Future<int> markAllNotificationsRead() async => _intValue(
    (await _post('/api/family/notifications/read-all', const {}))['markedRead'],
  );

  Future<String> uploadCasePhoto({required XFile photo, String? caseId}) async {
    final signature = await _post('/api/media/signature', {
      'kind': 'case-photo',
      if (caseId != null) 'caseId': caseId,
    });
    final cloudName = signature['cloudName']?.toString();
    final mediaId = signature['mediaId']?.toString();
    if (cloudName == null || mediaId == null)
      throw const FamilyApiException(
        'The image service returned invalid upload details.',
      );
    final upload =
        http.MultipartRequest(
            'POST',
            Uri.https('api.cloudinary.com', '/v1_1/$cloudName/image/upload'),
          )
          ..fields.addAll({
            'api_key': signature['apiKey'].toString(),
            'timestamp': signature['timestamp'].toString(),
            'signature': signature['signature'].toString(),
            'public_id': signature['publicId'].toString(),
            'type': signature['type'].toString(),
            'format': signature['format'].toString(),
            'overwrite': signature['overwrite'].toString(),
          })
          ..files.add(
            http.MultipartFile.fromBytes(
              'file',
              await photo.readAsBytes(),
              filename: photo.name,
            ),
          );
    final uploaded = await http.Response.fromStream(await _client.send(upload));
    if (uploaded.statusCode < 200 || uploaded.statusCode >= 300)
      throw FamilyApiException(_cloudinaryError(uploaded.body));
    await _post('/api/media/complete', {'mediaId': mediaId});
    return mediaId;
  }

  String mediaUrl(String id) => '$baseUrl/api/media/${_segment(id)}';
  Map<String, String> get mediaHeaders => _sessionCookie == null
      ? const {}
      : {'Cookie': 'reunite_session=$_sessionCookie'};

  Map<String, String> get _jsonHeaders => {
    'Content-Type': 'application/json',
    if (_sessionCookie != null) 'Cookie': 'reunite_session=$_sessionCookie',
  };
  Uri _uri(String path) => Uri.parse('$baseUrl$path');

  Future<Map<String, dynamic>> _get(String path) async =>
      _decode(await _client.get(_uri(path), headers: _jsonHeaders));
  Future<Map<String, dynamic>> _post(
    String path,
    Map<String, dynamic> body,
  ) async => _decode(
    await _client.post(
      _uri(path),
      headers: _jsonHeaders,
      body: jsonEncode(body),
    ),
  );
  Future<Map<String, dynamic>> _put(
    String path,
    Map<String, dynamic> body,
  ) async => _decode(
    await _client.put(
      _uri(path),
      headers: _jsonHeaders,
      body: jsonEncode(body),
    ),
  );
  Future<Map<String, dynamic>> _patch(
    String path,
    Map<String, dynamic> body,
  ) async => _decode(
    await _client.patch(
      _uri(path),
      headers: _jsonHeaders,
      body: jsonEncode(body),
    ),
  );
  Future<void> _delete(String path) async =>
      _decode(await _client.delete(_uri(path), headers: _jsonHeaders));

  Map<String, dynamic> _decode(http.Response response) {
    dynamic decoded;
    try {
      decoded = response.body.isEmpty
          ? <String, dynamic>{}
          : jsonDecode(response.body);
    } on FormatException {
      throw const FamilyApiException(
        'The service returned an unreadable response.',
      );
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final message = decoded is Map<String, dynamic>
          ? decoded['error']?.toString()
          : null;
      if (response.statusCode >= 500 &&
          (message == null ||
              message.isEmpty ||
              message.toLowerCase() == 'internal server error')) {
        throw FamilyApiException(
          'The service could not complete this request right now. Please try again in a moment. (Error ${response.statusCode})',
          statusCode: response.statusCode,
        );
      }
      throw FamilyApiException(
        message ?? 'Request failed (${response.statusCode}).',
        statusCode: response.statusCode,
      );
    }
    return decoded is Map<String, dynamic> ? decoded : <String, dynamic>{};
  }

  String _cloudinaryError(String response) {
    try {
      return jsonDecode(response)['error']['message']?.toString() ??
          'The image could not be uploaded.';
    } catch (_) {
      return 'The image could not be uploaded.';
    }
  }

  static Map<String, dynamic> _map(dynamic value) =>
      value is Map ? Map<String, dynamic>.from(value) : <String, dynamic>{};
  static List<Map<String, dynamic>> _list(dynamic value) => value is List
      ? value.whereType<Map>().map(Map<String, dynamic>.from).toList()
      : <Map<String, dynamic>>[];
  static int _intValue(dynamic value) =>
      value is num ? value.toInt() : int.tryParse(value?.toString() ?? '') ?? 0;
  static String _segment(String value) => Uri.encodeComponent(value);
}

class FamilyApiException implements Exception {
  const FamilyApiException(this.message, {this.statusCode});
  final String message;
  final int? statusCode;
  @override
  String toString() => message;
}
