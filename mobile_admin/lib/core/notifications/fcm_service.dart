import 'dart:io';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import '../network/api_client.dart';
import '../storage/secure_storage.dart';

// Top-level handler required by FCM for background messages
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  // Background message received — local notification shown by FCM on Android automatically
}

class FcmService {
  FcmService._();

  static final _localNotif = FlutterLocalNotificationsPlugin();
  static const _channelId = 'motipaper_admin';
  static const _channelName = 'MotiPaper Admin';

  /// Call once at app startup after Firebase.initializeApp()
  static Future<void> init() async {
    // Register background handler
    FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

    // Local notification channel (Android 8+)
    const androidChannel = AndroidNotificationChannel(
      _channelId, _channelName,
      description: 'Job card updates and admin alerts',
      importance: Importance.high,
    );

    await _localNotif.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()?.createNotificationChannel(androidChannel);

    await _localNotif.initialize(
      const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
        iOS: DarwinInitializationSettings(requestAlertPermission: false, requestBadgePermission: false, requestSoundPermission: false),
      ),
    );

    // Request permission (iOS + Android 13+)
    final messaging = FirebaseMessaging.instance;
    await messaging.requestPermission(alert: true, badge: true, sound: true);

    // Handle foreground messages
    FirebaseMessaging.onMessage.listen(_onForegroundMessage);

    // Register token & listen for refresh
    await _registerToken();
    messaging.onTokenRefresh.listen(_saveAndRegisterToken);
  }

  static void _onForegroundMessage(RemoteMessage message) {
    final n = message.notification;
    if (n == null) return;
    _localNotif.show(
      message.hashCode,
      n.title,
      n.body,
      NotificationDetails(
        android: AndroidNotificationDetails(_channelId, _channelName, channelDescription: 'MotiPaper Admin alerts', importance: Importance.high, priority: Priority.high, icon: '@mipmap/ic_launcher'),
        iOS: const DarwinNotificationDetails(),
      ),
    );
  }

  static Future<void> _registerToken() async {
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token != null) await _saveAndRegisterToken(token);
    } catch (_) {}
  }

  static Future<void> _saveAndRegisterToken(String token) async {
    try {
      final accessToken = await SecureStorage.getAccessToken();
      if (accessToken == null) return;
      await ApiClient.instance.patch('/auth/fcm-token', data: {'fcmToken': token});
    } catch (_) {}
  }

  /// Call on logout to deregister
  static Future<void> deleteToken() async {
    try {
      await FirebaseMessaging.instance.deleteToken();
    } catch (_) {}
  }
}

// ── Network status banner ─────────────────────────────────
class ConnectivityBanner extends StatefulWidget {
  final Widget child;
  const ConnectivityBanner({super.key, required this.child});
  @override
  State<ConnectivityBanner> createState() => _ConnectivityBannerState();
}

class _ConnectivityBannerState extends State<ConnectivityBanner> {
  bool _offline = false;

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      if (_offline)
        Material(
          child: Container(
            width: double.infinity,
            color: Colors.red.shade700,
            padding: EdgeInsets.only(top: MediaQuery.of(context).padding.top, bottom: 6, left: 16, right: 16),
            child: const Text('No internet connection', style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600)),
          ),
        ),
      Expanded(child: widget.child),
    ]);
  }
}
