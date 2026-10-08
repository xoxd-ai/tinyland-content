# Content GF v4 qualification: inert source preparation

The 2026-09-20 TIN-4177 preparation at `2d82de0` added inert qualification
source for canonical `tinyland-content` while keeping version 0.3.2 unchanged.
The subsequent [compatible 0.3.3 candidate](releases/content-0.3.3-candidate.md)
updates version metadata and retires provider-capable CI under the 2026-09-21
TIN-89 correction. Bzlmod/BCR is the sole first-party delivery authority; npmjs
and GitHub Packages are not delivery lanes or occupancy gates. Runtime code and
dependency pins are unchanged. No preparation enrolls the repository, activates
a replacement workflow, qualifies remote execution, releases a package or
authorizes runtime changes.

## Exact released contract

`.github/lanes.json` declares provider-blind ActionPlan/v4 schema 3 demand:

| Action | Existing Bazel target | Result |
| --- | --- | --- |
| `unit-tests` | `test //:test //:package_artifact_test` | `status-only` |
| `package-check` | `build //:pkg` | `status-only` |

Both request the abstract `rbe-linux-x86_64` capability; that is not evidence of
provider supply. `//:pkg` already depends on the `//:tinyland_content`
TypeScript/declaration compiler. This package has no `//:typecheck` target.
The test action actually requests `bazel test`, not `build //:test`.

The caller is deliberately under `docs/gf-v4-qualification.candidate.yml`,
**not** `.github/workflows/`. It now pins ci-templates v5.1.1 source commit
`ae836d8400d5784d74af4fecc020f225d1c2d08e`, whose released schema and thin caller
are the only contracts used here. It allows pushes and same-repository PRs
against `main`, binding the exact push or PR-head revision, not a merge ref.
Only `contents: read` and `id-token: write` are requested; no secrets, manual
dispatch, package write or publication is added. The prior v5.1.0 preparation
used `32e39ced0008edf4564ebeb173a5e8fbf069e28f`; that historical observation is
not admission. v5.1.1's thin caller supplies its own run-scoped result directory;
the source plan still requests status-only, not artifact export or publication.

Status-only is not artifact export. `//:pkg` produces a package directory, not
an already-qualified `export-regular-files` output. No result directory,
runner, endpoint, owner identity, credential or caller-built provider binding
belongs in this plan. No unreleased publisher inputs are assumed.

## Retire provider authority without inventing admission

The candidate removes `ci.yml` and `publish.yml`, which used provider-capable
`js-bazel-package.yml@61cd1338ca9dae8a25985c0a36ff7beb111449be`. It also removes
`publishConfig` and the publication lifecycle hook; package build/test scripts
remain. Historical tags/releases are untouched. There is no active workflow in
this candidate and no fabricated successful check to replace the retired lane.

Historical inspection of that exact legacy template found no `lanes.json` lookup,
`gf-action-client` invocation or workflow/repository dispatch: it runs explicit
input commands and targets. Its existing `nix-setup@v2` composite also has no
plan discovery or dispatch in the locally resolved source
`62a8c4d076e4f98719c4ace030e43718a69257eb`. That legacy tag is mutable; this
inspection does not repin it or make claims about future changes to it. The
legacy template built `bazel_targets`; `build //:test` was not test execution.

Keep the existing provider-blind thin caller inert. Before activation, refresh
the exact released reusable contract and prove repository-specific admission;
neither the old JS helper nor a previously prepared pin supplies that proof.
Do not restore the provider lane as a fallback for refused v4 work.

`test //:test` includes owner/runtime and source-contract tests;
`build //:pkg` includes the TypeScript/declaration compiler. The new
`test //:package_artifact_test` separately checks the real `//:pkg` directory:
source/artifact manifest parity, nonempty generated JS/types for every export,
and locked publint 0.3.18 with `pack: false`. It preserves the old errors-only
failure severity and prints warnings. No package manager, repacking, publisher
or runtime import is involved. Its source is prepared, not remotely executed.

Pinned rules_js 2.9.1 `npm_package` provides one directory in `DefaultInfo`,
including generated declarations by default. `js_test` receives that directory
through `data = [":pkg", ...]` and `$(rootpath :pkg)`, plus the locked
`:node_modules/publint` closure and source `package.json`. This checks assembled
package bytes, not workspace `dist`. It needs no target-package runtime
dependency overlay. Publint is not semantic TypeScript checking, declaration
import closure, license-file completeness, source archive integrity, or isolated
consumer proof. Those distinct checks and append-only BCR evidence remain.

## Local preparation and module lock

The existing managed launcher must use this package's Bazel 8.1.1 pin.
`bazel --batch mod deps --lockfile_mode=update` may generate the actual source
lock; `--lockfile_mode=error` then checks replay without changing it. These are
dependency-resolution diagnostics, not build/test actions or Linux remote
closure evidence. A copied, placeholder or ignored lock is insufficient.
The historical result below records successful generation for the 0.3.2
preparation inputs. Version 0.3.3 needs its own real lock refresh and error-mode
replay; the old digest is not current-candidate proof.

The focused `tests/gf-v4-qualification-contract.test.ts` checks the closed
action plan, exact pinned inert caller, provider-workflow retirement and real
test/package/artifact targets. `tests/release-metadata.test.ts` covers version
parity and provider-hook retirement. Existing `//:test` runfiles explicitly
include package, module and BUILD metadata, the artifact-check source, and glob
all `.yml`/`.yaml` workflows (allowing an empty inventory), so a reintroduced
caller cannot disappear from the check. An absent
workflow directory is accepted only for `ENOENT`, not arbitrary I/O failures.

Validate with the released full JSON Schema engine using an explicit schema:

```text
python3 <reviewed-release>/scripts/manifest-schema-validate.py \
  <reviewed-release>/schemas/lanes.schema.json .github/lanes.json
```

The current inert release pin is `ae836d8400d5784d74af4fecc020f225d1c2d08e`.
Read-only comparison found its schema/validator git blobs unchanged from
v5.1.0 (`32e39ced0008edf4564ebeb173a5e8fbf069e28f`). The schema SHA-256 is
`4fef58645b8cd367a4336a66eaee629388c8a949a06d85becc97cfc1be82e3b8`;
the validator SHA-256 is
`759f343aadf815a665b6c8319fbc92015a21ea4cf647b1e549f50d3c12b22468`.
An existing checkout is usable only after both files are verified byte-identical
to that release, with Python's `jsonschema` engine available. `--schemas-dir`
routes repository-manifest schemas, not this schema-3 action plan.

## Activation is a separate transaction

The reviewed auth source candidate (`xoxd-ai/tinyland-auth`, local commit
`67af1d3`, `docs/gf-v4-qualification-preparation.md`) records the full
installation/admission sequence; this reference does not claim it is released.
For this content repository, the rollout owner must independently verify:

1. The exact committed source lock and source-bound plan; the current all-repo
   App installation, signed `OwnerInstallation/v1`, `TenantOverlay/v1`,
   revocation head and admitted workflow/ref/event/capability policy. Renamed
   owner/workflow admission must be explicit, preserving numeric identities.
2. The installed dispatch/client image, provider receipt, adopter verifier,
   independent provider supply and revocations, current
   `ResolvedOwnerSupplyCatalog/v1` and eligible remote workers.
3. Fresh genuine Actions OIDC and independent App PR admission where required;
   a resolver binding of the exact repository, source, plan, action, lock,
   installed Bazel digest and provider-selected closure. Local/hosted execution
   or a cache endpoint cannot substitute for missing authority.
4. A reviewed activation diff and actual remote Execute or authenticated
   cache-hit evidence with measurement attribution for both actions. Distinguish
   cold execution from cache hits; green Actions or runner pickup alone is not
   proof. Moving the candidate into `.github/workflows/` already schedules work
   on a matching PR and is not part of this preparation.

## Historical 0.3.2 preparation diagnostic outcome

On 2026-09-20, before the 0.3.3 metadata, provider-retirement and artifact-target
changes, the then-current plan passed the exact v5.1.0 schema and validator,
read directly from the release's git objects using an existing Python with
`jsonschema`. The focused contract suite passed: 1 file, 4 tests, one worker.
These are local compatibility diagnostics, not remote qualification.

The existing managed launcher reported Bazel 8.1.1 and completed
`bazel --batch mod deps --lockfile_mode=update` with exit 0. It generated the
actual `MODULE.bazel.lock` (format 18; 334 registry file hashes from BCR and
the configured GitHub-hosted registry). Replaying with
`bazel --batch mod deps --lockfile_mode=error` also exited 0, with unchanged
lock SHA-256:
`50951d8af9ae86d4605f38e4e1fc21f596c8806ee45b81767e37c643f3117008`.

That preparation tracked the real lock and removed its ignore entry.
Inspection found no local filesystem paths/URLs, loopback endpoints, embedded
URL credentials or nonempty credential fields. Workflow, module, package and
pnpm-lock inputs were unchanged in `2d82de0`; the later candidate's version
metadata and lock must be assessed against its own exact source inputs.

That result closed only the then-missing source-lock-byte prerequisite. Resolution ran
on Darwin, not a qualified Linux remote closure; it proves no provider,
worker, admission, execution or cache-hit receipt. No Bazel build/test, GF
dispatch, publication, credential mutation or infrastructure action occurred.
