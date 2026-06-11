import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { AcademicTracksRepository } from './academic-tracks.repository';
import { AcademicTrack, AcademicTrackCode } from './entities/academic-track.entity';
import { CreateAcademicTrackDto } from './dto/create-academic-track.dto';
import { UpdateAcademicTrackDto } from './dto/update-academic-track.dto';

@Injectable()
export class AcademicTracksService {
  constructor(private readonly repository: AcademicTracksRepository) {}

  async create(createDto: CreateAcademicTrackDto, tenantId: string): Promise<AcademicTrack> {
    // Vérifier qu'un track avec ce code n'existe pas déjà
    const existing = await this.repository.findByCode(createDto.code, tenantId);
    if (existing) {
      throw new BadRequestException(`Un track avec le code ${createDto.code} existe déjà pour ce tenant`);
    }

    // Si c'est le track par défaut, désactiver les autres
    if (createDto.isDefault) {
      await this.unsetDefaultTracks(tenantId);
    }

    return this.repository.create({ ...createDto, tenantId });
  }

  async findAll(tenantId: string): Promise<AcademicTrack[]> {
    return this.repository.findAll(tenantId);
  }

  async findOne(id: string, tenantId: string): Promise<AcademicTrack> {
    const track = await this.repository.findOne(id, tenantId);
    if (!track) {
      throw new NotFoundException(`Academic Track with ID ${id} not found`);
    }
    return track;
  }

  async findByCode(code: AcademicTrackCode, tenantId: string): Promise<AcademicTrack> {
    const track = await this.repository.findByCode(code, tenantId);
    if (!track) {
      throw new NotFoundException(`Academic Track with code ${code} not found`);
    }
    return track;
  }

  async getDefaultTrack(tenantId: string): Promise<AcademicTrack> {
    let track = await this.repository.findDefault(tenantId);
    
    // Si aucun track par défaut, initialiser le FR
    if (!track) {
      track = await this.repository.initializeDefaultTrack(tenantId);
    }
    
    return track;
  }

  async update(id: string, updateDto: UpdateAcademicTrackDto, tenantId: string): Promise<AcademicTrack> {
    await this.findOne(id, tenantId);

    // Si on définit ce track comme par défaut, désactiver les autres
    if (updateDto.isDefault) {
      await this.unsetDefaultTracks(tenantId, id);
    }

    return this.repository.update(id, tenantId, updateDto);
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const track = await this.findOne(id, tenantId);

    // Ne pas permettre la suppression du track par défaut
    if (track.isDefault) {
      throw new BadRequestException('Cannot delete the default academic track');
    }

    // Ne pas permettre la suppression du track FR
    if (track.code === AcademicTrackCode.FR) {
      throw new BadRequestException('Cannot delete the Francophone track (FR)');
    }

    await this.repository.delete(id, tenantId);
  }

  /**
   * Initialise le track FR par défaut pour un tenant
   */
  async initializeDefaultTrack(tenantId: string): Promise<AcademicTrack> {
    return this.repository.initializeDefaultTrack(tenantId);
  }

  /**
   * Désactive tous les tracks par défaut (sauf celui avec excludeId)
   */
  private async unsetDefaultTracks(tenantId: string, excludeId?: string): Promise<void> {
    const tracks = await this.repository.findAll(tenantId);
    for (const track of tracks) {
      if (track.isDefault && track.id !== excludeId) {
        await this.repository.update(track.id, tenantId, { isDefault: false });
      }
    }
  }
}

