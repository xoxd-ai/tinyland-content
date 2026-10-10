






import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import matter from 'gray-matter';
import { getConfig } from './config.js';
import type { EventContent } from './types.js';





function getEventDateStr(event: EventContent): string | undefined {
  return (
    event.frontmatter.startDate ??
    event.frontmatter.startDateTime ??
    event.frontmatter.date
  );
}





export function loadEventsServer(): EventContent[] {
  const config = getConfig();
  const eventsPath = join(config.baseDir, config.contentSubPath);
  const allEvents: EventContent[] = [];

  try {
    const files = readdirSync(eventsPath);

    for (const file of files) {
      if (file.match(/\.(md|mdx|svx)$/)) {
        const filePath = join(eventsPath, file);
        const content = readFileSync(filePath, 'utf-8');
        const { data: frontmatter, content: markdownContent } = matter(content);

        const slug = file.replace(/\.(md|mdx|svx)$/, '');

        const wordCount = markdownContent.split(/\s+/).length;
        const readingTime = Math.ceil(wordCount / config.wordsPerMinute);

        allEvents.push({
          frontmatter: {
            title: (frontmatter.title as string) || 'Untitled Event',
            startDate:
              frontmatter.startDate ||
              frontmatter.startDateTime ||
              frontmatter.date ||
              new Date().toISOString(),
            ...frontmatter,
            slug: frontmatter.slug || slug,
            layout: frontmatter.layout || 'event',
          },
          content: markdownContent,
          slug: frontmatter.slug || slug,
          readingTime,
          wordCount,
        });
      }
    }

    return allEvents;
  } catch (error) {
    console.error('Error loading events:', error);
    return [];
  }
}




export function getUpcomingEventsServer(limit?: number): EventContent[] {
  const events = loadEventsServer();
  const now = new Date();

  const upcoming = events
    .filter((event) => {
      const dateStr = getEventDateStr(event);
      if (!dateStr) return false;
      return new Date(dateStr) >= now;
    })
    .sort((a, b) => {
      const dateA = new Date(
        getEventDateStr(a) || new Date().toISOString()
      );
      const dateB = new Date(
        getEventDateStr(b) || new Date().toISOString()
      );
      return dateA.getTime() - dateB.getTime();
    });

  return limit ? upcoming.slice(0, limit) : upcoming;
}




export function getPastEventsServer(limit?: number): EventContent[] {
  const events = loadEventsServer();
  const now = new Date();

  const past = events
    .filter((event) => {
      const dateStr = getEventDateStr(event);
      if (!dateStr) return false;
      return new Date(dateStr) < now;
    })
    .sort((a, b) => {
      const dateA = new Date(
        getEventDateStr(a) || new Date().toISOString()
      );
      const dateB = new Date(
        getEventDateStr(b) || new Date().toISOString()
      );
      return dateB.getTime() - dateA.getTime();
    });

  return limit ? past.slice(0, limit) : past;
}




export function getEventBySlugServer(slug: string): EventContent | undefined {
  const events = loadEventsServer();
  return events.find((event) => event.slug === slug);
}




export function getFeaturedEventsServer(limit: number = 3): EventContent[] {
  const events = loadEventsServer();
  const featured = events.filter((event) => event.frontmatter.featured);
  return featured.slice(0, limit);
}





export function getRelatedEventsServer(
  currentSlug: string,
  limit: number = 3
): EventContent[] {
  const events = loadEventsServer();
  const currentEvent = events.find((e) => e.slug === currentSlug);

  if (!currentEvent) return [];

  const related = events.filter((event) => {
    if (event.slug === currentSlug) return false;

    const currentCategories = currentEvent.frontmatter.categories || [];
    const currentTags = currentEvent.frontmatter.tags || [];
    const eventCategories = event.frontmatter.categories || [];
    const eventTags = event.frontmatter.tags || [];

    const hasMatchingCategory = currentCategories.some((cat: string) =>
      eventCategories.includes(cat)
    );
    const hasMatchingTag = currentTags.some((tag: string) =>
      eventTags.includes(tag)
    );

    return hasMatchingCategory || hasMatchingTag;
  });

  return related.slice(0, limit);
}




export function getEventsByOrganizerServer(organizer: string): EventContent[] {
  const events = loadEventsServer();
  return events.filter(
    (event) =>
      event.frontmatter.organizer === organizer ||
      event.frontmatter.contactEmail === organizer
  );
}
