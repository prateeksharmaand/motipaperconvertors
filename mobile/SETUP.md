# MotiPaper Flutter — Setup Guide

## First-time setup (run once per dev machine)

```bash
cd mobile

# 1. Get dependencies
flutter pub get

# 2. Generate Riverpod/retrofit code
dart run build_runner build --delete-conflicting-outputs

# 3. Android — add google-services.json
#    Download from Firebase Console → Project Settings → Android app
#    Place at: mobile/android/app/google-services.json

# 4. iOS — add GoogleService-Info.plist
#    Download from Firebase Console → Project Settings → iOS app
#    Place at: mobile/ios/Runner/GoogleService-Info.plist
#    Then run: cd ios && pod install

# 5. Run on device / emulator
flutter run --dart-define=API_URL=http://10.0.2.2:3000/api/v1   # Android emulator
flutter run --dart-define=API_URL=http://localhost:3000/api/v1   # iOS simulator
flutter run --dart-define=API_URL=https://api.motipaper.in/api/v1 # production
```

## Building for release

```bash
# Android APK
flutter build apk --release --dart-define=API_URL=https://api.motipaper.in/api/v1

# Android App Bundle (Play Store)
flutter build appbundle --release --dart-define=API_URL=https://api.motipaper.in/api/v1

# iOS (requires macOS + Xcode)
flutter build ios --release --dart-define=API_URL=https://api.motipaper.in/api/v1
```

## Code generation

Whenever you add/modify Riverpod providers or Retrofit clients:
```bash
dart run build_runner watch --delete-conflicting-outputs
```

## Project structure

```
lib/
├── main.dart               App entry point
├── router.dart             go_router configuration
├── api_client.dart         Dio HTTP client with JWT auto-refresh
└── features/
    ├── auth/               Login, auth state (Riverpod)
    ├── jobs/               Job list, detail, QR scan
    ├── quotations/         Quotation builder
    └── shell/              Bottom nav shell (role-aware)
```
