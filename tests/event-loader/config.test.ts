import { describe, it, expect, beforeEach } from 'vitest';
import { configure, getConfig, resetConfig } from '../../src/event-loader/config.js';

describe('config', () => {
  beforeEach(() => {
    resetConfig();
  });

  describe('configure()', () => {
    it('should accept a minimal config with only baseDir', () => {
      configure({ baseDir: '/tmp/test' });
      const config = getConfig();
      expect(config.baseDir).toBe('/tmp/test');
    });

    it('should set default contentSubPath when not provided', () => {
      configure({ baseDir: '/tmp/test' });
      const config = getConfig();
      expect(config.contentSubPath).toBe('src/content/events');
    });

    it('should set default wordsPerMinute when not provided', () => {
      configure({ baseDir: '/tmp/test' });
      const config = getConfig();
      expect(config.wordsPerMinute).toBe(225);
    });

    it('should accept custom contentSubPath', () => {
      configure({ baseDir: '/tmp/test', contentSubPath: 'content/events' });
      const config = getConfig();
      expect(config.contentSubPath).toBe('content/events');
    });

    it('should accept custom wordsPerMinute', () => {
      configure({ baseDir: '/tmp/test', wordsPerMinute: 200 });
      const config = getConfig();
      expect(config.wordsPerMinute).toBe(200);
    });

    it('should accept all custom options together', () => {
      configure({
        baseDir: '/my/project',
        contentSubPath: 'data/events',
        wordsPerMinute: 250,
      });
      const config = getConfig();
      expect(config.baseDir).toBe('/my/project');
      expect(config.contentSubPath).toBe('data/events');
      expect(config.wordsPerMinute).toBe(250);
    });

    it('should overwrite previous configuration', () => {
      configure({ baseDir: '/first' });
      configure({ baseDir: '/second' });
      const config = getConfig();
      expect(config.baseDir).toBe('/second');
    });

    it('should merge partial overrides with defaults on reconfigure', () => {
      configure({ baseDir: '/first', wordsPerMinute: 300 });
      configure({ baseDir: '/second' });
      const config = getConfig();
      expect(config.baseDir).toBe('/second');
      expect(config.wordsPerMinute).toBe(225); 
    });
  });

  describe('getConfig()', () => {
    it('should throw if configure() has not been called', () => {
      expect(() => getConfig()).toThrow(
        'tinyland-event-loader: configure() must be called before using loader functions.'
      );
    });

    it('should return the resolved config after configure()', () => {
      configure({ baseDir: '/tmp/test' });
      const config = getConfig();
      expect(config).toEqual({
        baseDir: '/tmp/test',
        contentSubPath: 'src/content/events',
        wordsPerMinute: 225,
      });
    });

    it('should return the same config on repeated calls', () => {
      configure({ baseDir: '/tmp/test' });
      const config1 = getConfig();
      const config2 = getConfig();
      expect(config1).toEqual(config2);
    });
  });

  describe('resetConfig()', () => {
    it('should reset config to unconfigured state', () => {
      configure({ baseDir: '/tmp/test' });
      resetConfig();
      expect(() => getConfig()).toThrow();
    });

    it('should allow reconfiguration after reset', () => {
      configure({ baseDir: '/first' });
      resetConfig();
      configure({ baseDir: '/second' });
      const config = getConfig();
      expect(config.baseDir).toBe('/second');
    });

    it('should not throw when called without prior configure()', () => {
      expect(() => resetConfig()).not.toThrow();
    });
  });
});
