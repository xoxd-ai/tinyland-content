import { describe, it, expect, beforeEach } from 'vitest';
import { configure, getConfig, resetConfig } from '../../src/profile-loader/config.js';

describe('ProfileLoaderConfig', () => {
  beforeEach(() => {
    resetConfig();
  });

  describe('getConfig', () => {
    it('should return default config with process.cwd() as baseDir', () => {
      const config = getConfig();
      expect(config.baseDir).toBe(process.cwd());
    });

    it('should return default contentSubPath as src/content/profiles', () => {
      const config = getConfig();
      expect(config.contentSubPath).toBe('src/content/profiles');
    });

    it('should return a copy, not the internal reference', () => {
      const config1 = getConfig();
      const config2 = getConfig();
      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });

    it('should not allow external mutation of returned config', () => {
      const config = getConfig();
      config.baseDir = '/mutated';
      expect(getConfig().baseDir).toBe(process.cwd());
    });
  });

  describe('configure', () => {
    it('should override baseDir when provided', () => {
      configure({ baseDir: '/custom/path' });
      expect(getConfig().baseDir).toBe('/custom/path');
    });

    it('should override contentSubPath when provided', () => {
      configure({ contentSubPath: 'data/profiles' });
      expect(getConfig().contentSubPath).toBe('data/profiles');
    });

    it('should merge partial config with existing config', () => {
      configure({ baseDir: '/custom/path' });
      const config = getConfig();
      expect(config.baseDir).toBe('/custom/path');
      expect(config.contentSubPath).toBe('src/content/profiles');
    });

    it('should allow overriding both baseDir and contentSubPath', () => {
      configure({ baseDir: '/app', contentSubPath: 'content/people' });
      const config = getConfig();
      expect(config.baseDir).toBe('/app');
      expect(config.contentSubPath).toBe('content/people');
    });

    it('should apply successive configure calls cumulatively', () => {
      configure({ baseDir: '/first' });
      configure({ contentSubPath: 'profiles' });
      const config = getConfig();
      expect(config.baseDir).toBe('/first');
      expect(config.contentSubPath).toBe('profiles');
    });

    it('should allow overriding a previously set value', () => {
      configure({ baseDir: '/first' });
      configure({ baseDir: '/second' });
      expect(getConfig().baseDir).toBe('/second');
    });
  });

  describe('resetConfig', () => {
    it('should restore baseDir to process.cwd()', () => {
      configure({ baseDir: '/custom' });
      resetConfig();
      expect(getConfig().baseDir).toBe(process.cwd());
    });

    it('should restore contentSubPath to default', () => {
      configure({ contentSubPath: 'custom/path' });
      resetConfig();
      expect(getConfig().contentSubPath).toBe('src/content/profiles');
    });

    it('should restore all values after multiple configure calls', () => {
      configure({ baseDir: '/a', contentSubPath: 'b' });
      resetConfig();
      const config = getConfig();
      expect(config.baseDir).toBe(process.cwd());
      expect(config.contentSubPath).toBe('src/content/profiles');
    });
  });
});
