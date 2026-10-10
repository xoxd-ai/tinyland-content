import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import * as content from '../src/index.js';
import * as eventLoader from '../src/event-loader/index.js';

// tummycrypt_tinyland_event_loader was merged into this module. The
// ./event-loader subpath keeps its exact API; the root facade keeps the
// aliased names it already re-exported from the standalone package.
describe('event loader merge', () => {
  let dir: string | undefined;

  afterEach(() => {
    eventLoader.resetConfig();
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  it('keeps the original API on the ./event-loader subpath', () => {
    expect(Object.keys(eventLoader).sort()).toEqual([
      'configure',
      'getConfig',
      'getEventBySlugServer',
      'getEventsByOrganizerServer',
      'getFeaturedEventsServer',
      'getPastEventsServer',
      'getRelatedEventsServer',
      'getUpcomingEventsServer',
      'loadEventsServer',
      'resetConfig',
    ]);
  });

  it('re-exports the same functions on the root facade', () => {
    expect(content.loadEventsServer).toBe(eventLoader.loadEventsServer);
    expect(content.getUpcomingEventsServer).toBe(eventLoader.getUpcomingEventsServer);
    expect(content.getPastEventsServer).toBe(eventLoader.getPastEventsServer);
    expect(content.getEventBySlugServer).toBe(eventLoader.getEventBySlugServer);
    expect(content.getFeaturedEventsServer).toBe(eventLoader.getFeaturedEventsServer);
    expect(content.getRelatedEventsServer).toBe(eventLoader.getRelatedEventsServer);
    expect(content.getEventsByOrganizerServer).toBe(eventLoader.getEventsByOrganizerServer);
    expect(content.configureEventLoader).toBe(eventLoader.configure);
    expect(content.getEventLoaderConfig).toBe(eventLoader.getConfig);
    expect(content.resetEventLoaderConfig).toBe(eventLoader.resetConfig);
  });

  it('shares one configuration between the facade and the subpath', () => {
    dir = mkdtempSync(join(tmpdir(), 'content-event-loader-'));
    mkdirSync(join(dir, 'events'));
    writeFileSync(
      join(dir, 'events', 'merged.md'),
      '---\ntitle: "Merged"\nstartDate: "2026-10-09"\n---\nBody text\n',
    );
    content.configureEventLoader({ baseDir: dir, contentSubPath: 'events' });
    expect(eventLoader.loadEventsServer().map((event) => event.slug)).toEqual(['merged']);
    eventLoader.resetConfig();
    expect(() => content.getEventLoaderConfig()).toThrow(/configure\(\) must be called/);
  });
});
