import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { configure, resetConfig } from '../../src/profile-loader/config.js';
import {
  loadProfilesServer,
  getPublishedProfilesServer,
  getFeaturedProfilesServer,
  getProfileBySlugServer,
  getProfilesByRoleServer,
  getProfilesByTagServer,
  getAllRolesServer,
  getAllProfileTagsServer,
  searchProfilesServer,
  getRandomProfilesServer,
} from '../../src/profile-loader/profile-loader.js';




function createProfileFile(
  dir: string,
  filename: string,
  frontmatter: Record<string, any>,
  content: string = '',
): void {
  const fm = Object.entries(frontmatter)
    .map(([k, v]) => {
      if (Array.isArray(v)) {
        return `${k}:\n${v.map((i) => `  - ${JSON.stringify(i)}`).join('\n')}`;
      }
      if (typeof v === 'object' && v !== null) {
        return `${k}: ${JSON.stringify(v)}`;
      }
      return `${k}: ${JSON.stringify(v)}`;
    })
    .join('\n');
  writeFileSync(join(dir, filename), `---\n${fm}\n---\n${content}`);
}

let tmpDir: string;
let profilesDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'profile-loader-test-'));
  profilesDir = join(tmpDir, 'profiles');
  mkdirSync(profilesDir, { recursive: true });
  resetConfig();
  configure({ baseDir: tmpDir, contentSubPath: 'profiles' });
});

afterEach(() => {
  resetConfig();
  rmSync(tmpDir, { recursive: true, force: true });
});




describe('loadProfilesServer', () => {
  it('should load .md files', () => {
    createProfileFile(profilesDir, 'alice.md', { name: 'Alice' });
    const profiles = loadProfilesServer();
    expect(profiles).toHaveLength(1);
    expect(profiles[0].frontmatter.name).toBe('Alice');
  });

  it('should load .mdx files', () => {
    createProfileFile(profilesDir, 'bob.mdx', { name: 'Bob' });
    const profiles = loadProfilesServer();
    expect(profiles).toHaveLength(1);
    expect(profiles[0].frontmatter.name).toBe('Bob');
  });

  it('should load .svx files', () => {
    createProfileFile(profilesDir, 'carol.svx', { name: 'Carol' });
    const profiles = loadProfilesServer();
    expect(profiles).toHaveLength(1);
    expect(profiles[0].frontmatter.name).toBe('Carol');
  });

  it('should load all markdown extensions at once', () => {
    createProfileFile(profilesDir, 'a.md', { name: 'A' });
    createProfileFile(profilesDir, 'b.mdx', { name: 'B' });
    createProfileFile(profilesDir, 'c.svx', { name: 'C' });
    const profiles = loadProfilesServer();
    expect(profiles).toHaveLength(3);
  });

  it('should ignore non-markdown files', () => {
    createProfileFile(profilesDir, 'alice.md', { name: 'Alice' });
    writeFileSync(join(profilesDir, 'notes.txt'), 'not a profile');
    writeFileSync(join(profilesDir, 'data.json'), '{}');
    writeFileSync(join(profilesDir, 'image.png'), 'binary');
    const profiles = loadProfilesServer();
    expect(profiles).toHaveLength(1);
  });

  it('should parse frontmatter correctly', () => {
    createProfileFile(profilesDir, 'alice.md', {
      name: 'Alice Smith',
      role: 'developer',
      bio: 'A talented developer',
      tags: ['typescript', 'svelte'],
    });
    const profiles = loadProfilesServer();
    expect(profiles[0].frontmatter.name).toBe('Alice Smith');
    expect(profiles[0].frontmatter.role).toBe('developer');
    expect(profiles[0].frontmatter.bio).toBe('A talented developer');
    expect(profiles[0].frontmatter.tags).toEqual(['typescript', 'svelte']);
  });

  it('should set default layout to profile', () => {
    createProfileFile(profilesDir, 'alice.md', { name: 'Alice' });
    const profiles = loadProfilesServer();
    expect(profiles[0].frontmatter.layout).toBe('profile');
  });

  it('should preserve custom layout from frontmatter', () => {
    createProfileFile(profilesDir, 'alice.md', { name: 'Alice', layout: 'custom' });
    const profiles = loadProfilesServer();
    expect(profiles[0].frontmatter.layout).toBe('custom');
  });

  it('should use frontmatter.slug over filename-derived slug', () => {
    createProfileFile(profilesDir, 'alice-smith.md', { name: 'Alice', slug: 'alice' });
    const profiles = loadProfilesServer();
    expect(profiles[0].slug).toBe('alice');
    expect(profiles[0].frontmatter.slug).toBe('alice');
  });

  it('should derive slug from filename when frontmatter.slug is not set', () => {
    createProfileFile(profilesDir, 'bob-jones.md', { name: 'Bob' });
    const profiles = loadProfilesServer();
    expect(profiles[0].slug).toBe('bob-jones');
  });

  it('should strip extension from filename for slug', () => {
    createProfileFile(profilesDir, 'my-profile.mdx', { name: 'Test' });
    const profiles = loadProfilesServer();
    expect(profiles[0].slug).toBe('my-profile');
  });

  it('should extract markdown content body', () => {
    createProfileFile(profilesDir, 'alice.md', { name: 'Alice' }, 'Hello, I am Alice.');
    const profiles = loadProfilesServer();
    expect(profiles[0].content).toContain('Hello, I am Alice.');
  });

  it('should sort by displayOrder when both profiles have it', () => {
    createProfileFile(profilesDir, 'b.md', { name: 'B', displayOrder: 2 });
    createProfileFile(profilesDir, 'a.md', { name: 'A', displayOrder: 1 });
    createProfileFile(profilesDir, 'c.md', { name: 'C', displayOrder: 3 });
    const profiles = loadProfilesServer();
    expect(profiles.map((p) => p.frontmatter.name)).toEqual(['A', 'B', 'C']);
  });

  it('should sort alphabetically by name when no displayOrder', () => {
    createProfileFile(profilesDir, 'z.md', { name: 'Zara' });
    createProfileFile(profilesDir, 'a.md', { name: 'Alice' });
    createProfileFile(profilesDir, 'm.md', { name: 'Monica' });
    const profiles = loadProfilesServer();
    expect(profiles.map((p) => p.frontmatter.name)).toEqual(['Alice', 'Monica', 'Zara']);
  });

  it('should use displayName as fallback for sorting when name is absent', () => {
    createProfileFile(profilesDir, 'z.md', { displayName: 'Zara' });
    createProfileFile(profilesDir, 'a.md', { displayName: 'Alice' });
    const profiles = loadProfilesServer();
    expect(profiles.map((p) => p.frontmatter.displayName)).toEqual(['Alice', 'Zara']);
  });

  it('should handle mixed displayOrder and name sorting', () => {
    createProfileFile(profilesDir, 'b.md', { name: 'B', displayOrder: 2 });
    createProfileFile(profilesDir, 'a.md', { name: 'A', displayOrder: 1 });
    createProfileFile(profilesDir, 'c.md', { name: 'C' });
    const profiles = loadProfilesServer();
    
    
    expect(profiles[0].frontmatter.name).toBe('A');
  });

  it('should return empty array when directory does not exist', () => {
    configure({ baseDir: '/nonexistent/path', contentSubPath: 'profiles' });
    const profiles = loadProfilesServer();
    expect(profiles).toEqual([]);
  });

  it('should return empty array when directory is empty', () => {
    const profiles = loadProfilesServer();
    expect(profiles).toEqual([]);
  });

  it('should handle profiles with no frontmatter fields', () => {
    writeFileSync(join(profilesDir, 'empty.md'), '---\n---\nJust content');
    const profiles = loadProfilesServer();
    expect(profiles).toHaveLength(1);
    expect(profiles[0].slug).toBe('empty');
    expect(profiles[0].frontmatter.layout).toBe('profile');
    expect(profiles[0].content).toContain('Just content');
  });

  it('should handle profiles with extra arbitrary frontmatter keys', () => {
    createProfileFile(profilesDir, 'alice.md', {
      name: 'Alice',
      customField: 'custom-value',
      anotherField: 42,
    });
    const profiles = loadProfilesServer();
    expect(profiles[0].frontmatter.customField).toBe('custom-value');
    expect(profiles[0].frontmatter.anotherField).toBe(42);
  });

  it('should respect custom contentSubPath', () => {
    const customDir = join(tmpDir, 'custom', 'people');
    mkdirSync(customDir, { recursive: true });
    createProfileFile(customDir, 'alice.md', { name: 'Alice' });
    configure({ baseDir: tmpDir, contentSubPath: 'custom/people' });
    const profiles = loadProfilesServer();
    expect(profiles).toHaveLength(1);
    expect(profiles[0].frontmatter.name).toBe('Alice');
  });

  it('should handle multiple profiles with same displayOrder', () => {
    createProfileFile(profilesDir, 'a.md', { name: 'Alpha', displayOrder: 1 });
    createProfileFile(profilesDir, 'b.md', { name: 'Beta', displayOrder: 1 });
    const profiles = loadProfilesServer();
    expect(profiles).toHaveLength(2);
  });

  it('should handle boolean frontmatter values correctly', () => {
    createProfileFile(profilesDir, 'a.md', { name: 'A', featured: true, hidden: false });
    const profiles = loadProfilesServer();
    expect(profiles[0].frontmatter.featured).toBe(true);
    expect(profiles[0].frontmatter.hidden).toBe(false);
  });
});




describe('getPublishedProfilesServer', () => {
  it('should return profiles with visibility=published', () => {
    createProfileFile(profilesDir, 'pub.md', { name: 'Published', visibility: 'published' });
    createProfileFile(profilesDir, 'draft.md', { name: 'Draft', visibility: 'draft' });
    const profiles = getPublishedProfilesServer();
    expect(profiles).toHaveLength(1);
    expect(profiles[0].frontmatter.name).toBe('Published');
  });

  it('should exclude profiles with visibility=draft', () => {
    createProfileFile(profilesDir, 'draft.md', { name: 'Draft', visibility: 'draft' });
    const profiles = getPublishedProfilesServer();
    expect(profiles).toHaveLength(0);
  });

  it('should exclude profiles with visibility=private', () => {
    createProfileFile(profilesDir, 'priv.md', { name: 'Private', visibility: 'private' });
    const profiles = getPublishedProfilesServer();
    expect(profiles).toHaveLength(0);
  });

  it('should include profiles with no visibility field and published not false (legacy)', () => {
    createProfileFile(profilesDir, 'legacy.md', { name: 'Legacy' });
    const profiles = getPublishedProfilesServer();
    expect(profiles).toHaveLength(1);
  });

  it('should include profiles with published=true (legacy)', () => {
    createProfileFile(profilesDir, 'legacy.md', { name: 'Legacy', published: true });
    const profiles = getPublishedProfilesServer();
    expect(profiles).toHaveLength(1);
  });

  it('should exclude profiles with published=false (legacy)', () => {
    createProfileFile(profilesDir, 'unpub.md', { name: 'Unpublished', published: false });
    const profiles = getPublishedProfilesServer();
    expect(profiles).toHaveLength(0);
  });

  it('should exclude profiles with hidden=true (legacy)', () => {
    createProfileFile(profilesDir, 'hidden.md', { name: 'Hidden', hidden: true });
    const profiles = getPublishedProfilesServer();
    expect(profiles).toHaveLength(0);
  });

  it('should include profiles with hidden=false (legacy)', () => {
    createProfileFile(profilesDir, 'visible.md', { name: 'Visible', hidden: false });
    const profiles = getPublishedProfilesServer();
    expect(profiles).toHaveLength(1);
  });

  it('should prioritize visibility field over legacy published/hidden', () => {
    createProfileFile(profilesDir, 'mixed.md', {
      name: 'Mixed',
      visibility: 'published',
      published: false,
      hidden: true,
    });
    const profiles = getPublishedProfilesServer();
    expect(profiles).toHaveLength(1);
  });

  it('should return empty array when no profiles are published', () => {
    createProfileFile(profilesDir, 'a.md', { name: 'A', visibility: 'draft' });
    createProfileFile(profilesDir, 'b.md', { name: 'B', published: false });
    const profiles = getPublishedProfilesServer();
    expect(profiles).toHaveLength(0);
  });
});




describe('getFeaturedProfilesServer', () => {
  it('should return only featured=true profiles', () => {
    createProfileFile(profilesDir, 'feat.md', { name: 'Featured', featured: true });
    createProfileFile(profilesDir, 'nonfeat.md', { name: 'NonFeatured', featured: false });
    createProfileFile(profilesDir, 'noflag.md', { name: 'NoFlag' });
    const profiles = getFeaturedProfilesServer();
    expect(profiles).toHaveLength(1);
    expect(profiles[0].frontmatter.name).toBe('Featured');
  });

  it('should only include published profiles', () => {
    createProfileFile(profilesDir, 'feat.md', {
      name: 'Featured',
      featured: true,
      visibility: 'draft',
    });
    const profiles = getFeaturedProfilesServer();
    expect(profiles).toHaveLength(0);
  });

  it('should return empty array when no featured profiles exist', () => {
    createProfileFile(profilesDir, 'a.md', { name: 'A' });
    const profiles = getFeaturedProfilesServer();
    expect(profiles).toHaveLength(0);
  });

  it('should return multiple featured profiles', () => {
    createProfileFile(profilesDir, 'a.md', { name: 'A', featured: true });
    createProfileFile(profilesDir, 'b.md', { name: 'B', featured: true });
    const profiles = getFeaturedProfilesServer();
    expect(profiles).toHaveLength(2);
  });

  it('should not include featured but hidden profiles', () => {
    createProfileFile(profilesDir, 'a.md', { name: 'A', featured: true, hidden: true });
    const profiles = getFeaturedProfilesServer();
    expect(profiles).toHaveLength(0);
  });
});




describe('getProfileBySlugServer', () => {
  it('should find a profile by slug', () => {
    createProfileFile(profilesDir, 'alice.md', { name: 'Alice' });
    const profile = getProfileBySlugServer('alice');
    expect(profile).not.toBeNull();
    expect(profile!.frontmatter.name).toBe('Alice');
  });

  it('should find a profile by frontmatter slug', () => {
    createProfileFile(profilesDir, 'alice-smith.md', { name: 'Alice', slug: 'alice' });
    const profile = getProfileBySlugServer('alice');
    expect(profile).not.toBeNull();
    expect(profile!.frontmatter.name).toBe('Alice');
  });

  it('should return null for unknown slug', () => {
    createProfileFile(profilesDir, 'alice.md', { name: 'Alice' });
    const profile = getProfileBySlugServer('nonexistent');
    expect(profile).toBeNull();
  });

  it('should return null when no profiles exist', () => {
    const profile = getProfileBySlugServer('anything');
    expect(profile).toBeNull();
  });

  it('should find unpublished profiles by slug', () => {
    createProfileFile(profilesDir, 'draft.md', { name: 'Draft', visibility: 'draft' });
    const profile = getProfileBySlugServer('draft');
    expect(profile).not.toBeNull();
    expect(profile!.frontmatter.name).toBe('Draft');
  });
});




describe('getProfilesByRoleServer', () => {
  it('should filter by single role field', () => {
    createProfileFile(profilesDir, 'dev.md', { name: 'Dev', role: 'developer' });
    createProfileFile(profilesDir, 'mgr.md', { name: 'Mgr', role: 'manager' });
    const profiles = getProfilesByRoleServer('developer');
    expect(profiles).toHaveLength(1);
    expect(profiles[0].frontmatter.name).toBe('Dev');
  });

  it('should filter by roles array', () => {
    createProfileFile(profilesDir, 'multi.md', {
      name: 'Multi',
      roles: ['developer', 'designer'],
    });
    const profiles = getProfilesByRoleServer('designer');
    expect(profiles).toHaveLength(1);
    expect(profiles[0].frontmatter.name).toBe('Multi');
  });

  it('should match both role and roles', () => {
    createProfileFile(profilesDir, 'a.md', { name: 'A', role: 'developer' });
    createProfileFile(profilesDir, 'b.md', { name: 'B', roles: ['developer', 'lead'] });
    const profiles = getProfilesByRoleServer('developer');
    expect(profiles).toHaveLength(2);
  });

  it('should return empty array for non-matching role', () => {
    createProfileFile(profilesDir, 'a.md', { name: 'A', role: 'developer' });
    const profiles = getProfilesByRoleServer('accountant');
    expect(profiles).toHaveLength(0);
  });

  it('should only include published profiles', () => {
    createProfileFile(profilesDir, 'a.md', {
      name: 'A',
      role: 'developer',
      visibility: 'draft',
    });
    const profiles = getProfilesByRoleServer('developer');
    expect(profiles).toHaveLength(0);
  });
});




describe('getProfilesByTagServer', () => {
  it('should filter by tags array', () => {
    createProfileFile(profilesDir, 'a.md', { name: 'A', tags: ['svelte', 'typescript'] });
    createProfileFile(profilesDir, 'b.md', { name: 'B', tags: ['react'] });
    const profiles = getProfilesByTagServer('svelte');
    expect(profiles).toHaveLength(1);
    expect(profiles[0].frontmatter.name).toBe('A');
  });

  it('should filter by interests array', () => {
    createProfileFile(profilesDir, 'a.md', { name: 'A', interests: ['music', 'coding'] });
    const profiles = getProfilesByTagServer('music');
    expect(profiles).toHaveLength(1);
  });

  it('should match both tags and interests', () => {
    createProfileFile(profilesDir, 'a.md', { name: 'A', tags: ['svelte'] });
    createProfileFile(profilesDir, 'b.md', { name: 'B', interests: ['svelte'] });
    const profiles = getProfilesByTagServer('svelte');
    expect(profiles).toHaveLength(2);
  });

  it('should return empty array for non-matching tag', () => {
    createProfileFile(profilesDir, 'a.md', { name: 'A', tags: ['svelte'] });
    const profiles = getProfilesByTagServer('rust');
    expect(profiles).toHaveLength(0);
  });

  it('should only include published profiles', () => {
    createProfileFile(profilesDir, 'a.md', {
      name: 'A',
      tags: ['svelte'],
      visibility: 'draft',
    });
    const profiles = getProfilesByTagServer('svelte');
    expect(profiles).toHaveLength(0);
  });
});




describe('getAllRolesServer', () => {
  it('should collect unique roles from role field', () => {
    createProfileFile(profilesDir, 'a.md', { name: 'A', role: 'developer' });
    createProfileFile(profilesDir, 'b.md', { name: 'B', role: 'designer' });
    const roles = getAllRolesServer();
    expect(roles).toEqual(['designer', 'developer']);
  });

  it('should collect unique roles from roles array', () => {
    createProfileFile(profilesDir, 'a.md', {
      name: 'A',
      roles: ['developer', 'lead'],
    });
    const roles = getAllRolesServer();
    expect(roles).toEqual(['developer', 'lead']);
  });

  it('should deduplicate roles across profiles', () => {
    createProfileFile(profilesDir, 'a.md', { name: 'A', role: 'developer' });
    createProfileFile(profilesDir, 'b.md', { name: 'B', role: 'developer' });
    const roles = getAllRolesServer();
    expect(roles).toEqual(['developer']);
  });

  it('should return sorted roles', () => {
    createProfileFile(profilesDir, 'a.md', { name: 'A', role: 'zookeeper' });
    createProfileFile(profilesDir, 'b.md', { name: 'B', role: 'accountant' });
    createProfileFile(profilesDir, 'c.md', { name: 'C', role: 'manager' });
    const roles = getAllRolesServer();
    expect(roles).toEqual(['accountant', 'manager', 'zookeeper']);
  });

  it('should return empty array when no roles exist', () => {
    createProfileFile(profilesDir, 'a.md', { name: 'A' });
    const roles = getAllRolesServer();
    expect(roles).toEqual([]);
  });
});




describe('getAllProfileTagsServer', () => {
  it('should collect unique tags', () => {
    createProfileFile(profilesDir, 'a.md', { name: 'A', tags: ['svelte', 'typescript'] });
    createProfileFile(profilesDir, 'b.md', { name: 'B', tags: ['react', 'typescript'] });
    const tags = getAllProfileTagsServer();
    expect(tags).toEqual(['react', 'svelte', 'typescript']);
  });

  it('should collect unique interests', () => {
    createProfileFile(profilesDir, 'a.md', { name: 'A', interests: ['music', 'coding'] });
    const tags = getAllProfileTagsServer();
    expect(tags).toEqual(['coding', 'music']);
  });

  it('should merge tags and interests', () => {
    createProfileFile(profilesDir, 'a.md', {
      name: 'A',
      tags: ['svelte'],
      interests: ['music'],
    });
    const tags = getAllProfileTagsServer();
    expect(tags).toEqual(['music', 'svelte']);
  });

  it('should return sorted tags', () => {
    createProfileFile(profilesDir, 'a.md', { name: 'A', tags: ['zebra', 'apple'] });
    const tags = getAllProfileTagsServer();
    expect(tags).toEqual(['apple', 'zebra']);
  });

  it('should return empty array when no tags or interests exist', () => {
    createProfileFile(profilesDir, 'a.md', { name: 'A' });
    const tags = getAllProfileTagsServer();
    expect(tags).toEqual([]);
  });
});




describe('searchProfilesServer', () => {
  it('should search by name', () => {
    createProfileFile(profilesDir, 'alice.md', { name: 'Alice Smith' });
    createProfileFile(profilesDir, 'bob.md', { name: 'Bob Jones' });
    const results = searchProfilesServer('alice');
    expect(results).toHaveLength(1);
    expect(results[0].frontmatter.name).toBe('Alice Smith');
  });

  it('should search by displayName', () => {
    createProfileFile(profilesDir, 'a.md', { displayName: 'Alice Smith' });
    const results = searchProfilesServer('alice');
    expect(results).toHaveLength(1);
  });

  it('should search by bio', () => {
    createProfileFile(profilesDir, 'a.md', { name: 'Alice', bio: 'Expert in TypeScript' });
    const results = searchProfilesServer('typescript');
    expect(results).toHaveLength(1);
  });

  it('should search by role', () => {
    createProfileFile(profilesDir, 'a.md', { name: 'Alice', role: 'Senior Developer' });
    const results = searchProfilesServer('developer');
    expect(results).toHaveLength(1);
  });

  it('should search in markdown content', () => {
    createProfileFile(
      profilesDir,
      'a.md',
      { name: 'Alice' },
      'Alice loves building web applications with Svelte.',
    );
    const results = searchProfilesServer('svelte');
    expect(results).toHaveLength(1);
  });

  it('should be case insensitive', () => {
    createProfileFile(profilesDir, 'a.md', { name: 'Alice Smith' });
    expect(searchProfilesServer('ALICE')).toHaveLength(1);
    expect(searchProfilesServer('alice')).toHaveLength(1);
    expect(searchProfilesServer('Alice')).toHaveLength(1);
  });

  it('should return empty array for no match', () => {
    createProfileFile(profilesDir, 'a.md', { name: 'Alice' });
    const results = searchProfilesServer('zzzzzzz');
    expect(results).toHaveLength(0);
  });

  it('should match partial strings', () => {
    createProfileFile(profilesDir, 'a.md', { name: 'Alice Wonderland' });
    const results = searchProfilesServer('wonder');
    expect(results).toHaveLength(1);
  });

  it('should return multiple matches', () => {
    createProfileFile(profilesDir, 'a.md', { name: 'Alice Developer' });
    createProfileFile(profilesDir, 'b.md', { name: 'Bob Developer' });
    const results = searchProfilesServer('developer');
    expect(results).toHaveLength(2);
  });

  it('should only search published profiles', () => {
    createProfileFile(profilesDir, 'a.md', { name: 'Alice', visibility: 'draft' });
    const results = searchProfilesServer('alice');
    expect(results).toHaveLength(0);
  });
});




describe('getRandomProfilesServer', () => {
  it('should return requested count', () => {
    createProfileFile(profilesDir, 'a.md', { name: 'A' });
    createProfileFile(profilesDir, 'b.md', { name: 'B' });
    createProfileFile(profilesDir, 'c.md', { name: 'C' });
    createProfileFile(profilesDir, 'd.md', { name: 'D' });
    createProfileFile(profilesDir, 'e.md', { name: 'E' });
    const profiles = getRandomProfilesServer(3);
    expect(profiles).toHaveLength(3);
  });

  it('should return only published profiles', () => {
    createProfileFile(profilesDir, 'pub.md', { name: 'Pub' });
    createProfileFile(profilesDir, 'draft.md', { name: 'Draft', visibility: 'draft' });
    const profiles = getRandomProfilesServer(10);
    expect(profiles).toHaveLength(1);
    expect(profiles[0].frontmatter.name).toBe('Pub');
  });

  it('should return fewer if not enough available', () => {
    createProfileFile(profilesDir, 'a.md', { name: 'A' });
    createProfileFile(profilesDir, 'b.md', { name: 'B' });
    const profiles = getRandomProfilesServer(5);
    expect(profiles).toHaveLength(2);
  });

  it('should default to 3', () => {
    for (let i = 0; i < 10; i++) {
      createProfileFile(profilesDir, `p${i}.md`, { name: `Profile ${i}` });
    }
    const profiles = getRandomProfilesServer();
    expect(profiles).toHaveLength(3);
  });

  it('should return empty array when no profiles exist', () => {
    const profiles = getRandomProfilesServer(3);
    expect(profiles).toHaveLength(0);
  });
});
