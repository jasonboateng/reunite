class PublicCase {
  const PublicCase({
    required this.id,
    required this.name,
    required this.status,
    this.foundAt,
    this.age,
    this.region,
    this.lastSeen,
    this.description = '',
    this.imageAssetId,
  });

  final String id;
  final String name;
  final String status;
  final String? foundAt;
  final String? age;
  final String? region;
  final String? lastSeen;
  final String description;
  final String? imageAssetId;

  factory PublicCase.fromJson(Map<String, dynamic> json) {
    return PublicCase(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? 'Name not shared',
      status: json['status']?.toString() ?? 'Active',
      foundAt: json['foundAt']?.toString(),
      age: json['age']?.toString(),
      region: json['region']?.toString(),
      lastSeen: json['lastSeen']?.toString(),
      description: json['description']?.toString() ?? '',
      imageAssetId: json['imageAssetId']?.toString(),
    );
  }
}

class PublicSighting {
  const PublicSighting({
    required this.id,
    required this.description,
    required this.observedAt,
    required this.location,
  });

  final String id;
  final String description;
  final String observedAt;
  final String location;

  factory PublicSighting.fromJson(Map<String, dynamic> json) {
    return PublicSighting(
      id: json['id']?.toString() ?? '',
      description: json['description']?.toString() ?? '',
      observedAt: json['observedAt']?.toString() ?? '',
      location: json['location']?.toString() ?? '',
    );
  }
}
