/**
 * AppRelease Entity — represents an installable file (APK, EXE, MSI, etc.)
 *
 * Les fichiers binaires sont stockés sur Cloudflare R2 (stockage objet).
 * Cette entité ne contient que les métadonnées.
 */

export type ReleasePlatform = 'android' | 'windows' | 'ios' | 'macos' | 'linux';
export type ReleaseChannel = 'stable' | 'beta' | 'dev';
export type ReleaseArch = 'x64' | 'arm64' | 'universal';

export class AppRelease {
  id: string;
  version: string;
  platform: ReleasePlatform;
  arch: ReleaseArch;
  filename: string;
  fileSize: number; // en bytes
  downloadUrl: string;
  checksumSha256?: string;
  releaseChannel: ReleaseChannel;
  isLatest: boolean;
  releaseNotes?: string;
  minOsVersion?: string;
  uploadedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
