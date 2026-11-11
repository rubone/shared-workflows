# Release

Workflow that automates versioning with
[release-please](https://github.com/googleapis/release-please), from the
[Conventional Commits](https://www.conventionalcommits.org/) on the default branch:

1. Each push to `main` opens or updates a **release PR** with the next version and its
   `CHANGELOG.md` entry.
2. Merging that PR creates the **`vX.Y.Z` tag** and the **GitHub release**, with the same
   notes.

Nothing is released until someone merges the release PR, so several features can go into
one release.

| Commits since the last release | Next version |
|---|---|
| `fix: …` | patch: 1.2.**4** |
| `feat: …` | minor: 1.**3**.0 |
| `feat!: …`, or `BREAKING CHANGE:` in the body | major: **2**.0.0 |
| Only `chore`, `docs`, `ci`, `refactor`, `test`… | no release PR |

With squash merge, each PR becomes one commit whose message is the PR title, which
[pr-checks](pr-checks.md) validates.

- Workflow: [`.github/workflows/release.yml`](../.github/workflows/release.yml)
- Caller sample (call mode): [`examples/release.yml`](../examples/release.yml)
- Actions: `googleapis/release-please-action` v5.0.0 and, with a GitHub App,
  `actions/create-github-app-token` v3.3.0, pinned by commit SHA.
- Repo access: `contents: write`, `pull-requests: write`, `issues: write` (the PR's labels).

### What the release PR updates

Detected from `WORKING_DIRECTORY` (set `RELEASE_TYPE` to choose):

| Project | Detected by | Version updated in |
|---|---|---|
| .NET | A solution, project or `Directory.Build.props` in the folder, or a solution or project up to two folders below | `version.txt`, and the `<Version>` or `<VersionPrefix>` already in `Directory.Build.props` or the projects (plain values only, not MSBuild expressions) |
| Node | A `package.json` in the folder | `package.json` and `package-lock.json` (`version`) |
| Anything else | — | `version.txt` |

All of them also update `CHANGELOG.md`. A .NET project next to a `package.json` (an ASP.NET
app with a frontend) counts as .NET. For .NET, nuget-publish takes the version from the
tag, so updating `<Version>` is optional.

---

## Requirements

- **Conventional Commits** on the default branch. Recommended: squash merge only, with the
  PR title as the commit message, and [pr-checks](pr-checks.md) on PRs.
- A token that can open PRs, one of:
  - **GITHUB_TOKEN** (default): in **Settings → Actions → General → Workflow
    permissions**, check **Allow GitHub Actions to create and approve pull requests**.
    GitHub doesn't run workflows for what this token does, so:
    - no checks run on the release PR: if a ruleset requires status checks on `main`, the
      PR can't be merged without bypassing it;
    - the tag and the release don't trigger other workflows (npm-publish, nuget-publish,
      docker-build-push on `v*` tags). Publish in the same run instead (call mode, see
      [Chaining](#chaining-a-publish-job)).
  - **A GitHub App** (recommended with rulesets or tag-triggered workflows): checks run on
    the release PR, and the release triggers other workflows. See
    [GitHub App](#github-app).

---

## Usage

The same file supports two modes. Pick one per repo.

| | A) Copy (main use) | B) Call |
|---|---|---|
| Works for | Any repo, any organization | Any repo, any organization whose Actions policy allows workflows from `rubone/shared-workflows` |
| What goes in the project repo | The whole `release.yml` | A ~40 line caller ([example](../examples/release.yml)) |
| Where values go | Top-level `env:` of the copied file | `with:` inputs in the caller |
| Trigger | `on:` in the copied file: pushes to `main`, manual | `on:` in the caller |

### A) Copy

1. Copy [`.github/workflows/release.yml`](../.github/workflows/release.yml) to
   `.github/workflows/` in the target repo.
2. If the default branch isn't `main`, change `on.push.branches`.
3. Allow GitHub Actions to create PRs (see [Requirements](#requirements)), or set up the
   [GitHub App](#github-app).

### B) Call

```yaml
jobs:
  release:
    permissions:
      contents: write
      pull-requests: write
      issues: write
    uses: rubone/shared-workflows/.github/workflows/release.yml@v1
```

With the GitHub App, pass its client ID and the secret (secrets aren't inherited):

```yaml
    with:
      app_client_id: ${{ vars.RELEASE_APP_CLIENT_ID }}
    secrets:
      RELEASE_APP_PRIVATE_KEY: ${{ secrets.RELEASE_APP_PRIVATE_KEY }}
```

### The first release

release-please continues from the latest GitHub release (`vX.Y.Z`). In a repo without
releases it reads the whole history and proposes `1.0.0`. To choose the version, of the
first release or any later one (e.g. `2.0.0` without a breaking commit), either:

- **Add a `Release-As` footer** to a commit on `main` (recommended: it holds until that
  release). With squash merge, put it at the end of the PR description and use *Pull
  request title and description* as the commit message, or push an empty commit:

  ```bash
  git commit --allow-empty -m "chore: release 0.1.0" -m "Release-As: 0.1.0"
  ```

- **Run the workflow manually** (**Actions → Release → Run workflow**) with `release_as`.
  It only applies to that run: the next push to `main` recomputes the release PR, so merge
  it first.

An existing `CHANGELOG.md` is kept: new entries go on top.

## Values

| `env` (copy) | Input (call) | Default | Description |
|---|---|---|---|
| `WORKING_DIRECTORY` | `working_directory` | `.` | Folder released. In a subfolder, only commits that touch it count, and its `CHANGELOG.md` and version files are updated. Tags stay `vX.Y.Z`. |
| `RELEASE_TYPE` | `release_type` | `auto` | `auto`, `node`, `dotnet` or `simple`. |
| `MOVE_MAJOR_TAG` | `move_major_tag` | `false` | `true` = also point `vX` at each release, for repos of actions and reusable workflows whose users pin `@v1`. 0.x releases never move it. |
| `APP_CLIENT_ID` | `app_client_id` | `vars.RELEASE_APP_CLIENT_ID` | Client ID of the GitHub App. Empty = GITHUB_TOKEN. |
| Secret `RELEASE_APP_PRIVATE_KEY` | Secret, same name | — | The App's private key. |
| — (manual run input) | `release_as` | `''` | Forces the next version, for that run only (see [The first release](#the-first-release)). |

In call mode, an empty input falls back to the `env` value.

**Outputs** (call mode): `release_created` (`'true'` when this run released), `tag_name`,
`version`, `major`, `pr` (number of the release PR opened or updated) and `release_type`.

### Chaining a publish job

The workflow creates the release when the release PR is merged, in the run of that push. In
call mode, a later job in the same workflow can publish it, with any token:

```yaml
  publish:
    needs: release
    if: needs.release.outputs.release_created == 'true'
    runs-on: ubuntu-latest
    steps:
      - run: echo "Publishing ${{ needs.release.outputs.tag_name }}"
```

With the GitHub App, workflows triggered by `release: published` or by `v*` tags also run.

## How it works

Two jobs:

1. **Detect project** (`contents: read`). Detects the project type and whether to run: only
   for the default branch, never for pull requests.
2. **Release PR and release**. One run at a time per folder, never cancelled.
   - With the App's client ID and key, creates an App token limited to contents, pull
     requests and issues on this repo; otherwise uses GITHUB_TOKEN.
   - Runs release-please: if the release PR was just merged, creates the tag and the
     release; then opens or updates the release PR with the commits since.
   - .NET: on the release PR's branch, copies the new version from `version.txt` into the
     `<Version>`/`<VersionPrefix>` elements that exist, in one commit.
   - With `MOVE_MAJOR_TAG`, points `vX` at the new release.

release-please regenerates the release PR on each push, so edits to its branch are lost;
change the next release's notes through commits (or edit the release afterwards).

## GitHub App

Once per organization (or user); then install it on each repo that releases.

1. **Settings → Developer settings → GitHub Apps → New GitHub App** (in the organization's
   settings for an organization). Any name and homepage URL; uncheck **Webhook → Active**.
2. **Repository permissions:** Contents *Read and write*, Pull requests *Read and write*,
   Issues *Read and write*. Metadata stays *Read-only*. Nothing else.
3. **Where can this GitHub App be installed?** *Only on this account*. Create it.
4. On the App's page, note the **Client ID**, and **Generate a private key** (a `.pem`
   file).
5. **Install App** → choose the repos that release.
6. In each repo (or as organization variables and secrets):
   - variable `RELEASE_APP_CLIENT_ID`: the Client ID;
   - secret `RELEASE_APP_PRIVATE_KEY`: the whole content of the `.pem` file.

Release PRs then show the App as author, and commit statuses run on them. If a ruleset
restricts who can create `v*` tags, add the App to its bypass list.

## Verify

1. Merge the workflow, then push (or merge) a `feat:` or `fix:` commit to `main`.
2. **Release** runs and opens the PR `chore(main): release X.Y.Z`. Its summary links it.
3. Merge it. The next run creates the tag and the release; its summary links the release.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `GitHub Actions is not permitted to create or approve pull requests` | The repo setting is off (GITHUB_TOKEN) | Check it in **Settings → Actions → General**, or use the App |
| The release PR waits forever for required checks | GITHUB_TOKEN created it, so no workflow ran | Use the [GitHub App](#github-app), or merge bypassing the ruleset |
| No release PR after a push | Only `chore`, `docs`, `ci`… since the last release, or the titles aren't Conventional Commits | Expected; check the commit messages on `main` |
| The version bump is wrong | A commit type doesn't match the change (`fix` for a feature) | Add a commit with a `Release-As:` footer before merging the release PR |
| The release PR went back to another version | It was forced with `release_as`, and a later push recomputed it | Use a `Release-As:` footer instead |
| First release PR proposes `1.0.0` | No previous GitHub release | A commit with `Release-As: 0.1.0` (or the version you want) |
| `Set both RELEASE_APP_CLIENT_ID … and RELEASE_APP_PRIVATE_KEY` | Only one of the two is set (in call mode, the secret wasn't passed) | Set both, or neither |
| App token error `Not Found` or `Integration not found` | The App isn't installed on the repo, or the Client ID belongs to another App | Install it (step 5); check the Client ID |
| `Resource not accessible by integration` | Missing permissions on the job (call mode) or the App | Grant `contents`, `pull-requests` and `issues: write` |
| npm-publish or nuget-publish didn't run after the release | GITHUB_TOKEN created it | Use the App, or publish in the same run ([Chaining](#chaining-a-publish-job)) |
| `.NET version` step: `version.txt … doesn't hold a version` | `version.txt` was edited by hand | Restore it to the last released version |

## Possible extensions

- Several packages per repo (release-please manifest), with one tag per package.
- Pre-release versions (`1.0.0-beta.1`) and `bump-minor-pre-major` for 0.x projects.
- Publishing to NuGet from the release (nuget-publish). For npm, see
  [npm-publish](npm-publish.md#after-releaseyml-same-run).
