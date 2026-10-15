import { describe, it, expect } from 'vitest';
import { parseGitHubRepoUrl, verifyRepoIdentity } from '../../../src/analysis/repo-verifier.js';

describe('Repository Verifier & Anti-Spoofing', () => {
  it('correctly parses various GitHub repository URL formats', () => {
    expect(parseGitHubRepoUrl('https://github.com/lodash/lodash')).toEqual({
      owner: 'lodash',
      repo: 'lodash',
    });

    expect(parseGitHubRepoUrl('git+https://github.com/expressjs/express.git')).toEqual({
      owner: 'expressjs',
      repo: 'express',
    });

    expect(parseGitHubRepoUrl('github:facebook/react')).toEqual({
      owner: 'facebook',
      repo: 'react',
    });

    expect(parseGitHubRepoUrl('git://github.com/sindresorhus/chalk.git#v5.0.0')).toEqual({
      owner: 'sindresorhus',
      repo: 'chalk',
    });

    expect(parseGitHubRepoUrl('https://gitlab.com/some/repo')).toBeNull();
    expect(parseGitHubRepoUrl(undefined)).toBeNull();
  });

  it('marks exact match as verified', () => {
    const result = verifyRepoIdentity('lodash', 'lodash', 'lodash', false);
    expect(result.associationStatus).toBe('verified');
  });

  it('marks cryptographically proven repo as verified', () => {
    const result = verifyRepoIdentity('my-custom-cli', 'company', 'developer-toolkit', true);
    expect(result.associationStatus).toBe('verified');
  });

  it('flags spoofed popular monorepo as divergent', () => {
    // Malicious or third party package claiming facebook/react without provenance
    const result = verifyRepoIdentity('react-malware-typosquat', 'facebook', 'react', false);
    expect(result.associationStatus).toBe('divergent');
    expect(result.unverifiedReason).toContain('claims monorepo');
  });

  it('marks ambiguous repo without provenance as unverified', () => {
    const result = verifyRepoIdentity('helper-utils', 'john', 'cool-stuff', false);
    expect(result.associationStatus).toBe('unverified');
    expect(result.unverifiedReason).toBeDefined();
  });
});
