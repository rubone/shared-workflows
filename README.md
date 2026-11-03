# shared-workflows

GitHub Actions workflows and composite actions to standardize CI/CD across projects, in any
organization.

Each workflow is a **single self-contained file** that works two ways:

- **Copy (main use):** copy the file as-is into `.github/workflows/` of any repo, in any
  organization, and edit the values marked in its `env:` block. No dependency on this repo.
- **Call:** repos that can reach this repo use it as a reusable workflow with
  `uses: rubone/shared-workflows/...@v1` and pass the same values as `with:` inputs.

---

## Structure

```
shared-workflows/
├── .github/
│   └── workflows/        # reusable workflows + _self-test.yml
├── actions/              # composite actions
├── examples/             # sample caller workflows
├── docs/                 # inputs, secrets, and outputs for each workflow
├── CHANGELOG.md
└── README.md
```

| Directory | Contents |
|---|---|
| `.github/workflows/` | Workflows (full jobs). GitHub doesn't allow subfolders here. Each one has its normal trigger (for copy mode) plus `on: workflow_call` (for call mode). `_self-test.yml` only validates this repo and is not meant to be copied. |
| `actions/` | Composite actions: reusable groups of steps for use inside any job (setup, login, caching). |
| `examples/` | Sample caller workflows for call mode. |
| `docs/` | Documentation for each workflow and action: inputs, secrets, and outputs. |

## Available workflows

| Workflow | What it does | Docs | Example |
|---|---|---|---|
| [`pr_slack_notify.yml`](.github/workflows/pr_slack_notify.yml) | Posts a Slack message when a PR is opened or leaves draft, with a Jira ticket button and owner mentions. | [docs](docs/pr-slack-notification.md) | [caller](examples/pr-slack-notify.yml) |
| [`dependency-review.yml`](.github/workflows/dependency-review.yml) | Fails PRs that add dependencies with known vulnerabilities (and, optionally, disallowed licenses). Skips with a warning where the repo doesn't support it. | [docs](docs/dependency-review.md) | [caller](examples/dependency-review.yml) |
| [`secret-scan.yml`](.github/workflows/secret-scan.yml) | Fails PRs and pushes that commit secrets (tokens, keys, connection strings) using gitleaks. Works in private repos without Advanced Security. | [docs](docs/secret-scan.md) | [caller](examples/secret-scan.yml) |
| [`codeql.yml`](.github/workflows/codeql.yml) | CodeQL static analysis for security bugs. Detects the languages (C#, JS/TS, Java/Kotlin, Python, Actions) and analyzes each in parallel. Skips with a warning where code scanning isn't available. | [docs](docs/codeql.md) | [caller](examples/codeql.yml) |

## Usage

### Copy (any organization)

1. Copy the workflow file (e.g. [`pr_slack_notify.yml`](.github/workflows/pr_slack_notify.yml))
   to `.github/workflows/` in the target repo.
2. Edit the values in its top-level `env:` block (marked `>>> Edit these`).
3. Add the secrets listed in the file header to the repo or its organization.

Keep the file otherwise unchanged, so updating means copying the new version and re-applying
your `env` values. The [CHANGELOG](CHANGELOG.md) says what changed between versions.

### Call (same owner)

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

Inputs override the file's `env` values. If this repo is private, callers must belong to the
same owner, and **Settings → Actions → General → Access** must allow access from those
repositories. For other organizations, use copy mode.

## Versioning

Releases are tagged with [Semantic Versioning](https://semver.org/) (`v1.0.0`), plus a moving
major tag (`v1`) that points to the latest `v1.x.y`. Callers pin `@v1` (or a commit SHA for
maximum safety), never `@main`. For copy mode, take the file from a release tag, not from `main`. Breaking changes to inputs, secrets or behavior bump the major
version. See [CHANGELOG.md](CHANGELOG.md).

```bash
git tag v1.0.0 && git push origin v1.0.0
git tag -f v1 v1.0.0 && git push -f origin v1
```
