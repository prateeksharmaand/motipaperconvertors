import 'package:flutter/material.dart';
import '../constants/app_constants.dart';

enum DeviceType { phone, tablet, largeTablet }

class Responsive {
  static DeviceType deviceType(BuildContext context) {
    final width = MediaQuery.of(context).size.width;
    if (width >= AppConstants.tabletBreakpoint) return DeviceType.largeTablet;
    if (width >= AppConstants.phoneBreakpoint) return DeviceType.tablet;
    return DeviceType.phone;
  }

  static bool isPhone(BuildContext context) =>
      MediaQuery.of(context).size.width < AppConstants.phoneBreakpoint;

  static bool isTablet(BuildContext context) =>
      MediaQuery.of(context).size.width >= AppConstants.phoneBreakpoint;

  static bool isLargeTablet(BuildContext context) =>
      MediaQuery.of(context).size.width >= AppConstants.tabletBreakpoint;

  static bool showSidebar(BuildContext context) => isLargeTablet(context);
  static bool showNavigationRail(BuildContext context) => isTablet(context) && !isLargeTablet(context);
  static bool showBottomNav(BuildContext context) => isPhone(context);

  static int gridCrossAxisCount(BuildContext context, {int phone = 1, int tablet = 2, int large = 3}) {
    return switch (deviceType(context)) {
      DeviceType.phone => phone,
      DeviceType.tablet => tablet,
      DeviceType.largeTablet => large,
    };
  }

  static T value<T>(BuildContext context, {required T phone, required T tablet, required T desktop}) {
    return switch (deviceType(context)) {
      DeviceType.phone => phone,
      DeviceType.tablet => tablet,
      DeviceType.largeTablet => desktop,
    };
  }

  static EdgeInsets pagePadding(BuildContext context) {
    return value(
      context,
      phone: const EdgeInsets.all(16),
      tablet: const EdgeInsets.all(20),
      desktop: const EdgeInsets.all(24),
    );
  }
}
