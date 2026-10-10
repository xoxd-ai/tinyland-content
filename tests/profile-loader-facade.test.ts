import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import * as content from '../src/index.js';
import * as profileLoader from '../src/profile-loader/index.js';

// tummycrypt_tinyland_profile_loader was merged into this module. The
// ./profile-loader subpath keeps its exact API; the root facade keeps the
// aliased names it already re-exported from the standalone package.
describe('profile loader merge', () => {
  let dir: string | undefined;

  afterEach(() => {
    profileLoader.resetConfig();
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  it('keeps the original API on the ./profile-loader subpath', () => {
    expect(Object.keys(profileLoader).sort()).toEqual([
      'configure',
      'getAllProfileTagsServer',
      'getAllRolesServer',
      'getConfig',
      'getFeaturedProfilesServer',
      'getProfileBySlugServer',
      'getProfilesByRoleServer',
      'getProfilesByTagServer',
      'getPublishedProfilesServer',
      'getRandomProfilesServer',
      'loadProfilesServer',
      'resetConfig',
      'searchProfilesServer',
    ]);
  });

  it('re-exports the same functions on the root facade', () => {
    expect(content.loadProfilesServer).toBe(profileLoader.loadProfilesServer);
    expect(content.getPublishedProfilesServer).toBe(profileLoader.getPublishedProfilesServer);
    expect(content.getFeaturedProfilesServer).toBe(profileLoader.getFeaturedProfilesServer);
    expect(content.getProfileBySlugServer).toBe(profileLoader.getProfileBySlugServer);
    expect(content.getProfilesByRoleServer).toBe(profileLoader.getProfilesByRoleServer);
    expect(content.getProfilesByTagServer).toBe(profileLoader.getProfilesByTagServer);
    expect(content.getAllRolesServer).toBe(profileLoader.getAllRolesServer);
    expect(content.getAllProfileTagsServer).toBe(profileLoader.getAllProfileTagsServer);
    expect(content.searchProfilesServer).toBe(profileLoader.searchProfilesServer);
    expect(content.getRandomProfilesServer).toBe(profileLoader.getRandomProfilesServer);
    expect(content.configureProfileLoader).toBe(profileLoader.configure);
    expect(content.getProfileLoaderConfig).toBe(profileLoader.getConfig);
    expect(content.resetProfileLoaderConfig).toBe(profileLoader.resetConfig);
  });

  it('shares one configuration between the facade and the subpath', () => {
    dir = mkdtempSync(join(tmpdir(), 'content-profile-loader-'));
    mkdirSync(join(dir, 'profiles'));
    writeFileSync(
      join(dir, 'profiles', 'merged.md'),
      '---\nname: "Merged"\nrole: "member"\n---\nBody text\n',
    );
    content.configureProfileLoader({ baseDir: dir, contentSubPath: 'profiles' });
    expect(profileLoader.loadProfilesServer().map((profile) => profile.slug)).toEqual(['merged']);
    expect(content.getProfileBySlugServer('merged')?.frontmatter.name).toBe('Merged');
    profileLoader.resetConfig();
    expect(content.getProfileLoaderConfig()).toEqual({
      baseDir: process.cwd(),
      contentSubPath: 'src/content/profiles',
    });
  });
});
