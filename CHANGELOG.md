# Changelog

## 0.4.0 — 2026-10-08

Minor release that lands the retained owner-scoped candidate (5eb83e9, the
source the Mothership writer was built from) on `main` so `xoxd-ai/tinyland.dev`
can pin a released module instead of a source override (RU11). The framework
stack is unchanged (TypeScript 5.9, Node >= 22); the RU1 stack uplift is a
later, major release. Bazel module `tummycrypt_tinyland_content` is the only
distribution path (RU6); nothing is published to npmjs or GitHub Packages.

The 0.3.3 version below was prepared but never tagged or registered; its
changes ship here. Everything it lists is included in 0.4.0.

Added

- `PostOwner`, `loadOwnedPost`, `updateOwnedPost` and `deleteOwnedPost`, also
  on the `createContentLoader()` factory. Owned operations require matching
  stored stable author identity and the exact owner/slug live Markdown path;
  they never fall back to another owner or bundled content.
- `adoptReviewedOwnedPost` with `ReviewedOwnedPostAdoption` and
  `AdoptedOwnedPost`: proof-bound adoption of a reviewed, id-less retained live
  post into the owner-scoped path. The caller supplies `verifyProof`; the
  source must be a regular file and the write is a complete flushed revision.

Changed (behavior, no signature change)

- User content loading fails closed when a live directory has both
  `<slug>.md` and `<slug>.mdx`: neither is served and an error is logged.
  A live file that cannot be read or parsed still shadows a bundled copy of
  the same slug, so a broken override cannot resurrect an older public
  bundled post. Parse failures log only the file path, not the gray-matter
  error (which can quote private source).
- `null` frontmatter `visibility` is normalized to absent before
  `migrateVisibility`, so it fails closed to `private` the same way in the
  blog loader, the by-slug gate and scheduled publishing.

CI and distribution

- `publish.yml` removed (RU8). `ci.yml` stays as a validation-only caller of
  `js-bazel-package.yml@v3.2.1`: `bazel test //:test`, `bazel build //:pkg`
  and `bazel test //:package_artifact_test`, with npm publication disabled
  and no package-write permission.
- `publishConfig` and `prepublishOnly` removed from `package.json`.
- `//:package_artifact_test` is now a `js_test` that runs locked publint on
  the real `//:pkg` tree (no repack) and checks manifest parity and every
  declared entrypoint. The target name is unchanged.
- `MODULE.bazel.lock` is committed.

Migration

- No consumer change is required: existing exports, signatures and the export
  map are unchanged. Consumers move from 0.2.x or 0.3.x by bumping the
  `bazel_dep` to `0.4.0`. Repos with a `.mdx`/`.md` pair for one slug in the
  same user directory must remove one of them.

## 0.3.3 — prepared, never released

See [candidate compatibility and release notes](docs/releases/content-0.3.3-candidate.md)
for the original scope notes. Superseded by 0.4.0.
