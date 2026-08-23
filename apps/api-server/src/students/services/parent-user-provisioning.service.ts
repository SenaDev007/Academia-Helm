/**
 * ============================================================================
 * PARENT USER PROVISIONING SERVICE
 * ============================================================================
 *
 * ⭐ Why this service exists:
 * The chat system (chat_conversations, chat_participants, chat_messages) is
 * built around User IDs. A parent (Guardian) cannot be a chat participant
 * unless they have a User account.
 *
 * Previously, guardians were created during student enrollment WITHOUT a
 * linked User account. This meant:
 *   - Teachers couldn't chat with parents (no User ID to add as participant)
 *   - Parents couldn't login to the portal (loginParentByPhone throws
 *     "Compte parent non configuré" if no User exists with matching email)
 *
 * This service fixes that by auto-creating a User account (role=PARENT,
 * passwordHash=null — login via phone OTP) for any guardian that doesn't
 * have one yet, and back-filling guardian.userId.
 *
 * ⭐ When it's called:
 *   - Lazily: when a teacher wants to start a chat with a guardian
 *     (POST /api/chat/conversations/guardian-direct)
 *   - Lazily: when the finance module wants to send a Helm Connect message
 *     to a parent (ReceiptNotificationFinanceService)
 *   - Eagerly: when a guardian is created via student enrollment
 *     (hooked into GuardiansPrismaService.createGuardianForStudent)
 *   - Backfill: a one-time admin script to provision existing guardians
 *
 * ⭐ Email handling:
 * The User.email column is @unique. If a guardian has no email, we use a
 * deterministic fallback: "guardian-{guardianId}@no-email.local".
 * This ensures we can always create a User, but the parent will need to
 * login via their phone (not email) in that case.
 * ============================================================================
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class ParentUserProvisioningService {
  private readonly logger = new Logger(ParentUserProvisioningService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ensures a User account exists for the given guardian. If the guardian
   * already has a linked userId, returns it. Otherwise:
   *   1. Looks up an existing User by email (in case a User was created
   *      out-of-band with the same email)
   *   2. If none, creates a new User with role=PARENT, passwordHash=null
   *   3. Back-fills guardian.userId
   *
   * @returns { userId, created } where created=true if a new User was created.
   */
  async ensureUserForGuardian(guardianId: string): Promise<{ userId: string; created: boolean }> {
    if (!guardianId) {
      throw new NotFoundException('guardianId is required');
    }

    // 1. Find the guardian
    const guardian = await this.prisma.guardian.findUnique({ where: { id: guardianId } });
    if (!guardian) {
      throw new NotFoundException(`Guardian not found: ${guardianId}`);
    }

    // 2. If already linked, return early (no work to do)
    if (guardian.userId) {
      return { userId: guardian.userId, created: false };
    }

    // 3. Look up existing User by email (in case it was created out-of-band)
    let user: any = null;
    if (guardian.email) {
      user = await this.prisma.user.findFirst({
        where: {
          email: { equals: guardian.email, mode: 'insensitive' },
          tenantId: guardian.tenantId,
        },
      });
    }

    // 4. If no User found, create one
    let created = false;
    if (!user) {
      const email = guardian.email || `guardian-${guardian.id}@no-email.local`;
      try {
        user = await this.prisma.user.create({
          data: {
            id: randomUUID(),
            tenantId: guardian.tenantId,
            email,
            firstName: guardian.firstName,
            lastName: guardian.lastName,
            role: 'PARENT',
            status: 'active',
            passwordHash: null, // Login via phone OTP — no password
          },
        });
        created = true;
        this.logger.log(`Created PARENT User ${user.id} for guardian ${guardian.id} (tenant ${guardian.tenantId})`);
      } catch (err: any) {
        // Handle race condition: another request created the User in parallel
        if (err.code === 'P2002' && guardian.email) {
          // Unique constraint violation on email — another User with this email exists
          user = await this.prisma.user.findFirst({
            where: {
              email: { equals: guardian.email, mode: 'insensitive' },
              tenantId: guardian.tenantId,
            },
          });
          if (!user) {
            throw err; // unexpected — rethrow
          }
          this.logger.warn(`Race condition: User with email ${guardian.email} was created concurrently. Reusing it.`);
        } else {
          throw err;
        }
      }
    }

    // 5. Back-fill guardian.userId (idempotent — safe to call multiple times)
    await this.prisma.guardian.update({
      where: { id: guardianId },
      data: { userId: user.id },
    });

    return { userId: user.id, created };
  }

  /**
   * Variant: ensure User exists for a guardian identified by phone number.
   * Useful for the finance module which only knows the parent's phone.
   */
  async ensureUserForGuardianByPhone(
    tenantId: string,
    phone: string,
  ): Promise<{ userId: string; guardianId: string; created: boolean } | null> {
    if (!tenantId || !phone) return null;

    const guardian = await this.prisma.guardian.findFirst({
      where: {
        tenantId,
        phone: phone,
      },
    });
    if (!guardian) {
      this.logger.warn(`No guardian found for tenant=${tenantId}, phone=${phone}`);
      return null;
    }

    const { userId, created } = await this.ensureUserForGuardian(guardian.id);
    return { userId, guardianId: guardian.id, created };
  }

  /**
   * Variant: ensure User exists for a guardian identified by student ID.
   * Useful for the finance module which knows the student but not the guardian.
   * Uses the isPrimary=true guardian (or falls back to any guardian).
   */
  async ensureUserForPrimaryGuardianOfStudent(
    tenantId: string,
    studentId: string,
  ): Promise<{ userId: string; guardianId: string; created: boolean } | null> {
    if (!tenantId || !studentId) return null;

    // Find the primary guardian for this student
    const studentGuardian = await this.prisma.studentGuardian.findFirst({
      where: {
        studentId,
        guardian: { tenantId },
      },
      orderBy: [{ isPrimary: 'desc' }],
      include: { guardian: true },
    });
    if (!studentGuardian) {
      this.logger.warn(`No guardian found for tenant=${tenantId}, student=${studentId}`);
      return null;
    }

    const { userId, created } = await this.ensureUserForGuardian(studentGuardian.guardianId);
    return { userId, guardianId: studentGuardian.guardianId, created };
  }
}
