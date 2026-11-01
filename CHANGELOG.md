# Changelog

All notable changes to this repo are listed here. Versions follow
[Semantic Versioning](https://semver.org/): changes that require editing a copied file
(new or renamed `env` values or secrets) bump the major version.

## [Unreleased]

### Changed
- Workflows moved from `.github/workflows/` to `workflows/`, so they no longer run in this
  repo. The repo is now a library: copy a file into `.github/workflows/` of the target repo.
- `pr_slack_notify.yml`: `SLACK_MENTION_IDS` defaults to `''` instead of an empty YAML value.

### Added
- `.gitignore` and this changelog.
