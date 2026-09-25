











import { join } from 'path';
import { readFileSync, existsSync, readdirSync, writeFileSync, unlinkSync } from 'fs';
import matter from 'gray-matter';
import { getContentConfig, getLogger, withSpan } from '../config.js';
import type {
  ContentItem,
  LoadContentOptions,
  LoadUserContentPageOptions,
  UserContentPage,
  ContentVisibility,
} from '../types.js';
import { migrateVisibility } from '../types.js';








function getUsersDir(): string {
  const config = getContentConfig();
  return join(config.contentDir, 'users');
}




function getUserContentDir(handle: string, contentType: string): string {
  return join(getUsersDir(), handle, contentType);
}




function getAllUserHandles(): string[] {
  const usersDir = getUsersDir();
  if (!existsSync(usersDir)) {
    return [];
  }

  return readdirSync(usersDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}








/**
 * Shared visibility allowlist for content projection surfaces.
 *
 * This is the single decision point used by the outbox/featured collection
 * loaders AND (via isPubliclyDeliverableObject in the app) by the per-object
 * ActivityPub routes, so the listing surface and the object surface cannot
 * drift apart. Exported for TIN-2423 fail-open sweep (AP object visibility
 * gate): non-public objects must 404 on anonymous AP fetches.
 */
export function shouldIncludeByVisibility(
  visibility: string,
  options: LoadContentOptions
): boolean {
  if (visibility === 'public') {
    return true;
  }

  if (visibility === 'unlisted' && options.includeUnlisted) {
    return true;
  }

  if (visibility === 'private' && options.includePrivate) {
    return true;
  }

  return false;
}




function shouldIncludeByFediverseVisibility(
  metadata: Record<string, unknown>,
  options: LoadContentOptions
): boolean {
  if (!options.fediverseVisibility && !options.federatedOnly) {
    return true;
  }

  // Fail closed: unknown, typo, and absent values normalize to 'private'.
  const fediverseVisibility = migrateVisibility(
    (metadata.fediverseVisibility as string) ||
      (metadata.visibility as string) ||
      undefined
  );

  if (options.federatedOnly) {
    if (fediverseVisibility === 'private' || fediverseVisibility === 'direct') {
      return false;
    }
  }

  if (options.fediverseVisibility && options.fediverseVisibility.length > 0) {
    return options.fediverseVisibility.includes(fediverseVisibility);
  }

  return true;
}




function extractDateFromSlug(slug: string): number {
  const parsed = Date.parse(slug);
  if (!isNaN(parsed)) {
    return parsed;
  }

  const dateMatch = slug.match(/^(\d{4}-\d{2}-\d{2})/);
  if (dateMatch) {
    return new Date(dateMatch[1]).getTime();
  }

  return Date.now();
}








function loadContentType(
  contentType: string,
  dirName: string,
  options: LoadContentOptions,
  publishedAtField: string = 'publishedAt',
  fallbackDateField: string = 'date',
  includeFediverse: boolean = false
): ContentItem[] {
  const logger = getLogger();
  const items: ContentItem[] = [];
  const handles = options.handle ? [options.handle] : getAllUserHandles();

  for (const handle of handles) {
    const dir = getUserContentDir(handle, dirName);

    if (!existsSync(dir)) {
      continue;
    }

    const files = readdirSync(dir)
      .filter((file) => file.endsWith('.md') || file.endsWith('.mdx'))
      .sort();

    for (const file of files) {
      try {
        const filePath = join(dir, file);
        const fileContent = readFileSync(filePath, 'utf-8');
        const { data: metadata, content: markdownContent } = matter(fileContent);

        const slug = file.replace(/\.(md|mdx)$/, '');

        // Fail closed: unknown, typo, and absent values resolve to 'private'.
        const visibility = migrateVisibility(
          metadata.visibility as string | null | undefined
        );
        if (!shouldIncludeByVisibility(visibility, options)) {
          continue;
        }

        if (includeFediverse && !shouldIncludeByFediverseVisibility(metadata, options)) {
          continue;
        }

        const item: ContentItem = {
          type: contentType as ContentItem['type'],
          slug,
          content: markdownContent,
          metadata,
          publishedAt: metadata[publishedAtField] || metadata[fallbackDateField],
          updatedAt: metadata.updatedAt as string | undefined,
          authorHandle: handle,
          visibility,
        };

        if (includeFediverse) {
          item.fediverseVisibility = metadata.fediverseVisibility
            ? migrateVisibility(metadata.fediverseVisibility as string)
            : visibility;
          item.fediverseId = metadata.activityPubId as string | undefined;
        }

        items.push(item);
      } catch (error) {
        logger.error(`[ContentLoader] Failed to load ${contentType} ${file}:`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  return items;
}








async function loadAllUserContent(
  handle: string,
  options: LoadContentOptions
): Promise<ContentItem[]> {
  const allContent: ContentItem[] = [];

  allContent.push(...await loadBlogPosts({ ...options, handle }));
  allContent.push(...await loadNotes({ ...options, handle }));
  allContent.push(...await loadProducts({ ...options, handle }));
  allContent.push(...await loadEvents({ ...options, handle }));
  allContent.push(...await loadPrograms({ ...options, handle }));
  allContent.push(...await loadVideos({ ...options, handle }));
  allContent.push(...await loadProfiles({ ...options, handle }));

  return allContent;
}

export async function loadUserContent(
  handle: string,
  options: LoadContentOptions = {}
): Promise<ContentItem[]> {
  return withSpan('content_loader.load_user_content', async () => {
    let filtered = await loadAllUserContent(handle, options);

    filtered.sort(
      (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );

    if (options.minId) {
      const minDate = extractDateFromSlug(options.minId);
      filtered = filtered.filter(
        (item) => new Date(item.publishedAt).getTime() < minDate
      );
    }

    if (options.maxId) {
      const maxDate = extractDateFromSlug(options.maxId);
      filtered = filtered.filter(
        (item) => new Date(item.publishedAt).getTime() > maxDate
      );
    }

    const offset = options.offset || 0;
    const limit = options.limit || 20;

    return filtered.slice(offset, offset + limit);
  });
}

type UserContentOrderKey = [number | null, string, string, string];

// The first consumer is an ActivityPub outbox with 20-item pages. Keep the
// package default aligned with that protocol surface while allowing bounded
// callers to request up to five pages' worth in one pass. The cursor cap is
// checked before Buffer allocation; generated cursors contain only one
// timestamp and three filesystem/content identifiers, so 4 KiB leaves ample
// headroom while making hostile request memory finite.
const DEFAULT_USER_CONTENT_PAGE_SIZE = 20;
const MAX_USER_CONTENT_PAGE_SIZE = 100;
const MAX_USER_CONTENT_CURSOR_LENGTH = 4096;

function orderKey(item: ContentItem): UserContentOrderKey {
  const rawTimestamp = item.metadata.publishedAt ?? item.metadata.date ??
    item.metadata.startDate ?? item.metadata.joinedDate;
  const timestamp = rawTimestamp instanceof Date
    ? rawTimestamp.getTime()
    : Date.parse(typeof rawTimestamp === 'string' ? rawTimestamp : '');
  return [Number.isFinite(timestamp) ? timestamp : null, item.type, item.authorHandle, item.slug];
}

function compareOrderKeys(a: UserContentOrderKey, b: UserContentOrderKey): number {
  if (a[0] !== b[0]) {
    if (a[0] === null) return 1;
    if (b[0] === null) return -1;
    return b[0] - a[0];
  }
  for (let index = 1; index < a.length; index += 1) {
    if (a[index] !== b[index]) {
      return (a[index] as string) < (b[index] as string) ? -1 : 1;
    }
  }
  return 0;
}

function encodeCursor(item: ContentItem): string {
  return Buffer.from(JSON.stringify([1, ...orderKey(item)])).toString('base64url');
}

function decodeCursor(cursor?: string): UserContentOrderKey | undefined {
  if (cursor === undefined) return undefined;
  try {
    if (cursor.length > MAX_USER_CONTENT_CURSOR_LENGTH) throw new Error();
    if (!/^[A-Za-z0-9_-]+$/.test(cursor)) throw new Error();
    const decoded = Buffer.from(cursor, 'base64url');
    if (decoded.toString('base64url') !== cursor) throw new Error();
    const value: unknown = JSON.parse(decoded.toString('utf8'));
    if (
      !Array.isArray(value) || value.length !== 5 || value[0] !== 1 ||
      !(value[1] === null || Number.isSafeInteger(value[1])) ||
      !value.slice(2).every((part) => typeof part === 'string')
    ) throw new Error();
    return value.slice(1) as unknown as UserContentOrderKey;
  } catch {
    throw new RangeError('invalid or unsupported cursor');
  }
}

function parsePageDateBound(value: string | undefined, name: string): number | undefined {
  if (value === undefined) return undefined;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new RangeError(`${name} must be a timestamp`);
  return timestamp;
}

/**
 * Apply a caller-owned eligibility rule before slicing. The exact eligible
 * total is counted in the same pass, while only the requested page is retained.
 * Totals and cursors describe a live keyset; later inserts/deletes are not snapshot-isolated.
 * Page size defaults to 20 and is capped at 100. Encoded cursors longer than
 * 4096 characters are rejected before decoding.
 */
export async function loadUserContentPage(
  handle: string,
  options: LoadUserContentPageOptions
): Promise<UserContentPage> {
  return withSpan('content_loader.load_user_content_page', async () => {
    const { cursor, predicate, limit = DEFAULT_USER_CONTENT_PAGE_SIZE, ...loadOptions } = options;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_USER_CONTENT_PAGE_SIZE) {
      throw new RangeError(`limit must be a safe integer from 1 to ${MAX_USER_CONTENT_PAGE_SIZE}`);
    }

    const after = decodeCursor(cursor);
    const minDate = parsePageDateBound(loadOptions.minId, 'minId');
    const maxDate = parsePageDateBound(loadOptions.maxId, 'maxId');
    const page: ContentItem[] = [];
    const seen = new Set<string>();
    let total = 0;
    let hasMore = false;

    const content = await loadAllUserContent(handle, loadOptions);
    content.sort((a, b) => compareOrderKeys(orderKey(a), orderKey(b)));
    for (const item of content) {
      const identity = JSON.stringify([item.type, item.authorHandle, item.slug]);
      if (seen.has(identity)) continue;
      seen.add(identity);
      const key = orderKey(item);
      const publishedAt = key[0];
      if (
        (minDate !== undefined && (publishedAt === null || publishedAt >= minDate)) ||
        (maxDate !== undefined && (publishedAt === null || publishedAt <= maxDate)) ||
        !predicate(item)
      ) {
        continue;
      }
      total += 1;
      if (after && compareOrderKeys(key, after) <= 0) {
        continue;
      }
      if (page.length < limit) {
        page.push(item);
      } else {
        hasMore = true;
      }
    }

    return {
      items: page,
      totalItems: total,
      nextCursor: hasMore ? encodeCursor(page[page.length - 1]) : null,
    };
  });
}




export async function loadBlogPosts(
  options: LoadContentOptions = {}
): Promise<ContentItem[]> {
  return loadContentType('blog-post', 'blog', options, 'publishedAt', 'date');
}




export async function loadNotes(
  options: LoadContentOptions = {}
): Promise<ContentItem[]> {
  return loadContentType('note', 'notes', options);
}




export async function loadProducts(
  options: LoadContentOptions = {}
): Promise<ContentItem[]> {
  return loadContentType('product', 'products', options);
}




export async function loadEvents(
  options: LoadContentOptions = {}
): Promise<ContentItem[]> {
  return loadContentType('event', 'events', options, 'publishedAt', 'date', true);
}




export async function loadPrograms(
  options: LoadContentOptions = {}
): Promise<ContentItem[]> {
  return loadContentType('program', 'programs', options, 'publishedAt', 'startDate', true);
}




export async function loadVideos(
  options: LoadContentOptions = {}
): Promise<ContentItem[]> {
  return loadContentType('video', 'videos', options, 'publishedAt', 'date', true);
}






export async function loadProfiles(
  options: LoadContentOptions = {}
): Promise<ContentItem[]> {
  const logger = getLogger();
  const items: ContentItem[] = [];
  const usersDir = getUsersDir();

  if (!existsSync(usersDir)) {
    return items;
  }

  const userDirs = readdirSync(usersDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const handle of userDirs) {
    if (options.handle && handle !== options.handle) {
      continue;
    }

    const profilePath = join(usersDir, handle, 'profile.md');
    if (!existsSync(profilePath)) {
      continue;
    }

    try {
      const fileContent = readFileSync(profilePath, 'utf-8');
      const { data: metadata, content: markdownContent } = matter(fileContent);

      const slug = (metadata.slug as string) || handle;
      const authorHandle = (metadata.handle as string) || handle;

      const visibility = migrateVisibility(
        metadata.visibility as string | null | undefined
      );
      if (!shouldIncludeByVisibility(visibility, options)) {
        continue;
      }

      if (!shouldIncludeByFediverseVisibility(metadata, options)) {
        continue;
      }

      items.push({
        type: 'profile',
        slug,
        content: markdownContent,
        metadata,
        publishedAt:
          (metadata.publishedAt as string) ||
          (metadata.joinedDate as string) ||
          new Date().toISOString(),
        updatedAt: metadata.updatedAt as string | undefined,
        authorHandle,
        visibility,
        fediverseVisibility: metadata.fediverseVisibility
          ? migrateVisibility(metadata.fediverseVisibility as string)
          : visibility,
        fediverseId: metadata.activityPubId as string | undefined,
      });
    } catch (error) {
      logger.error(`[ContentLoader] Failed to load profile from users/${handle}:`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return items;
}








/**
 * Live-content-only by-slug path resolver for the admin CRUD triad
 * (loadPostBySlug / updatePost / deletePost, and the event equivalents).
 *
 * DELIBERATELY does NOT apply the bundled+live overlay that the public
 * userContentLoader by-slug path (findContentBySlug / loadSingleUserContent →
 * loadBlogPost) uses. This resolver only ever sees the writable live contentDir
 * because its callers write there: updatePost/deletePost mutate found.filePath,
 * and bundled content is a read-only shipped baseline (no copy-on-write). Adding
 * the overlay here would let an admin *load* a bundled-only post that the paired
 * write op then fails to save — a worse footgun than the honest fail-fast 404.
 * The overlay gap is intentional, not the TIN-1952 bug.
 */
function findContentPath(
  contentType: string,
  slug: string
): { filePath: string; handle: string } | null {
  const usersDir = getUsersDir();

  if (!existsSync(usersDir)) {
    return null;
  }

  const userDirs = readdirSync(usersDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const handle of userDirs) {
    const dir = join(usersDir, handle, contentType);
    if (!existsSync(dir)) continue;

    for (const ext of ['.md', '.mdx']) {
      const filePath = join(dir, `${slug}${ext}`);
      if (existsSync(filePath)) {
        return { filePath, handle };
      }
    }
  }

  return null;
}




/**
 * ADMIN-ONLY RAW by-slug blog loader. Returns the post's frontmatter/content
 * VERBATIM with no visibility/published gate — a `published:false` / `private`
 * draft resolves non-null. This is intentional: its sole consumer is the
 * auth-gated member/admin edit surface (admin/member/posts/[slug]/edit), which
 * must load drafts to edit them.
 *
 * ⚠️ NOT a public by-slug loader and NOT interchangeable with `loadBlogPost`.
 * Two deliberate divergences from `loadBlogPost` (loaders/blogLoader →
 * userContentLoader.findContentBySlug):
 *   1. No bundled+live overlay — live contentDir only (see findContentPath;
 *      paired with the live-only updatePost/deletePost writes).
 *   2. No public-surface gate — raw by design for admin editing.
 * Do NOT wire this to a public request path: it would leak drafts/private
 * content, violating the org no-auto-publish invariant. Public by-slug reads
 * MUST use `loadBlogPost`, which is overlay-aware AND fail-closed by default
 * (opt into raw there via `{ includeUnpublished: true }` only from auth-gated
 * admin/preview callers). See userContentLoader.SingleContentOptions.
 */
export async function loadPostBySlug(slug: string): Promise<ContentItem | null> {
  const found = findContentPath('blog', slug);

  if (!found) {
    return null;
  }

  try {
    const fileContent = readFileSync(found.filePath, 'utf-8');
    const { data: metadata, content: markdownContent } = matter(fileContent);

    return {
      type: 'blog-post',
      slug,
      content: markdownContent,
      metadata,
      publishedAt: (metadata.publishedAt as string) || (metadata.date as string),
      updatedAt: metadata.updatedAt as string | undefined,
      authorHandle: found.handle,
      // Fail closed: unknown, typo, and absent values resolve to 'private'.
      visibility: migrateVisibility(
        metadata.visibility as string | null | undefined
      ),
    };
  } catch (error) {
    getLogger().error(`[ContentLoader] Failed to load blog post ${slug}:`, {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}




export async function loadEventBySlug(slug: string): Promise<ContentItem | null> {
  const found = findContentPath('events', slug);

  if (!found) {
    return null;
  }

  try {
    const fileContent = readFileSync(found.filePath, 'utf-8');
    const { data: metadata, content: markdownContent } = matter(fileContent);

    const rawFediverseVisibility =
      (metadata.fediverseVisibility as string | undefined) ||
      (metadata.visibility as string | undefined);

    const visibility = migrateVisibility(
      metadata.visibility as string | null | undefined
    );

    return {
      type: 'event',
      slug,
      content: markdownContent,
      metadata,
      publishedAt:
        (metadata.publishedAt as string) ||
        (metadata.date as string) ||
        (metadata.startDateTime as string),
      updatedAt: metadata.updatedAt as string | undefined,
      authorHandle: found.handle,
      // Fail closed: unknown, typo, and absent values resolve to 'private'.
      visibility,
      fediverseVisibility: rawFediverseVisibility
        ? migrateVisibility(rawFediverseVisibility)
        : visibility,
      fediverseId: metadata.activityPubId as string | undefined,
    };
  } catch (error) {
    getLogger().error(`[ContentLoader] Failed to load event ${slug}:`, {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}








export async function updatePost(
  slug: string,
  data: Partial<Record<string, unknown>>,
  content?: string
): Promise<void> {
  const found = findContentPath('blog', slug);

  if (!found) {
    throw new Error(`Post not found: ${slug}`);
  }

  const fileContent = readFileSync(found.filePath, 'utf-8');
  const { data: existingFrontmatter, content: existingContent } = matter(fileContent);

  const updatedFrontmatter = {
    ...existingFrontmatter,
    ...data,
    updatedAt: new Date().toISOString(),
    author: existingFrontmatter.author,
    authorId: existingFrontmatter.authorId,
  };

  const updatedContent = content !== undefined ? content : existingContent;
  const updatedFile = matter.stringify(updatedContent, updatedFrontmatter);
  writeFileSync(found.filePath, updatedFile, 'utf-8');
}




export async function updateEvent(
  slug: string,
  data: Partial<Record<string, unknown>>,
  content?: string
): Promise<void> {
  const found = findContentPath('events', slug);

  if (!found) {
    throw new Error(`Event not found: ${slug}`);
  }

  const fileContent = readFileSync(found.filePath, 'utf-8');
  const { data: existingFrontmatter, content: existingContent } = matter(fileContent);

  const updatedFrontmatter = {
    ...existingFrontmatter,
    ...data,
    updatedAt: new Date().toISOString(),
    organizer: existingFrontmatter.organizer,
    authorId: existingFrontmatter.authorId,
  };

  const updatedContent = content !== undefined ? content : existingContent;
  const updatedFile = matter.stringify(updatedContent, updatedFrontmatter);
  writeFileSync(found.filePath, updatedFile, 'utf-8');
}




export async function deletePost(slug: string): Promise<void> {
  const found = findContentPath('blog', slug);

  if (!found) {
    throw new Error(`Post not found: ${slug}`);
  }

  unlinkSync(found.filePath);
}




export async function deleteEvent(slug: string): Promise<void> {
  const found = findContentPath('events', slug);

  if (!found) {
    throw new Error(`Event not found: ${slug}`);
  }

  unlinkSync(found.filePath);
}















export function extractAuthorHandle(metadata: Record<string, unknown>): string {
  if (typeof metadata.author === 'object' && (metadata.author as Record<string, unknown>)?.handle) {
    return (metadata.author as Record<string, unknown>).handle as string;
  }

  if (typeof metadata.author === 'string' && metadata.author) {
    return metadata.author;
  }

  return (metadata.handle as string) || 'unknown';
}












export function extractOrganizerHandle(metadata: Record<string, unknown>): string {
  if (typeof metadata.author === 'object' && (metadata.author as Record<string, unknown>)?.handle) {
    return (metadata.author as Record<string, unknown>).handle as string;
  }

  if (typeof metadata.organizer === 'object' && (metadata.organizer as Record<string, unknown>)?.handle) {
    return (metadata.organizer as Record<string, unknown>).handle as string;
  }

  if (typeof metadata.organizer === 'string' && metadata.organizer) {
    return metadata.organizer;
  }

  if (typeof metadata.author === 'string' && metadata.author) {
    return metadata.author;
  }

  return (metadata.handle as string) || 'unknown';
}















export function createContentLoader() {
  return {
    loadUserContent,
    loadUserContentPage,
    loadBlogPosts,
    loadNotes,
    loadProducts,
    loadEvents,
    loadPrograms,
    loadVideos,
    loadProfiles,
    loadPostBySlug,
    loadEventBySlug,
    updatePost,
    updateEvent,
    deletePost,
    deleteEvent,
    extractAuthorHandle,
    extractOrganizerHandle,
  };
}
