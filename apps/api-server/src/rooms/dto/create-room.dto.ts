import { IsString, IsOptional, IsInt, IsArray, Min } from 'class-validator';

export class CreateRoomDto {
  @IsString()
  roomCode: string;

  @IsString()
  roomName: string;

  @IsString()
  roomType: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  capacity?: number;

  @IsArray()
  @IsOptional()
  equipment?: any[];

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsOptional()
  @IsString()
  academicYearId?: string;

  @IsOptional()
  @IsString()
  schoolLevelId?: string;
}

