import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import { DiskCacheStore } from '../../../src/cache/disk-store.js';

describe('Disk Cache Store', () => {
  let tmpCacheDir: string;

  beforeEach(async () => {
    tmpCacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'deppulse-cache-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpCacheDir, { recursive: true, force: true });
  });

  it('stores and retrieves data within TTL', async () => {
    const store = new DiskCacheStore({ dir: tmpCacheDir, enabled: true });
    const payload = { name: 'express', version: '4.19.2' };

    await store.set('test:express', payload, 5000);
    const retrieved = await store.get<typeof payload>('test:express');
    expect(retrieved).toEqual(payload);
  });

  it('returns null for expired cache items', async () => {
    const store = new DiskCacheStore({ dir: tmpCacheDir, enabled: true });
    await store.set('test:expired', { hello: 'world' }, -100); // already expired

    const retrieved = await store.get('test:expired');
    expect(retrieved).toBeNull();
  });

  it('returns null and does not throw for corrupt cache files', async () => {
    const store = new DiskCacheStore({ dir: tmpCacheDir, enabled: true });
    await store.set('test:corrupt', { valid: true }, 5000);

    // Corrupt the file
    const files = await fs.readdir(tmpCacheDir);
    expect(files.length).toBeGreaterThan(0);
    await fs.writeFile(path.join(tmpCacheDir, files[0]!), 'CORRUPT_JSON{{{');

    const retrieved = await store.get('test:corrupt');
    expect(retrieved).toBeNull();
  });

  it('acts as a no-op when disabled (--no-cache)', async () => {
    const store = new DiskCacheStore({ dir: tmpCacheDir, enabled: false });
    await store.set('test:disabled', { data: 123 }, 5000);

    const retrieved = await store.get('test:disabled');
    expect(retrieved).toBeNull();
  });
});
