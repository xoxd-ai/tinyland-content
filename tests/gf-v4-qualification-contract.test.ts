import { readFile, readdir } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const readText = (path: string) => readFile(path, 'utf8');
const release = '32e39ced0008edf4564ebeb173a5e8fbf069e28f';
const legacyRelease = '61cd1338ca9dae8a25985c0a36ff7beb111449be';
const candidatePath = 'docs/gf-v4-qualification.candidate.yml';

describe('inert GF v4 qualification source contract', () => {
  it('declares an actual test action and the existing package target', async () => {
    expect(JSON.parse(await readText('.github/lanes.json'))).toEqual({
      schema_version: 3,
      actions: {
        'unit-tests': {
          command: 'test',
          targets: ['//:test'],
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

  it('keeps the candidate outside the active workflow directory', async () => {
    const workflows = (await readdir('.github/workflows'))
      .filter((name) => /\.ya?ml$/.test(name)).sort();
    expect(workflows).toEqual(['ci.yml', 'publish.yml']);
    for (const name of workflows) {
      expect(await readText(`.github/workflows/${name}`)).not.toContain('spoke-ci-v4.yml');
    }
    expect(await readText(candidatePath)).toContain('# INERT SOURCE CANDIDATE');
  });

  it('preserves the existing CI and package publication checks', async () => {
    for (const path of ['.github/workflows/ci.yml', '.github/workflows/publish.yml']) {
      const workflow = await readText(path);
      expect(workflow).toContain(`js-bazel-package.yml@${legacyRelease}`);
      expect(workflow).toContain('bazel_targets: "//:pkg //:test"');
      expect(workflow).toContain('npm_publish_mode: disabled');
    }
    const publish = await readText('.github/workflows/publish.yml');
    for (const command of [
      'typecheck_command: pnpm typecheck',
      'unit_test_command: pnpm test',
      'build_command: pnpm build',
      'package_check_command: pnpm check:package',
    ]) {
      expect(publish).toContain(command);
    }
    const ci = await readText('.github/workflows/ci.yml');
    expect(ci).toContain('unit_test_command: ""');
    expect(ci).toContain('dry_run: true');
  });
});
