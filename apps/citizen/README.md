# REUNITE Citizen app

Flutter Android app for browsing public missing-person cases and privately sending a sighting to the family for review.

## Run

From this directory:

```powershell
flutter pub get
flutter run --dart-define=API_BASE_URL=https://reunite-k2eg.onrender.com
```

To use a local API from an Android emulator, use `http://10.0.2.2:4000` as the `API_BASE_URL`. A physical phone should use the computer's LAN IP address. For local HTTP, allow cleartext traffic in the Android manifest during development.

The app supports public case search, case details and approved sightings, GPS/manual location for a sighting, optional photo evidence uploaded through the API's Cloudinary signing flow, and private submission for family review.
