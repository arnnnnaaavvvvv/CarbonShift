import {
  ProviderNetworkError,
  RateLimitExceededError,
  SSRFProtectionError,
} from '../../core/errors.js';
import { sanitizeUrl, validateSafeUrl } from './ssrf-guard.js';

export interface HttpClientOptions {
  concurrency?: number | undefined;
  timeoutMs?: number | undefined;
  maxRetries?: number | undefined;
  allowedRegistries?: readonly string[] | undefined;
}

const MAX_RESPONSE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_REDIRECTS = 3;

/**
 * Redacts known sensitive patterns (GitHub tokens, npm tokens, Bearer strings) from any text.
 */
export function redactTokens(input: string): string {
  return input
    .replace(/(ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{20,}/g, '$1_***REDACTED***')
    .replace(/github_pat_[a-zA-Z0-9_]{30,}/g, 'github_pat_***REDACTED***')
    .replace(/npm_[a-zA-Z0-9]{36}/g, 'npm_***REDACTED***')
    .replace(/Bearer\s+[a-zA-Z0-9._~+/-]+=*/gi, 'Bearer ***REDACTED***');
}

export class ResilientHttpClient {
  private readonly concurrency: number;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly allowedRegistries: readonly string[];

  private activeRequests = 0;
  private readonly queue: Array<() => void> = [];
  private readonly inFlight = new Map<string, Promise<unknown>>();

  constructor(options: HttpClientOptions = {}) {
    this.concurrency = options.concurrency ?? 8;
    this.timeoutMs = options.timeoutMs ?? 8000;
    this.maxRetries = options.maxRetries ?? 3;
    this.allowedRegistries = options.allowedRegistries ?? ['https://registry.npmjs.org'];
  }

  private async acquireSlot(): Promise<void> {
    if (this.activeRequests < this.concurrency) {
      this.activeRequests++;
      return;
    }
    return new Promise<void>(resolve => {
      this.queue.push(() => {
        this.activeRequests++;
        resolve();
      });
    });
  }

  private releaseSlot(): void {
    this.activeRequests--;
    const next = this.queue.shift();
    if (next) {
      next();
    }
  }

  async getJson<T>(
    url: string,
    options: {
      headers?: Record<string, string> | undefined;
      signal?: AbortSignal | undefined;
      timeoutMs?: number | undefined;
    } = {},
  ): Promise<T> {
    // 1. Initial URL validation with SSRF Guard
    validateSafeUrl(url, this.allowedRegistries);

    // 2. In-flight Request Deduplication
    const dedupKey = `GET:${url}`;
    const existing = this.inFlight.get(dedupKey);
    if (existing) {
      return existing as Promise<T>;
    }

    const promise = this.executeWithRetry<T>(url, options).finally(() => {
      this.inFlight.delete(dedupKey);
    });

    this.inFlight.set(dedupKey, promise);
    return promise;
  }

  private async executeWithRetry<T>(
    initialUrl: string,
    options: {
      headers?: Record<string, string> | undefined;
      signal?: AbortSignal | undefined;
      timeoutMs?: number | undefined;
    },
  ): Promise<T> {
    const timeoutMs = options.timeoutMs ?? this.timeoutMs;
    let attempt = 0;

    while (attempt <= this.maxRetries) {
      await this.acquireSlot();

      const controller = new AbortController();
      let timeoutId: NodeJS.Timeout | null = null;

      if (options.signal) {
        options.signal.addEventListener('abort', () => controller.abort(options.signal?.reason), {
          once: true,
        });
      }

      timeoutId = setTimeout(() => {
        controller.abort(new Error(`Request timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      try {
        let currentUrl = initialUrl;
        let redirectCount = 0;
        let response: Response | null = null;

        // Manual redirect following loop to prevent redirect-based SSRF
        while (redirectCount <= MAX_REDIRECTS) {
          response = await fetch(currentUrl, {
            method: 'GET',
            headers: {
              Accept: 'application/json',
              'User-Agent': 'deppulse/0.1.0 (Dependency Health & Upgrade Intelligence)',
              ...options.headers,
            },
            redirect: 'manual',
            signal: controller.signal,
          });

          // Check if redirect
          if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get('location');
            if (!location) {
              throw new ProviderNetworkError(
                `Redirect status ${response.status} missing Location header from ${sanitizeUrl(currentUrl)}`,
              );
            }

            // Resolve target URL relative to currentUrl
            const resolvedTarget = new URL(location, currentUrl).href;

            // Re-validate target URL with SSRF Guard
            validateSafeUrl(resolvedTarget, this.allowedRegistries);

            currentUrl = resolvedTarget;
            redirectCount++;
            continue;
          }

          break;
        }

        if (redirectCount > MAX_REDIRECTS || !response) {
          throw new ProviderNetworkError(
            `Exceeded maximum redirect limit (${MAX_REDIRECTS}) for ${sanitizeUrl(initialUrl)}`,
          );
        }

        if (timeoutId) clearTimeout(timeoutId);

        // Handle 429 Rate Limiting
        if (response.status === 429) {
          const retryAfterHeader = response.headers.get('retry-after');
          const resetHeader = response.headers.get('x-ratelimit-reset');
          let waitSeconds = 5;

          if (retryAfterHeader) {
            const parsed = Number(retryAfterHeader);
            if (!Number.isNaN(parsed)) waitSeconds = parsed;
          } else if (resetHeader) {
            const resetTime = Number(resetHeader) * 1000;
            const diff = Math.max(1, Math.ceil((resetTime - Date.now()) / 1000));
            waitSeconds = Math.min(diff, 60);
          }

          if (attempt < this.maxRetries && waitSeconds <= 10) {
            await new Promise(r => setTimeout(r, waitSeconds * 1000));
            attempt++;
            continue;
          }

          throw new RateLimitExceededError(
            `Rate limit exceeded (HTTP 429) for ${sanitizeUrl(currentUrl)}. Retry after ${waitSeconds}s`,
            'Configure an authentication token or reduce scan concurrency in deppulse.config.json',
            { url: sanitizeUrl(currentUrl), waitSeconds },
          );
        }

        // Handle 404 (Not Found)
        if (response.status === 404) {
          throw new ProviderNetworkError(
            `Resource not found (HTTP 404): ${sanitizeUrl(currentUrl)}`,
            'Verify that the package or repository exists and is publicly accessible.',
            { status: 404, url: sanitizeUrl(currentUrl) },
          );
        }

        // Handle Server Errors (5xx) with backoff retry
        if (response.status >= 500) {
          if (attempt < this.maxRetries) {
            attempt++;
            const backoff = Math.min(4000, 500 * Math.pow(2, attempt)) * (0.5 + Math.random() * 0.5);
            await new Promise(r => setTimeout(r, backoff));
            continue;
          }
          throw new ProviderNetworkError(
            `Upstream server error HTTP ${response.status} from ${sanitizeUrl(currentUrl)}`,
            'The upstream registry or API is currently experiencing downtime. Try again later.',
            { status: response.status, url: sanitizeUrl(currentUrl) },
          );
        }

        if (!response.ok) {
          throw new ProviderNetworkError(
            `HTTP request failed with status ${response.status} for ${sanitizeUrl(currentUrl)}`,
            'Check network connectivity and endpoint access.',
            { status: response.status, url: sanitizeUrl(currentUrl) },
          );
        }

        // Bounded response size check (handles both content-length and streaming chunks)
        const contentLength = response.headers.get('content-length');
        if (contentLength && Number(contentLength) > MAX_RESPONSE_BYTES) {
          throw new ProviderNetworkError(
            `Response size ${contentLength} bytes exceeds safety limit of ${MAX_RESPONSE_BYTES} bytes.`,
            'The packument or repository payload is excessively large.',
            { url: sanitizeUrl(currentUrl), size: contentLength },
          );
        }

        // Read and bound response stream
        if (response.body) {
          const reader = response.body.getReader();
          const chunks: Uint8Array[] = [];
          let totalBytes = 0;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              totalBytes += value.byteLength;
              if (totalBytes > MAX_RESPONSE_BYTES) {
                await reader.cancel();
                throw new ProviderNetworkError(
                  `Response exceeded maximum allowed size of ${MAX_RESPONSE_BYTES} bytes.`,
                  'Payload rejected due to size limit safety policy.',
                  { url: sanitizeUrl(currentUrl), bytesReceived: totalBytes },
                );
              }
              chunks.push(value);
            }
          }

          // Concatenate Uint8Array chunks and parse JSON safely
          const allBytes = new Uint8Array(totalBytes);
          let offset = 0;
          for (const c of chunks) {
            allBytes.set(c, offset);
            offset += c.byteLength;
          }

          const text = new TextDecoder('utf-8').decode(allBytes);
          try {
            return JSON.parse(text) as T;
          } catch (parseErr) {
            throw new ProviderNetworkError(
              `Malformed JSON response from ${sanitizeUrl(currentUrl)}: ${(parseErr as Error).message}`,
              'The upstream server returned non-JSON or corrupted content.',
              { url: sanitizeUrl(currentUrl) },
              { cause: parseErr },
            );
          }
        }

        // Fallback if response.body is null
        const data = (await response.json()) as T;
        return data;
      } catch (err) {
        if (timeoutId) clearTimeout(timeoutId);

        if (
          err instanceof RateLimitExceededError ||
          err instanceof SSRFProtectionError ||
          err instanceof ProviderNetworkError
        ) {
          throw err;
        }

        // Network error (fetch failure / abort)
        if (attempt < this.maxRetries) {
          attempt++;
          const backoff = Math.min(4000, 500 * Math.pow(2, attempt)) * (0.5 + Math.random() * 0.5);
          await new Promise(r => setTimeout(r, backoff));
          continue;
        }

        const safeMsg = redactTokens((err as Error).message);
        throw new ProviderNetworkError(
          `Network request to ${sanitizeUrl(initialUrl)} failed: ${safeMsg}`,
          'Check internet connection and proxy/firewall settings.',
          { url: sanitizeUrl(initialUrl), error: safeMsg },
          { cause: err },
        );
      } finally {
        this.releaseSlot();
      }
    }

    throw new ProviderNetworkError(`Failed to fetch ${sanitizeUrl(initialUrl)} after ${this.maxRetries} retries.`);
  }
}
