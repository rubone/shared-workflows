# Static Web App deploy

Workflow that builds a frontend (React, Angular, Vue, Svelte, Astro, a static Next.js
export…) with the project's own package manager and deploys the result to
[Azure Static Web Apps](https://learn.microsoft.com/azure/static-web-apps/).

| When | What it does |
|---|---|
| Pull request | Builds the site, to catch a broken build before the merge. Nothing is deployed. |
| Push to the default branch, manual run on it | Builds and deploys to production |
| Push to other branches | Builds only (if the trigger includes them) |

- Workflow: [`.github/workflows/azure-static-web-apps-deploy.yml`](../.github/workflows/azure-static-web-apps-deploy.yml)
- Caller sample (call mode): [`examples/azure-static-web-apps-deploy.yml`](../examples/azure-static-web-apps-deploy.yml)
- Actions: `actions/setup-node`, `pnpm/action-setup`, `actions/upload-artifact` and
  `download-artifact`, and Microsoft's `Azure/static-web-apps-deploy` v1, all pinned by commit
  SHA. With OIDC, this repo's [azure-login](azure-login.md) action, as
  `rubone/shared-workflows/actions/azure-login@v1`.
- Repo access: `contents: read`; `id-token: write` in the deploy job (OIDC).

### Why the workflow builds, not the Azure action

`Azure/static-web-apps-deploy` can build the site itself with Oryx, Microsoft's build
engine. Here the workflow builds instead, the same way as [node-ci](node-ci.md), and the
action only uploads the folder (`skip_app_build: true`):

- The same package manager and Node version as your machine and CI (lockfile, `.nvmrc`),
  not the ones Oryx guesses.
- Dependencies cached between runs.
- Build errors in a normal step log, not inside the action's container.

### Why PRs don't get preview environments

Static Web Apps can publish each PR to a staging URL. This workflow deliberately doesn't:
previews need write access to PRs (for the comment with the URL), a second job to delete
them when the PR closes, and the Free plan allows only 3 at a time. PRs build, so a broken
build still fails the PR.

---

## Requirements

- A **package.json** with a `build` script (or the one in `BUILD_SCRIPT`) and a committed
  **lockfile**. Without package.json, the workflow skips with a warning and the run stays
  green.
- A **Static Web App** resource in Azure. Create it with deployment source **Other**: the
  GitHub option makes Azure commit its own workflow file to the repo.
- One way to authenticate:
  - **OpenID Connect** (recommended, no stored secret): an identity with **Contributor** on
    the Static Web App, a federated credential for the `production` environment, the
    `AZURE_*` repository variables and `APP_NAME`. See [Azure setup](#azure-setup). The
    sign-in uses the [azure-login](azure-login.md) action from this repo, also in copy mode:
    if the organization restricts actions, allow `rubone/shared-workflows/*`.
  - **Deployment token**: the `AZURE_STATIC_WEB_APPS_API_TOKEN` secret, with the token from
    the resource's **Overview → Manage deployment token**. When set, it's used instead of
    OIDC.

Without either one, the push to `main` builds and warns that nothing was deployed.

---

## Usage

The same file supports two modes. Pick one per repo.

| | A) Copy (main use) | B) Call |
|---|---|---|
| Works for | Any repo, any organization | Any repo, any organization whose Actions policy allows workflows from `rubone/shared-workflows` |
| What goes in the project repo | The whole `azure-static-web-apps-deploy.yml` | A ~30 line caller ([example](../examples/azure-static-web-apps-deploy.yml)) |
| Where values go | Top-level `env:` of the copied file | `with:` inputs in the caller |
| Trigger | `on:` in the copied file: PRs, pushes to `main`, manual | `on:` in the caller |

### A) Copy

1. Copy [`.github/workflows/azure-static-web-apps-deploy.yml`](../.github/workflows/azure-static-web-apps-deploy.yml)
   to `.github/workflows/` in the target repo.
2. Set `APP_NAME` in `env:` (OIDC), or add the `AZURE_STATIC_WEB_APPS_API_TOKEN` secret.
3. If the frontend isn't at the repo root, set `WORKING_DIRECTORY`. If the default branch
   isn't `main`, change `on.pull_request.branches` and `on.push.branches`.

### B) Call

```yaml
jobs:
  swa:
    permissions:
      contents: read
      id-token: write
    uses: rubone/shared-workflows/.github/workflows/azure-static-web-apps-deploy.yml@v1
    with:
      app_name: my-frontend
```

With the deployment token instead of OIDC, pass the secret (it isn't inherited):

```yaml
    secrets:
      AZURE_STATIC_WEB_APPS_API_TOKEN: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
```

## Values

| `env` (copy) | Input (call) | Default | Description |
|---|---|---|---|
| `WORKING_DIRECTORY` | `working_directory` | `.` | Folder with the frontend's package.json. The lockfile can be there or in a parent folder (workspaces). |
| `NODE_VERSION` | `node_version` | `''` | Node version. Empty = `.nvmrc`, `.node-version`, package.json (`volta`, `devEngines`, `engines`), else the latest LTS. |
| `PNPM_VERSION` | — | `10` | pnpm only, when package.json has no `packageManager` field. |
| `BUILD_SCRIPT` | `build_script` | `build` | package.json script that builds the site. |
| `OUTPUT_LOCATION` | `output_location` | `''` | Build output, relative to `WORKING_DIRECTORY`. Empty = the first of `dist/<app>/browser`, `dist`, `dist/<app>`, `build`, `out` with an `index.html`. |
| `APP_NAME` | `app_name` | `''` | Name of the Static Web App resource (OIDC). |
| `RESOURCE_GROUP` | `resource_group` | `''` | Its resource group. Empty = found by name in the subscription. |
| `ENVIRONMENT` | `environment` | `production` | GitHub environment of the deploy job. |
| `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` | `azure_client_id`, … | `vars.AZURE_*` | OIDC only. The same variables as docker-build-push and trivy-scan. |
| Secret `AZURE_STATIC_WEB_APPS_API_TOKEN` | Secret, same name | — | Deployment token. When set, OIDC isn't used. |

In call mode, an empty input falls back to the `env` value.

**Output** (call mode): `url`, the site's URL after a deploy (empty otherwise). For example,
to run smoke tests in a later job: `needs.swa.outputs.url`.

### Routes, redirects and SPA fallback

Static Web Apps reads `staticwebapp.config.json` from the deployed folder. Most bundlers
don't copy it from the project folder, so the workflow does: if the output has no
`staticwebapp.config.json` and `WORKING_DIRECTORY` has one, it's copied in. For a single page
app (React Router, Angular, Vue Router), the minimum is:

```json
{
  "navigationFallback": {
    "rewrite": "/index.html"
  }
}
```

### Build-time variables

Values the bundler embeds in the bundle (`VITE_*`, `NEXT_PUBLIC_*`, `REACT_APP_*`) are read
from the environment during **Build**. In copy mode, add them to the step's `env:`. They end
up in public JavaScript: never put secrets there.

## How it works

Two jobs:

1. **Build site** (every event). Detects the package manager from the lockfile and the Node
   version, installs with cache, runs the build script and finds the output folder. When
   it's going to deploy, uploads the folder as a workflow artifact (kept 1 day).
2. **Deploy to Static Web Apps** (default branch only). Runs in the GitHub environment
   (`production`), so the repo shows its URL and deploy history, and the environment can
   require a reviewer before deploying. With OIDC, it signs in with the
   [azure-login](azure-login.md) action and reads the deployment token with `az staticwebapp secrets list` (masked in the log). Then
   `Azure/static-web-apps-deploy` uploads the folder, without building.

The build job has no Azure access, so a compromised build dependency can't reach Azure.
Deploys to the same app are queued, never cancelled halfway.

## Azure setup

For OIDC, once per app (or once for several apps, with the same identity):

1. Create a **user-assigned managed identity** (or an app registration) in Microsoft Entra.
2. On the Static Web App, **Access control (IAM) → Add role assignment**: role
   **Contributor**, assigned to that identity. It's needed to read the deployment token;
   Static Web Apps has no narrower built-in role for it.
3. On the identity, add a **federated credential** for GitHub Actions: organization, repo,
   entity **Environment**, environment `production` (or your `ENVIRONMENT`).

   The deploy job runs in a GitHub environment, so its token says
   `repo:<owner>/<repo>:environment:production`, not the branch. A credential for the
   `main` branch (like the one docker-build-push uses) doesn't match it.
4. In the repo, **Settings → Secrets and variables → Actions → Variables**: add
   `AZURE_CLIENT_ID` (the identity's client ID), `AZURE_TENANT_ID` and
   `AZURE_SUBSCRIPTION_ID`. If docker-build-push already uses them for ACR, they're the same.

With the Azure CLI:

```bash
APP=my-frontend; RG=my-rg; REPO=org/repo
az identity create --name gh-swa-deploy --resource-group "$RG"
PRINCIPAL=$(az identity show --name gh-swa-deploy --resource-group "$RG" --query principalId -o tsv)
SWA_ID=$(az staticwebapp show --name "$APP" --resource-group "$RG" --query id -o tsv)
az role assignment create --assignee-object-id "$PRINCIPAL" --assignee-principal-type ServicePrincipal \
  --role Contributor --scope "$SWA_ID"
az identity federated-credential create --identity-name gh-swa-deploy --resource-group "$RG" \
  --name github-production --issuer https://token.actions.githubusercontent.com \
  --subject "repo:${REPO}:environment:production" --audiences api://AzureADTokenExchange
az identity show --name gh-swa-deploy --resource-group "$RG" --query clientId -o tsv   # AZURE_CLIENT_ID
```

## Verify

1. Merge the workflow (copy mode), or add the caller.
2. Open a PR. **Build site** builds it; its summary shows the output folder and size.
3. After the merge, **Deploy to Static Web Apps** runs and its summary shows the URL. The
   repo's **Environments** (right column of the home page) show it as well.

To require the build before merging, add **Build site** (copy mode) or **swa / Build site**
(call mode, if the caller's job is called `swa`) to the required status checks in
**Settings → Rules → Rulesets**.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Warning `No package.json in '.'` | The frontend is in a subfolder | Set `WORKING_DIRECTORY` |
| `No index.html in dist/<app>/browser, dist, build or out` | The build writes somewhere else | Set `OUTPUT_LOCATION` |
| Warning `Built, but not deployed` | Neither `APP_NAME` nor the token secret is set | See [Requirements](#requirements) |
| `Missing AZURE_…`, `… must be a GUID`, `can't request an OIDC token` | Checks of the azure-login action | See [azure-login troubleshooting](azure-login.md#troubleshooting) |
| `rubone/shared-workflows/actions/azure-login@v1 is not allowed` | The organization only allows some actions | Allow `rubone/shared-workflows/*` in **Settings → Actions → General** |
| `AADSTS700213: No matching federated identity record found` | The credential is for a branch, not the environment | Add one with entity **Environment** (see [Azure setup](#azure-setup)) |
| `Couldn't read the deployment token` | Wrong `APP_NAME`, the app is in another subscription, or the identity lacks Contributor on it | Check the name and `AZURE_SUBSCRIPTION_ID`, and the role assignment |
| Deep links (`/about`) return 404 | A single page app without a fallback route | Add `staticwebapp.config.json` with `navigationFallback` (see [Routes](#routes-redirects-and-spa-fallback)) |
| Azure committed a workflow file to the repo | The app was created with deployment source **GitHub** | Delete that file, and the `AZURE_STATIC_WEB_APPS_API_TOKEN_*` secret it added if you use OIDC |
| `The content server has rejected the request with: BadRequest` | The site exceeds the plan's size limit (250 MB Free, 500 MB Standard) | Remove source maps or large assets from the output |
| The deploy waits for approval | The `production` environment has required reviewers | Expected; approve it in the run |

## Possible extensions

- Preview environments for PRs (with a closing job that deletes them).
- An Azure Functions API (`api_location`) built alongside the site.
- Deploying from release tags instead of every push to `main`.
