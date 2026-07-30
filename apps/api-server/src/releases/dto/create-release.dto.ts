import { IsString, IsEnum, IsBoolean, IsOptional, IsNumber, IsURL, MaxLength } from 'class-validator';

export enum ReleasePlatform {
  ANDROID = 'android',
  WINDOWS = 'windows',
  IOS = 'ios',
  MACOS = 'macos',
  LINUX = 'linux',
}

export enum ReleaseChannel {
  STABLE = 'stable',
  BETA = 'beta',
  DEV = 'dev',
}

export enum ReleaseArch {
  X64 = 'x64',
  ARM64 = 'arm64',
  UNIVERSAL = 'universal',
}

export class CreateReleaseDto {
  @IsString()
  @MaxLength(32)
  version: string; // ex: "1.2.8"

  @IsEnum(ReleasePlatform)
  platform: ReleasePlatform;

  @IsEnum(ReleaseArch)
  arch: ReleaseArch = ReleaseArch.UNIVERSAL;

  @IsString()
  @MaxLength(255)
  filename: string;

  @IsNumber()
  fileSize: number; // en bytes

  @IsURL()
  downloadUrl: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  checksumSha256?: string;

  @IsOptional()
  @IsEnum(ReleaseChannel)
  releaseChannel?: ReleaseChannel = ReleaseChannel.STABLE;

  @IsBoolean()
  isLatest: boolean = false;

  @IsOptional()
  @IsString()
  releaseNotes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  minOsVersion?: string;
}
