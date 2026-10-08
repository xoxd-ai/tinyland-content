











import { dirname, join, resolve } from 'path';
import { createHash, randomUUID } from 'crypto';
import { isDeepStrictEqual } from 'util';
import { readFileSync, readSync, existsSync, readdirSync, writeFileSync, unlinkSync, renameSync, openSync, fsyncSync, closeSync, lstatSync, fstatSync, realpathSync, constants } from 'fs';
import matter from 'gray-matter';
import { getContentConfig, getLogger, withSpan } from '../config.js';
import type {
  ContentItem,
  LoadContentOptions,
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
          (metadata.visibility as string | null | undefined) ?? undefined
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








export async function loadUserContent(
  handle: string,
  options: LoadContentOptions = {}
): Promise<ContentItem[]> {
  return withSpan('content_loader.load_user_content', async () => {
    const allContent: ContentItem[] = [];

    const blogPosts = await loadBlogPosts({ ...options, handle });
    allContent.push(...blogPosts);

    const notes = await loadNotes({ ...options, handle });
    allContent.push(...notes);

    const products = await loadProducts({ ...options, handle });
    allContent.push(...products);

    const events = await loadEvents({ ...options, handle });
    allContent.push(...events);

    const programs = await loadPrograms({ ...options, handle });
    allContent.push(...programs);

    const videos = await loadVideos({ ...options, handle });
    allContent.push(...videos);

    const profiles = await loadProfiles({ ...options, handle });
    allContent.push(...profiles);

    
    allContent.sort(
      (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );

    
    let filtered = allContent;

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
        (metadata.visibility as string | null | undefined) ?? undefined
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








/** Stable principal supplied by an authenticated caller, never form metadata. */
export interface PostOwner {
  id: string;
  handle: string;
}

export interface ReviewedOwnedPostAdoption {
  owner: PostOwner;
  slug: string;
  /** Exact live source from the app's frozen, principal-bound adoption proof. */
  source: { extension: 'md' | 'mdx'; rawSha256: string };
  /** Complete requested revision; existing unrelated frontmatter is retained. */
  planned: { metadata: Record<string, unknown>; content: string };
  /** App-owned durable proof and current-session/journal verification. */
  verifyProof: (observed: {
    owner: PostOwner;
    slug: string;
    extension: 'md' | 'mdx';
    rawSha256: string;
  }) => Promise<void>;
}

export interface AdoptedOwnedPost {
  metadata: Record<string, unknown>;
  content: string;
  rawSha256: string;
}

function validComponent(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 &&
    value !== '.' && value !== '..' && !/[\/\\\0]/.test(value);
}

function assertPostOwner(owner: PostOwner, slug: string): void {
  if (!owner || typeof owner.id !== 'string' || !owner.id.trim() ||
      !validComponent(owner.handle) || !validComponent(slug)) {
    throw new Error('Invalid owned post identity');
  }
}

function assertPostOwnership(metadata: Record<string, unknown>, owner: PostOwner): void {
  const author = metadata.author;
  const nested = author !== null && typeof author === 'object' && !Array.isArray(author)
    ? author as Record<string, unknown> : undefined;
  const ids = [metadata.authorId, nested?.id].filter((id) => id !== undefined);
  if (ids.length === 0 || ids.some((id) => id !== owner.id) ||
      (nested?.handle !== undefined && nested.handle !== owner.handle) ||
      (typeof author === 'string' && author !== owner.handle)) {
    throw new Error('Owned post identity mismatch');
  }
}

/**
 * Live-content-only resolver for editor CRUD, never a bundled+live overlay.
 * Bundled content is read-only (no copy-on-write); loading it here would offer
 * an editor a post that its paired mutation cannot save. The overlay gap is
 * intentional, not the TIN-1952 bug. An explicit owner selects only that user's
 * exact path; legacy callers retain the global first-match lookup.
 */
function findContentPath(
  contentType: string,
  slug: string,
  owner?: PostOwner
): { filePath: string; handle: string } | null {
  const usersDir = getUsersDir();

  if (owner !== undefined) {
    assertPostOwner(owner, slug);
    const dir = join(usersDir, owner.handle, contentType);
    const matches = ['.md', '.mdx'].map((ext) => join(dir, `${slug}${ext}`)).filter(existsSync);
    if (matches.length > 1) throw new Error('Ambiguous owned post extensions');
    return matches.length === 1 ? { filePath: matches[0], handle: owner.handle } : null;
  }

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
async function loadPost(slug: string, owner?: PostOwner): Promise<ContentItem | null> {
  try {
    const found = findContentPath('blog', slug, owner);
    if (!found) return null;
    const fileContent = readFileSync(found.filePath, 'utf-8');
    const { data: metadata, content: markdownContent } = matter(fileContent);
    if (owner !== undefined) assertPostOwnership(metadata, owner);

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
        (metadata.visibility as string | null | undefined) ?? undefined
      ),
    };
  } catch (error) {
    getLogger().error(`[ContentLoader] Failed to load blog post ${slug}:`, {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function loadPostBySlug(slug: string): Promise<ContentItem | null> {
  return loadPost(slug);
}

/** Raw live-only owner-scoped editor read; not a public projection loader. */
export async function loadOwnedPost(owner: PostOwner, slug: string): Promise<ContentItem | null> {
  // Explicit validation prevents a JavaScript caller's undefined owner from
  // silently selecting the legacy global lookup.
  try { assertPostOwner(owner, slug); } catch { return null; }
  return loadPost(slug, owner);
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
      (metadata.visibility as string | null | undefined) ?? undefined
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








async function writePost(
  slug: string,
  data: Partial<Record<string, unknown>>,
  content?: string,
  owner?: PostOwner
): Promise<void> {
  const found = findContentPath('blog', slug, owner);

  if (!found) {
    throw new Error(`Post not found: ${slug}`);
  }

  const fileContent = readFileSync(found.filePath, 'utf-8');
  const { data: existingFrontmatter, content: existingContent } = matter(fileContent);
  if (owner !== undefined) assertPostOwnership(existingFrontmatter, owner);

  let updatedAt = new Date().toISOString();
  if (owner !== undefined && data.updatedAt !== undefined) {
    if (typeof data.updatedAt !== 'string' ||
        !Number.isFinite(Date.parse(data.updatedAt)) ||
        new Date(data.updatedAt).toISOString() !== data.updatedAt) {
      throw new Error('Invalid owned post revision timestamp');
    }
    // A caller may replay a server-committed publication snapshot. Preserve
    // that revision timestamp rather than manufacturing a different revision.
    updatedAt = data.updatedAt;
  }

  const updatedFrontmatter: Record<string, unknown> = {
    ...existingFrontmatter,
    ...data,
    updatedAt,
  };
  for (const key of ['author', 'authorId']) {
    if (Object.prototype.hasOwnProperty.call(existingFrontmatter, key)) {
      updatedFrontmatter[key] = existingFrontmatter[key];
    } else {
      // Absence is an immutable binding too. Besides preventing forgery, omit
      // missing keys rather than passing undefined to the YAML serializer.
      delete updatedFrontmatter[key];
    }
  }

  const updatedContent = content !== undefined ? content : existingContent;
  const updatedFile = matter.stringify(updatedContent, updatedFrontmatter);
  if (owner === undefined) {
    writeFileSync(found.filePath, updatedFile, 'utf-8');
  } else {
    replaceOwnedPost(found.filePath, updatedFile);
  }
}

/**
 * Publish a complete Markdown revision, never truncate the currently readable
 * one. The app records publication/deletion obligations separately; this is
 * only the single-writer file replacement boundary, not a distributed lock.
 */
function replaceOwnedPost(filePath: string, bytes: string): void {
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporaryPath, bytes, {
      encoding: 'utf-8', flag: 'wx', mode: 0o600, flush: true,
    });
    renameSync(temporaryPath, filePath);
    syncPostDirectory(filePath);
  } finally {
    // A process crash may leave an ignored .tmp file. A reported write/rename
    // failure must not leave it behind or replace the last complete revision.
    if (existsSync(temporaryPath)) unlinkSync(temporaryPath);
  }
}

function syncPostDirectory(filePath: string): void {
  const directory = openSync(dirname(filePath), 'r');
  try {
    fsyncSync(directory);
  } finally {
    closeSync(directory);
  }
}

export async function updatePost(slug: string, data: Partial<Record<string, unknown>>, content?: string): Promise<void> {
  return writePost(slug, data, content);
}

export async function updateOwnedPost(owner: PostOwner, slug: string, data: Partial<Record<string, unknown>>, content?: string): Promise<void> {
  assertPostOwner(owner, slug);
  return writePost(slug, data, content, owner);
}

function rawSha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

const MAX_REVIEWED_POST_BYTES = 4 * 1024 * 1024;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function readRegularSourceBytes(path: string): Buffer {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const before = fstatSync(fd);
    if (!before.isFile() || before.nlink !== 1 || before.size < 1 ||
        before.size > MAX_REVIEWED_POST_BYTES) {
      throw new Error('Unsafe or oversized retained post source');
    }
    const buffer = Buffer.alloc(before.size + 1);
    let size = 0;
    while (size < buffer.length) {
      const count = readSync(fd, buffer, size, buffer.length - size, size);
      if (count === 0) break;
      size += count;
    }
    const after = fstatSync(fd);
    const linked = lstatSync(path);
    if (size !== before.size || after.size !== before.size ||
        after.dev !== before.dev || after.ino !== before.ino ||
        after.mtimeMs !== before.mtimeMs || after.ctimeMs !== before.ctimeMs ||
        linked.isSymbolicLink() || !linked.isFile() || linked.nlink !== 1 ||
        linked.dev !== before.dev || linked.ino !== before.ino) {
      throw new Error('Retained post source changed');
    }
    return buffer.subarray(0, size);
  } finally {
    closeSync(fd);
  }
}

function existsWithoutFollowingLinks(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

/** Resolve only the exact live source; no bundled read-through or copy-on-write. */
function reviewedLivePostPath(input: ReviewedOwnedPostAdoption): string {
  const root = resolve(getContentConfig().contentDir);
  const users = join(root, 'users');
  const handle = join(users, input.owner.handle);
  const blog = join(handle, 'blog');
  const path = join(blog, `${input.slug}.${input.source.extension}`);
  const otherExtension = input.source.extension === 'md' ? 'mdx' : 'md';

  // These checks are repeated after the awaited proof callback. The app must
  // still serialize writers; this synchronous filesystem boundary is not a
  // cross-process compare-and-swap or a substitute for that exclusion.
  if (realpathSync(root) !== root) throw new Error('Unsafe retained post source');
  for (const directory of [root, users, handle, blog]) {
    const info = lstatSync(directory);
    if (info.isSymbolicLink() || !info.isDirectory()) {
      throw new Error('Unsafe retained post source');
    }
  }
  const sourceInfo = lstatSync(path);
  if (sourceInfo.isSymbolicLink() || !sourceInfo.isFile() ||
      existsWithoutFollowingLinks(join(blog, `${input.slug}.${otherExtension}`))) {
    throw new Error('Unsafe or ambiguous retained post source');
  }
  return path;
}

function assertIdlessReviewedMetadata(value: unknown, owner: PostOwner): void {
  const visited = new WeakSet<object>();
  const visit = (node: unknown, depth: number): void => {
    if (depth > 24) throw new Error('Retained post identity is not adoptable');
    if (!node || typeof node !== 'object') return;
    if (visited.has(node)) throw new Error('Retained post identity is not adoptable');
    visited.add(node);
    for (const [key, child] of Object.entries(node)) {
      if (/^(?:id|authorId|ownerId|userId)$/i.test(key) && child !== undefined) {
        throw new Error('Retained post identity is not adoptable');
      }
      if (/^(?:author|owner)$/i.test(key)) {
        if (!child || typeof child !== 'object' || Array.isArray(child) ||
            (child as Record<string, unknown>).handle !== owner.handle) {
          throw new Error('Retained post identity is not adoptable');
        }
      }
      visit(child, depth + 1);
    }
  };
  visit(value, 0);
}

function readReviewedLivePost(input: ReviewedOwnedPostAdoption): {
  path: string;
  metadata: Record<string, unknown>;
  content: string;
} {
  const path = reviewedLivePostPath(input);
  const bytes = readRegularSourceBytes(path);
  if (rawSha256(bytes) !== input.source.rawSha256) {
    throw new Error('Retained post source changed');
  }
  // Explicit YAML options bypass gray-matter's pre-parse cache, including
  // partial cache entries left by a malformed private source.
  let parsed: { data: Record<string, unknown>; content: string };
  try {
    parsed = matter(new TextDecoder('utf-8', { fatal: true }).decode(bytes), { language: 'yaml' });
  } catch {
    // YAML diagnostics may include a source excerpt; this boundary never
    // returns retained private bytes in an error or log message.
    throw new Error('Invalid retained post source');
  }
  const metadata = parsed.data as Record<string, unknown>;
  assertIdlessReviewedMetadata(metadata, input.owner);
  return { path, metadata, content: parsed.content };
}

/**
 * Bind one reviewed, ID-less LIVE source on its first explicit save. The
 * caller supplies a one-shot durable proof verifier; this package does not
 * grant ownership from a handle or inspect an app's admission sidecar. The
 * caller must serialize the source with the existing publication journal.
 */
export async function adoptReviewedOwnedPost(input: ReviewedOwnedPostAdoption): Promise<AdoptedOwnedPost> {
  if (!input || !input.owner) throw new Error('Invalid retained post adoption');
  assertPostOwner(input.owner, input.slug);
  if ((input.source?.extension !== 'md' && input.source?.extension !== 'mdx') ||
      !/^[a-f0-9]{64}$/.test(input.source.rawSha256) ||
      !input.planned || !input.planned.metadata ||
      typeof input.planned.metadata !== 'object' || Array.isArray(input.planned.metadata) ||
      typeof input.planned.content !== 'string' || typeof input.verifyProof !== 'function') {
    throw new Error('Invalid retained post adoption');
  }
  if (Buffer.byteLength(input.planned.content, 'utf-8') > MAX_REVIEWED_POST_BYTES) {
    throw new Error('Retained post revision too large');
  }
  // Keep one request snapshot across the awaited proof check. A mutable caller
  // object must not change the expected digest, owner, or planned revision.
  const request: ReviewedOwnedPostAdoption = {
    owner: { id: input.owner.id, handle: input.owner.handle },
    slug: input.slug,
    source: { extension: input.source.extension, rawSha256: input.source.rawSha256 },
    planned: { metadata: structuredClone(input.planned.metadata), content: input.planned.content },
    verifyProof: input.verifyProof,
  };
  // Planned identity is never a permission source, including a matching ID.
  assertIdlessReviewedMetadata(request.planned.metadata, request.owner);

  readReviewedLivePost(request);
  await request.verifyProof({
    owner: { ...request.owner }, slug: request.slug,
    extension: request.source.extension, rawSha256: request.source.rawSha256,
  });
  // Proof verification may await I/O. Do not use the stale pre-await bytes.
  const current = readReviewedLivePost(request);
  const previousAuthor = current.metadata.author;
  const authorFields = previousAuthor !== null && typeof previousAuthor === 'object' && !Array.isArray(previousAuthor)
    ? previousAuthor as Record<string, unknown> : {};
  if (Object.prototype.hasOwnProperty.call(request.planned.metadata, 'tinyland')) {
    const plannedTinyland = request.planned.metadata.tinyland;
    if (!isPlainRecord(plannedTinyland)) {
      // An original malformed value is preserved, never silently normalized.
      // A new/different malformed value is not an approved metadata edit.
      if (!Object.prototype.hasOwnProperty.call(current.metadata, 'tinyland') ||
          !isDeepStrictEqual(plannedTinyland, current.metadata.tinyland)) {
        throw new Error('Invalid retained post publication metadata');
      }
    }
  }
  const requested = { ...request.planned.metadata };
  delete requested.author;
  const updatedAt = requested.updatedAt === undefined
    ? new Date().toISOString()
    : requested.updatedAt;
  if (typeof updatedAt !== 'string' || !Number.isFinite(Date.parse(updatedAt)) ||
      new Date(updatedAt).toISOString() !== updatedAt) {
    throw new Error('Invalid retained post revision timestamp');
  }
  const metadata: Record<string, unknown> = {
    ...current.metadata, ...requested,
    authorId: request.owner.id,
    author: { ...authorFields, id: request.owner.id, handle: request.owner.handle },
    updatedAt,
    published: false,
    draft: true,
    status: 'draft',
    visibility: 'private',
    fediverseVisibility: 'private',
    publicFediverseDelivery: false,
  };
  if (isPlainRecord(metadata.tinyland)) {
    metadata.tinyland = {
      ...metadata.tinyland as Record<string, unknown>, publicFediverseDelivery: false,
    };
  }
  let bytes: string;
  try {
    bytes = matter.stringify(request.planned.content, metadata);
  } catch {
    throw new Error('Invalid retained post revision');
  }
  if (Buffer.byteLength(bytes, 'utf-8') > MAX_REVIEWED_POST_BYTES) {
    throw new Error('Retained post revision too large');
  }
  // Same single-writer temp+rename+directory fsync boundary as ordinary owner
  // updates. An uncertain fsync/readback result must remain a pending journal
  // operation for the app to reconcile by exact after-revision bytes.
  replaceOwnedPost(current.path, bytes);
  const readback = readRegularSourceBytes(current.path);
  if (!readback.equals(Buffer.from(bytes, 'utf-8'))) {
    throw new Error('Retained post write readback mismatch');
  }
  let saved: { data: Record<string, unknown>; content: string };
  try {
    saved = matter(new TextDecoder('utf-8', { fatal: true }).decode(readback), { language: 'yaml' });
  } catch {
    throw new Error('Retained post readback invalid');
  }
  return {
    metadata: saved.data as Record<string, unknown>,
    content: saved.content,
    rawSha256: rawSha256(readback),
  };
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

export async function deleteOwnedPost(owner: PostOwner, slug: string): Promise<void> {
  assertPostOwner(owner, slug);
  const found = findContentPath('blog', slug, owner);
  if (!found) throw new Error(`Post not found: ${slug}`);
  const { data: metadata } = matter(readFileSync(found.filePath, 'utf-8'));
  assertPostOwnership(metadata, owner);
  const bundledRoot = getContentConfig().bundledContentDir;
  if (bundledRoot) {
    const bundledBlog = join(bundledRoot, 'users', owner.handle, 'blog');
    // The public overlay supports .md and .mdx, including cross-extension
    // shadowing. Removing this live source could reveal either predecessor.
    // lstat sees symlinks/broken symlinks; unreadable status is also a deny.
    let baselinePossible = false;
    for (const extension of ['md', 'mdx']) {
      try {
        lstatSync(join(bundledBlog, `${slug}.${extension}`));
        baselinePossible = true;
        break;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
        baselinePossible = true;
        break;
      }
    }
    if (baselinePossible) {
      throw Object.assign(new Error('Bundled baseline requires withdrawal instead of deletion'), {
        code: 'OWNED_POST_BUNDLED_BASELINE',
      });
    }
  }
  unlinkSync(found.filePath);
  syncPostDirectory(found.filePath);
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
    loadBlogPosts,
    loadNotes,
    loadProducts,
    loadEvents,
    loadPrograms,
    loadVideos,
    loadProfiles,
    loadPostBySlug,
    loadOwnedPost,
    updateOwnedPost,
    adoptReviewedOwnedPost,
    deleteOwnedPost,
    loadEventBySlug,
    updatePost,
    updateEvent,
    deletePost,
    deleteEvent,
    extractAuthorHandle,
    extractOrganizerHandle,
  };
}
