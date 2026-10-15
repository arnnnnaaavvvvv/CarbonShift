import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ResilientHttpClient, redactTokens } from '../../../src/providers/http/client.js';
import { ProviderNetworkError, RateLimitExceededError, SSRFProtectionError } from '../../../src/core/errors.js';

describe('Resilient HTTP Client & Security Controls', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('deduplicates simultaneous in-flight requests for the same URL', async () => {
    const mockData = { name: 'chalk', version: '5.0.0' };
    let fetchCount = 0;

    globalThis.fetch = vi.fn().mockImplementation(async () => {
      fetchCount++;
      await new Promise(r => setTimeout(r, 20));
      return new Response(JSON.stringify(mockData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const client = new ResilientHttpClient({ concurrency: 4 });
    const [res1, res2] = await Promise.all([
      client.getJson<typeof mockData>('https://registry.npmjs.org/chalk'),
      client.getJson<typeof mockData>('https://registry.npmjs.org/chalk'),
    ]);

    expect(res1).toEqual(mockData);
    expect(res2).toEqual(mockData);
    expect(fetchCount).toBe(1);
  });

  it('blocks redirects to private IP addresses (Redirect-based SSRF defense)', async () => {
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url === 'https://registry.npmjs.org/redirect-me') {
        return new Response(null, {
          status: 302,
          headers: { location: 'https://169.254.169.254/latest/meta-data' },
        });
      }
      return new Response('{}', { status: 200 });
    });

    const client = new ResilientHttpClient({ maxRetries: 0 });
    await expect(client.getJson('https://registry.npmjs.org/redirect-me')).rejects.toThrow(
      SSRFProtectionError,
    );
  });

  it('blocks redirects to unencrypted http: URLs', async () => {
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url === 'https://registry.npmjs.org/insecure-redirect') {
        return new Response(null, {
          status: 301,
          headers: { location: 'http://registry.npmjs.org/insecure' },
        });
      }
      return new Response('{}', { status: 200 });
    });

    const client = new ResilientHttpClient({ maxRetries: 0 });
    await expect(client.getJson('https://registry.npmjs.org/insecure-redirect')).rejects.toThrow(
      SSRFProtectionError,
    );
  });

  it('throws RateLimitExceededError when HTTP 429 retry-after exceeds threshold', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response('Rate limit exceeded', {
        status: 429,
        headers: { 'retry-after': '60' },
      }),
    );

    const client = new ResilientHttpClient({ maxRetries: 0 });
    await expect(client.getJson('https://api.github.com/repos/facebook/react')).rejects.toThrow(
      RateLimitExceededError,
    );
  });

  it('redacts tokens and credentials in error messages', () => {
    const rawError = 'Failed request with token ghp_1234567890123456789012345 and npm_123456789012345678901234567890123456';
    const redacted = redactTokens(rawError);
    expect(redacted).not.toContain('ghp_1234567890');
    expect(redacted).not.toContain('npm_1234567890');
    expect(redacted).toContain('ghp_***REDACTED***');
    expect(redacted).toContain('npm_***REDACTED***');
  });

  it('enforces streaming response size limit even when content-length header is absent', async () => {
    // Generate a chunk larger than 10MB
    const largeChunk = new Uint8Array(11 * 1024 * 1024);
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(largeChunk);
        controller.close();
      },
    });

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'application/json' }, // No content-length header
      }),
    );

    const client = new ResilientHttpClient({ maxRetries: 0 });
    await expect(client.getJson('https://registry.npmjs.org/huge-pkg')).rejects.toThrow(
      ProviderNetworkError,
    );
  });
});
