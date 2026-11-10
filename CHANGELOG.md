# Changelog

All notable changes to this repo are listed here. Versions follow
[Semantic Versioning](https://semver.org/): callers pin a major tag (`@v1`), so breaking
changes to inputs, secrets or behavior require a new major version.

## [Unreleased]

### Added
- `docker-build-push.yml`: builds a Docker image with Buildx (GitHub Actions layer cache) and
  pushes it to GHCR (`GITHUB_TOKEN`) or ACR (Azure OIDC with `azure/login` v3.1.0). PRs only
  build; pushes to the default branch are tagged `sha-<short>` and the branch, `v*` tags get
  semver tags and `latest`. Optional multi-platform builds, with arm64 on a native ARM runner
  in public repos and QEMU otherwise, merged into one image. SBOM and provenance
  attestations. Outputs the image, digest and tags. Skips with a warning without a
  Dockerfile. Uses the `docker/*` actions pinned by SHA. Copy and call modes.
- `tests/fixtures/docker`: multi-platform sample image for the self-test.
- `php-laravel-ci.yml`: installs a Laravel app's Composer dependencies with cache and runs its
  tests (`php artisan test`, Pest or PHPUnit) on SQLite in memory, or on MySQL, MariaDB or
  PostgreSQL in a container. Optional steps: Pint format check, PHPStan/Larastan, and the
  Vite build (npm, pnpm or Yarn). PHP version from `PHP_VERSION`, `config.platform.php`, or
  the lowest version `composer.json` and every package in `composer.lock` accept; PHP
  extensions from their `ext-*` requirements. Skips with a warning without a Laravel
  `composer.json`. Uses `shivammathur/setup-php` 2.40.0 pinned by SHA. Copy and call modes.
- `tests/fixtures/laravel`: Laravel 13 app (PHPUnit, Pint, Larastan, Vite) for the self-test.
- `trivy-scan.yml`: scans a Docker image for vulnerabilities with the Trivy CLI 0.76.1
  (pinned by checksum, not `aquasecurity/trivy-action`, whose tags were hijacked in March
  2026). PRs build the image from the Dockerfile with docker-build-push's layer cache; after
  docker-build-push pushes (`workflow_run`), it scans the pushed `sha-<commit>` tag; weekly
  and manual runs scan `latest`, else the default branch's tag. Fails on CRITICAL/HIGH
  vulnerabilities with a fixed version (configurable, or report only), uploads SARIF to code
  scanning when available, and summarizes the findings in the job. Honors `.trivyignore`.
  Outputs the counts. Copy and call modes.
- `docker-build-push` docs link to `trivy-scan`.
- `azure-static-web-apps-deploy.yml`: builds a frontend with its package manager (npm,
  pnpm, Yarn; Node version from `.nvmrc` or `package.json`, as in `node-ci`), finds the output
  folder (Angular, Vite, CRA, Next.js export) and deploys it to Azure Static Web Apps on
  pushes to the default branch and manual runs. PRs only build. Authenticates with OIDC
  (the `azure-login` action, then the deployment token read with the Azure CLI) or with the
  `AZURE_STATIC_WEB_APPS_API_TOKEN` secret. The deploy job runs in a GitHub environment
  (`production`). Uses `Azure/static-web-apps-deploy` v1 pinned by SHA. Copy and call modes.
- `tests/fixtures/static-web`: dependency-free static site for the self-test.
- `azure-webapp-deploy.yml`: builds a .NET app (`dotnet publish` of the only web project, SDK
  from `global.json`) or a Node app (npm, pnpm, Yarn; build script, then production
  dependencies only, without `.env` files) into a zip and deploys it to Azure App Service with
  `azure/webapps-deploy` v3.0.8 pinned by SHA, on pushes to the default branch and manual
  runs. PRs only build. Signs in with the `azure-login` action; the deploy job runs in a
  GitHub environment (`production`). Optional health check after the deploy. Copy and call
  modes.
- `tests/fixtures/dotnet-web` and `tests/fixtures/node-web`: minimal ASP.NET and Node web apps
  without dependencies, for the self-test.
- `azure-container-apps-deploy.yml`: deploys the image docker-build-push pushed for the commit
  (`sha-<commit>`, derived from the same registry values, or any `image` such as
  `image@digest` in call mode) to an existing Azure Container App with
  `az containerapp update`, after each push to the default branch (`workflow_run`, or after
  `Trivy scan` to deploy only scanned images). Manual runs take a `tag` to roll back. Waits
  for the new revision to run, warns when multiple revision mode leaves it without traffic,
  optional health check. Signs in with the `azure-login` action; the deploy job runs in a
  GitHub environment (`production`). No third-party actions. Outputs the image, revision and
  URL. Copy and call modes.
- `actions/azure-login`: first composite action. Checks the `AZURE_*` values (set, GUIDs) and
  the job's `id-token: write` permission with clear errors, then runs `azure/login` (OIDC).
  The Azure deploys reference it as `rubone/shared-workflows/actions/azure-login@v1` in both
  modes, so `v1` must be moved to a release that includes it before they can sign in.

## [1.0.0] - 2026-11-05

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
  provider, pinned by SHA; the Gradle wrapper is validated. On pushes and manual or scheduled
  runs on the default branch, a second job submits the Gradle dependencies to the dependency
  graph. Skips with a warning without `gradlew` or an Android plugin, and for Flutter
  projects. Copy and call modes.
- `flutter-ci.yml`: checks formatting (`dart format`), runs `flutter analyze` and
  `flutter test`, and builds the debug APK or the web app (uploaded as an artifact). Takes the
  Flutter version from FVM (`.fvmrc`, `.fvm/fvm_config.json`) or an exact version in
  `pubspec.yaml`, else the latest stable; enforces `pubspec.lock`; runs `build_runner` when
  it's a dependency; packages and plugins skip the build. Skips with a warning without a
  Flutter `pubspec.yaml`. Uses `subosito/flutter-action` v2.23.0 (SDK and pub caches),
  `actions/setup-java` v6.1.0 (JDK 17) and `gradle/actions` v6.4.0, pinned by SHA. Copy and
  call modes.
- `tests/fixtures/`: sample projects (npm, pnpm, Yarn 1, Yarn 4, .NET 10 with xUnit, Android
  with AGP 9, Flutter 3.47) for the self-test.
- `_self-test.yml`: runs actionlint and a smoke test of the reusable workflows on every PR.
- `.gitignore` and this changelog.

[Unreleased]: https://github.com/rubone/shared-workflows/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/rubone/shared-workflows/releases/tag/v1.0.0
