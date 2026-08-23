/**
 * ============================================================================
 * FILE SERVING CONTROLLER — Streams static files from public/ via NestJS
 * ============================================================================
 *
 * ⭐ Why this controller exists:
 * The previous setup used `app.use(express.static(join(process.cwd(), 'public')))`
 * in main.ts. The intent was: files saved by StorageService at
 * `public/chat/audio/uuid.webm` would be served at URL `/chat/audio/uuid.webm`.
 *
 * However, NestJS's router intercepts ALL incoming requests BEFORE the
 * express.static middleware runs. For any path that doesn't match a NestJS
 * controller (e.g. `/chat/audio/uuid.webm`), NestJS returns its default
 * `{"message":"Cannot GET /chat/audio/...","error":"Not Found","statusCode":404}`
 * response immediately — the express.static middleware never gets invoked.
 *
 * Result: every chat attachment URL like `/chat/audio/xxx.webm` returned 404,
 * breaking audio playback and file downloads.
 *
 * ⭐ Fix:
 * This controller explicitly registers a NestJS route at `/chat/files/*`
 * that streams the file from `public/` using `res.sendFile`. Because it's
 * a proper NestJS controller, NestJS's router routes the request to it
 * instead of returning 404.
 *
 * ⭐ Endpoint:
 *   GET /api/chat/files/*path  →  streams public/<path> from disk
 *
 * Examples:
 *   GET /api/chat/files/chat/audio/uuid.webm  →  public/chat/audio/uuid.webm
 *   GET /api/chat/files/chat/document/abc.pdf →  public/chat/document/abc.pdf
 *   GET /api/chat/files/chat/image/xyz.jpg    →  public/chat/image/xyz.jpg
 *   GET /api/chat/files/avatars/user-123.png  →  public/avatars/user-123.png
 *
 * ⭐ Security:
 *   - Path is sanitized to prevent directory traversal (no `..` allowed)
 *   - Only files inside `public/` are served
 *   - The endpoint is PUBLIC (no JWT guard) so that <audio src="..."> and
 *     <a href="..." download> tags can fetch the file without auth headers.
 *     This is consistent with how R2/S3 URLs work (also public).
 *   - For sensitive files, the existing StorageService R2/S3 path with
 *     pre-signed URLs should be used instead.
 * ============================================================================
 */

import {
  Controller, Get, Param, Res, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { join, normalize } from 'path';
import { existsSync, statSync } from 'fs';
import * as fs from 'fs';
import * as path from 'path';

// Max file size to serve via this endpoint (50 MB — audio files can be large)
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

// Allowed folders under public/ that can be served by this controller.
// Restricting to a whitelist prevents serving arbitrary files (e.g. .env).
const ALLOWED_FOLDERS = ['chat', 'avatars', 'uploads', 'logos', 'icons'];

@Controller('chat/files')
export class FileServingController {
  /**
   * Streams a file from public/ to the client.
   * The wildcard path `*path` captures the full sub-path including slashes.
   */
  @Get('*path')
  async serveFile(@Param('path') reqPath: string, @Res() res: Response) {
    if (!reqPath) {
      throw new BadRequestException('File path is required');
    }

    // ⭐ Security: normalize the path and prevent directory traversal.
    //    `normalize` collapses `..` segments, then we explicitly reject
    //    any remaining `..` to be safe.
    const normalized = normalize(reqPath);
    if (normalized.includes('..')) {
      throw new BadRequestException('Invalid path: directory traversal not allowed');
    }

    // Check that the path starts with one of the allowed folders
    const firstSegment = normalized.split('/')[0] || normalized.split('\\')[0];
    if (!ALLOWED_FOLDERS.includes(firstSegment)) {
      throw new BadRequestException(
        `Access denied: folder '${firstSegment}' is not in the allowed list. ` +
        `Allowed folders: ${ALLOWED_FOLDERS.join(', ')}.`
      );
    }

    // Build the absolute file path
    const filePath = join(process.cwd(), 'public', normalized);

    // ⭐ Security: verify the resolved path is still inside public/ (defence in depth)
    const publicRoot = join(process.cwd(), 'public');
    if (!filePath.startsWith(publicRoot)) {
      throw new BadRequestException('Invalid path: escapes public folder');
    }

    // Check if file exists
    if (!existsSync(filePath)) {
      throw new NotFoundException(
        `File not found: /${reqPath}. ` +
        `If this is an audio message recently uploaded, the file may have been ` +
        `lost during a Railway redeploy (ephemeral filesystem). Consider ` +
        `configuring STORAGE_TYPE=r2 on Railway for persistent file storage.`
      );
    }

    // Check file size — reject files larger than 50 MB
    const stat = statSync(filePath);
    if (stat.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException('File too large to serve via this endpoint');
    }

    // Determine Content-Type from extension
    const ext = path.extname(filePath).toLowerCase();
    const contentType = this.getContentType(ext);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', stat.size.toString());
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 24h cache
    // Allow cross-origin requests from the web app
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Stream the file to the response
    const stream = fs.createReadStream(filePath);
    stream.on('error', (err) => {
      console.error('[FileServingController] Stream error:', err);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Failed to stream file', error: err.message });
      }
    });
    stream.pipe(res);
  }

  /**
   * Maps file extensions to MIME types.
   * Covers the common attachment types used by Helm Connect chat.
   */
  private getContentType(ext: string): string {
    const map: Record<string, string> = {
      '.webm': 'audio/webm',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.m4a': 'audio/mp4',
      '.mp4': 'video/mp4',
      '.webp': 'image/webp',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.zip': 'application/zip',
      '.txt': 'text/plain',
      '.json': 'application/json',
    };
    return map[ext] || 'application/octet-stream';
  }
}
