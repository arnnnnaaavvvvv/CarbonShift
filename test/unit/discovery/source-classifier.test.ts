import { describe, it, expect } from 'vitest';
import { classifyDependencySource } from '../../../src/discovery/source-classifier.js';

describe('Dependency Source Classifier', () => {
  it('identifies standard npm ranges and versions', () => {
    expect(classifyDependencySource('^1.2.3')).toBe('npm');
    expect(classifyDependencySource('~0.14.0')).toBe('npm');
    expect(classifyDependencySource('>=2.0.0')).toBe('npm');
    expect(classifyDependencySource('1.0.0')).toBe('npm');
    expect(classifyDependencySource('*')).toBe('npm');
    expect(classifyDependencySource('latest')).toBe('npm');
    expect(classifyDependencySource('next')).toBe('npm');
  });

  it('identifies workspace specifiers and local packages', () => {
    expect(classifyDependencySource('workspace:*')).toBe('workspace');
    expect(classifyDependencySource('workspace:^2.0.0')).toBe('workspace');
    expect(classifyDependencySource('my-internal-lib', new Set(['my-internal-lib']))).toBe('workspace');
  });

  it('identifies git and repo URLs', () => {
    expect(classifyDependencySource('git+https://github.com/foo/bar.git')).toBe('git');
    expect(classifyDependencySource('git://github.com/foo/bar.git#v1.0.0')).toBe('git');
    expect(classifyDependencySource('github:foo/bar')).toBe('git');
    expect(classifyDependencySource('https://github.com/foo/bar/tarball/master')).toBe('git');
  });

  it('identifies file and link specifiers', () => {
    expect(classifyDependencySource('file:../local-pkg')).toBe('file');
    expect(classifyDependencySource('link:./packages/core')).toBe('file');
  });

  it('identifies npm package aliases', () => {
    expect(classifyDependencySource('npm:my-fork@^1.0.0')).toBe('alias');
  });

  it('classifies unsupported/unrecognized specifiers as unknown', () => {
    expect(classifyDependencySource('arbitrary-custom-protocol://test')).toBe('unknown');
  });
});
