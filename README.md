# shared-workflows

Library of GitHub Actions workflows and composite actions to reuse across projects, in any
organization.

Nothing here runs in this repo: workflows live in `workflows/`, which GitHub ignores. To use
one, copy it into `.github/workflows/` of the target repo and edit the values marked in its
`env:` block. The copied file has no dependency on this repo.

---

## Structure

```
shared-workflows/
├── workflows/            # workflow templates to copy (not run here)
├── actions/              # composite actions
├── docs/                 # setup, inputs and secrets for each workflow
├── CHANGELOG.md
└── README.md
```

| Directory | Contents |
|---|---|
| `workflows/` | Complete workflow files, ready to copy into `.github/workflows/` of another repo. GitHub only runs files under `.github/workflows/`, so they never trigger here. |
| `actions/` | Composite actions: reusable groups of steps for use inside any job (setup, login, caching). |
| `docs/` | Documentation for each workflow and action: setup, values to configure, secrets. |

## Available workflows

| Workflow | What it does | Docs |
|---|---|---|
| [`pr_slack_notify.yml`](workflows/pr_slack_notify.yml) | Posts a Slack message when a PR is opened or leaves draft, with a Jira ticket button and owner mentions. | [docs](docs/pr-slack-notification.md) |

## Usage

1. Copy the workflow file (e.g. [`workflows/pr_slack_notify.yml`](workflows/pr_slack_notify.yml))
   to `.github/workflows/` in the target repo.
2. Edit the values in its top-level `env:` block (marked `>>> Edit these`).
3. Add the secrets listed in the file header to the repo or its organization.

Keep the file otherwise unchanged, so updating means copying the new version and re-applying
your `env` values. The [CHANGELOG](CHANGELOG.md) says what changed between versions.

## Validating changes

Nothing runs in CI here, so lint the workflows locally before pushing
([actionlint](https://github.com/rhysd/actionlint), via Docker):

```bash
docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:1.7.7 -color workflows/*.yml
```

## Versioning

Releases are tagged with [Semantic Versioning](https://semver.org/) (`v1.0.0`). Copy files from
a release tag rather than from `main`, so you know which version each project has. Changes that
require editing a copied file (new or renamed `env` values or secrets) bump the major version.
See [CHANGELOG.md](CHANGELOG.md).

```bash
git tag v1.0.0 && git push origin v1.0.0
```
