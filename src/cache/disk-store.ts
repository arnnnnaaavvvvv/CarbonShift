import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { CacheStore } from '../providers/types.js';

interface CacheEnvelope<T> {
  data: T;
  expiresAt: number;
}

export class DiskCacheStore implements CacheStore {
  private readonly cacheDir: string;
  private readonly enabled: boolean;
  private initPromise: Promise<void> | null = null;

  constructor(options: { dir?: string | undefined; enabled?: boolean | undefined } = {}) {
    this.enabled = options.enabled ?? true;
    this.cacheDir = options.dir ?? path.resolve(process.cwd(), '.deppulse', 'cache');
  }

  private async ensureDir(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = fs.mkdir(this.cacheDir, { recursive: true }).then(() => undefined);
    }
    return this.initPromise;
  }

  private getFilePath(key: string): string {
    const hash = crypto.createHash('sha256').update(key).digest('hex');
    return path.join(this.cacheDir, `${hash}.json`);
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.enabled) return null;

    const filePath = this.getFilePath(key);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const envelope = JSON.parse(content) as CacheEnvelope<T>;

      if (Date.now() > envelope.expiresAt) {
        // Expired - clean up asynchronously
        fs.unlink(filePath).catch(() => {});
        return null;
      }

      return envelope.data;
    } catch {
      // File doesn't exist or corrupt JSON - treat as miss
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    if (!this.enabled || ttlMs <= 0) return;

    await this.ensureDir();
    const filePath = this.getFilePath(key);
    const tempPath = `${filePath}.tmp.${process.pid}.${Math.random().toString(36).slice(2, 8)}`;

    const envelope: CacheEnvelope<T> = {
      data: value,
      expiresAt: Date.now() + ttlMs,
    };

    try {
      await fs.writeFile(tempPath, JSON.stringify(envelope), 'utf-8');
      await fs.rename(tempPath, filePath);
    } catch {
      // If rename fails or write fails, clean temp file
      fs.unlink(tempPath).catch(() => {});
    }
  }

  async clear(): Promise<void> {
    try {
      await fs.rm(this.cacheDir, { recursive: true, force: true });
      this.initPromise = null;
    } catch {
      // ignore
    }
  }
}
