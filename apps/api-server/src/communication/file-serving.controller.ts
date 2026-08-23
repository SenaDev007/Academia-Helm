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
 * 404 response immediately — the express.static middleware never gets invoked.
 *
 * Result: every chat attachment URL like `/chat/audio/xxx.webm` returned 404,
 * breaking audio playback and file downloads.
 *
 * ⭐ Fix:
 * This controller explicitly registers NestJS routes at /chat/files/* that
 * stream files from public/ using res.sendFile. Because they're proper
 * NestJS routes, NestJS's router dispatches them instead of returning 404.
 *
 * We register TWO routes:
 *   - GET /api/chat/files/:folder/:sub/:filename   (3 segments, e.g. chat/audio/uuid.webm)
 *   - GET /api/chat/files/:folder/:filename        (2 segments, e.g. avatars/user-123.png)
 *
 * Using explicit parameter routes is more reliable than wildcards across
 * NestJS versions (path-to-regexp v6 changed the wildcard syntax, and
 * `*name` doesn't always capture as expected).
 *
 * ⭐ Security:
 *   - Path is sanitized to prevent directory traversal (no `..` allowed)
 *   - Only files inside public/ are served
 *   - Allow-list of folders (chat, avatars, uploads, logos, icons)
 *   - Public endpoint (no JWT guard) so <audio src> and <a download> work
 *
 * ⭐ Long-term fix:
 *   Configure STORAGE_TYPE=r2 on Railway so files persist across deploys
 *   and are served via public R2 URLs (no NestJS controller needed).
 * ============================================================================
 */

import {
  Controller, Get, Param, Res, NotFoundException, BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { Public } from '../auth/decorators/public.decorator';

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

const ALLOWED_FOLDERS = ['chat', 'avatars', 'uploads', 'logos', 'icons'];

/**
 * ⭐ @Public() marks all routes in this controller as PUBLIC (no JWT required).
 * This is necessary because:
 *   - <audio src="..."> tags don't send Authorization headers
 *   - <a href="..." download> tags don't send Authorization headers
 *   - <img src="..."> tags don't send Authorization headers
 * Consistent with how R2/S3 URLs work (also public).
 */
@Controller('chat/files')
@Public()
export class FileServingController {
  /**
   * 3-segment route: matches /api/chat/files/chat/audio/uuid.webm
   * Used by audio messages (folder=chat, sub=audio, filename=uuid.webm)
   * and documents (folder=chat, sub=document, filename=abc.pdf)
   * and images (folder=chat, sub=image, filename=xyz.jpg).
   */
  @Get(':folder/:sub/:filename')
  async serveThreeSegments(
    @Param('folder') folder: string,
    @Param('sub') sub: string,
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    return this.streamFile(`${folder}/${sub}/${filename}`, res);
  }

  /**
   * 2-segment route: matches /api/chat/files/avatars/user-123.png
   * Used by user avatars (folder=avatars, filename=user-123.png)
   * and any other 2-segment path.
   */
  @Get(':folder/:filename')
  async serveTwoSegments(
    @Param('folder') folder: string,
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    return this.streamFile(`${folder}/${filename}`, res);
  }

  /**
   * Common method: streams a file from public/ to the response.
   * Handles security checks, content-type, caching, and errors.
   */
  private streamFile(relativePath: string, res: Response): void {
    // ⭐ Security: reject any path containing '..' (directory traversal)
    if (relativePath.includes('..')) {
      throw new BadRequestException('Invalid path: directory traversal not allowed');
    }

    // Verify the first segment is in the allowed folders list
    const firstSegment = relativePath.split('/')[0];
    if (!ALLOWED_FOLDERS.includes(firstSegment)) {
      throw new BadRequestException(
        `Access denied: folder '${firstSegment}' is not in the allowed list. ` +
        `Allowed folders: ${ALLOWED_FOLDERS.join(', ')}.`,
      );
    }

    // Build the absolute file path
    const publicRoot = path.join(process.cwd(), 'public');
    const filePath = path.join(publicRoot, relativePath);

    // Defence in depth: verify the resolved path is still inside public/
    const resolvedPath = path.resolve(filePath);
    const resolvedRoot = path.resolve(publicRoot);
    if (!resolvedPath.startsWith(resolvedRoot + path.sep) && resolvedPath !== resolvedRoot) {
      throw new BadRequestException('Invalid path: escapes public folder');
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException(
        `File not found: ${relativePath}. ` +
        `If this is an audio message recently uploaded, the file may have been ` +
        `lost during a Railway redeploy (ephemeral filesystem). Consider ` +
        `configuring STORAGE_TYPE=r2 on Railway for persistent file storage.`,
      );
    }

    // Check file size — reject files larger than 50 MB
    const stat = fs.statSync(filePath);
    if (stat.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException('File too large to serve via this endpoint');
    }
    if (!stat.isFile()) {
      throw new BadRequestException('Requested path is not a file');
    }

    // Determine Content-Type from extension
    const ext = path.extname(filePath).toLowerCase();
    const contentType = this.getContentType(ext);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', stat.size.toString());
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 24h cache
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
