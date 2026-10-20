import 'dart:convert';
import 'dart:io';

import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

class SightingDraft {
  const SightingDraft({
    required this.caseId,
    required this.description,
    required this.observedAt,
    required this.location,
    required this.latitude,
    required this.longitude,
    this.photoPath,
  });

  final String caseId;
  final String description;
  final DateTime observedAt;
  final String location;
  final String latitude;
  final String longitude;
  final String? photoPath;

  Map<String, Object?> toJson() => {
    'caseId': caseId,
    'description': description,
    'observedAt': observedAt.toIso8601String(),
    'location': location,
    'latitude': latitude,
    'longitude': longitude,
    'photoPath': photoPath,
  };

  factory SightingDraft.fromJson(Map<String, dynamic> json) {
    return SightingDraft(
      caseId: json['caseId']?.toString() ?? '',
      description: json['description']?.toString() ?? '',
      observedAt:
          DateTime.tryParse(json['observedAt']?.toString() ?? '') ??
          DateTime.now(),
      location: json['location']?.toString() ?? '',
      latitude: json['latitude']?.toString() ?? '',
      longitude: json['longitude']?.toString() ?? '',
      photoPath: json['photoPath']?.toString(),
    );
  }
}

class SightingDraftStore {
  static const _keyPrefix = 'citizen.sightingDraft.';

  String _key(String caseId) => '$_keyPrefix$caseId';

  Future<SightingDraft?> load(String caseId) async {
    final preferences = await SharedPreferences.getInstance();
    final encoded = preferences.getString(_key(caseId));
    if (encoded == null) return null;

    try {
      final decoded = jsonDecode(encoded);
      if (decoded is! Map<String, dynamic>) return null;
      final draft = SightingDraft.fromJson(decoded);
      final photoPath = draft.photoPath;
      if (photoPath == null || await File(photoPath).exists()) return draft;
      return SightingDraft(
        caseId: draft.caseId,
        description: draft.description,
        observedAt: draft.observedAt,
        location: draft.location,
        latitude: draft.latitude,
        longitude: draft.longitude,
      );
    } on Object {
      return null;
    }
  }

  Future<void> save(SightingDraft draft) async {
    final preferences = await SharedPreferences.getInstance();
    final key = _key(draft.caseId);
    final previous = preferences.getString(key);
    String? previousPhotoPath;
    if (previous != null) {
      try {
        final decoded = jsonDecode(previous);
        if (decoded is Map<String, dynamic>) {
          previousPhotoPath = decoded['photoPath']?.toString();
        }
      } on Object {
        // Replace an unreadable old draft with the current valid one.
      }
    }

    await preferences.setString(key, jsonEncode(draft.toJson()));
    if (previousPhotoPath != null && previousPhotoPath != draft.photoPath) {
      await _deletePhotoIfOwned(previousPhotoPath);
    }
  }

  Future<String> persistPhoto(String caseId, String sourcePath) async {
    final directory = await _draftDirectory();
    final extension = _fileExtension(sourcePath);
    final destination = File(
      '${directory.path}/${_safeName(caseId)}$extension',
    );
    final source = File(sourcePath);
    if (await source.exists()) await source.copy(destination.path);
    return destination.path;
  }

  Future<void> delete(String caseId) async {
    final preferences = await SharedPreferences.getInstance();
    final encoded = preferences.getString(_key(caseId));
    await preferences.remove(_key(caseId));
    if (encoded == null) return;

    try {
      final decoded = jsonDecode(encoded);
      if (decoded is Map<String, dynamic>) {
        final photoPath = decoded['photoPath']?.toString();
        if (photoPath != null) await _deletePhotoIfOwned(photoPath);
      }
    } on Object {
      // The draft was removed; an unknown image file is left untouched.
    }
  }

  Future<Directory> _draftDirectory() async {
    final documents = await getApplicationDocumentsDirectory();
    final directory = Directory('${documents.path}/sighting_drafts');
    await directory.create(recursive: true);
    return directory;
  }

  Future<void> _deletePhotoIfOwned(String path) async {
    final directory = await _draftDirectory();
    final separator = Platform.pathSeparator;
    final ownedPrefix = '${directory.path}$separator';
    if (!path.startsWith(ownedPrefix)) return;
    final file = File(path);
    if (await file.exists()) await file.delete();
  }

  String _safeName(String value) =>
      value.replaceAll(RegExp(r'[^a-zA-Z0-9_-]'), '_');

  String _fileExtension(String path) {
    final lastSeparator = path.lastIndexOf(Platform.pathSeparator);
    final dot = path.lastIndexOf('.');
    if (dot <= lastSeparator || dot == path.length - 1) return '.jpg';
    return path.substring(dot);
  }
}
