---
name: version-bump-from-diff
description: Compare unreleased VideoLecture2Notes changes, choose and apply the SemVer bump, and optionally complete the explicitly requested commit, develop push, and main-based tag release flow.
---

# Version Bump From Diff

Use this project skill when the user asks to raise the VideoLecture2Notes version based on repository changes, or asks for the complete version-to-release sequence.

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

## Commit and release flow

Leave changes uncommitted when the user asks only for a version assessment or version bump. Commit, push, and tag are separate external mutations and require an explicit request for the corresponding release action.

When the user explicitly requests the complete release flow after choosing the next version:

1. Update all four application-version fields with `bun run version:set <next-version>`.
2. Verify the result with `bun scripts/version.ts check <next-version>`.
3. Inspect the four-file diff and run `git diff --check`. Do not include unrelated product changes in the version commit.
4. Run proportionate validation, at minimum `bunx tsc -b --noEmit`; run `bun run lint` when appropriate.
5. Stage only the application-version files:

   `git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock`

6. Commit with a concise Japanese message:

   `git commit -m "バージョンを<next-version>に更新"`

7. Confirm the commit and push the version commit to the development branch:

   `git push origin develop`

8. Wait for the `develop` → `main` merge. Never create the release tag on `develop`; the release workflow rejects tags whose commits are not included in `main`.
9. After the merge, update the local checkout to `main`, run `bun scripts/version.ts check <next-version>`, then create and push an annotated tag:

   `git tag -a v<next-version> -m "v<next-version>"`

   `git push origin v<next-version>`

The tag triggers `.github/workflows/release-macos.yml`, which checks the tag/version match, builds the Apple Silicon DMG as a draft release, and publishes it after a successful build. If the user has not explicitly asked to publish or tag, stop after the version commit and explain the remaining main-merge/tag steps.

## Validate and report

After editing:

- inspect `git diff` and run `git diff --check`;
- run `cargo metadata --locked --no-deps --format-version 1 --manifest-path src-tauri/Cargo.toml`;
- run `bun run lint` and `bun run build` when the change scope and available time make a project check appropriate.

Report both the repository context (`origin/main` and its merge-base) and the selected release baseline, detected change category, old → new version, four updated files, and validation results. When the release flow was requested, also report the commit hash, pushed branch, and tag status. Explicitly note when features visible in the `origin/main` comparison predate the selected release baseline and were therefore excluded. Leave edits uncommitted unless the user separately requests a commit.
