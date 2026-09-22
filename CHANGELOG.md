# Changelog

## 0.3.3 — Unreleased candidate

Prepared for the existing-admin, single-writer mothership launch under TIN-4177.
This entry describes retained source changes since released 0.3.2, not a
published artifact or runtime rollout.

- Add `PostOwner`, `loadOwnedPost`, `updateOwnedPost` and `deleteOwnedPost`
  exports, including the service factory. Owned operations require matching
  stored stable author identity and the exact owner/slug live Markdown path;
  they never fall back to another owner or bundled content.
- Preserve complete owned revisions through flushed temporary-file replacement
  and directory synchronization; synchronize owned deletions and preserve valid
  server-supplied revision timestamps for replay.
- Preserve absent author metadata without passing `undefined` to the YAML
  serializer, while retaining immutable stored authorship and existing global
  admin API signatures and first-match behavior.
- Retire provider-capable legacy CI/publish workflows, `publishConfig` and the
  publication lifecycle hook under TIN-89. Bzlmod/BCR is the sole first-party
  delivery authority; JavaScript package/build mechanics remain.
- Keep the schema-3 GF qualification plan and pinned caller inert under `docs/`.
  No replacement workflow is activated before released-contract/admission
  verification. Metadata parity and the actual Bazel test remain in the graph.
- Add `//:package_artifact_test`: locked publint inspects the actual Bazel
  package with packing disabled, plus manifest parity and nonempty generated
  JavaScript/declaration entrypoint checks. This target has not been executed.

See [candidate compatibility and release notes](docs/releases/content-0.3.3-candidate.md)
for scope, version observations and remaining release evidence.
