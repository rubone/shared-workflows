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
- `_self-test.yml`: runs actionlint and a smoke test of the reusable workflows on every PR.
- `.gitignore` and this changelog.
