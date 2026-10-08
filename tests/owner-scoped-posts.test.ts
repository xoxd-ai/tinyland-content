import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { join } from 'node:path';
import matter from 'gray-matter';
import { configureContent, resetContentConfig } from '../src/config.js';

const state = vi.hoisted(() => ({
  files: new Map<string, string>(),
  directories: new Map<string, string[]>(),
  read: vi.fn(), exists: vi.fn(), list: vi.fn(), write: vi.fn(), unlink: vi.fn(),
}));

// Match the package's existing synchronous filesystem-boundary test style.
// These mocks never create, update, or remove a real content file.
vi.mock('fs', () => ({
  readFileSync: state.read, existsSync: state.exists, readdirSync: state.list,
  writeFileSync: state.write, unlinkSync: state.unlink,
  renameSync: (from: string, to: string) => {
    const bytes = state.files.get(from);
    if (bytes === undefined) throw new Error('Missing temporary file');
    state.files.set(to, bytes);
    state.files.delete(from);
  },
  openSync: () => 42, fsyncSync: () => {}, closeSync: () => {},
}));

import {
  loadOwnedPost, updateOwnedPost, deleteOwnedPost,
  loadPostBySlug, updatePost, deletePost,
  createContentLoader,
  type PostOwner,
} from '../src/services/ContentLoaderService.js';

const ROOT = '/test/content';
const USERS = join(ROOT, 'users');
const alice: PostOwner = { id: 'alice-id', handle: 'alice' };
const bob: PostOwner = { id: 'bob-id', handle: 'bob' };
const SLUG = 'shared-draft';

function file(owner: PostOwner, slug = SLUG, extension = 'md') {
  return join(USERS, owner.handle, 'blog', `${slug}.${extension}`);
}

function source(metadata: Record<string, unknown>, content = 'Retained draft body.\n') {
  return matter.stringify(content, { title: 'Draft', published: false, visibility: 'private', ...metadata });
}

function ownMetadata(owner: PostOwner) {
  return { authorId: owner.id, author: { id: owner.id, handle: owner.handle, name: owner.handle } };
}

function seed(owner: PostOwner, metadata = ownMetadata(owner), content = `${owner.handle} draft.\n`, extension = 'md') {
  const bytes = source(metadata, content);
  state.files.set(file(owner, SLUG, extension), bytes);
  const dir = join(USERS, owner.handle, 'blog');
  state.directories.set(dir, [...new Set([...(state.directories.get(dir) ?? []), `${SLUG}.${extension}`])]);
  if (!state.directories.get(USERS)?.includes(owner.handle)) {
    state.directories.set(USERS, [...(state.directories.get(USERS) ?? []), owner.handle]);
  }
  return bytes;
}

async function expectDenied(owner: PostOwner, slug = SLUG) {
  await expect(loadOwnedPost(owner, slug)).resolves.toBeNull();
  await expect(updateOwnedPost(owner, slug, { title: 'Forbidden change' }, 'Forbidden body')).rejects.toThrow();
  await expect(deleteOwnedPost(owner, slug)).rejects.toThrow();
  expect(state.write).not.toHaveBeenCalled();
  expect(state.unlink).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.resetAllMocks();
  configureContent({ contentDir: ROOT, dataDir: '/test/data' });
  state.files = new Map();
  state.directories = new Map([[USERS, []]]);
  state.read.mockImplementation((path: string) => {
    const bytes = state.files.get(String(path));
    if (bytes === undefined) throw Object.assign(new Error('Missing file'), { code: 'ENOENT' });
    return bytes;
  });
  state.exists.mockImplementation((path: string) => state.files.has(String(path)) || state.directories.has(String(path)));
  state.list.mockImplementation((path: string, options?: { withFileTypes?: boolean }) => {
    const entries = state.directories.get(String(path)) ?? [];
    return options?.withFileTypes
      ? entries.map((name) => ({ name, isDirectory: () => state.directories.has(join(String(path), name)) || String(path) === USERS }))
      : entries;
  });
  state.write.mockImplementation((path: string, bytes: string) => state.files.set(String(path), String(bytes)));
  state.unlink.mockImplementation((path: string) => {
    if (!state.files.delete(String(path))) throw Object.assign(new Error('Missing file'), { code: 'ENOENT' });
  });
});

afterEach(() => resetContentConfig());

describe('an exact owner/slug target, never a global first-match fallback', () => {
  it('exposes the same explicit owner APIs through the service factory', () => {
    expect(createContentLoader()).toMatchObject({ loadOwnedPost, updateOwnedPost, deleteOwnedPost });
  });

  it.each([{ order: ['alice', 'bob'] }, { order: ['bob', 'alice'] }])('isolates same-slug owners with directory order $order', async ({ order }) => {
    const aliceBytes = seed(alice);
    const bobBytes = seed(bob);
    state.directories.set(USERS, order);

    const alicePost = await loadOwnedPost(alice, SLUG);
    const bobPost = await loadOwnedPost(bob, SLUG);
    expect(alicePost).toMatchObject({ slug: SLUG, authorHandle: 'alice', content: 'alice draft.\n' });
    expect(bobPost).toMatchObject({ slug: SLUG, authorHandle: 'bob', content: 'bob draft.\n' });
    expect(alicePost?.metadata).toMatchObject({ published: false, visibility: 'private', authorId: alice.id });
    expect(state.list).not.toHaveBeenCalled();

    await updateOwnedPost(alice, SLUG, { title: 'Alice updated' }, 'Alice updated body.');
    expect(state.files.get(file(alice))).not.toBe(aliceBytes);
    expect(state.files.get(file(bob))).toBe(bobBytes);
    expect(state.write).toHaveBeenCalledWith(expect.stringContaining(`${file(alice)}.`), expect.any(String), {
      encoding: 'utf-8', flag: 'wx', mode: 0o600, flush: true,
    });
    await deleteOwnedPost(alice, SLUG);
    expect(state.files.has(file(alice))).toBe(false);
    expect(state.files.get(file(bob))).toBe(bobBytes);
    expect(state.unlink).toHaveBeenCalledWith(file(alice));
    expect(state.list).not.toHaveBeenCalled();
  });

  it('does not fall back to another owner when the requested owner file is missing', async () => {
    const bobBytes = seed(bob);
    await expectDenied(alice);
    expect(state.files.get(file(bob))).toBe(bobBytes);
    expect(state.read).not.toHaveBeenCalledWith(file(bob), expect.anything());
    expect(state.list).not.toHaveBeenCalled();
  });

  it('does not fall back to the bundled baseline for writable owner APIs', async () => {
    configureContent({ contentDir: ROOT, bundledContentDir: '/test/bundled', dataDir: '/test/data' });
    const bundled = '/test/bundled/users/alice/blog/shared-draft.md';
    const bytes = source(ownMetadata(alice));
    state.files.set(bundled, bytes);
    await expectDenied(alice);
    expect(state.files.get(bundled)).toBe(bytes);
    expect(state.read).not.toHaveBeenCalled();
  });

  it('supports an unambiguous owned mdx file without touching another owner md file', async () => {
    seed(alice, ownMetadata(alice), 'Alice MDX body.\n', 'mdx');
    const bobBytes = seed(bob);
    await expect(loadOwnedPost(alice, SLUG)).resolves.toMatchObject({ content: 'Alice MDX body.\n' });
    await updateOwnedPost(alice, SLUG, { title: 'Updated MDX' });
    expect(matter(state.files.get(file(alice, SLUG, 'mdx'))!).content).toBe('Alice MDX body.\n');
    await deleteOwnedPost(alice, SLUG);
    expect(state.files.has(file(alice, SLUG, 'mdx'))).toBe(false);
    expect(state.files.get(file(bob))).toBe(bobBytes);
  });

  it('refuses ambiguous md plus mdx rather than choosing an extension', async () => {
    const md = seed(alice);
    const mdx = seed(alice, ownMetadata(alice), 'Different MDX body.\n', 'mdx');
    await expectDenied(alice);
    expect(state.files.get(file(alice))).toBe(md);
    expect(state.files.get(file(alice, SLUG, 'mdx'))).toBe(mdx);
  });
});

describe('stable author identity is required and every supplied binding must agree', () => {
  it.each([
    { authorId: alice.id },
    { author: { id: alice.id } },
    { authorId: alice.id, author: { name: 'Alice' } },
    { authorId: alice.id, author: 'alice' },
    { authorId: alice.id, author: { id: alice.id, handle: 'alice' } },
  ])('accepts matching stable ownership %j', async (metadata) => {
    state.files.set(file(alice), source(metadata));
    await expect(loadOwnedPost(alice, SLUG)).resolves.toMatchObject({ authorHandle: 'alice' });
    await updateOwnedPost(alice, SLUG, { title: 'Authorized update' });
    expect(state.write).toHaveBeenCalledTimes(1);
    await deleteOwnedPost(alice, SLUG);
    expect(state.unlink).toHaveBeenCalledWith(file(alice));
  });

  it.each([
    {}, { author: 'alice' }, { author: { handle: 'alice' } },
    { authorId: bob.id }, { author: { id: bob.id } },
    { authorId: alice.id, author: { id: bob.id, handle: 'alice' } },
    { authorId: bob.id, author: { id: alice.id, handle: 'alice' } },
    { authorId: alice.id, author: { id: alice.id, handle: 'bob' } },
    { authorId: alice.id, author: 'bob' },
    { authorId: null, author: { id: alice.id } },
    { authorId: alice.id, author: { id: null } },
    { authorId: 123, author: { handle: 'alice' } },
  ])('refuses missing, forged, or contradictory bindings %j', async (metadata) => {
    const bytes = source(metadata);
    state.files.set(file(alice), bytes);
    await expectDenied(alice);
    expect(state.files.get(file(alice))).toBe(bytes);
  });

  it('keeps stable author metadata unchanged when update data tries to forge it', async () => {
    seed(alice);
    await updateOwnedPost(alice, SLUG, {
      title: 'Allowed title', authorId: bob.id, author: { id: bob.id, handle: 'bob', name: 'Bob' },
    }, 'Allowed content.');
    const post = matter(state.files.get(file(alice))!);
    expect(post.data).toMatchObject({
      title: 'Allowed title', authorId: alice.id,
      author: { id: alice.id, handle: alice.handle, name: alice.handle },
    });
    expect(post.content.trim()).toBe('Allowed content.');
  });

  it('does not invent a missing authorId when identity is held in author.id', async () => {
    const author = { id: alice.id, handle: alice.handle, name: 'Alice' };
    state.files.set(file(alice), source({ author }));
    await updateOwnedPost(alice, SLUG, { authorId: bob.id, author: 'bob' });
    const post = matter(state.files.get(file(alice))!);
    expect(post.data.author).toEqual(author);
    expect(post.data.authorId).toBeUndefined();
  });

  it.each(['update', 'delete'])('rechecks storage ownership at %s after a formerly authorized load', async (operation) => {
    seed(alice);
    await expect(loadOwnedPost(alice, SLUG)).resolves.not.toBeNull();
    const replacement = source(ownMetadata(bob), 'Now owned by someone else.\n');
    state.files.set(file(alice), replacement);
    if (operation === 'update') {
      await expect(updateOwnedPost(alice, SLUG, { title: 'Stale permission' }, 'Stale overwrite')).rejects.toThrow();
    } else {
      await expect(deleteOwnedPost(alice, SLUG)).rejects.toThrow();
    }
    expect(state.files.get(file(alice))).toBe(replacement);
    expect(state.write).not.toHaveBeenCalled();
    expect(state.unlink).not.toHaveBeenCalled();
  });
});

describe('owner and slug are safe exact path components', () => {
  const unsafe = ['', '.', '..', '../bob', 'alice/bob', 'alice\\bob', 'nul\u0000component'];

  it.each(unsafe)('rejects unsafe owner handle %j before any path probe', async (handle) => {
    await expectDenied({ ...alice, handle });
    expect(state.exists).not.toHaveBeenCalled();
    expect(state.read).not.toHaveBeenCalled();
  });

  it.each(unsafe)('rejects unsafe slug %j before any path probe', async (slug) => {
    await expectDenied(alice, slug);
    expect(state.exists).not.toHaveBeenCalled();
    expect(state.read).not.toHaveBeenCalled();
  });

  it.each(['', '   ', null, 123])('rejects invalid stable owner ID %j', async (id) => {
    await expectDenied({ ...alice, id } as PostOwner);
    expect(state.exists).not.toHaveBeenCalled();
  });

  it.each([undefined, null])('does not silently select legacy global behavior for absent owner %j', async (owner) => {
    const bobBytes = seed(bob);
    await expectDenied(owner as unknown as PostOwner);
    expect(state.files.get(file(bob))).toBe(bobBytes);
    expect(state.exists).not.toHaveBeenCalled();
    expect(state.list).not.toHaveBeenCalled();
  });

  it('does not add an unrelated restrictive handle/slug grammar', async () => {
    const dotted: PostOwner = { id: 'dotted-id', handle: 'alice.example' };
    const slug = 'draft.one';
    const bytes = source(ownMetadata(dotted));
    state.files.set(file(dotted, slug), bytes);
    await expect(loadOwnedPost(dotted, slug)).resolves.toMatchObject({ authorHandle: dotted.handle, slug });
    await updateOwnedPost(dotted, slug, { title: 'Updated dotted draft' });
    await deleteOwnedPost(dotted, slug);
    expect(state.files.has(file(dotted, slug))).toBe(false);
  });
});

describe('committed owned revision timestamps', () => {
  it('preserves a server-supplied revision timestamp across repeated snapshot writes', async () => {
    seed(alice);
    const updatedAt = '2026-09-19T23:55:00.000Z';
    await updateOwnedPost(alice, SLUG, { title: 'Committed title', updatedAt }, 'Committed body.');
    const first = state.files.get(file(alice));
    await updateOwnedPost(alice, SLUG, { title: 'Committed title', updatedAt }, 'Committed body.');
    expect(state.files.get(file(alice))).toBe(first);
    expect(matter(first!).data.updatedAt).toBe(updatedAt);
  });

  it.each(['invalid', '2026-09-19', '', null, 123])('rejects noncanonical revision timestamp %j', async (updatedAt) => {
    const before = seed(alice);
    await expect(updateOwnedPost(alice, SLUG, { updatedAt })).rejects.toThrow('Invalid owned post revision timestamp');
    expect(state.files.get(file(alice))).toBe(before);
    expect(state.write).not.toHaveBeenCalled();
  });
});

describe('legacy global APIs retain their compatibility contract', () => {
  it('keeps first-match global behavior while the new owned path is explicit', async () => {
    const aliceBytes = seed(alice);
    seed(bob);
    state.directories.set(USERS, ['bob', 'alice']);
    await expect(loadPostBySlug(SLUG)).resolves.toMatchObject({ authorHandle: 'bob' });
    await expect(loadOwnedPost(alice, SLUG)).resolves.toMatchObject({ authorHandle: 'alice' });
    await updatePost(SLUG, { title: 'Legacy update' }, 'Legacy body');
    expect(matter(state.files.get(file(bob))!).data.title).toBe('Legacy update');
    expect(state.files.get(file(alice))).toBe(aliceBytes);
    await deletePost(SLUG);
    expect(state.files.has(file(bob))).toBe(false);
    expect(state.files.get(file(alice))).toBe(aliceBytes);
  });
});
