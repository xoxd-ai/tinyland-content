# Content GF v4 qualification: inert source preparation

As of 2026-09-20, this TIN-4177 source candidate prepares canonical
`tinyland-content` for a
separately reviewed qualification. It does not enroll the repository, activate
a workflow, qualify remote execution, publish a package or authorize runtime
changes. Existing CI, release checks, package version 0.3.2 and dependency pins
remain unchanged.

## Exact released contract

`.github/lanes.json` declares provider-blind ActionPlan/v4 schema 3 demand:

| Action | Existing Bazel target | Result |
| --- | --- | --- |
| `unit-tests` | `test //:test` | `status-only` |
| `package-check` | `build //:pkg` | `status-only` |

Both request the abstract `rbe-linux-x86_64` capability; that is not evidence of
provider supply. `//:pkg` already depends on the `//:tinyland_content`
TypeScript/declaration compiler. This package has no `//:typecheck` target.
The test action actually requests `bazel test`, not `build //:test`.

The caller is deliberately under `docs/gf-v4-qualification.candidate.yml`,
**not** `.github/workflows/`. It pins ci-templates v5.1.0 source commit
`32e39ced0008edf4564ebeb173a5e8fbf069e28f`, whose released schema and thin caller
are the only contracts used here. It allows pushes and same-repository PRs
against `main`, binding the exact push or PR-head revision, not a merge ref.
Only `contents: read` and `id-token: write` are requested; no secrets, manual
dispatch, package write or publication is added.

Status-only is not artifact export. `//:pkg` produces a package directory, not
an already-qualified `export-regular-files` output. No result directory,
runner, endpoint, owner identity, credential or caller-built provider binding
belongs in this plan. No unreleased publisher inputs are assumed.

## Preserve release authority

The existing `ci.yml` and `publish.yml` retain their legacy template pin
`61cd1338ca9dae8a25985c0a36ff7beb111449be` and settings. That template builds
its `bazel_targets`; including `//:test` does not itself prove test execution.
Do not relabel legacy results as v4 qualification or use them as a fallback
when a v4 action is refused.

Source inspection of that exact legacy template found no `lanes.json` lookup,
`gf-action-client` invocation or workflow/repository dispatch: it runs explicit
input commands and targets. Its existing `nix-setup@v2` composite also has no
plan discovery or dispatch in the locally resolved source
`62a8c4d076e4f98719c4ace030e43718a69257eb`. That legacy tag is mutable; this
inspection does not repin it or make claims about future changes to it.

This plan is not full release-validation parity: it does not replace the
existing publish workflow's `pnpm typecheck`, `pnpm test`, `pnpm build` and
`pnpm check:package` checks, nor change its disabled npmjs publication policy.
Publication, artifact qualification, an immutable release version, BCR
registration and consumer adoption remain separate reviewed work.

## Local preparation and module lock

The existing managed launcher must use this package's Bazel 8.1.1 pin.
`bazel --batch mod deps --lockfile_mode=update` may generate the actual source
lock; `--lockfile_mode=error` then checks replay without changing it. These are
dependency-resolution diagnostics, not build/test actions or Linux remote
closure evidence. A copied, placeholder or ignored lock is insufficient.
The preparation result below records whether actual lock generation succeeded.

The focused `tests/gf-v4-qualification-contract.test.ts` checks the closed
action plan, exact pinned inert caller, active workflow inventory and retained
release checks. Its existing `//:test` runfiles include all `.yml` and `.yaml`
workflows so a newly activated caller cannot disappear from that check.

Validate with the released full JSON Schema engine using an explicit schema:

```text
python3 <reviewed-release>/scripts/manifest-schema-validate.py \
  <reviewed-release>/schemas/lanes.schema.json .github/lanes.json
```

The release is `32e39ced0008edf4564ebeb173a5e8fbf069e28f`. The schema SHA-256 is
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

## Preparation diagnostic outcome

On 2026-09-20, the plan passed the exact released schema and validator above,
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

The real lock is included in this source change and its ignore entry removed.
Inspection found no local filesystem paths/URLs, loopback endpoints, embedded
URL credentials or nonempty credential fields. Existing workflow, module,
package and pnpm-lock inputs remain unchanged.

This closes only the missing source-lock-byte prerequisite. Resolution ran
on Darwin, not a qualified Linux remote closure; it proves no provider,
worker, admission, execution or cache-hit receipt. No Bazel build/test, GF
dispatch, publication, credential mutation or infrastructure action occurred.
