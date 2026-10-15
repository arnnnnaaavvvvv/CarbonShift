import { describe, it, expect } from 'vitest';
import { validateSafeUrl } from '../../../src/providers/http/ssrf-guard.js';
import { SSRFProtectionError } from '../../../src/core/errors.js';

describe('SSRF Guard and URL Security Validator', () => {
  it('allows standard https package registries and APIs', () => {
    expect(() => validateSafeUrl('https://registry.npmjs.org/lodash')).not.toThrow();
    expect(() => validateSafeUrl('https://api.github.com/repos/facebook/react')).not.toThrow();
  });

  it('rejects unencrypted http: URLs', () => {
    expect(() => validateSafeUrl('http://registry.npmjs.org/lodash')).toThrow(SSRFProtectionError);
    try {
      validateSafeUrl('http://registry.npmjs.org/lodash');
    } catch (err) {
      expect((err as SSRFProtectionError).message).toContain('Insecure protocol');
      expect((err as SSRFProtectionError).exitCode).toBe(2);
    }
  });

  it('blocks private, loopback, and cloud metadata IP addresses', () => {
    expect(() => validateSafeUrl('https://127.0.0.1/malicious')).toThrow(SSRFProtectionError);
    expect(() => validateSafeUrl('https://localhost:8080/data')).toThrow(SSRFProtectionError);
    expect(() => validateSafeUrl('https://169.254.169.254/latest/meta-data')).toThrow(SSRFProtectionError);
    expect(() => validateSafeUrl('https://10.0.0.5/api')).toThrow(SSRFProtectionError);
    expect(() => validateSafeUrl('https://192.168.1.1/admin')).toThrow(SSRFProtectionError);
  });

  it('allows custom whitelisted private enterprise registries', () => {
    const customRegistries = ['https://npm.corp.mycompany.internal'];
    expect(() =>
      validateSafeUrl('https://npm.corp.mycompany.internal/my-pkg', customRegistries),
    ).not.toThrow();
  });
});
