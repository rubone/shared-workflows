# NuGet publish

Workflow that packs the .NET projects of a solution and pushes them when a GitHub release is
published, to **nuget.org** or **GitHub Packages**:

1. Takes the version from the release tag (`v1.2.3` → `1.2.3`).
2. Restores and runs `dotnet pack` in Release with `-p:Version`, with symbol packages
   (`.snupkg`) for nuget.org.
3. Pushes each package with `dotnet nuget push --skip-duplicate`: a version already in the
   feed is skipped, so re-running is safe.

With [release](release.md), merging the release PR creates the release that triggers this
workflow. The projects don't need a `<Version>`: the tag sets it.

- Workflow: [`.github/workflows/nuget-publish.yml`](../.github/workflows/nuget-publish.yml)
- Caller sample (call mode): [`examples/nuget-publish.yml`](../examples/nuget-publish.yml)
- Actions: `actions/setup-dotnet` v6.0.0 and, for trusted publishing, `NuGet/login` v1.2.0,
  pinned by commit SHA.
- Repo access: `contents: read`, `id-token: write` (nuget.org trusted publishing),
  `packages: write` (GitHub Packages).

| Registry | Authentication |
|---|---|
| nuget.org (default) | **Trusted publishing**: `NuGet/login` exchanges the job's OIDC token for an API key valid 1 hour. Needs the `NUGET_USER` variable |
| nuget.org | `NUGET_API_KEY` secret (an API key with push rights) |
| GitHub Packages | `GITHUB_TOKEN` (no symbol packages) |

---

## Requirements

- A solution (`.slnx`, `.sln`) or project in `WORKING_DIRECTORY`. Without one, the workflow
  skips with a warning and the run stays green.
- At least one **packable** project. Test projects (`Microsoft.NET.Test.Sdk`) and projects
  with `<IsPackable>false</IsPackable>` are left out; ASP.NET apps usually set it.
  Recommended in each package: `<PackageId>`, `<Authors>`, `<Description>`,
  `<PackageLicenseExpression>` and `<PackageReadmeFile>`.
- No `<PackageVersion>` in the projects: it would win over the tag (the run fails if a
  package doesn't have the tag's version). A plain `<Version>` is overridden, with a
  warning when it differs.
- A release tag ending in the version: `v1.2.3`, `1.2.3` or `name-v1.2.3`. Manual runs take
  it from the tag chosen under **Use workflow from**.
- **nuget.org with trusted publishing:** a policy on nuget.org (see
  [Trusted publishing](#trusted-publishing)) and the `NUGET_USER` repository variable with
  the nuget.org **profile name** (not the email).
- A release that **triggers workflows**: one created with `GITHUB_TOKEN` (release.yml's
  default) doesn't. Use release.yml's [GitHub App](release.md#github-app), or publish in
  the same run (see [After release.yml](#after-releaseyml-same-run)).

---

## Usage

The same file supports two modes. Pick one per repo.

| | A) Copy (main use) | B) Call |
|---|---|---|
| Works for | Any repo, any organization | Any repo, any organization whose Actions policy allows workflows from `rubone/shared-workflows` |
| What goes in the project repo | The whole `nuget-publish.yml` | A ~30 line caller ([example](../examples/nuget-publish.yml)) |
| Where values go | Top-level `env:` of the copied file | `with:` inputs in the caller |
| Trigger | `on:` in the copied file: release published, manual | `on:` in the caller |

### A) Copy

1. Copy [`.github/workflows/nuget-publish.yml`](../.github/workflows/nuget-publish.yml) to
   `.github/workflows/` in the target repo.
2. Edit the values under `env:` if the defaults don't fit.
3. nuget.org: create the [trusted publishing](#trusted-publishing) policy with the workflow
   file `nuget-publish.yml`, and add the `NUGET_USER` variable. Or add the `NUGET_API_KEY`
   secret.

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
    uses: rubone/shared-workflows/.github/workflows/nuget-publish.yml@v1
    with:
      nuget_user: ${{ vars.NUGET_USER }}
```

Pass `nuget_user` explicitly, as above. With an API key instead (secrets aren't inherited):

```yaml
    secrets:
      NUGET_API_KEY: ${{ secrets.NUGET_API_KEY }}
```

### After release.yml (same run)

A release created with `GITHUB_TOKEN` doesn't trigger the `release` event. Publish from the
same workflow as release.yml instead:

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
    uses: rubone/shared-workflows/.github/workflows/nuget-publish.yml@v1
    with:
      tag: ${{ needs.release.outputs.tag_name }}
      nuget_user: ${{ vars.NUGET_USER }}
```

### Publishing again by hand

**Actions → NuGet publish → Run workflow**, choosing the release tag under **Use workflow
from → Tags**. `dry_run` packs without pushing; the packages are listed in the log.

## Values

| `env` (copy) | Input (call) | Default | Description |
|---|---|---|---|
| `WORKING_DIRECTORY` | `working_directory` | `.` | Folder with the solution. |
| `SOLUTION` | `solution` | `''` | Solution or project to pack, relative to the folder. Empty = the only `.slnx`/`.sln`, else the only project. |
| `REGISTRY` | `registry` | `nugetorg` | `nugetorg` or `github` (GitHub Packages, `nuget.pkg.github.com/<owner>`). |
| `NUGET_USER` | `nuget_user` | `vars.NUGET_USER` | nuget.org profile name of the trusted publishing policy. Empty = `NUGET_API_KEY`. |
| `DOTNET_VERSION` | `dotnet_version` | `10.0.x` | SDK when there's no `global.json` (in the folder or the repo root). |
| `SYMBOLS` | `symbols` | `true` | Symbol packages (`.snupkg`) for nuget.org's symbol server. Always off for GitHub Packages. |
| — (manual run input) | `dry_run` | `false` | `true` = pack only. |
| — | `tag` | `''` | Release tag the version comes from. Empty = the release's tag, or the run's tag. |
| Secret `NUGET_API_KEY` | Secret, same name | — | nuget.org API key. Takes precedence over `NUGET_USER`. |

In call mode, an empty input falls back to the `env` value.

**Outputs** (call mode): `published` (`'true'` when at least one new package was pushed),
`version`, `packages` (file names, comma-separated).

## Trusted publishing

Once per repo, on nuget.org (signed in as the account or organization that owns the
packages):

1. **Your user → Trusted Publishing → Create**:
   - **Repository Owner** and **Repository**: this repo.
   - **Workflow File**: `nuget-publish.yml` in copy mode: the file name only, without
     `.github/workflows/`. In call mode, nuget.org's docs don't say whether it checks the
     caller's file or this repo's; npm checks the caller's, so start with the caller's file
     name, and add a second policy with `nuget-publish.yml` if the login is refused.
   - **Environment**: empty.
2. In the repo: variable `NUGET_USER` = the nuget.org profile name (not the email).

From private repos, a new policy is active for 7 days; the first successful publish makes
it permanent.

## How it works

One job, **Publish NuGet packages**, one run at a time per folder, registry and version,
and never cancelled:

1. **Detect project**: finds the solution, takes the version from the tag, picks the
   authentication and the SDK (`global.json` or `DOTNET_VERSION`).
2. Sets up .NET and restores (locked mode with `packages.lock.json`).
3. **Pack**: `dotnet pack --configuration Release -p:Version=<tag version>
   -p:ContinuousIntegrationBuild=true`, plus `.snupkg` and, for GitHub Packages,
   `RepositoryUrl` (it links the package to the repo). Checks that every package has the
   version.
4. nuget.org with trusted publishing: `NuGet/login` gets the API key right before the push.
5. **Push**: each `.nupkg` (with its `.snupkg`) with `--skip-duplicate`. The key is only
   given to this step.

Tests aren't run: CI ([dotnet-ci](dotnet-ci.md)) already did on the commit being released.

## Verify

1. `dry_run` from **Actions → NuGet publish → Run workflow** on a release tag: the log lists
   the `.nupkg` and `.snupkg` files.
2. Publish a release (or merge a release PR). The summary links each pushed package.
3. nuget.org validates new packages (a few minutes) before listing them.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Nothing runs after release.yml creates a release | The release was created with `GITHUB_TOKEN` | release.yml's GitHub App, or [publish in the same run](#after-releaseyml-same-run) |
| `No release tag to take the version from` | Manual run from a branch | Choose the tag under **Use workflow from** |
| `nuget.org needs the NUGET_USER variable … or the NUGET_API_KEY secret` | Neither is set (in call mode, `nuget_user` wasn't passed) | Set one of them |
| `NuGet/login` fails: no matching policy | Owner, repo or workflow file don't match the policy, or it expired (private repos, 7 days) | Check the policy on nuget.org; in call mode see [Trusted publishing](#trusted-publishing) |
| `403 Forbidden` on push | The key or the policy's owner doesn't own the package ID | Use the owner of the package, or another `PackageId` |
| `dotnet pack produced no package` | No packable project | Remove `<IsPackable>false</IsPackable>` from the library |
| `… doesn't have the version` | A `<PackageVersion>` in the project | Remove it: the version comes from the tag |
| `NU5039` / readme or license errors | Package metadata points to missing files | Fix `PackageReadmeFile` / `PackageLicenseFile` paths |
| `401` on GitHub Packages | `packages: write` missing (call mode) | Grant it in the caller |
| A package shows *skipped (already in the feed)* | That version was published before | Expected on re-runs; publish a new version |

## Possible extensions

- Signing packages with a certificate.
- Running the tests before packing.
- Pushing to both registries.
