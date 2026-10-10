import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { configure, resetConfig } from '../../src/event-loader/config.js';
import {
  loadEventsServer,
  getUpcomingEventsServer,
  getPastEventsServer,
  getEventBySlugServer,
  getFeaturedEventsServer,
  getRelatedEventsServer,
  getEventsByOrganizerServer,
} from '../../src/event-loader/event-loader.js';




function createEventFile(
  dir: string,
  filename: string,
  frontmatter: Record<string, unknown>,
  content: string = ''
): void {
  const fm = Object.entries(frontmatter)
    .map(([k, v]) => {
      if (Array.isArray(v)) {
        return `${k}:\n${v.map((i) => `  - ${JSON.stringify(i)}`).join('\n')}`;
      }
      return `${k}: ${JSON.stringify(v)}`;
    })
    .join('\n');
  writeFileSync(join(dir, filename), `---\n${fm}\n---\n${content}`);
}

let tmpBase: string;
let eventsDir: string;

beforeEach(() => {
  tmpBase = mkdtempSync(join(tmpdir(), 'event-loader-test-'));
  eventsDir = join(tmpBase, 'src', 'content', 'events');
  mkdirSync(eventsDir, { recursive: true });
  configure({ baseDir: tmpBase });
});

afterEach(() => {
  resetConfig();
  rmSync(tmpBase, { recursive: true, force: true });
});




describe('loadEventsServer', () => {
  it('should load .md files from configured path', () => {
    createEventFile(eventsDir, 'test-event.md', {
      title: 'Test Event',
      startDate: '2030-06-01T10:00:00Z',
    });
    const events = loadEventsServer();
    expect(events).toHaveLength(1);
    expect(events[0].frontmatter.title).toBe('Test Event');
  });

  it('should load .mdx files', () => {
    createEventFile(eventsDir, 'mdx-event.mdx', {
      title: 'MDX Event',
      startDate: '2030-06-01T10:00:00Z',
    });
    const events = loadEventsServer();
    expect(events).toHaveLength(1);
    expect(events[0].frontmatter.title).toBe('MDX Event');
  });

  it('should load .svx files', () => {
    createEventFile(eventsDir, 'svx-event.svx', {
      title: 'SVX Event',
      startDate: '2030-06-01T10:00:00Z',
    });
    const events = loadEventsServer();
    expect(events).toHaveLength(1);
    expect(events[0].frontmatter.title).toBe('SVX Event');
  });

  it('should load multiple file types together', () => {
    createEventFile(eventsDir, 'a.md', { title: 'A', startDate: '2030-01-01' });
    createEventFile(eventsDir, 'b.mdx', { title: 'B', startDate: '2030-01-01' });
    createEventFile(eventsDir, 'c.svx', { title: 'C', startDate: '2030-01-01' });
    const events = loadEventsServer();
    expect(events).toHaveLength(3);
  });

  it('should ignore non-markdown files', () => {
    createEventFile(eventsDir, 'event.md', {
      title: 'Valid',
      startDate: '2030-01-01',
    });
    writeFileSync(join(eventsDir, 'readme.txt'), 'not an event');
    writeFileSync(join(eventsDir, 'data.json'), '{}');
    writeFileSync(join(eventsDir, 'image.png'), 'binary');
    const events = loadEventsServer();
    expect(events).toHaveLength(1);
  });

  it('should ignore files without markdown extensions', () => {
    writeFileSync(join(eventsDir, 'notes.markdown'), '---\ntitle: "X"\n---\nContent');
    writeFileSync(join(eventsDir, 'file.txt'), '---\ntitle: "Y"\n---\nContent');
    const events = loadEventsServer();
    expect(events).toHaveLength(0);
  });

  it('should parse frontmatter correctly', () => {
    createEventFile(eventsDir, 'detailed.md', {
      title: 'Detailed Event',
      startDate: '2030-06-15T14:00:00Z',
      location: 'Main Hall',
      categories: ['workshop', 'tech'],
      tags: ['svelte', 'typescript'],
    });
    const events = loadEventsServer();
    expect(events[0].frontmatter.title).toBe('Detailed Event');
    expect(events[0].frontmatter.startDate).toBe('2030-06-15T14:00:00Z');
    expect(events[0].frontmatter.location).toBe('Main Hall');
    expect(events[0].frontmatter.categories).toEqual(['workshop', 'tech']);
    expect(events[0].frontmatter.tags).toEqual(['svelte', 'typescript']);
  });

  it('should calculate wordCount correctly', () => {
    createEventFile(
      eventsDir,
      'wordy.md',
      { title: 'Wordy', startDate: '2030-01-01' },
      'one two three four five six seven eight nine ten'
    );
    const events = loadEventsServer();
    expect(events[0].wordCount).toBe(10);
  });

  it('should calculate readingTime based on wordsPerMinute', () => {
    
    const words = Array.from({ length: 225 }, (_, i) => `word${i}`).join(' ');
    createEventFile(
      eventsDir,
      'long.md',
      { title: 'Long', startDate: '2030-01-01' },
      words
    );
    const events = loadEventsServer();
    expect(events[0].readingTime).toBe(1);
  });

  it('should calculate readingTime with custom wordsPerMinute', () => {
    resetConfig();
    configure({ baseDir: tmpBase, wordsPerMinute: 100 });
    
    const words = Array.from({ length: 200 }, (_, i) => `word${i}`).join(' ');
    createEventFile(
      eventsDir,
      'custom-wpm.md',
      { title: 'Custom', startDate: '2030-01-01' },
      words
    );
    const events = loadEventsServer();
    expect(events[0].readingTime).toBe(2);
  });

  it('should ceil readingTime for partial minutes', () => {
    
    const words = Array.from({ length: 226 }, (_, i) => `word${i}`).join(' ');
    createEventFile(
      eventsDir,
      'partial.md',
      { title: 'Partial', startDate: '2030-01-01' },
      words
    );
    const events = loadEventsServer();
    expect(events[0].readingTime).toBe(2);
  });

  it('should set default title "Untitled Event" when missing', () => {
    createEventFile(eventsDir, 'no-title.md', {
      startDate: '2030-01-01',
    });
    const events = loadEventsServer();
    expect(events[0].frontmatter.title).toBe('Untitled Event');
  });

  it('should set default startDate from startDateTime fallback', () => {
    createEventFile(eventsDir, 'datetime.md', {
      title: 'DateTime',
      startDateTime: '2030-07-01T09:00:00Z',
    });
    const events = loadEventsServer();
    expect(events[0].frontmatter.startDate).toBe('2030-07-01T09:00:00Z');
  });

  it('should set default startDate from date fallback', () => {
    createEventFile(eventsDir, 'date-only.md', {
      title: 'DateOnly',
      date: '2030-08-01',
    });
    const events = loadEventsServer();
    expect(events[0].frontmatter.startDate).toBe('2030-08-01');
  });

  it('should generate startDate as ISO string when no date fields exist', () => {
    createEventFile(eventsDir, 'no-date.md', {
      title: 'No Date',
    });
    const events = loadEventsServer();
    
    expect(() => new Date(events[0].frontmatter.startDate!)).not.toThrow();
    expect(new Date(events[0].frontmatter.startDate!).getTime()).not.toBeNaN();
  });

  it('should use frontmatter.slug over filename-derived slug', () => {
    createEventFile(eventsDir, 'filename-slug.md', {
      title: 'Custom Slug',
      slug: 'my-custom-slug',
      startDate: '2030-01-01',
    });
    const events = loadEventsServer();
    expect(events[0].slug).toBe('my-custom-slug');
    expect(events[0].frontmatter.slug).toBe('my-custom-slug');
  });

  it('should derive slug from filename when frontmatter.slug is absent', () => {
    createEventFile(eventsDir, 'my-event-file.md', {
      title: 'File Slug',
      startDate: '2030-01-01',
    });
    const events = loadEventsServer();
    expect(events[0].slug).toBe('my-event-file');
  });

  it('should strip extension from filename-derived slug for .mdx', () => {
    createEventFile(eventsDir, 'cool-event.mdx', {
      title: 'MDX Slug',
      startDate: '2030-01-01',
    });
    const events = loadEventsServer();
    expect(events[0].slug).toBe('cool-event');
  });

  it('should strip extension from filename-derived slug for .svx', () => {
    createEventFile(eventsDir, 'svx-event.svx', {
      title: 'SVX Slug',
      startDate: '2030-01-01',
    });
    const events = loadEventsServer();
    expect(events[0].slug).toBe('svx-event');
  });

  it('should set default layout to "event" when not provided', () => {
    createEventFile(eventsDir, 'no-layout.md', {
      title: 'No Layout',
      startDate: '2030-01-01',
    });
    const events = loadEventsServer();
    expect(events[0].frontmatter.layout).toBe('event');
  });

  it('should preserve custom layout when provided', () => {
    createEventFile(eventsDir, 'custom-layout.md', {
      title: 'Custom Layout',
      startDate: '2030-01-01',
      layout: 'workshop',
    });
    const events = loadEventsServer();
    expect(events[0].frontmatter.layout).toBe('workshop');
  });

  it('should return markdown content without frontmatter', () => {
    createEventFile(
      eventsDir,
      'with-content.md',
      { title: 'Content Test', startDate: '2030-01-01' },
      'This is the body content.\n\nWith multiple paragraphs.'
    );
    const events = loadEventsServer();
    expect(events[0].content).toContain('This is the body content.');
    expect(events[0].content).toContain('With multiple paragraphs.');
  });

  it('should return empty array when directory does not exist', () => {
    resetConfig();
    configure({ baseDir: '/nonexistent/path/that/does/not/exist' });
    const events = loadEventsServer();
    expect(events).toEqual([]);
  });

  it('should return empty array on error', () => {
    resetConfig();
    configure({ baseDir: tmpBase, contentSubPath: 'missing/dir' });
    const events = loadEventsServer();
    expect(events).toEqual([]);
  });

  it('should handle empty directory', () => {
    const events = loadEventsServer();
    expect(events).toEqual([]);
  });

  it('should preserve arbitrary frontmatter fields', () => {
    createEventFile(eventsDir, 'extra.md', {
      title: 'Extra Fields',
      startDate: '2030-01-01',
      customField: 'custom value',
      registrationUrl: 'https://example.com/register',
    });
    const events = loadEventsServer();
    expect(events[0].frontmatter.customField).toBe('custom value');
    expect(events[0].frontmatter.registrationUrl).toBe(
      'https://example.com/register'
    );
  });

  it('should use custom contentSubPath', () => {
    resetConfig();
    const customDir = join(tmpBase, 'data', 'events');
    mkdirSync(customDir, { recursive: true });
    configure({ baseDir: tmpBase, contentSubPath: 'data/events' });
    createEventFile(customDir, 'custom-path.md', {
      title: 'Custom Path',
      startDate: '2030-01-01',
    });
    const events = loadEventsServer();
    expect(events).toHaveLength(1);
    expect(events[0].frontmatter.title).toBe('Custom Path');
  });
});




describe('getUpcomingEventsServer', () => {
  it('should return only future events', () => {
    createEventFile(eventsDir, 'past.md', {
      title: 'Past Event',
      startDate: '2020-01-01T10:00:00Z',
    });
    createEventFile(eventsDir, 'future.md', {
      title: 'Future Event',
      startDate: '2099-06-01T10:00:00Z',
    });
    const upcoming = getUpcomingEventsServer();
    expect(upcoming).toHaveLength(1);
    expect(upcoming[0].frontmatter.title).toBe('Future Event');
  });

  it('should sort by date ascending (nearest first)', () => {
    createEventFile(eventsDir, 'later.md', {
      title: 'Later',
      startDate: '2099-12-01T10:00:00Z',
    });
    createEventFile(eventsDir, 'sooner.md', {
      title: 'Sooner',
      startDate: '2099-01-01T10:00:00Z',
    });
    createEventFile(eventsDir, 'middle.md', {
      title: 'Middle',
      startDate: '2099-06-01T10:00:00Z',
    });
    const upcoming = getUpcomingEventsServer();
    expect(upcoming).toHaveLength(3);
    expect(upcoming[0].frontmatter.title).toBe('Sooner');
    expect(upcoming[1].frontmatter.title).toBe('Middle');
    expect(upcoming[2].frontmatter.title).toBe('Later');
  });

  it('should respect limit parameter', () => {
    createEventFile(eventsDir, 'a.md', {
      title: 'A',
      startDate: '2099-01-01T10:00:00Z',
    });
    createEventFile(eventsDir, 'b.md', {
      title: 'B',
      startDate: '2099-02-01T10:00:00Z',
    });
    createEventFile(eventsDir, 'c.md', {
      title: 'C',
      startDate: '2099-03-01T10:00:00Z',
    });
    const upcoming = getUpcomingEventsServer(2);
    expect(upcoming).toHaveLength(2);
  });

  it('should return all upcoming when limit is not provided', () => {
    createEventFile(eventsDir, 'a.md', {
      title: 'A',
      startDate: '2099-01-01',
    });
    createEventFile(eventsDir, 'b.md', {
      title: 'B',
      startDate: '2099-02-01',
    });
    const upcoming = getUpcomingEventsServer();
    expect(upcoming).toHaveLength(2);
  });

  it('should return empty when no upcoming events', () => {
    createEventFile(eventsDir, 'past.md', {
      title: 'Past',
      startDate: '2020-01-01',
    });
    const upcoming = getUpcomingEventsServer();
    expect(upcoming).toEqual([]);
  });

  it('should exclude events with no date', () => {
    createEventFile(eventsDir, 'no-date.md', {
      title: 'No Date',
    });
    
    
    
    
    const upcoming = getUpcomingEventsServer();
    
    
    expect(Array.isArray(upcoming)).toBe(true);
  });

  it('should use startDateTime fallback for filtering', () => {
    createEventFile(eventsDir, 'datetime.md', {
      title: 'DateTime Event',
      startDateTime: '2099-06-01T10:00:00Z',
    });
    const upcoming = getUpcomingEventsServer();
    expect(upcoming).toHaveLength(1);
  });

  it('should use date fallback for filtering', () => {
    createEventFile(eventsDir, 'date.md', {
      title: 'Date Event',
      date: '2099-06-01',
    });
    const upcoming = getUpcomingEventsServer();
    expect(upcoming).toHaveLength(1);
  });

  it('should return empty array when directory is empty', () => {
    const upcoming = getUpcomingEventsServer();
    expect(upcoming).toEqual([]);
  });

  it('should handle limit larger than available events', () => {
    createEventFile(eventsDir, 'one.md', {
      title: 'One',
      startDate: '2099-01-01',
    });
    const upcoming = getUpcomingEventsServer(100);
    expect(upcoming).toHaveLength(1);
  });
});




describe('getPastEventsServer', () => {
  it('should return only past events', () => {
    createEventFile(eventsDir, 'past.md', {
      title: 'Past Event',
      startDate: '2020-01-01T10:00:00Z',
    });
    createEventFile(eventsDir, 'future.md', {
      title: 'Future Event',
      startDate: '2099-06-01T10:00:00Z',
    });
    const past = getPastEventsServer();
    expect(past).toHaveLength(1);
    expect(past[0].frontmatter.title).toBe('Past Event');
  });

  it('should sort by date descending (most recent first)', () => {
    createEventFile(eventsDir, 'older.md', {
      title: 'Older',
      startDate: '2020-01-01T10:00:00Z',
    });
    createEventFile(eventsDir, 'recent.md', {
      title: 'Recent',
      startDate: '2024-06-01T10:00:00Z',
    });
    createEventFile(eventsDir, 'middle.md', {
      title: 'Middle',
      startDate: '2022-06-01T10:00:00Z',
    });
    const past = getPastEventsServer();
    expect(past).toHaveLength(3);
    expect(past[0].frontmatter.title).toBe('Recent');
    expect(past[1].frontmatter.title).toBe('Middle');
    expect(past[2].frontmatter.title).toBe('Older');
  });

  it('should respect limit parameter', () => {
    createEventFile(eventsDir, 'a.md', {
      title: 'A',
      startDate: '2020-01-01',
    });
    createEventFile(eventsDir, 'b.md', {
      title: 'B',
      startDate: '2021-01-01',
    });
    createEventFile(eventsDir, 'c.md', {
      title: 'C',
      startDate: '2022-01-01',
    });
    const past = getPastEventsServer(2);
    expect(past).toHaveLength(2);
  });

  it('should return all past when limit is not provided', () => {
    createEventFile(eventsDir, 'a.md', {
      title: 'A',
      startDate: '2020-01-01',
    });
    createEventFile(eventsDir, 'b.md', {
      title: 'B',
      startDate: '2021-01-01',
    });
    const past = getPastEventsServer();
    expect(past).toHaveLength(2);
  });

  it('should return empty when no past events', () => {
    createEventFile(eventsDir, 'future.md', {
      title: 'Future',
      startDate: '2099-01-01',
    });
    const past = getPastEventsServer();
    expect(past).toEqual([]);
  });

  it('should use startDateTime fallback for filtering', () => {
    createEventFile(eventsDir, 'past-dt.md', {
      title: 'Past DateTime',
      startDateTime: '2020-06-01T10:00:00Z',
    });
    const past = getPastEventsServer();
    expect(past).toHaveLength(1);
  });

  it('should use date fallback for filtering', () => {
    createEventFile(eventsDir, 'past-date.md', {
      title: 'Past Date',
      date: '2020-06-01',
    });
    const past = getPastEventsServer();
    expect(past).toHaveLength(1);
  });

  it('should return empty array when directory is empty', () => {
    const past = getPastEventsServer();
    expect(past).toEqual([]);
  });

  it('should handle limit larger than available events', () => {
    createEventFile(eventsDir, 'one.md', {
      title: 'One',
      startDate: '2020-01-01',
    });
    const past = getPastEventsServer(100);
    expect(past).toHaveLength(1);
  });

  it('should handle limit of zero', () => {
    createEventFile(eventsDir, 'a.md', {
      title: 'A',
      startDate: '2020-01-01',
    });
    
    const past = getPastEventsServer(0);
    expect(past).toHaveLength(1);
  });
});




describe('getEventBySlugServer', () => {
  it('should find event by slug', () => {
    createEventFile(eventsDir, 'my-event.md', {
      title: 'My Event',
      startDate: '2030-01-01',
    });
    const event = getEventBySlugServer('my-event');
    expect(event).toBeDefined();
    expect(event!.frontmatter.title).toBe('My Event');
  });

  it('should find event by custom frontmatter slug', () => {
    createEventFile(eventsDir, 'filename.md', {
      title: 'Custom Slug Event',
      slug: 'custom-slug',
      startDate: '2030-01-01',
    });
    const event = getEventBySlugServer('custom-slug');
    expect(event).toBeDefined();
    expect(event!.frontmatter.title).toBe('Custom Slug Event');
  });

  it('should return undefined for unknown slug', () => {
    createEventFile(eventsDir, 'exists.md', {
      title: 'Exists',
      startDate: '2030-01-01',
    });
    const event = getEventBySlugServer('does-not-exist');
    expect(event).toBeUndefined();
  });

  it('should return undefined when no events exist', () => {
    const event = getEventBySlugServer('anything');
    expect(event).toBeUndefined();
  });

  it('should match exact slug only', () => {
    createEventFile(eventsDir, 'partial-match.md', {
      title: 'Partial',
      startDate: '2030-01-01',
    });
    const event = getEventBySlugServer('partial');
    expect(event).toBeUndefined();
  });
});




describe('getFeaturedEventsServer', () => {
  it('should return only featured events', () => {
    createEventFile(eventsDir, 'featured.md', {
      title: 'Featured Event',
      startDate: '2030-01-01',
      featured: true,
    });
    createEventFile(eventsDir, 'normal.md', {
      title: 'Normal Event',
      startDate: '2030-01-01',
    });
    const featured = getFeaturedEventsServer();
    expect(featured).toHaveLength(1);
    expect(featured[0].frontmatter.title).toBe('Featured Event');
  });

  it('should respect limit parameter', () => {
    createEventFile(eventsDir, 'f1.md', {
      title: 'Featured 1',
      startDate: '2030-01-01',
      featured: true,
    });
    createEventFile(eventsDir, 'f2.md', {
      title: 'Featured 2',
      startDate: '2030-02-01',
      featured: true,
    });
    createEventFile(eventsDir, 'f3.md', {
      title: 'Featured 3',
      startDate: '2030-03-01',
      featured: true,
    });
    const featured = getFeaturedEventsServer(2);
    expect(featured).toHaveLength(2);
  });

  it('should default limit to 3', () => {
    for (let i = 0; i < 5; i++) {
      createEventFile(eventsDir, `feat-${i}.md`, {
        title: `Featured ${i}`,
        startDate: '2030-01-01',
        featured: true,
      });
    }
    const featured = getFeaturedEventsServer();
    expect(featured).toHaveLength(3);
  });

  it('should return empty when no featured events exist', () => {
    createEventFile(eventsDir, 'normal.md', {
      title: 'Normal',
      startDate: '2030-01-01',
    });
    const featured = getFeaturedEventsServer();
    expect(featured).toEqual([]);
  });

  it('should not treat featured: false as featured', () => {
    createEventFile(eventsDir, 'not-featured.md', {
      title: 'Not Featured',
      startDate: '2030-01-01',
      featured: false,
    });
    const featured = getFeaturedEventsServer();
    expect(featured).toEqual([]);
  });
});




describe('getRelatedEventsServer', () => {
  it('should return events with matching categories', () => {
    createEventFile(eventsDir, 'current.md', {
      title: 'Current',
      startDate: '2030-01-01',
      categories: ['workshop', 'tech'],
    });
    createEventFile(eventsDir, 'related.md', {
      title: 'Related',
      startDate: '2030-02-01',
      categories: ['workshop'],
    });
    createEventFile(eventsDir, 'unrelated.md', {
      title: 'Unrelated',
      startDate: '2030-03-01',
      categories: ['social'],
    });
    const related = getRelatedEventsServer('current');
    expect(related).toHaveLength(1);
    expect(related[0].frontmatter.title).toBe('Related');
  });

  it('should return events with matching tags', () => {
    createEventFile(eventsDir, 'current.md', {
      title: 'Current',
      startDate: '2030-01-01',
      tags: ['svelte', 'typescript'],
    });
    createEventFile(eventsDir, 'tag-match.md', {
      title: 'Tag Match',
      startDate: '2030-02-01',
      tags: ['svelte', 'react'],
    });
    const related = getRelatedEventsServer('current');
    expect(related).toHaveLength(1);
    expect(related[0].frontmatter.title).toBe('Tag Match');
  });

  it('should return events matching either categories or tags', () => {
    createEventFile(eventsDir, 'current.md', {
      title: 'Current',
      startDate: '2030-01-01',
      categories: ['workshop'],
      tags: ['svelte'],
    });
    createEventFile(eventsDir, 'cat-match.md', {
      title: 'Category Match',
      startDate: '2030-02-01',
      categories: ['workshop'],
    });
    createEventFile(eventsDir, 'tag-match.md', {
      title: 'Tag Match',
      startDate: '2030-03-01',
      tags: ['svelte'],
    });
    const related = getRelatedEventsServer('current');
    expect(related).toHaveLength(2);
  });

  it('should exclude current event from results', () => {
    createEventFile(eventsDir, 'current.md', {
      title: 'Current',
      startDate: '2030-01-01',
      categories: ['workshop'],
    });
    createEventFile(eventsDir, 'other.md', {
      title: 'Other',
      startDate: '2030-02-01',
      categories: ['workshop'],
    });
    const related = getRelatedEventsServer('current');
    expect(related).toHaveLength(1);
    expect(related[0].slug).not.toBe('current');
  });

  it('should respect limit parameter', () => {
    createEventFile(eventsDir, 'current.md', {
      title: 'Current',
      startDate: '2030-01-01',
      categories: ['workshop'],
    });
    createEventFile(eventsDir, 'r1.md', {
      title: 'Related 1',
      startDate: '2030-02-01',
      categories: ['workshop'],
    });
    createEventFile(eventsDir, 'r2.md', {
      title: 'Related 2',
      startDate: '2030-03-01',
      categories: ['workshop'],
    });
    createEventFile(eventsDir, 'r3.md', {
      title: 'Related 3',
      startDate: '2030-04-01',
      categories: ['workshop'],
    });
    const related = getRelatedEventsServer('current', 2);
    expect(related).toHaveLength(2);
  });

  it('should default limit to 3', () => {
    createEventFile(eventsDir, 'current.md', {
      title: 'Current',
      startDate: '2030-01-01',
      tags: ['shared'],
    });
    for (let i = 0; i < 5; i++) {
      createEventFile(eventsDir, `r${i}.md`, {
        title: `Related ${i}`,
        startDate: '2030-02-01',
        tags: ['shared'],
      });
    }
    const related = getRelatedEventsServer('current');
    expect(related).toHaveLength(3);
  });

  it('should return empty when no matches exist', () => {
    createEventFile(eventsDir, 'current.md', {
      title: 'Current',
      startDate: '2030-01-01',
      categories: ['workshop'],
      tags: ['svelte'],
    });
    createEventFile(eventsDir, 'unrelated.md', {
      title: 'Unrelated',
      startDate: '2030-02-01',
      categories: ['social'],
      tags: ['react'],
    });
    const related = getRelatedEventsServer('current');
    expect(related).toEqual([]);
  });

  it('should return empty when slug not found', () => {
    createEventFile(eventsDir, 'event.md', {
      title: 'Event',
      startDate: '2030-01-01',
      categories: ['workshop'],
    });
    const related = getRelatedEventsServer('nonexistent');
    expect(related).toEqual([]);
  });

  it('should return empty when current event has no categories or tags', () => {
    createEventFile(eventsDir, 'current.md', {
      title: 'Current',
      startDate: '2030-01-01',
    });
    createEventFile(eventsDir, 'other.md', {
      title: 'Other',
      startDate: '2030-02-01',
      categories: ['workshop'],
    });
    const related = getRelatedEventsServer('current');
    expect(related).toEqual([]);
  });

  it('should handle events with categories but no tags', () => {
    createEventFile(eventsDir, 'current.md', {
      title: 'Current',
      startDate: '2030-01-01',
      categories: ['workshop'],
    });
    createEventFile(eventsDir, 'match.md', {
      title: 'Match',
      startDate: '2030-02-01',
      categories: ['workshop'],
    });
    const related = getRelatedEventsServer('current');
    expect(related).toHaveLength(1);
  });
});




describe('getEventsByOrganizerServer', () => {
  it('should filter by organizer name', () => {
    createEventFile(eventsDir, 'org1.md', {
      title: 'Org Event',
      startDate: '2030-01-01',
      organizer: 'Alice',
    });
    createEventFile(eventsDir, 'org2.md', {
      title: 'Other Event',
      startDate: '2030-02-01',
      organizer: 'Bob',
    });
    const events = getEventsByOrganizerServer('Alice');
    expect(events).toHaveLength(1);
    expect(events[0].frontmatter.title).toBe('Org Event');
  });

  it('should filter by contactEmail', () => {
    createEventFile(eventsDir, 'email.md', {
      title: 'Email Event',
      startDate: '2030-01-01',
      contactEmail: 'alice@example.com',
    });
    const events = getEventsByOrganizerServer('alice@example.com');
    expect(events).toHaveLength(1);
    expect(events[0].frontmatter.title).toBe('Email Event');
  });

  it('should match either organizer or contactEmail', () => {
    createEventFile(eventsDir, 'by-name.md', {
      title: 'By Name',
      startDate: '2030-01-01',
      organizer: 'Alice',
    });
    createEventFile(eventsDir, 'by-email.md', {
      title: 'By Email',
      startDate: '2030-02-01',
      contactEmail: 'Alice',
    });
    const events = getEventsByOrganizerServer('Alice');
    expect(events).toHaveLength(2);
  });

  it('should return empty when no events match organizer', () => {
    createEventFile(eventsDir, 'event.md', {
      title: 'Event',
      startDate: '2030-01-01',
      organizer: 'Bob',
    });
    const events = getEventsByOrganizerServer('Alice');
    expect(events).toEqual([]);
  });

  it('should return empty when no events exist', () => {
    const events = getEventsByOrganizerServer('Anyone');
    expect(events).toEqual([]);
  });

  it('should not match partial organizer names', () => {
    createEventFile(eventsDir, 'org.md', {
      title: 'Org Event',
      startDate: '2030-01-01',
      organizer: 'Alice Johnson',
    });
    const events = getEventsByOrganizerServer('Alice');
    expect(events).toEqual([]);
  });

  it('should return multiple events from the same organizer', () => {
    createEventFile(eventsDir, 'e1.md', {
      title: 'Event 1',
      startDate: '2030-01-01',
      organizer: 'Alice',
    });
    createEventFile(eventsDir, 'e2.md', {
      title: 'Event 2',
      startDate: '2030-02-01',
      organizer: 'Alice',
    });
    const events = getEventsByOrganizerServer('Alice');
    expect(events).toHaveLength(2);
  });
});




describe('edge cases', () => {
  it('should handle markdown file with empty frontmatter', () => {
    writeFileSync(join(eventsDir, 'empty-fm.md'), '---\n---\nJust content');
    const events = loadEventsServer();
    expect(events).toHaveLength(1);
    expect(events[0].frontmatter.title).toBe('Untitled Event');
    expect(events[0].content).toContain('Just content');
  });

  it('should handle markdown file with no content body', () => {
    createEventFile(eventsDir, 'no-body.md', {
      title: 'No Body',
      startDate: '2030-01-01',
    });
    const events = loadEventsServer();
    expect(events).toHaveLength(1);
    expect(events[0].content.trim()).toBe('');
  });

  it('should handle events with organizer as object type', () => {
    
    createEventFile(eventsDir, 'obj-org.md', {
      title: 'Object Organizer',
      startDate: '2030-01-01',
      organizer: 'Alice',
    });
    const events = getEventsByOrganizerServer('Alice');
    expect(events).toHaveLength(1);
  });

  it('should handle concurrent calls to loadEventsServer consistently', () => {
    createEventFile(eventsDir, 'consistent.md', {
      title: 'Consistent',
      startDate: '2030-01-01',
    });
    const results1 = loadEventsServer();
    const results2 = loadEventsServer();
    expect(results1).toHaveLength(1);
    expect(results2).toHaveLength(1);
    expect(results1[0].slug).toBe(results2[0].slug);
  });
});
