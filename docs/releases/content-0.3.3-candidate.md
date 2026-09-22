# Content 0.3.3 compatible launch candidate

As of 2026-09-21, this is source/version and BCR-only CI preparation for the approved
existing-admin, single-writer mothership launch. Program: TIN-4177; source
scope receipt: TIN-2716 `6d68fbe2-d37a-4ea3-8d80-2927dec2979b`.
It neither changes nor depends on the unrelated deferred release train.

## Baseline and provisional version

Canonical `xoxd-ai/tinyland-content` tag/release `v0.3.2` points to
`6f9445b3ee91f0841392a59e57f7a144d61ed0ae` (release published 2026-07-11).
The retained implementation is `0ab350e` plus `c6e2664`; inert qualification
preparation is `2d82de0`.

Read-only GitHub observations refreshed on 2026-09-21 found no `v0.3.3`
tag/release and no `0.3.3` directory or metadata entry in active
`xoxd-ai/bazel-registry` main, module `tummycrypt_tinyland_content`.
Local active-registry metadata agrees. These observations are not a reservation.
`0.3.3` is provisional. Under [TIN-89](https://linear.app/tinyland/issue/TIN-89),
Bzlmod/BCR is the sole first-party delivery authority. npmjs and GitHub Packages
occupancy are not release gates. Recheck the source tag/release and active BCR
entry at release time; do not change credentials, package scopes or historical
releases as part of this candidate.

## Compatibility with released 0.3.2

- Existing exports, signatures, export-map paths, content layout, dependency
  pins, Node >=22 requirement and Bazel compatibility level 1 remain intact.
  Public loaders, visibility rules and projection behavior are unchanged.
- New owned APIs and `PostOwner` are additive; the service factory gains the
  same methods. Existing global admin APIs retain first-match lookup and live
  content-only behavior. They do not become owner-authorized APIs automatically.
- The shared update helper now omits originally absent `author`/`authorId`
  keys instead of serializing `undefined`; stored authorship remains immutable.
  Existing Markdown does not require a format migration. Old posts lacking
  stable author IDs remain accessible through the existing guarded admin path
  but deliberately fail the new owner-scoped path.
- Owned access requires a trusted caller-supplied stable ID and handle matching
  stored author bindings. Ambiguous `.md`/`.mdx` pairs fail closed; no bundled
  or cross-owner fallback occurs. These are raw editor reads, not public reads.
- Owned writes replace a complete flushed revision and sync its directory;
  owned deletes sync after unlink. A filesystem failure is propagated and can
  occur after the file changed. Callers must retain retry/journal obligations
  until acknowledged; this is not a distributed lock or multi-writer guarantee.
  Auth, publication journals, tombstones and delivery remain application-owned.

This preparation changes no implementation, API, dependency or consumer pin.
It does not enable invitations, public federation or a second writer.
Compatibility is source-reviewed; previous diagnostics are historical, not
fresh qualification of the versioned candidate.

## Provider retirement and replacement boundary

This cutover removes `.github/workflows/ci.yml` and `publish.yml`, which invoked
a provider-capable legacy template, and removes `publishConfig` and
`prepublishOnly` from `package.json`. No package-write permission, publisher
secret inheritance, provider dry-run or publication job remains in an active
workflow. Published historical sources are untouched. This retires
repository-controlled provider machinery; it is not a claim that an operator
could never invoke a publication command manually.

The pattern follows provider removal in canonical `tinyland-color-utils`
PR #11, `vite-plugin-a11y` PR #11 and `vite-plugin-skeleton-colors` PR #9. Their
old canary caller pin is not copied as current release/admission evidence.
The existing thin `spoke-ci-v4.yml` caller stays under `docs/` at
the released v5.1.1 commit `ae836d8400d5784d74af4fecc020f225d1c2d08e` (refreshed
from historical v5.1.0 `32e39ced0008edf4564ebeb173a5e8fbf069e28f`); no active
replacement or dummy-green workflow is added. This leaves **no active CI workflow in this candidate**
until a fresh released contract and content-repository GF admission are verified.

`pnpm`, `npm_translate_lock`, `npm_link_package` and `//:pkg` remain Bazel
build/consumer mechanics, not provider-delivery authority. The source test
graph retains metadata parity and an actual
`test //:test //:package_artifact_test` action. Source
archive integrity, append-only BCR registration and isolated consumer proof
remain the release path.

## Remaining release evidence

Obtain a real `MODULE.bazel.lock` refresh for these changed inputs through the
authorized managed Bazel 8.1.1 dependency-resolution lane, followed by replay
with `--lockfile_mode=error`. No local Bazel invocation is part of this pass.
Do not hand-edit the lock or reuse the 0.3.2 preparation digest as current proof.
Run `tests/release-metadata.test.ts` for package/root-module/`npm_package`
version parity and provider-hook retirement; its three metadata inputs are
explicit existing `//:test` runfiles. Qualify owner/legacy compatibility and
inert-caller contracts through remote GF-backed
`test //:test //:package_artifact_test` and `build //:pkg`, after admission.
Building test targets alone is not test evidence. The artifact test passes the
actual `//:pkg` tree to existing locked publint 0.3.18 with packing disabled,
retaining the previous gate's errors-only failure severity. It checks built
manifest identity/version/export/dependency parity and all declared generated
JS/types files, without trusting a workspace build or invoking a package manager.
This target's source is ready, not execution-qualified; compilation alone does
not replace it. Semantic declaration checks, runtime dependency closure, license
file completeness, immutable archive/version and append-only registry/isolated
consumer evidence remain separate release work.

The [GF preparation record](../gf-v4-qualification-preparation.md) remains
inert: its caller stays under `docs/`; provider CI/publication is retired in
this source candidate, not activated on the remote repository. No push, tag,
publication, workflow dispatch or runtime deployment
is performed or authorized by this source-only candidate preparation.
