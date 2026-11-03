# shared-workflows

GitHub Actions workflows and composite actions to standardize CI/CD across projects, in any
organization.

Each workflow is a **single self-contained file** that works two ways:

- **Copy (main use):** copy the file as-is into `.github/workflows/` of any repo, in any
  organization, and edit the values marked in its `env:` block. No dependency on this repo.
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
| [`pr-checks.yml`](.github/workflows/pr-checks.yml) | Checks that the PR title follows Conventional Commits, and labels the PR by size (`size/XS`…`size/XL`) and by changed paths. | [docs](docs/pr-checks.md) | [caller](examples/pr-checks.yml), [labeler](examples/labeler.yml) |

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

> **No release yet.** The first one (`v1.0.0`) will be tagged once the per-stack CI workflows
> are done. Until then, `@v1` doesn't exist: pin a commit SHA of `main` to call a workflow, and
> copy files from `main`.

Releases are tagged with [Semantic Versioning](https://semver.org/) (`v1.0.0`), plus a moving
major tag (`v1`) that points to the latest `v1.x.y`. Callers pin `@v1` (or a commit SHA for
maximum safety), never `@main`. For copy mode, take the file from a release tag, not from `main`. Breaking changes to inputs, secrets or behavior bump the major
version. See [CHANGELOG.md](CHANGELOG.md).

```bash
git tag v1.0.0 && git push origin v1.0.0
git tag -f v1 v1.0.0 && git push -f origin v1
```
