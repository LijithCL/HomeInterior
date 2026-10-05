import { Injectable } from '@nestjs/common';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const DEFAULT_TTL_SECONDS = 60 * 60; // 1 hour — refreshed each time the API re-serializes an asset

// Local-disk object store: no S3/cloud spend (see docs/ARCHITECTURE.md §B).
// Shaped like an S3 client (put/get path + signed URL) so swapping in a
// real object store later only means a new provider behind this service.
@Injectable()
export class StorageService {
  private readonly root: string;
  private readonly signingSecret: string;

  constructor() {
    this.root = path.resolve(
      process.cwd(),
      process.env.STORAGE_ROOT ?? '../../storage',
    );
    this.signingSecret =
      process.env.UPLOAD_SIGNING_SECRET ??
      'dev-upload-signing-secret-change-me';
  }

  // Keys are always generated server-side (see UploadsService) — this never
  // resolves a client-supplied path, so there is no traversal risk to guard.
  private resolvePath(key: string): string {
    return path.join(this.root, key);
  }

  async put(key: string, data: Buffer): Promise<void> {
    const filePath = this.resolvePath(key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, data);
  }

  async read(key: string): Promise<Buffer> {
    return fs.readFile(this.resolvePath(key));
  }

  async delete(key: string): Promise<void> {
    await fs.rm(this.resolvePath(key), { force: true });
  }

  signKey(
    key: string,
    ttlSeconds = DEFAULT_TTL_SECONDS,
  ): { exp: number; sig: string } {
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    const sig = this.computeSignature(key, exp);
    return { exp, sig };
  }

  verify(key: string, exp: number, sig: string): boolean {
    if (Date.now() / 1000 > exp) return false;
    const expected = this.computeSignature(key, exp);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  // Absolute, not relative: this URL is embedded in <img src> on the
  // Next.js frontend (a different origin/port), so it must resolve against
  // the API's own origin rather than the page's. Plain <img> loads aren't
  // subject to CORS, so no extra cross-origin config is needed for this.
  getSignedUrl(key: string, ttlSeconds?: number): string {
    const { exp, sig } = this.signKey(key, ttlSeconds);
    const publicUrl = process.env.PUBLIC_API_URL ?? 'http://localhost:3001';
    return `${publicUrl}/uploads/${key}?exp=${exp}&sig=${sig}`;
  }

  private computeSignature(key: string, exp: number): string {
    return crypto
      .createHmac('sha256', this.signingSecret)
      .update(`${key}:${exp}`)
      .digest('hex');
  }
}
