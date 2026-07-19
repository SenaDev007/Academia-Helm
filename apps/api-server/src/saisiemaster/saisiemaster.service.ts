/**
 * ============================================================================
 * SAISIEMASTER SERVICE — Prospect lead capture & session management
 * ============================================================================
 *
 * Frictionless auth (NO password):
 *   - signup: create or update a prospect by email → returns prospect + JWT
 *   - login:  find prospect by email → returns prospect + JWT
 *
 * The JWT contains { prospectId, email } and is signed with JWT_SECRET.
 *
 * Sessions:
 *   - Each session represents one class (Excel sheet) with its grades.
 *   - saveSession is idempotent: if a session with the same className +
 *     academicYear already exists for this prospect, it is updated.
 *
 * Activity tracking:
 *   - login / grade_entered / export → updates counters + lastLoginAt.
 *   - These counters feed the lead-scoring model in the marketing pipeline.
 * ============================================================================
 */

import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../database/prisma.service';

export interface UpdateProfileDto {
  firstName?: string;
  lastName?: string;
  schoolName?: string;
  phoneNumber?: string | null;
  city?: string | null;
}

export interface SignupDto {
  email: string;
  firstName: string;
  lastName: string;
  schoolName: string;
  phoneNumber?: string;
  city?: string;
  /** Mot de passe en clair (sera hashé avant stockage). Min 6 caractères. */
  password?: string;
}

export interface LoginDto {
  email: string;
  /** Mot de passe en clair à vérifier contre le hash stocké. */
  password?: string;
}

export interface SaveSessionDto {
  className: string;
  schoolYear?: string;
  academicYear?: string;
  studentCount: number;
  subjectCount: number;
  gradesData: unknown;
}

export interface AuthResult {
  prospect: ProspectPublic;
  token: string;
}

export interface ProspectPublic {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  schoolName: string;
  phoneNumber: string | null;
  city: string | null;
  status: string;
  signupDate: Date;
  lastLoginAt: Date | null;
  loginCount: number;
  classesCreated: number;
  gradesEntered: number;
  exportsCount: number;
}

export type ActivityType = 'login' | 'grade_entered' | 'export';

function toPublic(p: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  schoolName: string;
  phoneNumber: string | null;
  city: string | null;
  status: string;
  signupDate: Date;
  lastLoginAt: Date | null;
  loginCount: number;
  classesCreated: number;
  gradesEntered: number;
  exportsCount: number;
}): ProspectPublic {
  return {
    id: p.id,
    email: p.email,
    firstName: p.firstName,
    lastName: p.lastName,
    schoolName: p.schoolName,
    phoneNumber: p.phoneNumber,
    city: p.city,
    status: p.status,
    signupDate: p.signupDate,
    lastLoginAt: p.lastLoginAt,
    loginCount: p.loginCount,
    classesCreated: p.classesCreated,
    gradesEntered: p.gradesEntered,
    exportsCount: p.exportsCount,
  };
}

@Injectable()
export class SaisieMasterService {
  private readonly logger = new Logger(SaisieMasterService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Create or update a prospect by email. The password is hashed with bcrypt
   * before storage. Returns the prospect + a signed JWT token.
   *
   * Backward compatibility: if `password` is omitted, the prospect is created
   * without a password (legacy frictionless flow). Existing prospects without
   * a password can still login via the email-only fallback.
   */
  async signup(data: SignupDto): Promise<AuthResult> {
    const email = (data.email || '').trim().toLowerCase();
    if (!email) {
      throw new BadRequestException('Email is required');
    }
    if (!data.firstName || !data.lastName || !data.schoolName) {
      throw new BadRequestException(
        'firstName, lastName and schoolName are required',
      );
    }

    // ⭐ Pour les NOUVEAUX prospects, phoneNumber (WhatsApp) et city sont
    // obligatoires — l'admin doit savoir d'où vient le promoteur et avoir
    // un moyen de le contacter. Pour les prospects existants (update via
    // upsert), on tolère l'absence (rétro-compatibilité).
    const existingProspect = await this.prisma.saisieMasterProspect.findUnique({
      where: { email },
      select: { id: true },
    });
    if (!existingProspect) {
      if (!data.phoneNumber || !data.phoneNumber.trim()) {
        throw new BadRequestException(
          'Le numéro WhatsApp est obligatoire pour créer un compte',
        );
      }
      if (!data.city || !data.city.trim()) {
        throw new BadRequestException(
          'La ville est obligatoire pour créer un compte',
        );
      }
    }

    // Validate password if provided.
    let hashedPassword: string | undefined;
    if (data.password !== undefined && data.password !== null) {
      const pwd = data.password.trim();
      if (pwd.length < 6) {
        throw new BadRequestException(
          'Le mot de passe doit contenir au moins 6 caractères',
        );
      }
      hashedPassword = await bcrypt.hash(pwd, 10);
    }

    // Upsert by email — if the prospect already exists (returning user),
    // we refresh their profile info but keep the lead-tracking fields.
    const prospect = await this.prisma.saisieMasterProspect.upsert({
      where: { email },
      create: {
        email,
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        schoolName: data.schoolName.trim(),
        phoneNumber: data.phoneNumber?.trim() || null,
        city: data.city?.trim() || null,
        // Only store the password if one was provided.
        ...(hashedPassword ? { password: hashedPassword } : {}),
        source: 'saiemaster',
        status: 'LEAD',
        signupDate: new Date(),
        lastLoginAt: new Date(),
        loginCount: 1,
      },
      update: {
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        schoolName: data.schoolName.trim(),
        phoneNumber: data.phoneNumber?.trim() || null,
        city: data.city?.trim() || null,
        // Update the password only if a new one was provided. Otherwise we
        // keep the existing one (so re-signing up with no password doesn't
        // wipe the user's password).
        ...(hashedPassword ? { password: hashedPassword } : {}),
        lastLoginAt: new Date(),
        loginCount: { increment: 1 },
      },
    });

    const token = this.signToken(prospect.id, prospect.email);
    this.logger.log(
      `Signup OK — prospect ${prospect.id} (${prospect.email}, ${prospect.schoolName})`,
    );
    return { prospect: toPublic(prospect), token };
  }

  /**
   * Login by email + password.
   *
   * Backward compatibility: if the prospect has no stored password (created
   * before passwords were introduced), we still allow login via email-only
   * fallback — provided no password is sent in the request. This keeps old
   * prospects working without forcing them to reset.
   */
  async login(email: string, password?: string): Promise<AuthResult> {
    const normalized = (email || '').trim().toLowerCase();
    if (!normalized) {
      throw new BadRequestException('Email is required');
    }

    const prospect = await this.prisma.saisieMasterProspect.findUnique({
      where: { email: normalized },
    });

    if (!prospect) {
      // We don't leak whether the email exists — but for a frictionless free
      // tool, the UX is better if we tell the user to sign up.
      throw new NotFoundException(
        'Aucun compte trouvé avec cet email. Inscrivez-vous gratuitement pour commencer.',
      );
    }

    // Password verification.
    if (prospect.password) {
      // The prospect has a stored password — require a matching one.
      if (!password) {
        throw new UnauthorizedException(
          'Mot de passe requis pour ce compte.',
        );
      }
      const ok = await bcrypt.compare(password, prospect.password);
      if (!ok) {
        throw new UnauthorizedException('Email ou mot de passe incorrect.');
      }
    } else {
      // Legacy prospect (no password stored). Allow email-only login if the
      // caller did not send a password; otherwise reject to avoid silently
      // accepting any password.
      if (password) {
        throw new UnauthorizedException(
          'Ce compte ne possède pas encore de mot de passe. Veuillez réinitialiser votre compte ou contacter le support.',
        );
      }
    }

    const updated = await this.prisma.saisieMasterProspect.update({
      where: { id: prospect.id },
      data: {
        lastLoginAt: new Date(),
        loginCount: { increment: 1 },
      },
    });

    const token = this.signToken(updated.id, updated.email);
    this.logger.log(`Login OK — prospect ${updated.id} (${updated.email})`);
    return { prospect: toPublic(updated), token };
  }

  /**
   * Get the current prospect's profile (with sessions).
   */
  async getProfile(prospectId: string) {
    const prospect = await this.prisma.saisieMasterProspect.findUnique({
      where: { id: prospectId },
      include: {
        sessions: {
          orderBy: { updatedAt: 'desc' },
        },
      },
    });

    if (!prospect) {
      throw new NotFoundException('Prospect not found');
    }

    return {
      ...toPublic(prospect),
      sessions: prospect.sessions.map((s) => ({
        id: s.id,
        className: s.className,
        schoolYear: s.schoolYear,
        academicYear: s.academicYear,
        studentCount: s.studentCount,
        subjectCount: s.subjectCount,
        gradesData: s.gradesData,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
    };
  }

  /**
   * Update the current prospect's profile (firstName, lastName, schoolName,
   * phoneNumber, city). Email cannot be changed (it's the login key).
   * Returns the updated prospect (without sessions).
   */
  async updateProfile(prospectId: string, data: UpdateProfileDto) {
    const prospect = await this.prisma.saisieMasterProspect.findUnique({
      where: { id: prospectId },
      select: { id: true },
    });
    if (!prospect) {
      throw new NotFoundException('Prospect not found');
    }

    const update: Record<string, string | null> = {};
    if (typeof data.firstName === 'string' && data.firstName.trim()) {
      update.firstName = data.firstName.trim();
    }
    if (typeof data.lastName === 'string' && data.lastName.trim()) {
      update.lastName = data.lastName.trim();
    }
    if (typeof data.schoolName === 'string' && data.schoolName.trim()) {
      update.schoolName = data.schoolName.trim();
    }
    if (data.phoneNumber !== undefined) {
      update.phoneNumber = data.phoneNumber?.trim() || null;
    }
    if (data.city !== undefined) {
      update.city = data.city?.trim() || null;
    }

    if (Object.keys(update).length === 0) {
      throw new BadRequestException(
        'No updatable fields provided (firstName, lastName, schoolName, phoneNumber, city)',
      );
    }

    const updated = await this.prisma.saisieMasterProspect.update({
      where: { id: prospectId },
      data: update,
    });

    this.logger.log(
      `Profile updated — prospect ${prospectId} (${updated.email})`,
    );
    return toPublic(updated);
  }

  /**
   * Save (create or update) a grade-entry session for a prospect.
   * Idempotent on (prospectId, className, academicYear).
   */
  async saveSession(prospectId: string, data: SaveSessionDto) {
    if (!data.className) {
      throw new BadRequestException('className is required');
    }

    const prospect = await this.prisma.saisieMasterProspect.findUnique({
      where: { id: prospectId },
      select: { id: true, classesCreated: true },
    });
    if (!prospect) {
      throw new NotFoundException('Prospect not found');
    }

    // Try to find an existing session for the same className + academicYear.
    const academicYear = data.academicYear ?? null;
    const existing = await this.prisma.saisieMasterSession.findFirst({
      where: {
        prospectId,
        className: data.className,
        academicYear,
      },
    });

    let session;
    let isNew = false;
    if (existing) {
      session = await this.prisma.saisieMasterSession.update({
        where: { id: existing.id },
        data: {
          schoolYear: data.schoolYear ?? null,
          studentCount: data.studentCount ?? 0,
          subjectCount: data.subjectCount ?? 0,
          gradesData: data.gradesData as object,
        },
      });
    } else {
      isNew = true;
      session = await this.prisma.saisieMasterSession.create({
        data: {
          prospectId,
          className: data.className,
          schoolYear: data.schoolYear ?? null,
          academicYear,
          studentCount: data.studentCount ?? 0,
          subjectCount: data.subjectCount ?? 0,
          gradesData: data.gradesData as object,
        },
      });

      // Bump the classesCreated counter for lead scoring.
      await this.prisma.saisieMasterProspect.update({
        where: { id: prospectId },
        data: { classesCreated: { increment: 1 } },
      });
    }

    this.logger.log(
      `Session ${isNew ? 'created' : 'updated'} — prospect ${prospectId}, class ${data.className} (${session.id})`,
    );
    return session;
  }

  /**
   * List all sessions for a prospect (most recently updated first).
   */
  async getSessions(prospectId: string) {
    const sessions = await this.prisma.saisieMasterSession.findMany({
      where: { prospectId },
      orderBy: { updatedAt: 'desc' },
    });
    return sessions;
  }

  /**
   * Delete a session. Must belong to the prospect.
   */
  async deleteSession(prospectId: string, sessionId: string) {
    const session = await this.prisma.saisieMasterSession.findUnique({
      where: { id: sessionId },
      select: { id: true, prospectId: true },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }
    if (session.prospectId !== prospectId) {
      // Don't leak existence of other prospects' sessions.
      throw new NotFoundException('Session not found');
    }

    await this.prisma.saisieMasterSession.delete({ where: { id: sessionId } });
    this.logger.log(
      `Session deleted — prospect ${prospectId}, session ${sessionId}`,
    );
    return { success: true, id: sessionId };
  }

  /**
   * Track activity for lead scoring.
   *   - login         → updates lastLoginAt + loginCount
   *   - grade_entered → increments gradesEntered
   *   - export        → increments exportsCount
   */
  async trackActivity(prospectId: string, type: ActivityType) {
    const prospect = await this.prisma.saisieMasterProspect.findUnique({
      where: { id: prospectId },
      select: { id: true },
    });
    if (!prospect) {
      throw new NotFoundException('Prospect not found');
    }

    const now = new Date();
    let update: Record<string, unknown>;

    switch (type) {
      case 'login':
        update = {
          lastLoginAt: now,
          loginCount: { increment: 1 },
        };
        break;
      case 'grade_entered':
        update = { gradesEntered: { increment: 1 } };
        break;
      case 'export':
        update = { exportsCount: { increment: 1 } };
        break;
      default:
        throw new ConflictException(`Unknown activity type: ${type}`);
    }

    const updated = await this.prisma.saisieMasterProspect.update({
      where: { id: prospectId },
      data: update,
    });

    return {
      success: true,
      type,
      gradesEntered: updated.gradesEntered,
      exportsCount: updated.exportsCount,
      classesCreated: updated.classesCreated,
      loginCount: updated.loginCount,
    };
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  private signToken(prospectId: string, email: string): string {
    return this.jwtService.sign({ prospectId, email });
  }

  /**
   * Verify a bearer token and return the payload.
   * Throws if invalid/expired.
   */
  async verifyToken(token: string): Promise<{ prospectId: string; email: string }> {
    try {
      const payload = await this.jwtService.verifyAsync<{
        prospectId: string;
        email: string;
      }>(token);
      if (!payload?.prospectId) {
        throw new BadRequestException('Invalid token payload');
      }
      return payload;
    } catch (err) {
      throw new BadRequestException(
        `Invalid or expired token: ${(err as Error).message}`,
      );
    }
  }
}
