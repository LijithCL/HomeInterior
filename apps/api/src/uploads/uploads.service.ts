import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { StorageService } from '../storage/storage.service';

const ALLOWED_MIME_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

@Injectable()
export class UploadsService {
  constructor(private readonly storage: StorageService) {}

  async saveImage(
    file: { mimetype: string; size: number; buffer: Buffer },
    prefix: string,
  ): Promise<string> {
    const ext = ALLOWED_MIME_TYPES[file.mimetype];
    if (!ext) {
      throw new BadRequestException(
        'Only PNG, JPEG, or WEBP images are allowed',
      );
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException('File exceeds the 5MB limit');
    }

    // Flat, server-generated key: never derived from client input, and
    // single-segment (no slashes) so the download route stays a plain
    // `:key` param regardless of the framework's wildcard-route syntax.
    const key = `${prefix}-${randomUUID()}.${ext}`;
    await this.storage.put(key, file.buffer);
    return key;
  }

  contentTypeFor(key: string): string {
    const ext = key.split('.').pop();
    const entry = Object.entries(ALLOWED_MIME_TYPES).find(([, e]) => e === ext);
    return entry?.[0] ?? 'application/octet-stream';
  }
}
