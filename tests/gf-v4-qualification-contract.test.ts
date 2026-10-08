import { readFile, readdir } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const readText = (path: string) => readFile(path, 'utf8');
const release = 'ae836d8400d5784d74af4fecc020f225d1c2d08e';
const candidatePath = 'docs/gf-v4-qualification.candidate.yml';

async function workflowFiles(): Promise<string[]> {
  try {
    return (await readdir('.github/workflows')).filter((name) => /\.ya?ml$/.test(name)).sort();
  } catch (error) {
    // Git and Bazel runfiles omit a directory after its last workflow retires.
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

describe('inert GF v4 qualification source contract', () => {
  it('declares an actual test action and the existing package target', async () => {
    expect(JSON.parse(await readText('.github/lanes.json'))).toEqual({
      schema_version: 3,
      actions: {
        'unit-tests': {
          command: 'test',
          targets: ['//:test', '//:package_artifact_test'],
          capability: 'rbe-linux-x86_64',
          result: { mode: 'status-only' },
        },
        'package-check': {
          command: 'build',
          targets: ['//:pkg'],
          capability: 'rbe-linux-x86_64',
          result: { mode: 'status-only' },
        },
      },
    });
  });

  it('pins the released thin caller without adding execution or publication authority', async () => {
    const candidate = (await readText(candidatePath))
      .split('\n').filter((line) => !line.startsWith('#')).join('\n').trim();
    expect(candidate).toBe(`name: GF v4 qualification

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  contents: read
  id-token: write

jobs:
  qualify:
    if: >-
      github.event_name == 'push' ||
      github.event.pull_request.head.repo.full_name == github.repository
    strategy:
      fail-fast: false
      matrix:
        action: [unit-tests, package-check]
    uses: xoxd-ai/ci-templates/.github/workflows/spoke-ci-v4.yml@${release}
    with:
      action_name: \${{ matrix.action }}`);
  });

  it('retires provider-capable workflows without activating an unadmitted replacement', async () => {
    const workflows = await workflowFiles();
    expect(workflows).toEqual([]);
    for (const name of ['ci.yml', 'publish.yml']) {
      await expect(readText(`.github/workflows/${name}`)).rejects.toMatchObject({ code: 'ENOENT' });
    }
    expect(await readText(candidatePath)).toContain('# INERT SOURCE CANDIDATE');
  });

  it('backs the finite plan with a real Bazel test and its exact source inputs', async () => {
    const build = await readText('BUILD.bazel');
    const testRule = build.match(/\bvitest_bin\.vitest_test\(\s*name\s*=\s*"test",([\s\S]*?)\n\)/)?.[1];
    expect(testRule).toBeDefined();
    expect(testRule).toMatch(/args\s*=\s*\[\s*"run",/);
    for (const input of [
      'package.json', 'MODULE.bazel', 'BUILD.bazel', '.github/lanes.json', candidatePath,
      'tests/**/*.test.ts', '.github/workflows/*.yml', '.github/workflows/*.yaml',
    ]) {
      expect(testRule).toContain(`"${input}"`);
    }
    const packageRule = build.match(/\bnpm_package\(\s*name\s*=\s*"pkg",([\s\S]*?)\n\)/)?.[1];
    expect(packageRule).toContain('":tinyland_content"');
    expect(build).toMatch(/\bts_project\(\s*name\s*=\s*"tinyland_content",/);
  });

  it('runs locked publint on the real Bazel package without repacking or publication', async () => {
    const build = await readText('BUILD.bazel');
    const artifactRule = build.match(/\bjs_test\(\s*name\s*=\s*"package_artifact_test",([\s\S]*?)\n\)/)?.[1];
    expect(artifactRule).toContain('entry_point = "scripts/check-package-artifact.mjs"');
    expect(artifactRule).toContain('args = ["$(rootpath :pkg)"]');
    for (const input of [':pkg', ':node_modules/publint', 'package.json', 'scripts/check-package-artifact.mjs']) {
      expect(artifactRule).toContain(`"${input}"`);
    }
    const testRule = build.match(/\bvitest_bin\.vitest_test\(\s*name\s*=\s*"test",([\s\S]*?)\n\)/)?.[1];
    expect(testRule).toContain('"scripts/check-package-artifact.mjs"');
    const script = await readText('scripts/check-package-artifact.mjs');
    expect(script).toContain('await publint({ pkgDir: packageDirectory, pack: false, strict: false })');
    expect(script).toContain("message.type === 'error'");
    expect(script).not.toMatch(/child_process|execSync|spawnSync|npm publish|pnpm publish/);
  });
});
