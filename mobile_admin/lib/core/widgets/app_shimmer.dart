import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';
import '../theme/app_theme.dart';

/// Base shimmer wrapper
class AppShimmer extends StatelessWidget {
  final Widget child;
  const AppShimmer({super.key, required this.child});

  @override
  Widget build(BuildContext context) => Shimmer.fromColors(
    baseColor: const Color(0xFFE2E8F0),
    highlightColor: const Color(0xFFF8FAFC),
    period: const Duration(milliseconds: 1200),
    child: child,
  );
}

/// A shimmer box placeholder
Widget _shimmerBox({double? width, double height = 14, double radius = 8}) => Container(
  width: width,
  height: height,
  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(radius)),
);

// ── List item shimmer (job card, client row, etc.) ────────
class ShimmerListItem extends StatelessWidget {
  final bool hasSubtitle;
  final bool hasTrailing;
  const ShimmerListItem({super.key, this.hasSubtitle = true, this.hasTrailing = true});

  @override
  Widget build(BuildContext context) => AppShimmer(child: Container(
    margin: const EdgeInsets.only(bottom: 10),
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      border: const Border(left: BorderSide(color: Colors.white, width: 4)),
    ),
    child: Row(children: [
      const SizedBox(width: 4),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          _shimmerBox(width: 40, height: 13),
          const SizedBox(width: 8),
          Expanded(child: _shimmerBox(height: 13)),
          const SizedBox(width: 8),
          _shimmerBox(width: 64, height: 22, radius: 6),
        ]),
        if (hasSubtitle) ...[
          const SizedBox(height: 8),
          _shimmerBox(width: 140, height: 11),
          const SizedBox(height: 8),
          Row(children: [
            _shimmerBox(width: 60, height: 11),
            const SizedBox(width: 12),
            _shimmerBox(width: 90, height: 11),
            const Spacer(),
            if (hasTrailing) _shimmerBox(width: 70, height: 13),
          ]),
        ],
      ])),
      const SizedBox(width: 8),
      _shimmerBox(width: 18, height: 18, radius: 4),
    ]),
  ));
}

/// Shimmer for a simple row (clients, staff, etc.)
class ShimmerRow extends StatelessWidget {
  const ShimmerRow({super.key});
  @override
  Widget build(BuildContext context) => AppShimmer(child: Padding(
    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
    child: Row(children: [
      _shimmerBox(width: 40, height: 40, radius: 20),
      const SizedBox(width: 12),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        _shimmerBox(width: double.infinity, height: 13),
        const SizedBox(height: 6),
        _shimmerBox(width: 160, height: 11),
      ])),
      _shimmerBox(width: 60, height: 24, radius: 12),
    ]),
  ));
}

/// Shimmer for stat cards (dashboard grid)
class ShimmerStatCard extends StatelessWidget {
  const ShimmerStatCard({super.key});
  @override
  Widget build(BuildContext context) => AppShimmer(child: Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
      _shimmerBox(width: 34, height: 34, radius: 8),
      Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        _shimmerBox(width: 56, height: 20),
        const SizedBox(height: 6),
        _shimmerBox(width: 80, height: 11),
      ]),
    ]),
  ));
}

/// Shimmer for card blocks (billing, invoices)
class ShimmerCard extends StatelessWidget {
  final double height;
  const ShimmerCard({super.key, this.height = 100});
  @override
  Widget build(BuildContext context) => AppShimmer(child: Container(
    height: height,
    margin: const EdgeInsets.only(bottom: 10),
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        _shimmerBox(width: 100, height: 14),
        _shimmerBox(width: 70, height: 22, radius: 11),
      ]),
      const SizedBox(height: 12),
      _shimmerBox(width: 140, height: 11),
      const SizedBox(height: 8),
      Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        _shimmerBox(width: 80, height: 11),
        _shimmerBox(width: 90, height: 18),
      ]),
    ]),
  ));
}

/// Shimmer for a full list page (renders N items)
class ShimmerList extends StatelessWidget {
  final int count;
  final Widget Function() itemBuilder;
  const ShimmerList({super.key, this.count = 6, required this.itemBuilder});

  @override
  Widget build(BuildContext context) => ListView.builder(
    padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
    itemCount: count,
    physics: const NeverScrollableScrollPhysics(),
    shrinkWrap: true,
    itemBuilder: (_, __) => itemBuilder(),
  );
}

/// Sliver version
class SliverShimmerList extends StatelessWidget {
  final int count;
  final Widget Function() itemBuilder;
  const SliverShimmerList({super.key, this.count = 6, required this.itemBuilder});

  @override
  Widget build(BuildContext context) => SliverPadding(
    padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
    sliver: SliverList(delegate: SliverChildBuilderDelegate(
      (_, i) => itemBuilder(),
      childCount: count,
    )),
  );
}

/// Hero banner shimmer (dashboard)
class ShimmerHeroBanner extends StatelessWidget {
  const ShimmerHeroBanner({super.key});
  @override
  Widget build(BuildContext context) => AppShimmer(child: Container(
    margin: const EdgeInsets.all(16),
    padding: const EdgeInsets.all(20),
    height: 120,
    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        _shimmerBox(width: 40, height: 40, radius: 20),
        const SizedBox(width: 12),
        Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          _shimmerBox(width: 60, height: 11),
          const SizedBox(height: 6),
          _shimmerBox(width: 120, height: 14),
        ]),
      ]),
      const Spacer(),
      _shimmerBox(width: double.infinity, height: 36, radius: 10),
    ]),
  ));
}
