import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, renameSync, fsyncSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import matter from 'gray-matter';
import { configureContent, resetContentConfig } from '../src/config.js';
import { deleteOwnedPost, loadOwnedPost, updateOwnedPost, type PostOwner } from '../src/services/ContentLoaderService.js';

vi.mock('fs', async (importOriginal) => {
  const original = await importOriginal<typeof import('fs')>();
  return { ...original, renameSync: vi.fn(original.renameSync), writeFileSync: vi.fn(original.writeFileSync), fsyncSync: vi.fn(original.fsyncSync) };
});

const alice: PostOwner = { id: 'alice-stable-id', handle: 'alice' };
const bob: PostOwner = { id: 'bob-stable-id', handle: 'bob' };
const slug = 'shared-draft';
let contentDir: string;

function postPath(owner: PostOwner): string {
  return join(contentDir, 'users', owner.handle, 'blog', `${slug}.md`);
}

function seed(owner: PostOwner): string {
  mkdirSync(join(contentDir, 'users', owner.handle, 'blog'), { recursive: true });
  const bytes = matter.stringify(`${owner.handle}'s retained draft.\n`, {
    title: 'A title: with # hash\nand a newline',
    tags: ['one', 'two'], published: false, visibility: 'private',
    authorId: owner.id, author: { id: owner.id, handle: owner.handle },
  });
  writeFileSync(postPath(owner), bytes);
  return bytes;
}

beforeEach(() => {
  contentDir = mkdtempSync(join(tmpdir(), 'tinyland-owned-posts-'));
  configureContent({ contentDir });
});

afterEach(() => {
  vi.mocked(renameSync).mockClear();
  vi.mocked(writeFileSync).mockClear();
  vi.mocked(fsyncSync).mockClear();
  resetContentConfig();
  rmSync(contentDir, { recursive: true, force: true });
});

describe('owned Markdown persistence on a real filesystem', () => {
  it('roundtrips author metadata and isolates the same slug through reload and deletion', async () => {
    seed(alice);
    const bobBefore = seed(bob);
    await updateOwnedPost(alice, slug, { title: 'Changed: # safely\nagain' }, 'The complete new body.\n');
    resetContentConfig();
    configureContent({ contentDir });

    await expect(loadOwnedPost(alice, slug)).resolves.toMatchObject({
      authorHandle: alice.handle, content: 'The complete new body.\n',
      metadata: {
        title: 'Changed: # safely\nagain', tags: ['one', 'two'],
        authorId: alice.id, author: { id: alice.id, handle: alice.handle },
        published: false, visibility: 'private',
      },
    });
    expect(readFileSync(postPath(bob), 'utf-8')).toBe(bobBefore);
    expect(readdirSync(join(contentDir, 'users', alice.handle, 'blog'))).toEqual([`${slug}.md`]);

    await deleteOwnedPost(alice, slug);
    await expect(loadOwnedPost(alice, slug)).resolves.toBeNull();
    expect(readFileSync(postPath(bob), 'utf-8')).toBe(bobBefore);
  });

  it('preserves the previous complete revision when replacement fails and propagates the failure', async () => {
    const before = seed(alice);
    vi.mocked(renameSync).mockImplementationOnce(() => {
      throw Object.assign(new Error('Injected rename failure'), { code: 'EIO' });
    });

    await expect(updateOwnedPost(alice, slug, { title: 'Must not appear' }, 'Must not replace')).rejects.toThrow('Injected rename failure');
    expect(readFileSync(postPath(alice), 'utf-8')).toBe(before);
    expect(readdirSync(join(contentDir, 'users', alice.handle, 'blog'))).toEqual([`${slug}.md`]);
    await expect(loadOwnedPost(alice, slug)).resolves.toMatchObject({ content: "alice's retained draft.\n" });
  });

  it('cleans an incompletely written temporary file without truncating live Markdown', async () => {
    const before = seed(alice);
    const actualWrite = vi.mocked(writeFileSync).getMockImplementation()!;
    vi.mocked(writeFileSync).mockImplementationOnce((path) => {
      actualWrite(path, 'incomplete temporary bytes');
      throw Object.assign(new Error('Injected disk full'), { code: 'ENOSPC' });
    });

    await expect(updateOwnedPost(alice, slug, {}, 'Must not replace')).rejects.toThrow('Injected disk full');
    expect(readFileSync(postPath(alice), 'utf-8')).toBe(before);
    expect(readdirSync(join(contentDir, 'users', alice.handle, 'blog'))).toEqual([`${slug}.md`]);
    expect(renameSync).not.toHaveBeenCalled();
  });

  it('does not acknowledge a deletion whose directory flush fails', async () => {
    seed(alice);
    vi.mocked(fsyncSync).mockImplementationOnce(() => {
      throw Object.assign(new Error('Injected directory flush failure'), { code: 'EIO' });
    });
    await expect(deleteOwnedPost(alice, slug)).rejects.toThrow('Injected directory flush failure');
    expect(fsyncSync).toHaveBeenCalledTimes(1);
    // Unlink happened, but callers must retain their pending tombstone record
    // because durable completion was not acknowledged.
    expect(readdirSync(join(contentDir, 'users', alice.handle, 'blog'))).toEqual([]);
  });
});
