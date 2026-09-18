import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
// ⭐ Profil self-service « Mon profil » (photo + identité) — tous les UI
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

@Module({
  imports: [],
  controllers: [UsersController, ProfileController],
  providers: [UsersService, UsersRepository, ProfileService],
  exports: [
    UsersService,
    UsersRepository,
  ],
})
export class UsersModule {}

