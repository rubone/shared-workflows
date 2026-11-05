# Changelog

All notable changes to this repo are listed here. Versions follow
[Semantic Versioning](https://semver.org/): callers pin a major tag (`@v1`), so breaking
changes to inputs, secrets or behavior require a new major version.

## [Unreleased]

### Changed
- `pr_slack_notify.yml` works in two modes from the same file:
  - **Copy:** keeps its `pull_request` trigger; set `JIRA_BASE_URL` and `SLACK_MENTION_IDS`
    in the top-level `env:` block (unchanged from before).
  - **Call:** new `on: workflow_call` with inputs `jira_base_url` and `slack_mention_ids`
    (override the `env` values) and the optional `SLACK_PR_WEBHOOK_URL` secret. Caller sample
    in `examples/pr-slack-notify.yml`.
- `SLACK_MENTION_IDS` defaults to `''` instead of an empty YAML value.

### Added
- `dependency-review.yml`: blocks PRs that add vulnerable dependencies, with optional license
  allow list. Copy and call modes; a `detect` job skips it with a warning on repos without
  dependency review support. Uses `actions/dependency-review-action` v5.0.0 pinned by SHA.
- `secret-scan.yml`: fails when commits contain secrets, using the gitleaks CLI 8.30.1
  (pinned by checksum, no license key). Scans only the PR's or push's new commits; a manual
  run scans the whole history. Findings show as annotations and in the job summary,
  redacted. Copy and call modes.
- `codeql.yml`: CodeQL code scanning (`github/codeql-action` v4.39.1 pinned by SHA). Detects
  languages from the repo's files and runs one job per language; Kotlin uses autobuild, the
  rest build mode `none`. A `detect` job skips it with a warning where code scanning isn't
  available. Copy and call modes.
- `pr-checks.yml`: checks that the PR title follows Conventional Commits, adds a `size/*`
  label (lockfiles and generated code ignored) and path labels with `actions/labeler` v7.0.0
  from the project's `.github/labeler.yml`. Runs on `pull_request_target` without checking out
  the PR. Copy and call modes; sample `examples/labeler.yml` for the supported stacks.
- `.github/labeler.yml` for this repo.
- `stale.yml`: daily job that marks issues (60 days) and PRs (30 days) with no activity as
  `stale` and closes them 14 days later, using `actions/stale` v11.0.0 pinned by SHA. Exempt
  labels, `-1` to never mark or close, and a dry-run mode. Copy and call modes.
- `node-ci.yml`: installs dependencies with cache and runs the project's lint, type check,
  test and build scripts (each only if `package.json` defines it). Detects npm, pnpm, Yarn 1
  or Yarn 2+ from the lockfile, and the Node version from `.nvmrc`, `.node-version` or
  `package.json`. Skips with a warning when there's no `package.json`. Uses
  `actions/setup-node` v7.1.0 and `pnpm/action-setup` v6.1.0 pinned by SHA. Copy and call
  modes.
- `dotnet-ci.yml`: restores with a NuGet cache (locked mode with `packages.lock.json`),
  checks formatting with `dotnet format` when there's an `.editorconfig`, builds and runs the
  tests (VSTest or Microsoft.Testing.Platform), with test totals in the job summary. Finds the
  `.slnx`/`.sln` and takes the SDK from `global.json`. Skips with a warning when there's no
  solution or project. Uses `actions/setup-dotnet` v6.0.0 and `actions/cache` v6.1.0 pinned by
  SHA. Copy and call modes.
- `android-ci.yml`: Android Lint, unit tests and the debug APK build (uploaded as an
  artifact) for a Gradle project, with the variant configurable for flavors. Uses
  `actions/setup-java` v6.1.0 (JDK 21) and `gradle/actions` v6.4.0 with the open-source cache
  provider, pinned by SHA; the Gradle wrapper is validated. On pushes to the default branch, a
  second job submits the Gradle dependencies to the dependency graph. Skips with a warning
  without `gradlew` or an Android plugin, and for Flutter projects. Copy and call modes.
- `tests/fixtures/`: sample projects (npm, pnpm, Yarn 1, Yarn 4, .NET 10 with xUnit, Android
  with AGP 9) for the self-test.
- `_self-test.yml`: runs actionlint and a smoke test of the reusable workflows on every PR.
- `.gitignore` and this changelog.
