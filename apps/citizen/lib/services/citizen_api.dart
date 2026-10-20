import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';

import '../models/public_case.dart';

class CitizenApi {
  CitizenApi({http.Client? client}) : _client = client ?? http.Client();

  static const String _configuredBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://reunite-k2eg.onrender.com',
  );

  static final Uri _baseUri = Uri.parse(_configuredBaseUrl);
  static String get baseUrl =>
      _baseUri.toString().replaceFirst(RegExp(r'/$'), '');
  final http.Client _client;

  Uri _uri(String path) => _baseUri.resolve(path);

  Future<List<PublicCase>> fetchCases() async {
    final response = await _client.get(_uri('/api/cases'));
    final data = _decodeResponse(response);
    final items = data['items'];
    if (items is! List)
      throw const CitizenApiException(
        'The cases service returned invalid data.',
      );
    return items
        .whereType<Map<String, dynamic>>()
        .map(PublicCase.fromJson)
        .toList(growable: false);
  }

  Future<PublicCase> fetchCase(String id) async {
    final response = await _client.get(
      _uri('/api/cases/${Uri.encodeComponent(id)}'),
    );
    return PublicCase.fromJson(_decodeResponse(response));
  }

  Future<List<PublicSighting>> fetchSightings(String caseId) async {
    final response = await _client.get(
      _uri('/api/cases/${Uri.encodeComponent(caseId)}/sightings'),
    );
    final data = _decodeResponse(response);
    final items = data['items'];
    if (items is! List)
      throw const CitizenApiException(
        'The sightings service returned invalid data.',
      );
    return items
        .whereType<Map<String, dynamic>>()
        .map(PublicSighting.fromJson)
        .toList(growable: false);
  }

  Future<String> uploadSightingPhoto({
    required String caseId,
    required XFile photo,
  }) async {
    final signatureResponse = await _client.post(
      _uri('/api/media/signature'),
      headers: const {'Content-Type': 'application/json'},
      body: jsonEncode({'kind': 'sighting-photo', 'caseId': caseId}),
    );
    final signature = _decodeResponse(signatureResponse);
    final cloudName = signature['cloudName']?.toString();
    final mediaId = signature['mediaId']?.toString();
    if (cloudName == null || mediaId == null) {
      throw const CitizenApiException(
        'The image service returned invalid upload details.',
      );
    }

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
          ..files.add(await http.MultipartFile.fromPath('file', photo.path));

    final uploadResponse = await http.Response.fromStream(
      await _client.send(upload),
    );
    if (uploadResponse.statusCode < 200 || uploadResponse.statusCode >= 300) {
      final uploadError = jsonDecode(uploadResponse.body);
      final errorDetails = uploadError is Map<String, dynamic>
          ? uploadError['error']
          : null;
      final message = errorDetails is Map<String, dynamic>
          ? errorDetails['message']?.toString()
          : null;
      throw CitizenApiException(
        message ?? 'The photo could not be uploaded. Try another image.',
      );
    }

    final completeResponse = await _client.post(
      _uri('/api/media/complete'),
      headers: const {'Content-Type': 'application/json'},
      body: jsonEncode({'mediaId': mediaId}),
    );
    _decodeResponse(completeResponse);
    return mediaId;
  }

  Future<String> submitSighting({
    required String caseId,
    required String description,
    required DateTime observedAt,
    required String location,
    required double latitude,
    required double longitude,
    String? imageAssetId,
  }) async {
    final response = await _client.post(
      _uri('/api/cases/${Uri.encodeComponent(caseId)}/sightings'),
      headers: const {'Content-Type': 'application/json'},
      body: jsonEncode({
        'description': description,
        'observedAt': observedAt.toUtc().toIso8601String(),
        'location': location,
        'latitude': latitude,
        'longitude': longitude,
        if (imageAssetId != null) 'imageAssetId': imageAssetId,
      }),
    );
    return _decodeResponse(response)['message']?.toString() ??
        'Sighting sent to the family for review.';
  }

  Map<String, dynamic> _decodeResponse(http.Response response) {
    dynamic decoded;
    try {
      decoded = jsonDecode(response.body);
    } on FormatException {
      throw const CitizenApiException(
        'The service returned an unreadable response.',
      );
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final message = decoded is Map<String, dynamic>
          ? decoded['error']?.toString()
          : null;
      throw CitizenApiException(
        message ?? 'The request failed (${response.statusCode}).',
      );
    }
    if (decoded is! Map<String, dynamic>) {
      throw const CitizenApiException('The service returned invalid data.');
    }
    return decoded;
  }

  void close() => _client.close();
}

class CitizenApiException implements Exception {
  const CitizenApiException(this.message);

  final String message;

  @override
  String toString() => message;
}
