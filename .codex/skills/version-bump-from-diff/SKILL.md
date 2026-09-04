---
name: version-bump-from-diff
description: Compare unreleased VideoLecture2Notes changes since the current release baseline, choose an evidence-based SemVer bump, and update the app version consistently across its frontend and Tauri manifests.
---

# Version Bump From Diff

Use this project skill when the user asks to raise the VideoLecture2Notes version based on the changes in the repository.

## Scope and safety

- Inspect committed changes since the selected release baseline and all staged, unstaged, and relevant untracked work.
- Read `agent.md` before changing files and preserve unrelated user changes.
- Treat version-only edits as bookkeeping, not evidence for another bump.
- Do not reset, checkout, stash, delete, commit, tag, publish, or push unless the user explicitly asks.

## Assess the change

1. Check `git status --short`, the current branch, and whether `origin/main` resolves. If the ref is missing, fetch `origin main` when an `origin` remote exists; if it remains unavailable, explain that repository-context check instead of guessing a remote baseline.
2. Establish the release baseline before reviewing product impact:

   - Read the top-level `package.json` version and verify that the three Tauri application version fields match it.
   - Find the most recent committed version-update change on the current line of history that set those application fields to the current release version. Prefer a commit that updates all four fields together, and inspect its patch to confirm it is a bookkeeping-only version change.
   - Use that version-update commit itself as the release baseline. Review changes in `release-baseline..HEAD`, then add staged, unstaged, and relevant untracked work. Do not use the parent of the version-update commit: that would count features already included in the current release a second time.
   - If the current version is being changed only in the working tree, keep those metadata edits out of the impact diff and use the last committed version-update commit as the baseline.
   - Treat `origin/main` and its merge-base as repository history context, not as the default release baseline. A long-lived `develop` branch can contain features already accounted for by an intervening version update even when they have not yet reached `origin/main`.
   - If no clear prior version-update commit can be identified, or if version history and the four manifests do not agree, stop and report the ambiguity instead of counting the entire `origin/main..HEAD` history by default.
3. Review the actual patch for the selected release baseline → `HEAD`, the working-tree diff, and relevant untracked files. Use `git diff --stat`, `git diff --name-status`, and the full diff; do not rely on commit messages alone.
4. Exclude version metadata and all changes before the release baseline from the release-impact judgment, then classify the highest-impact product change:

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

Report both the repository context (`origin/main` and its merge-base) and the selected release baseline, detected change category, old → new version, four updated files, and validation results. Explicitly note when features visible in the `origin/main` comparison predate the selected release baseline and were therefore excluded. Leave edits uncommitted unless the user separately requests a commit.
