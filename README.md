# shared-workflows

GitHub Actions workflows and composite actions to standardize CI/CD across projects, in any
organization.

Each workflow is a **single self-contained file** that works two ways:

- **Copy (main use):** copy the file as-is into `.github/workflows/` of any repo, in any
  organization, and edit the values marked in its `env:` block. No dependency on this repo,
  except the Azure deploys, which sign in with this repo's
  [`azure-login`](docs/azure-login.md) action.
- **Call:** any repo, in any organization, uses it as a reusable workflow with
  `uses: rubone/shared-workflows/...@v1` and passes the same values as `with:` inputs. Updates
  arrive by moving the tag, with no copying.

---

## Structure

```
shared-workflows/
├── .github/
│   └── workflows/        # reusable workflows + _self-test.yml
├── actions/              # composite actions
├── examples/             # sample caller workflows
├── docs/                 # inputs, secrets, and outputs for each workflow
├── tests/fixtures/       # sample projects used by _self-test.yml
├── CHANGELOG.md
└── README.md
```

| Directory | Contents |
|---|---|
| `.github/workflows/` | Workflows (full jobs). GitHub doesn't allow subfolders here. Each one has its normal trigger (for copy mode) plus `on: workflow_call` (for call mode). `_self-test.yml` only validates this repo and is not meant to be copied. |
| `actions/` | Composite actions: reusable groups of steps for use inside any job (setup, login, caching). |
| `examples/` | Sample caller workflows for call mode. |
| `docs/` | Documentation for each workflow and action: inputs, secrets, and outputs. |
| `tests/fixtures/` | Minimal sample projects (no dependencies) that `_self-test.yml` runs the stack workflows against. Not meant to be copied. |

## Available workflows

| Workflow | What it does | Docs | Example |
|---|---|---|---|
| [`pr_slack_notify.yml`](.github/workflows/pr_slack_notify.yml) | Posts a Slack message when a PR is opened or leaves draft, with a Jira ticket button and owner mentions. | [docs](docs/pr-slack-notification.md) | [caller](examples/pr-slack-notify.yml) |
| [`dependency-review.yml`](.github/workflows/dependency-review.yml) | Fails PRs that add dependencies with known vulnerabilities (and, optionally, disallowed licenses). Skips with a warning where the repo doesn't support it. | [docs](docs/dependency-review.md) | [caller](examples/dependency-review.yml) |
| [`secret-scan.yml`](.github/workflows/secret-scan.yml) | Fails PRs and pushes that commit secrets (tokens, keys, connection strings) using gitleaks. Works in private repos without Advanced Security. | [docs](docs/secret-scan.md) | [caller](examples/secret-scan.yml) |
| [`codeql.yml`](.github/workflows/codeql.yml) | CodeQL static analysis for security bugs. Detects the languages (C#, JS/TS, Java/Kotlin, Python, Actions) and analyzes each in parallel. Skips with a warning where code scanning isn't available. | [docs](docs/codeql.md) | [caller](examples/codeql.yml) |
| [`pr-checks.yml`](.github/workflows/pr-checks.yml) | Checks that the PR title follows Conventional Commits, and labels the PR by size (`size/XS`…`size/XL`) and by changed paths. | [docs](docs/pr-checks.md) | [caller](examples/pr-checks.yml), [labeler](examples/labeler.yml) |
| [`stale.yml`](.github/workflows/stale.yml) | Daily: marks issues and PRs with no activity as `stale` and closes them later if nothing happens. Dry-run mode to try it safely. | [docs](docs/stale.md) | [caller](examples/stale.yml) |
| [`node-ci.yml`](.github/workflows/node-ci.yml) | Installs with cache and runs the project's lint, type check, test and build scripts. Detects npm, pnpm or Yarn and the Node version. React, Angular, Vue, Next.js, Node backends. | [docs](docs/node-ci.md) | [caller](examples/node-ci.yml) |
| [`dotnet-ci.yml`](.github/workflows/dotnet-ci.yml) | Restores with cache, checks formatting (with `.editorconfig`), builds and runs the tests of a .NET solution. SDK from `global.json`. | [docs](docs/dotnet-ci.md) | [caller](examples/dotnet-ci.yml) |
| [`android-ci.yml`](.github/workflows/android-ci.yml) | Android Lint, unit tests and the debug APK (uploaded as an artifact), with Gradle caching. Variant configurable for flavors. Submits the Gradle dependencies to the dependency graph on pushes to `main`. | [docs](docs/android-ci.md) | [caller](examples/android-ci.yml) |
| [`flutter-ci.yml`](.github/workflows/flutter-ci.yml) | Checks formatting, runs `flutter analyze` and the tests, and builds the debug APK or the web app (uploaded as an artifact). Flutter version from FVM or `pubspec.yaml`; runs `build_runner` when the project uses it. | [docs](docs/flutter-ci.md) | [caller](examples/flutter-ci.yml) |
| [`php-laravel-ci.yml`](.github/workflows/php-laravel-ci.yml) | Installs with Composer cache and runs a Laravel app's tests (Pest or PHPUnit) on SQLite, MySQL, MariaDB or PostgreSQL. Optional Pint, PHPStan/Larastan and Vite build. PHP version from `composer.json` and `composer.lock`. | [docs](docs/php-laravel-ci.md) | [caller](examples/php-laravel-ci.yml) |
| [`docker-build-push.yml`](.github/workflows/docker-build-push.yml) | Builds the Docker image with Buildx and cache, and pushes it to GHCR or ACR (OIDC, no passwords) tagged by commit, branch and semver. PRs only build. Optional multi-platform (amd64 + arm64). | [docs](docs/docker-build-push.md) | [caller](examples/docker-build-push.yml) |
| [`trivy-scan.yml`](.github/workflows/trivy-scan.yml) | Scans the Docker image for known vulnerabilities with Trivy: on PRs (built from the Dockerfile), after each push and weekly. Fails on CRITICAL/HIGH ones with a fix; results in the Security tab. | [docs](docs/trivy-scan.md) | [caller](examples/trivy-scan.yml) |
| [`azure-static-web-apps-deploy.yml`](.github/workflows/azure-static-web-apps-deploy.yml) | Builds a frontend (React, Angular, Vue…) with its package manager and deploys it to Azure Static Web Apps from `main`. PRs only build. OIDC (no stored secret) or the deployment token. | [docs](docs/azure-static-web-apps-deploy.md) | [caller](examples/azure-static-web-apps-deploy.yml) |
| [`azure-webapp-deploy.yml`](.github/workflows/azure-webapp-deploy.yml) | Builds a .NET (`dotnet publish`) or Node app (production dependencies only) into a package and deploys it to Azure App Service from `main`, with an optional health check. PRs only build. OIDC, no stored secret. | [docs](docs/azure-webapp-deploy.md) | [caller](examples/azure-webapp-deploy.yml) |
| [`azure-container-apps-deploy.yml`](.github/workflows/azure-container-apps-deploy.yml) | Deploys the image docker-build-push pushed (`sha-<commit>`) to an existing Azure Container App after each push to `main`, waits for the new revision to run, with an optional health check. Manual runs roll back to an earlier tag. OIDC, no stored secret. | [docs](docs/azure-container-apps-deploy.md) | [caller](examples/azure-container-apps-deploy.yml) |

## Available actions

| Action | What it does | Docs |
|---|---|---|
| [`azure-login`](actions/azure-login/action.yml) | Signs in to Azure with OpenID Connect (no stored secret), after checking the `AZURE_*` values and the job's `id-token` permission with clear errors. Used by the Azure deploys (Static Web Apps, Web App, Container Apps). | [docs](docs/azure-login.md) |

### Repo settings each workflow needs

None of the workflows fail when a setting is missing: they skip with a warning and the run
stays green. Settings live in the project repo under **Settings → Advanced Security**.

| Workflow | Needs in the project repo | Public repo | Private repo |
|---|---|---|---|
| `pr_slack_notify.yml` | Secret `SLACK_PR_WEBHOOK_URL` | — | — |
| `dependency-review.yml` | **Dependency graph** enabled | Free. Usually on, but check it: a repo turned from private to public may have it off. | Needs GitHub Code Security / Advanced Security |
| `secret-scan.yml` | Nothing | — | — |
| `codeql.yml` | **Code scanning** available, with CodeQL **default setup off** | Free, nothing to enable | Needs GitHub Code Security / Advanced Security |
| `pr-checks.yml` | Optional `.github/labeler.yml` for path labels. Recommended: squash merge only, with the PR title as commit message | — | — |
| `stale.yml` | Nothing | — | — |
| `node-ci.yml` | A committed lockfile | — | — |
| `dotnet-ci.yml` | Nothing | — | — |
| `android-ci.yml` | A committed Gradle wrapper (`gradlew`). For the dependency submission job: **Dependency graph** enabled (without it, that job only warns) | Free | Free |
| `flutter-ci.yml` | Nothing. Recommended: Flutter pinned with FVM (`.fvmrc`) and `pubspec.lock` committed | — | — |
| `php-laravel-ci.yml` | Nothing. Recommended: `composer.lock` committed | — | — |
| `docker-build-push.yml` | GHCR: nothing. ACR: an identity with AcrPush and a federated credential, and the `AZURE_*` repository variables | GHCR free | GHCR: free quota, then billed storage |
| `trivy-scan.yml` | The image published by `docker-build-push.yml` (same values in both). For the Security tab: **Code scanning** available. ACR: AcrPull and the `AZURE_*` variables | Free | Security tab needs GitHub Code Security; without it, job summary only |
| `azure-static-web-apps-deploy.yml` | A Static Web App, and either an identity with Contributor on it plus `APP_NAME` and the `AZURE_*` variables (OIDC), or the `AZURE_STATIC_WEB_APPS_API_TOKEN` secret | Free plan available | Free plan available |
| `azure-webapp-deploy.yml` | A Web App with the matching runtime, an identity with Website Contributor on it, `APP_NAME` and the `AZURE_*` variables | App Service plan | App Service plan |
| `azure-container-apps-deploy.yml` | A Container App that can pull the image (ACR: its managed identity with AcrPull), an identity with Container Apps Contributor on the app and its environment, `APP_NAME` and the `AZURE_*` variables. Copy mode: `docker-build-push.yml` next to it | Consumption plan with a free monthly grant | Consumption plan with a free monthly grant |

Recommended, though no workflow depends on them:

- **Dependabot alerts:** warn about vulnerable dependencies already on `main` (dependency review
  only checks what each PR changes).
- **Secret scanning + push protection:** block a secret *before* it's pushed; `secret-scan.yml`
  finds it *after*, with its own rules. Free for public repos; private repos need GitHub Secret
  Protection.

In call mode, the organization's Actions policy must also allow `rubone/shared-workflows/*`
(see [Call](#call-any-organization)).

## Usage

### Copy (any organization)

1. Copy the workflow file (e.g. [`pr_slack_notify.yml`](.github/workflows/pr_slack_notify.yml))
   to `.github/workflows/` in the target repo.
2. Edit the values in its top-level `env:` block (marked `>>> Edit these`).
3. Add the secrets listed in the file header to the repo or its organization.

Keep the file otherwise unchanged, so updating means copying the new version and re-applying
your `env` values. The [CHANGELOG](CHANGELOG.md) says what changed between versions.

### Call (any organization)

Call the workflow from a job in the project repo:

```yaml
jobs:
  notify:
    uses: rubone/shared-workflows/.github/workflows/pr_slack_notify.yml@v1
    with:
      jira_base_url: 'https://<your-domain>.atlassian.net'
    secrets:
      SLACK_PR_WEBHOOK_URL: ${{ secrets.SLACK_PR_WEBHOOK_URL }}
```

Inputs override the file's `env` values. This repo is public, so any repo can call it. If the
caller's organization restricts actions (**Settings → Actions → General → Policies**), add
`rubone/shared-workflows/*` to its allow list, or use copy mode.

Which mode to pick:

| | Copy | Call |
|---|---|---|
| Depends on this repo at run time | No | Yes |
| Org policy must allow external workflows | No | Yes |
| Getting fixes and improvements | Re-copy the file | Automatic within `@v1` |
| Customizing beyond the `env` values | Edit the copy freely | Only through inputs |

## Versioning

Releases are tagged with [Semantic Versioning](https://semver.org/) (`v1.0.0`), plus a moving
major tag (`v1`) that points to the latest `v1.x.y`. Callers pin `@v1` (or a commit SHA for
maximum safety), never `@main`. For copy mode, take the file from a release tag, not from
`main`. Breaking changes to inputs, secrets or behavior bump the major version. See
[CHANGELOG.md](CHANGELOG.md).

```bash
git tag v1.1.0 && git push origin v1.1.0
git tag -f v1 v1.1.0 && git push -f origin v1
```
