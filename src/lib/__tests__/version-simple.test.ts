import { describe, it, expect } from 'vitest';
import version from '../version';

describe('Version Module', () => {
  it('should export a version string', () => {
    expect(typeof version).toBe('string');
    expect(version.length).toBeGreaterThan(0);
  });

  it('should have a valid version format', () => {
    // Basic version format validation (semantic versioning)
    const versionRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/;
    expect(version).toMatch(versionRegex);
  });

  it('should not be empty', () => {
    expect(version.trim()).not.toBe('');
  });

  it('should be a non-null value', () => {
    expect(version).not.toBeNull();
    expect(version).not.toBeUndefined();
  });
});
