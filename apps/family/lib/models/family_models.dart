class FamilyUser {
  const FamilyUser({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
  });

  final String id;
  final String name;
  final String email;
  final String role;

  factory FamilyUser.fromJson(Map<String, dynamic> json) => FamilyUser(
    id: json['id']?.toString() ?? '',
    name: json['name']?.toString() ?? 'Family member',
    email: json['email']?.toString() ?? '',
    role: json['role']?.toString() ?? 'family',
  );
}

class FamilyCase {
  const FamilyCase({
    required this.id,
    required this.caseNumber,
    required this.name,
    required this.age,
    required this.region,
    required this.lastSeen,
    required this.status,
    this.reviewState = '',
    this.reviewNote = '',
    this.visibility = 'private',
    this.description = '',
    this.contact = '',
    this.imageAssetId,
    this.pendingSightings = 0,
    this.approvedSightings = 0,
    this.publicFields = const [],
    this.publicSummary = '',
    this.publicRequested = false,
    this.flyerFields = const ['name', 'age', 'region', 'lastSeen', 'contact'],
    this.flyerSummary = '',
  });

  final String id;
  final String caseNumber;
  final String name;
  final String age;
  final String region;
  final String lastSeen;
  final String status;
  final String reviewState;
  final String reviewNote;
  final String visibility;
  final String description;
  final String contact;
  final String? imageAssetId;
  final int pendingSightings;
  final int approvedSightings;
  final List<String> publicFields;
  final String publicSummary;
  final bool publicRequested;
  final List<String> flyerFields;
  final String flyerSummary;

  factory FamilyCase.fromJson(Map<String, dynamic> json) {
    final profile = json['publicProfile'] is Map
        ? Map<String, dynamic>.from(json['publicProfile'] as Map)
        : <String, dynamic>{};
    final flyer = json['flyerProfile'] is Map
        ? Map<String, dynamic>.from(json['flyerProfile'] as Map)
        : <String, dynamic>{};
    return FamilyCase(
      id: json['id']?.toString() ?? '',
      caseNumber:
          json['caseNumber']?.toString() ?? json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      age: json['age']?.toString() ?? 'Unknown',
      region: json['region']?.toString() ?? '',
      lastSeen: json['lastSeen']?.toString() ?? '',
      status: json['status']?.toString() ?? 'Review',
      reviewState: json['reviewState']?.toString() ?? '',
      reviewNote: json['reviewNote']?.toString() ?? '',
      visibility: json['visibility']?.toString() ?? 'private',
      description: json['description']?.toString() ?? '',
      contact: json['contact']?.toString() ?? '',
      imageAssetId: json['imageAssetId']?.toString(),
      pendingSightings: _intValue(json['pendingSightings']),
      approvedSightings: _intValue(json['approvedSightings']),
      publicFields: _stringList(profile['fields']),
      publicSummary: profile['summary']?.toString() ?? '',
      publicRequested: profile['requested'] == true,
      flyerFields: flyer['fields'] is List
          ? _stringList(flyer['fields'])
          : const ['name', 'age', 'region', 'lastSeen', 'contact'],
      flyerSummary: flyer['summary']?.toString() ?? '',
    );
  }
}

class FamilySighting {
  const FamilySighting({
    required this.id,
    required this.description,
    required this.observedAt,
    required this.location,
    required this.latitude,
    required this.longitude,
    required this.status,
    required this.isPublic,
    required this.submittedAt,
    this.imageAssetId,
  });

  final String id;
  final String description;
  final String observedAt;
  final String location;
  final double latitude;
  final double longitude;
  final String status;
  final bool isPublic;
  final String submittedAt;
  final String? imageAssetId;

  factory FamilySighting.fromJson(Map<String, dynamic> json) => FamilySighting(
    id: json['id']?.toString() ?? '',
    description: json['description']?.toString() ?? '',
    observedAt: json['observedAt']?.toString() ?? '',
    location: json['location']?.toString() ?? '',
    latitude: double.tryParse(json['latitude']?.toString() ?? '') ?? 0,
    longitude: double.tryParse(json['longitude']?.toString() ?? '') ?? 0,
    status: json['status']?.toString() ?? 'pending-family-review',
    isPublic: json['public'] == true,
    submittedAt: json['submittedAt']?.toString() ?? '',
    imageAssetId: json['imageAssetId']?.toString(),
  );
}

class FamilyNotification {
  const FamilyNotification({
    required this.id,
    required this.type,
    required this.title,
    required this.message,
    required this.caseId,
    required this.caseNumber,
    required this.createdAt,
    this.readAt,
  });

  final String id;
  final String type;
  final String title;
  final String message;
  final String caseId;
  final String caseNumber;
  final String createdAt;
  final String? readAt;

  factory FamilyNotification.fromJson(Map<String, dynamic> json) =>
      FamilyNotification(
        id: json['id']?.toString() ?? '',
        type: json['type']?.toString() ?? 'update',
        title: json['title']?.toString() ?? 'Account update',
        message: json['message']?.toString() ?? '',
        caseId: json['caseId']?.toString() ?? '',
        caseNumber: json['caseNumber']?.toString() ?? '',
        createdAt: json['createdAt']?.toString() ?? '',
        readAt: json['readAt']?.toString(),
      );
}

class ModeratorInvitation {
  const ModeratorInvitation({
    required this.id,
    required this.email,
    required this.status,
    required this.createdAt,
    this.expiresAt = '',
    this.acceptedAt,
  });

  final String id;
  final String email;
  final String status;
  final String createdAt;
  final String expiresAt;
  final String? acceptedAt;

  factory ModeratorInvitation.fromJson(Map<String, dynamic> json) =>
      ModeratorInvitation(
        id: json['id']?.toString() ?? '',
        email: json['email']?.toString() ?? '',
        status: json['status']?.toString() ?? 'pending',
        createdAt: json['createdAt']?.toString() ?? '',
        expiresAt: json['expiresAt']?.toString() ?? '',
        acceptedAt: json['acceptedAt']?.toString(),
      );
}

int _intValue(dynamic value) =>
    value is num ? value.toInt() : int.tryParse(value?.toString() ?? '') ?? 0;
List<String> _stringList(dynamic value) =>
    value is List ? value.map((item) => item.toString()).toList() : const [];
