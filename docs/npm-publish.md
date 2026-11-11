# npm publish

Workflow that publishes an npm package when a GitHub release is published, to
**npmjs.com** or **GitHub Packages**:

1. Checks that `package.json`'s version matches the release tag (`v1.2.3` → `1.2.3`).
2. Installs the dependencies, runs the `build` script and packs the package with its package
   manager.
3. Publishes that tarball with `npm publish`, unless the version is already in the registry.

With [release](release.md), the release PR updates `package.json`, and merging it creates
the release that triggers this workflow.

- Workflow: [`.github/workflows/npm-publish.yml`](../.github/workflows/npm-publish.yml)
- Caller sample (call mode): [`examples/npm-publish.yml`](../examples/npm-publish.yml)
- Actions: `actions/setup-node` v7.1.0 and `pnpm/action-setup` v6.1.0 (pnpm only), pinned by
  commit SHA. npm 11.20.0 when the Node version comes with an npm older than 11.5.1.
- Repo access: `contents: read`, `id-token: write` (npmjs trusted publishing and
  provenance), `packages: write` (GitHub Packages).

| Registry | Authentication | Provenance |
|---|---|---|
| npmjs.com (default) | **Trusted publishing** (OIDC): no stored token | Automatic, for public packages from public repos |
| npmjs.com | `NPM_TOKEN` secret (granular access token) | Added from public repos (`--provenance`) |
| GitHub Packages | `GITHUB_TOKEN` | Not supported by GitHub Packages |

---

## Requirements

- A `package.json` in `WORKING_DIRECTORY` with `name` and `version`, and without
  `"private": true`. Without one, or with `private`, the workflow skips with a warning and
  the run stays green.
- A committed lockfile, if the package has dependencies.
- **npmjs.com with trusted publishing:**
  - `repository.url` in `package.json` pointing to this repo, e.g.
    `"repository": { "type": "git", "url": "git+https://github.com/<owner>/<repo>.git" }`.
  - Node 22.14 or later (the `NODE_VERSION`, `.nvmrc` or `engines` the package uses).
  - The package configured on npmjs.com (see [Trusted publishing](#trusted-publishing)).
  - A GitHub-hosted runner (the default `ubuntu-latest`).
- **GitHub Packages:** the name scoped to the repo owner, in lowercase: `@<owner>/<name>`.
- A release that **triggers workflows**: one created with `GITHUB_TOKEN` (release.yml's
  default) doesn't. Use release.yml's [GitHub App](release.md#github-app), or publish in
  the same run (see [After release.yml](#after-releaseyml-same-run)).

---

## Usage

The same file supports two modes. Pick one per repo.

| | A) Copy (main use) | B) Call |
|---|---|---|
| Works for | Any repo, any organization | Any repo, any organization whose Actions policy allows workflows from `rubone/shared-workflows` |
| What goes in the project repo | The whole `npm-publish.yml` | A ~30 line caller ([example](../examples/npm-publish.yml)) |
| Where values go | Top-level `env:` of the copied file | `with:` inputs in the caller |
| Trigger | `on:` in the copied file: release published, manual | `on:` in the caller |
| Workflow name for trusted publishing | `npm-publish.yml` | The caller's file name |

### A) Copy

1. Copy [`.github/workflows/npm-publish.yml`](../.github/workflows/npm-publish.yml) to
   `.github/workflows/` in the target repo.
2. Edit the values under `env:` (`REGISTRY`, `WORKING_DIRECTORY`…) if the defaults don't
   fit.
3. npmjs.com: set up [trusted publishing](#trusted-publishing) with the workflow name
   `npm-publish.yml`, or add the `NPM_TOKEN` secret.

### B) Call

```yaml
on:
  release:
    types: [published]

jobs:
  publish:
    permissions:
      contents: read
      id-token: write
      packages: write
    uses: rubone/shared-workflows/.github/workflows/npm-publish.yml@v1
```

`id-token: write` is needed in the caller too. npm checks the **caller's** workflow name
(e.g. `npm-publish.yml` in the project repo), not this repo's file.

With a token instead of trusted publishing (secrets aren't inherited):

```yaml
    secrets:
      NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### After release.yml (same run)

A release created with `GITHUB_TOKEN` doesn't trigger the `release` event. Publish from the
same workflow as release.yml instead, after the release PR is merged:

```yaml
on:
  push:
    branches: [main]

jobs:
  release:
    permissions: { contents: write, pull-requests: write, issues: write }
    uses: rubone/shared-workflows/.github/workflows/release.yml@v1

  publish:
    needs: release
    if: needs.release.outputs.release_created == 'true'
    permissions: { contents: read, id-token: write, packages: write }
    uses: rubone/shared-workflows/.github/workflows/npm-publish.yml@v1
    with:
      tag: ${{ needs.release.outputs.tag_name }}
```

The run's commit is the merge of the release PR, which holds the new version. For trusted
publishing, configure the name of this workflow file (e.g. `release.yml`).

### Publishing again by hand

**Actions → npm publish → Run workflow**, choosing the release tag under **Use workflow
from → Tags**. `dry_run` packs and runs `npm publish --dry-run` without publishing. A
version already in the registry is skipped, so re-running after a failure is safe.

## Values

| `env` (copy) | Input (call) | Default | Description |
|---|---|---|---|
| `WORKING_DIRECTORY` | `working_directory` | `.` | Folder with the package's `package.json`. For several packages, copy or call the workflow once per package. |
| `REGISTRY` | `registry` | `npmjs` | `npmjs` or `github` (GitHub Packages). |
| `DIST_TAG` | `dist_tag` | `''` | npm dist-tag. Empty = `latest`, or the prerelease id for prereleases (`1.0.0-rc.1` → `rc`, `1.0.0-1` → `next`). |
| `ACCESS` | `access` | `public` | npmjs only: `public`, or `restricted` (private package, paid plan). Needed as `public` for the first publish of a scoped package. |
| `NODE_VERSION` | `node_version` | `''` | Empty = from `.nvmrc`, `.node-version` or `package.json` (`volta`, `devEngines`, `engines`), else the latest LTS. |
| `PNPM_VERSION` | — | `10` | pnpm only, when `package.json` has no `packageManager` field. |
| `BUILD_SCRIPT` | `build_script` | `build` | Scripts to try before packing, comma-separated; the first one that exists runs. `off` = none. |
| — (manual run input) | `dry_run` | `false` | `true` = `npm publish --dry-run`. |
| — | `tag` | `''` | Release tag that the version must match. Empty = the release's tag, or the run's tag. Without any tag, the version in `package.json` is published, with a notice. |
| Secret `NPM_TOKEN` | Secret, same name | — | npmjs.com granular access token. Empty = trusted publishing. |

In call mode, an empty input falls back to the `env` value.

**Outputs** (call mode): `published` (`'true'` when this run published), `name`, `version`,
`dist_tag`.

## Trusted publishing

Once per package, on npmjs.com:

1. **The package must exist.** For a new package, publish the first version with a token
   (`NPM_TOKEN`, or `npm publish` from your machine), then switch.
2. Package → **Settings → Trusted publishing → GitHub Actions**:
   - **Organization or user** and **Repository**: this repo.
   - **Workflow filename**: `npm-publish.yml` (copy mode), or the caller's file name (call
     mode). Only the name, with `.yml`; it's case-sensitive.
   - **Environment**: empty.
3. Optional, recommended: **Publishing access → Require two-factor authentication and
   disallow tokens**. Trusted publishing keeps working.

npm doesn't check the configuration when you save it: the first run tells. A new trusted
publisher expires if nothing is published with it within 2 days.

## How it works

One job, **Publish npm package**, one run at a time per package, registry and version, and
never cancelled:

1. **Detect package**: reads `package.json`, checks the version against the tag, picks the
   dist-tag and the authentication, and detects the package manager (from the lockfile,
   like [node-ci](node-ci.md)) and the Node version.
2. Sets up Node (and pnpm or Yarn 2+ through Corepack). Updates npm when it's older than
   11.5.1.
3. Installs the dependencies from the lockfile (no cache: a release builds from scratch) and
   runs the build script.
4. **Pack**: `npm pack`, `pnpm pack` or `yarn pack`. pnpm and Yarn replace `workspace:`
   versions with real ones. Checks that the tarball holds the expected name and version,
   and lists its files.
5. **Check the registry**: if the version is already there, stops with a notice.
6. **Publish**: `npm publish <tarball>` with the registry, dist-tag and access. The token
   (when there is one) is only given to this step and the previous one, through
   `NODE_AUTH_TOKEN`; installs and scripts never see it.

## Verify

1. `dry_run` from **Actions → npm publish → Run workflow**: the log lists the files in the
   tarball and ends with `+ <name>@<version>` (dry-run).
2. Publish a release (or merge a release PR). The summary links the published version.
3. On npmjs.com, the version shows a **Provenance** badge (public repo and package).

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Nothing runs after release.yml creates a release | The release was created with `GITHUB_TOKEN` | release.yml's GitHub App, or [publish in the same run](#after-releaseyml-same-run) |
| `package.json has version X, but the tag vY is Y` | The release didn't update `package.json`, or the run is on the wrong tag | release.yml (node) updates it in the release PR; for manual runs, choose the tag |
| `needs "repository"` | `repository.url` is missing or points to another repo | Set it to this repo |
| `E404 Not Found - PUT` with trusted publishing | No trusted publisher matches: wrong repo or workflow name (in call mode, the caller's), or the package doesn't exist yet | Check the settings on npmjs.com; publish the first version with a token |
| `ENEEDAUTH` / `need auth` | No trusted publisher and no `NPM_TOKEN` | Configure one of them |
| `Trusted publishing needs Node 22.14 or later` | The package pins an older Node | Set `NODE_VERSION` to 22.14+ (it only builds the package), or use a token |
| `E402 Payment Required` | First publish of a scoped package as private | `ACCESS: public`, or a paid plan for `restricted` |
| `E403 You cannot publish over the previously published versions` | The version exists but wasn't visible without a token (restricted package) | Expected for re-runs; nothing to do |
| `E422 … provenance` | `repository.url` doesn't match, or the repo is private | Fix `repository.url`; from private repos there's no provenance |
| `GitHub Packages needs the package scoped to the repo owner` | The name isn't `@<owner>/…` | Rename it, or use npmjs |
| `publishConfig.registry … but REGISTRY is …` | `package.json` points to another registry | Remove `publishConfig.registry` or change `REGISTRY` |
| `Publishing the prerelease … as 'latest'` (warning) | `DIST_TAG: latest` with a prerelease version | Leave `DIST_TAG` empty |

## Possible extensions

- Several packages of a workspace in one run (matrix over the folders).
- Deprecating or unpublishing versions, and moving dist-tags by hand.
- Publishing to both registries.
