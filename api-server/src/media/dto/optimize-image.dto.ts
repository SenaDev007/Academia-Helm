import { IsString, MaxLength, MinLength } from 'class-validator';

/** Corps POST /api/media/optimize — data URL image (souvent base64). */
export class OptimizeImageDto {
  @IsString()
  @MinLength(32, { message: 'dataUrl invalide' })
  @MaxLength(30_000_000, { message: 'Image trop volumineuse (chaîne)' })
  dataUrl!: string;
}
