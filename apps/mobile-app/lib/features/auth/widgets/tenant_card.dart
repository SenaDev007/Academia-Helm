import 'package:flutter/material.dart';

import '../../../core/auth/auth_state.dart';
import '../../../core/theme/ah_theme.dart';

/// Card widget for displaying a tenant in the selection list.
class TenantCard extends StatelessWidget {
  const TenantCard({
    super.key,
    required this.tenant,
    required this.onTap,
  });

  final TenantBasic tenant;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(
        horizontal: AHSpacing.lg,
        vertical: AHSpacing.sm,
      ),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AHRadius.lg),
        side: BorderSide(color: AHColors.gray200, width: 1),
      ),
      elevation: 1,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AHRadius.lg),
        child: Padding(
          padding: const EdgeInsets.all(AHSpacing.lg),
          child: Row(
            children: [
              // ── Tenant Logo / Placeholder ──────────────────────────
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  color: AHColors.navy.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(AHRadius.md),
                ),
                child: tenant.logoUrl != null
                    ? ClipRRect(
                        borderRadius: BorderRadius.circular(AHRadius.md),
                        child: Image.network(
                          tenant.logoUrl!,
                          width: 52,
                          height: 52,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) =>
                              _buildAcronymPlaceholder(),
                        ),
                      )
                    : _buildAcronymPlaceholder(),
              ),
              const SizedBox(width: AHSpacing.lg),

              // ── Tenant Info ───────────────────────────────────────
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      tenant.name,
                      style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: AHColors.gray900,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: AHSpacing.xs),
                    Row(
                      children: [
                        if (tenant.acronym != null) ...[
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: AHSpacing.sm,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: AHColors.gold.withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              tenant.acronym!,
                              style: const TextStyle(
                                fontFamily: 'Inter',
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                color: AHColors.goldDark,
                              ),
                            ),
                          ),
                          const SizedBox(width: AHSpacing.sm),
                        ],
                        if (tenant.type != null)
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: AHSpacing.sm,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: AHColors.navy.withValues(alpha: 0.08),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              tenant.type!,
                              style: const TextStyle(
                                fontFamily: 'Inter',
                                fontSize: 11,
                                fontWeight: FontWeight.w500,
                                color: AHColors.navy,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ],
                ),
              ),

              // ── Chevron ───────────────────────────────────────────
              const Icon(
                Icons.chevron_right,
                color: AHColors.gray400,
                size: 24,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildAcronymPlaceholder() {
    return Center(
      child: Text(
        tenant.shortName,
        style: const TextStyle(
          fontFamily: 'Inter',
          fontSize: 16,
          fontWeight: FontWeight.w700,
          color: AHColors.navy,
        ),
      ),
    );
  }
}
