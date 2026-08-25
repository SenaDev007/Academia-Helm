import { Injectable, NotFoundException, Optional, Inject, Logger } from '@nestjs/common';
import { AbsencesRepository } from './absences.repository';
import { Absence } from './entities/absence.entity';
import { CreateAbsenceDto } from './dto/create-absence.dto';
import { UpdateAbsenceDto } from './dto/update-absence.dto';
import { toDate } from '../common/helpers/date.helper';
import { HelmConnectNotificationBridgeService } from '../communication/services/helm-connect-bridge.service';

@Injectable()
export class AbsencesService {
  private readonly logger = new Logger(AbsencesService.name);

  constructor(
    private readonly absencesRepository: AbsencesRepository,
    @Optional() @Inject(HelmConnectNotificationBridgeService)
    private readonly bridge?: HelmConnectNotificationBridgeService,
  ) {}

  async create(createAbsenceDto: CreateAbsenceDto, tenantId: string, createdBy?: string): Promise<Absence> {
    const absence = await this.absencesRepository.create({
      ...createAbsenceDto,
      date: toDate(createAbsenceDto.date as any) || new Date(),
      tenantId,
      createdBy,
    });

    // ⭐ V3-4: Yeshua Connect notification (fire-and-forget, never blocks)
    if (this.bridge && absence) {
      this.bridge
        .notifyAbsenceCreated({
          tenantId,
          absenceId: (absence as any).id,
          studentId: (absence as any).studentId,
          classId: (absence as any).classId,
          date: (absence as any).date instanceof Date
            ? (absence as any).date
            : new Date((absence as any).date),
          isJustified: (absence as any).isJustified,
          justification: (absence as any).justification,
          triggeredByUserId: createdBy,
        })
        .then((r) =>
          this.logger.log(
            `notifyAbsenceCreated: inApp=${r.channels.inApp?.status} whatsapp=${r.channels.whatsapp?.status} helm=${r.channels.helmConnectMessage?.status}`,
          ),
        )
        .catch((err) =>
          this.logger.warn(`notifyAbsenceCreated non-bloquant échoué: ${err.message}`),
        );
    }

    return absence;
  }

  async findAll(tenantId: string, studentId?: string, classId?: string, startDate?: Date, endDate?: Date): Promise<Absence[]> {
    return this.absencesRepository.findAll(tenantId, studentId, classId, startDate, endDate);
  }

  async findOne(id: string, tenantId: string): Promise<Absence> {
    const absence = await this.absencesRepository.findOne(id, tenantId);
    if (!absence) {
      throw new NotFoundException(`Absence with ID ${id} not found`);
    }
    return absence;
  }

  async update(id: string, updateAbsenceDto: UpdateAbsenceDto, tenantId: string, justifiedBy?: string): Promise<Absence> {
    await this.findOne(id, tenantId);
    const updateData: any = { ...updateAbsenceDto, justifiedBy };
    if (updateAbsenceDto.date) {
      updateData.date = toDate(updateAbsenceDto.date as any);
    }
    const updated = await this.absencesRepository.update(id, tenantId, updateData);

    // ⭐ V3-4: Si l'absence a été justifiée par le parent/SG, notifier le staff
    if (this.bridge && updated && (updateAbsenceDto as any).isJustified === true) {
      this.bridge
        .notifyAbsenceJustified({
          tenantId,
          absenceId: id,
          studentId: (updated as any).studentId,
          date:
            (updated as any).date instanceof Date
              ? (updated as any).date
              : new Date((updated as any).date),
          justification: (updated as any).justification,
          justifiedByUserId: justifiedBy,
        })
        .then((r) =>
          this.logger.log(`notifyAbsenceJustified: inApp=${r.channels.inApp?.status}`),
        )
        .catch((err) =>
          this.logger.warn(`notifyAbsenceJustified non-bloquant échoué: ${err.message}`),
        );
    }

    return updated;
  }

  async delete(id: string, tenantId: string): Promise<void> {
    await this.findOne(id, tenantId);
    await this.absencesRepository.delete(id, tenantId);
  }
}
