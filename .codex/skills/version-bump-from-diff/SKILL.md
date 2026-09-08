---
name: version-bump-from-diff
description: Compare unreleased VideoLecture2Notes changes, choose and apply the SemVer bump, then for an explicit release request commit and push to develop before handing off main merge, CLI tag creation, and manual Draft Release publication.
---

# Version Bump From Diff

Use this project skill when the user asks to raise the VideoLecture2Notes version based on repository changes, or asks for the complete version-to-release sequence. A request such as `バージョン上げて` authorizes this skill to proceed through the version commit and `develop` push; it does not authorize merging a PR, creating a tag, or publishing a GitHub release.

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

## Commit and push to develop

Leave changes uncommitted when the user asks only for a version assessment or version candidate. For an explicit version-bump request such as `バージョン上げて`, commit the version files and push to `develop` as described below. Never create or push the release tag from this skill.

After choosing the next version:

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

8. After the push completes, stop local release work and give the user the release handoff below. Do not merge, tag, publish, or run a tag push.

## Release handoff after the push

Tell the user to complete these steps after the push:

1. Open the repository's **Pull requests** tab and open the automatically created `develop` → `main` PR. Wait for required checks/review, then click **Merge pull request**.
2. After the merge completes, create and push the tag `v<next-version>` from the merged `main` commit. Tag creation is the actual trigger for `.github/workflows/release-macos.yml`; do not create or publish a Release at this point. Before creating it, confirm that the tag does not already exist locally or on `origin`; never force-push or move an existing release tag.

   ```bash
   git fetch origin main --no-tags
   git switch main
   git pull --ff-only origin main
   git tag -a v<next-version> -m "v<next-version>"
   git push origin v<next-version>
   ```

   If `git switch` or `git pull --ff-only` cannot proceed because of local changes or diverged history, stop and resolve that state without discarding user work. Never target `develop`.
3. Wait for the **Actions** tab's `Build macOS release assets` workflow to finish. Do not upload a DMG manually; the repository workflow builds it, creates/updates the draft release, and generates the initial release notes.
4. Open the generated Draft Release, review and edit the release notes, confirm the Apple Silicon DMG is attached, then click **Publish release**. If the build fails, do not publish the draft; fix the cause and rerun the workflow.

The release workflow verifies that the tag is based on `main`, checks the tag/version match, builds the DMG, and leaves the release as a draft after uploading the artifact. Do not use **Releases** → **Draft a new release** to start this tag-triggered workflow, do not create a second tag, and do not manually upload another DMG if the workflow is still running.

The initial release notes are generated automatically through `tauri-action`'s GitHub Release Notes API (`generateReleaseNotes: true`). After the DMG upload, the draft intentionally remains unpublished so a human can review and edit the notes before publishing it. The tag push is the only local release action this handoff asks the user to perform after the `develop` push.

## Validate and report

After editing:

- inspect `git diff` and run `git diff --check`;
- run `cargo metadata --locked --no-deps --format-version 1 --manifest-path src-tauri/Cargo.toml`;
- run `bun run lint` and `bun run build` when the change scope and available time make a project check appropriate.

Report both the repository context (`origin/main` and its merge-base) and the selected release baseline, detected change category, old → new version, four updated files, and validation results. When the version-bump request authorized the release preparation, also report the commit hash, pushed branch, and the remaining PR-merge, CLI-tag, and Draft Release handoff; explicitly state that no tag was created by Codex. Note when features visible in the `origin/main` comparison predate the selected release baseline and were therefore excluded. Leave edits uncommitted only for assessment/candidate requests; commit and push to `develop` for an explicit version-bump request.
