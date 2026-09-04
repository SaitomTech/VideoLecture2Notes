---
name: version-bump-from-diff
description: Compare VideoLecture2Notes changes with origin/main, choose an evidence-based SemVer bump, and update the app version consistently across its frontend and Tauri manifests.
---

# Version Bump From Diff

Use this project skill when the user asks to raise the VideoLecture2Notes version based on the changes in the repository.

## Scope and safety

- Inspect committed changes since `origin/main` and all staged, unstaged, and relevant untracked work.
- Read `agent.md` before changing files and preserve unrelated user changes.
- Treat version-only edits as bookkeeping, not evidence for another bump.
- Do not reset, checkout, stash, delete, commit, tag, publish, or push unless the user explicitly asks.

## Assess the change

1. Check `git status --short`, the current branch, and whether `origin/main` resolves. If the ref is missing, fetch `origin main` when an `origin` remote exists; if it remains unavailable, explain the blocker instead of guessing another baseline.
2. Resolve `git merge-base origin/main HEAD`. Review the actual patch for the merge-base → `HEAD`, the working-tree diff, and relevant untracked files. Use `git diff --stat`, `git diff --name-status`, and the full diff; do not rely on commit messages alone.
3. Exclude version metadata from the release-impact judgment, then classify the highest-impact product change:

   - **Patch**: bug fix, refactor, tests, documentation, styling-only change, or dependency maintenance with no intentional user/API/data-contract change.
   - **Minor**: backward-compatible user-facing feature or meaningful enhancement.
   - **Major**: incompatible persisted-data/schema, file-format, public API, plugin, or user workflow change requiring migration or breaking existing consumers.

   For this app's current `0.x` convention, use the next minor (`0.x.0` → `0.(x+1).0`) for a feature or breaking change, and the next patch for fixes-only changes. Use `1.0.0` only when the user explicitly requests a stable release or the repository establishes that convention. Prefer the smallest bump that matches the highest-impact change.

## Update the project version

The application version must stay synchronized in exactly these four places:

- `package.json` → top-level `version`
- `src-tauri/tauri.conf.json` → top-level `version`
- `src-tauri/Cargo.toml` → `[package].version`
- `src-tauri/Cargo.lock` → the `[[package]]` entry whose `name` is `videolecture2notes`

Update only those application version fields. Cargo.lock contains unrelated dependency versions; never replace every occurrence of the old version. If the current values disagree, report the inconsistency and use the canonical `package.json` value only when the other three fields clearly mirror it; otherwise stop for clarification.

## Validate and report

After editing:

- inspect `git diff` and run `git diff --check`;
- run `cargo metadata --locked --no-deps --format-version 1 --manifest-path src-tauri/Cargo.toml`;
- run `bun run lint` and `bun run build` when the change scope and available time make a project check appropriate.

Report the `origin/main` baseline, detected change category, old → new version, four updated files, and validation results. Leave edits uncommitted unless the user separately requests a commit.
