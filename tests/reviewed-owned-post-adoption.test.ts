import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { linkSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import matter from 'gray-matter';
import { configureContent, resetContentConfig } from '../src/config.js';
import {
  adoptReviewedOwnedPost, deleteOwnedPost, loadOwnedPost, updateOwnedPost,
  type PostOwner, type ReviewedOwnedPostAdoption,
} from '../src/services/ContentLoaderService.js';

const owner: PostOwner = { id: 'reviewed-owner-id', handle: 'jesssullivan' };
const slug = 'retained-draft';
let root: string;

function livePath(extension: 'md' | 'mdx' = 'md'): string {
  return join(root, 'users', owner.handle, 'blog', `${slug}.${extension}`);
}

function source(metadata: Record<string, unknown> = {}, content = 'Original body.\n'): string {
  return matter.stringify(content, {
    title: 'Retained title', tags: ['old'], author: { handle: owner.handle, name: 'Jess' },
    published: true, visibility: 'public', publicFediverseDelivery: true, ...metadata,
  });
}

function digest(path = livePath()): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function input(overrides: Partial<ReviewedOwnedPostAdoption> = {}): ReviewedOwnedPostAdoption {
  return {
    owner, slug,
    source: overrides.source ?? { extension: 'md', rawSha256: digest() },
    planned: { metadata: { title: 'Explicit edit', updatedAt: '2026-09-24T00:00:00.000Z' }, content: 'Saved body.\n' },
    verifyProof: async () => {},
    ...overrides,
  };
}

beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), 'tinyland-reviewed-post-')));
  mkdirSync(join(root, 'users', owner.handle, 'blog'), { recursive: true });
  configureContent({ contentDir: root });
});

afterEach(() => {
  resetContentConfig();
  rmSync(root, { recursive: true, force: true });
});

describe('one-shot reviewed live-source adoption', () => {
  it('calls proof with the exact source, forces a private owner-bound draft, and returns actual readback', async () => {
    writeFileSync(livePath(), source({ tinyland: { publicFediverseDelivery: true, marker: 'retained' } }));
    const observed: unknown[] = [];
    const adopted = await adoptReviewedOwnedPost(input({
      planned: {
        metadata: {
          title: 'Explicit edit', updatedAt: '2026-09-24T00:00:00.000Z',
          published: true, visibility: 'public', publicFediverseDelivery: true,
        },
        content: 'Saved body.\n',
      },
      verifyProof: async (proof) => { observed.push(proof); },
    }));
    expect(observed).toEqual([{
      owner, slug, extension: 'md', rawSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    }]);
    expect(adopted).toMatchObject({
      content: 'Saved body.\n', metadata: {
        title: 'Explicit edit', tags: ['old'], updatedAt: '2026-09-24T00:00:00.000Z',
        authorId: owner.id, author: { id: owner.id, handle: owner.handle, name: 'Jess' },
        published: false, draft: true, status: 'draft', visibility: 'private',
        fediverseVisibility: 'private', publicFediverseDelivery: false,
        tinyland: { publicFediverseDelivery: false, marker: 'retained' },
      },
    });
    expect(adopted.rawSha256).toBe(digest());
    expect(readdirSync(join(root, 'users', owner.handle, 'blog'))).toEqual([`${slug}.md`]);
    await expect(loadOwnedPost(owner, slug)).resolves.toMatchObject({ content: 'Saved body.\n' });
    await updateOwnedPost(owner, slug, { title: 'Normal strict edit' });
    expect(matter(readFileSync(livePath(), 'utf-8')).data.title).toBe('Normal strict edit');
  });

  it('does not adopt on missing or rejected proof, and rechecks bytes after an awaited callback', async () => {
    const before = source();
    writeFileSync(livePath(), before);
    await expect(adoptReviewedOwnedPost(input({ verifyProof: async () => { throw new Error('Proof denied'); } })))
      .rejects.toThrow('Proof denied');
    expect(readFileSync(livePath(), 'utf-8')).toBe(before);

    await expect(adoptReviewedOwnedPost(input({ verifyProof: async () => {
      writeFileSync(livePath(), source({ title: 'Changed during proof' }));
    } }))).rejects.toThrow('Retained post source changed');
    expect(matter(readFileSync(livePath(), 'utf-8')).data.title).toBe('Changed during proof');
  });

  it('keeps the expected source and planned revision fixed across the proof await', async () => {
    writeFileSync(livePath(), source());
    const request = input();
    request.verifyProof = async () => {
      request.source.rawSha256 = '0'.repeat(64);
      request.planned.content = 'Mutated request body';
      request.planned.metadata.title = 'Mutated request title';
    };
    const result = await adoptReviewedOwnedPost(request);
    expect(result.content).toBe('Saved body.\n');
    expect(result.metadata.title).toBe('Explicit edit');
  });

  it('denies malformed source without returning its private YAML excerpt', async () => {
    const secret = 'PRIVATE_RETAINED_SOURCE_SENTINEL';
    writeFileSync(livePath(), `---\ntitle: [${secret}\n---\nPrivate body`);
    let reported: unknown;
    try {
      await adoptReviewedOwnedPost(input());
    } catch (error) {
      reported = error;
    }
    expect(reported).toBeInstanceOf(Error);
    expect(String(reported)).not.toContain(secret);
    expect(readFileSync(livePath(), 'utf-8')).toContain(secret);
  });

  it('denies oversized or hard-linked source before proof and oversized output before replacement', async () => {
    writeFileSync(livePath(), Buffer.alloc(4 * 1024 * 1024 + 1, 65));
    let called = false;
    await expect(adoptReviewedOwnedPost(input({ verifyProof: async () => { called = true; } })))
      .rejects.toThrow('Unsafe or oversized retained post source');
    expect(called).toBe(false);

    writeFileSync(livePath(), source());
    const other = join(root, 'hardlink.md');
    linkSync(livePath(), other);
    await expect(adoptReviewedOwnedPost(input())).rejects.toThrow('Unsafe or oversized retained post source');
    rmSync(other);

    const before = readFileSync(livePath());
    await expect(adoptReviewedOwnedPost(input({
      planned: { metadata: {}, content: 'A'.repeat(4 * 1024 * 1024) },
    }))).rejects.toThrow('Retained post revision too large');
    expect(readFileSync(livePath()).equals(before)).toBe(true);
  });

  it.each([
    { authorId: owner.id }, { authorId: null }, { author: { id: owner.id, handle: owner.handle } },
    { author: { id: 'foreign', handle: owner.handle } }, { author: { handle: 'foreign' } },
    { ownerId: 'foreign' }, { userId: owner.id }, { id: owner.id },
    { tinyland: { owner: { handle: 'foreign' } } },
    { tinyland: { asset: { id: 'foreign' } } },
  ])('rejects an existing owner anchor or foreign handle %j', async (metadata) => {
    const before = source(metadata);
    writeFileSync(livePath(), before);
    let called = false;
    await expect(adoptReviewedOwnedPost(input({ verifyProof: async () => { called = true; } }))).rejects.toThrow();
    expect(called).toBe(false);
    expect(readFileSync(livePath(), 'utf-8')).toBe(before);
  });

  it('rejects caller-supplied owner IDs and stale digest before proof', async () => {
    writeFileSync(livePath(), source());
    let called = false;
    await expect(adoptReviewedOwnedPost(input({
      planned: { metadata: { authorId: owner.id }, content: 'Unsafe' },
      verifyProof: async () => { called = true; },
    }))).rejects.toThrow('Retained post identity is not adoptable');
    await expect(adoptReviewedOwnedPost(input({
      planned: { metadata: { tinyland: { nested: { ownerId: owner.id } } }, content: 'Unsafe' },
      verifyProof: async () => { called = true; },
    }))).rejects.toThrow('Retained post identity is not adoptable');
    await expect(adoptReviewedOwnedPost(input({
      source: { extension: 'md', rawSha256: '0'.repeat(64) },
      verifyProof: async () => { called = true; },
    }))).rejects.toThrow('Retained post source changed');
    expect(called).toBe(false);
    expect(matter(readFileSync(livePath(), 'utf-8')).data.authorId).toBeUndefined();
  });

  it('forces planned nested delivery intent back to private without dropping unrelated nested fields', async () => {
    writeFileSync(livePath(), source());
    const adopted = await adoptReviewedOwnedPost(input({
      planned: {
        metadata: { tinyland: { publicFediverseDelivery: true, marker: 'requested' } },
        content: 'Saved body.\n',
      },
    }));
    expect(adopted.metadata.tinyland).toMatchObject({
      publicFediverseDelivery: false, marker: 'requested',
    });
  });

  it.each([{ tinyland: null }, { tinyland: 'legacy-malformed' }, { tinyland: ['legacy-malformed'] }])(
    'preserves a non-object legacy tinyland field while forcing top-level private status $tinyland', async ({ tinyland }) => {
      writeFileSync(livePath(), source({ tinyland }));
      const adopted = await adoptReviewedOwnedPost(input());
      expect(adopted.metadata.tinyland).toEqual(tinyland);
      expect(adopted.metadata).toMatchObject({
        published: false, visibility: 'private', publicFediverseDelivery: false,
      });
    }
  );

  it('rejects changed or introduced malformed tinyland values before writing', async () => {
    writeFileSync(livePath(), source({ tinyland: 'legacy-malformed' }));
    const before = readFileSync(livePath());
    const exact = await adoptReviewedOwnedPost(input({
      planned: { metadata: { tinyland: 'legacy-malformed' }, content: 'Saved body.\n' },
    }));
    expect(exact.metadata.tinyland).toBe('legacy-malformed');
    writeFileSync(livePath(), before);
    await expect(adoptReviewedOwnedPost(input({
      planned: { metadata: { tinyland: ['different'] }, content: 'Saved body.\n' },
    }))).rejects.toThrow('Invalid retained post publication metadata');
    expect(readFileSync(livePath()).equals(before)).toBe(true);

    writeFileSync(livePath(), source());
    await expect(adoptReviewedOwnedPost(input({
      planned: { metadata: { tinyland: null }, content: 'Saved body.\n' },
    }))).rejects.toThrow('Invalid retained post publication metadata');
  });

  it('rejects duplicate extensions and a symlinked source without writing', async () => {
    writeFileSync(livePath(), source());
    const before = readFileSync(livePath());
    writeFileSync(livePath('mdx'), source({ title: 'Ambiguous' }));
    await expect(adoptReviewedOwnedPost(input())).rejects.toThrow('Unsafe or ambiguous retained post source');
    expect(readFileSync(livePath()).equals(before)).toBe(true);

    rmSync(livePath('mdx'));
    const target = join(root, 'outside.md');
    writeFileSync(target, source());
    rmSync(livePath());
    symlinkSync(target, livePath());
    await expect(adoptReviewedOwnedPost(input({ source: { extension: 'md', rawSha256: digest(target) } })))
      .rejects.toThrow('Unsafe or ambiguous retained post source');
    expect(matter(readFileSync(target, 'utf-8')).data.authorId).toBeUndefined();
  });

  it('rejects a symlinked ancestor of the live source', async () => {
    const realHandle = join(root, 'real-handle');
    mkdirSync(join(realHandle, 'blog'), { recursive: true });
    writeFileSync(join(realHandle, 'blog', `${slug}.md`), source());
    rmSync(join(root, 'users', owner.handle), { recursive: true });
    symlinkSync(realHandle, join(root, 'users', owner.handle));
    await expect(adoptReviewedOwnedPost(input())).rejects.toThrow('Unsafe retained post source');
    expect(matter(readFileSync(join(realHandle, 'blog', `${slug}.md`), 'utf-8')).data.authorId).toBeUndefined();
  });

  it('rejects a symlink ancestor above the configured content root', async () => {
    const physical = join(root, 'physical');
    const physicalContent = join(physical, 'content');
    mkdirSync(join(physicalContent, 'users', owner.handle, 'blog'), { recursive: true });
    const physicalPost = join(physicalContent, 'users', owner.handle, 'blog', `${slug}.md`);
    writeFileSync(physicalPost, source());
    symlinkSync(physical, join(root, 'alias-parent'));
    configureContent({ contentDir: join(root, 'alias-parent', 'content') });
    await expect(adoptReviewedOwnedPost(input({
      source: { extension: 'md', rawSha256: digest(physicalPost) },
    }))).rejects.toThrow('Unsafe retained post source');
    expect(matter(readFileSync(physicalPost, 'utf-8')).data.authorId).toBeUndefined();
  });

  it('does not copy or adopt a bundled-only source', async () => {
    const bundled = join(root, 'bundled');
    const bundledPath = join(bundled, 'users', owner.handle, 'blog', `${slug}.md`);
    mkdirSync(join(bundled, 'users', owner.handle, 'blog'), { recursive: true });
    writeFileSync(bundledPath, source());
    configureContent({ contentDir: root, bundledContentDir: bundled });
    await expect(adoptReviewedOwnedPost(input({ source: { extension: 'md', rawSha256: digest(bundledPath) } })))
      .rejects.toThrow();
    expect(matter(readFileSync(bundledPath, 'utf-8')).data.authorId).toBeUndefined();
  });

  it.each(['md', 'mdx'] as const)('denies deleting an adopted live post over a bundled .%s predecessor', async (extension) => {
    const bundled = join(root, 'bundled');
    const bundledPath = join(bundled, 'users', owner.handle, 'blog', `${slug}.${extension}`);
    mkdirSync(join(bundled, 'users', owner.handle, 'blog'), { recursive: true });
    const baseline = source({ title: 'Bundled public predecessor' });
    writeFileSync(bundledPath, baseline);
    writeFileSync(livePath(), source());
    configureContent({ contentDir: root, bundledContentDir: bundled });
    await adoptReviewedOwnedPost(input());
    const adoptedBytes = readFileSync(livePath());
    await expect(deleteOwnedPost(owner, slug)).rejects.toMatchObject({
      code: 'OWNED_POST_BUNDLED_BASELINE',
      message: 'Bundled baseline requires withdrawal instead of deletion',
    });
    expect(readFileSync(livePath()).equals(adoptedBytes)).toBe(true);
    expect(readFileSync(bundledPath, 'utf-8')).toBe(baseline);
    await updateOwnedPost(owner, slug, {
      published: false, draft: true, visibility: 'private', publicFediverseDelivery: false,
    });
    expect(matter(readFileSync(livePath(), 'utf-8')).data).toMatchObject({
      authorId: owner.id, published: false, draft: true, visibility: 'private',
    });
    expect(readFileSync(bundledPath, 'utf-8')).toBe(baseline);
  });
});
