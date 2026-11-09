# Web App deploy

Workflow that builds a **.NET** or **Node** app into a ready-to-run package and deploys it to
[Azure App Service](https://learn.microsoft.com/azure/app-service/) (Web Apps, Linux or
Windows), signing in with OpenID Connect.

| When | What it does |
|---|---|
| Pull request | Builds the package, to catch a broken build or publish before the merge. Nothing is deployed. |
| Push to the default branch, manual run on it | Builds and deploys to the production slot |
| Push to other branches | Builds only (if the trigger includes them) |

It doesn't run tests or linters: pair it with [dotnet-ci](dotnet-ci.md) or [node-ci](node-ci.md)
and require those checks before merging.

- Workflow: [`.github/workflows/azure-webapp-deploy.yml`](../.github/workflows/azure-webapp-deploy.yml)
- Caller sample (call mode): [`examples/azure-webapp-deploy.yml`](../examples/azure-webapp-deploy.yml)
- Actions: `actions/setup-dotnet`, `actions/cache`, `actions/setup-node`,
  `pnpm/action-setup`, `actions/upload-artifact` and `download-artifact`, and
  `azure/webapps-deploy` v3.0.8, all pinned by commit SHA. The sign-in uses this repo's
  [azure-login](azure-login.md) action, as `rubone/shared-workflows/actions/azure-login@v1`.
- Repo access: `contents: read`; `id-token: write` in the deploy job.

### What goes in the package

| Stack | Detected by | Package |
|---|---|---|
| .NET | A web project (`Sdk="Microsoft.NET.Sdk.Web"`) in `WORKING_DIRECTORY` or up to two folders below (`Api.csproj`, `Api/Api.csproj`, `src/Api/Api.csproj`) | `dotnet publish -c Release` of that project (framework-dependent). SDK from `global.json`, else `DOTNET_VERSION`. |
| Node | A `package.json` in `WORKING_DIRECTORY` | The folder after `build` (when the script exists), with `node_modules` reinstalled with production dependencies only. Package manager and Node version as in node-ci. Leaves out `.git`, `.github`, `.env` and `.env.*local` files. |

When the folder has both (an ASP.NET app with a `package.json` for its frontend), .NET wins;
set `STACK` to choose. The package is zipped and deployed with zip deploy, so App Service
runs it as is, without building it again.

---

## Requirements

- A **.NET web project** or a **package.json** with its **lockfile** in the same folder.
  Without either, the workflow skips with a warning and the run stays green.
- Node: a `start` script (App Service starts Node apps with `npm start`), or `STARTUP_COMMAND`.
  The app must listen on `process.env.PORT`.
- A **Web App** whose runtime matches the build: the same .NET major version as the
  project's `TargetFramework`, or the same Node major version as `.nvmrc`. App Service doesn't
  install another one.
- The app setting `SCM_DO_BUILD_DURING_DEPLOYMENT` absent or `false`. With `true`, App Service
  builds the package again with Oryx.
- An identity with **Website Contributor** on the Web App, a federated credential for the
  `production` environment, the `AZURE_*` repository variables and `APP_NAME`. See
  [Azure setup](#azure-setup). If the organization restricts actions, allow
  `rubone/shared-workflows/*` (for the [azure-login](azure-login.md) action).

Without `APP_NAME`, the push to `main` builds and warns that nothing was deployed.

---

## Usage

The same file supports two modes. Pick one per repo.

| | A) Copy (main use) | B) Call |
|---|---|---|
| Works for | Any repo, any organization | Any repo, any organization whose Actions policy allows workflows from `rubone/shared-workflows` |
| What goes in the project repo | The whole `azure-webapp-deploy.yml` | A ~30 line caller ([example](../examples/azure-webapp-deploy.yml)) |
| Where values go | Top-level `env:` of the copied file | `with:` inputs in the caller |
| Trigger | `on:` in the copied file: PRs, pushes to `main`, manual | `on:` in the caller |

### A) Copy

1. Copy [`.github/workflows/azure-webapp-deploy.yml`](../.github/workflows/azure-webapp-deploy.yml)
   to `.github/workflows/` in the target repo.
2. Set `APP_NAME` in `env:`. If the app isn't at the repo root, set `WORKING_DIRECTORY`.
3. If the default branch isn't `main`, change `on.pull_request.branches` and
   `on.push.branches`.

### B) Call

```yaml
jobs:
  webapp:
    permissions:
      contents: read
      id-token: write
    uses: rubone/shared-workflows/.github/workflows/azure-webapp-deploy.yml@v1
    with:
      app_name: my-api
```

To deploy only after CI passes, in one workflow:

```yaml
jobs:
  ci:
    permissions:
      contents: read
    uses: rubone/shared-workflows/.github/workflows/dotnet-ci.yml@v1
  webapp:
    needs: ci
    permissions:
      contents: read
      id-token: write
    uses: rubone/shared-workflows/.github/workflows/azure-webapp-deploy.yml@v1
    with:
      app_name: my-api
```

## Values

| `env` (copy) | Input (call) | Default | Description |
|---|---|---|---|
| `WORKING_DIRECTORY` | `working_directory` | `.` | Folder with the app. |
| `STACK` | `stack` | `auto` | `auto`, `dotnet` or `node`. |
| `PROJECT` | `project` | `''` | .NET project to publish, relative to `WORKING_DIRECTORY`. Empty = the only web project. |
| `DOTNET_VERSION` | `dotnet_version` | `10.0.x` | .NET SDK when there's no `global.json`. |
| `NODE_VERSION` | `node_version` | `''` | Node version. Empty = `.nvmrc`, `.node-version`, package.json, else the latest LTS. |
| `PNPM_VERSION` | — | `10` | pnpm only, when package.json has no `packageManager` field. |
| `BUILD_SCRIPT` | `build_script` | `build` | Node: script that builds the app. Skipped if package.json doesn't have it. |
| `APP_NAME` | `app_name` | `''` | Name of the Web App. |
| `RESOURCE_GROUP` | `resource_group` | `''` | Its resource group. Empty = found by name in the subscription. |
| `STARTUP_COMMAND` | `startup_command` | `''` | Linux only. Empty = App Service's default (`npm start`; for .NET, the app's dll). |
| `HEALTH_CHECK_PATH` | `health_check_path` | `''` | Path requested after the deploy (e.g. `/health`) until it answers 2xx or 3xx, up to 5 minutes; fails the run otherwise. Empty = no check. |
| `ENVIRONMENT` | `environment` | `production` | GitHub environment of the deploy job. |
| `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` | `azure_client_id`, … | `vars.AZURE_*` | The same variables as the other Azure workflows. |

In call mode, an empty input falls back to the `env` value.

**Output** (call mode): `url`, the app's URL after a deploy (empty otherwise).

### Configuration and secrets of the app

Connection strings, API keys and other settings go in the Web App, not in the package:
**Settings → Environment variables** in the portal (or Key Vault references there). They reach
the app as environment variables; in .NET, `ConnectionStrings__Default` overrides
`ConnectionStrings:Default` from `appsettings.json`. The workflow never sends them.

## How it works

Two jobs:

1. **Build package** (every event). Detects the stack and builds the package in a temporary
   folder, then zips it. When it's going to deploy, uploads the zip as a workflow artifact
   (kept 1 day).
2. **Deploy to App Service** (default branch only). Runs in the GitHub environment
   (`production`), so the repo shows its URL and deploy history, and the environment can
   require a reviewer. Signs in with the [azure-login](azure-login.md) action, deploys the zip
   with `azure/webapps-deploy` and, with `HEALTH_CHECK_PATH`, waits until the app answers.

The build job has no Azure access, so a compromised build dependency can't reach Azure.
Deploys to the same app are queued, never cancelled halfway.

The deploy goes to the production slot and App Service restarts the app: expect a few seconds
of errors or slow responses during each deploy. To avoid them, use deployment slots (Standard
plan or higher) and swap; this workflow doesn't do that yet.

## Azure setup

Once per app, as in [azure-login](azure-login.md#azure-setup):

1. Create a **user-assigned managed identity** (or reuse one).
2. On the Web App, **Access control (IAM) → Add role assignment**: **Website Contributor**,
   assigned to the identity. It can deploy and restart that app only.
3. On the identity, add a **federated credential** with entity **Environment** and
   environment `production` (or your `ENVIRONMENT`).
4. In the repo, the `AZURE_CLIENT_ID`, `AZURE_TENANT_ID` and `AZURE_SUBSCRIPTION_ID`
   variables.

With the Azure CLI:

```bash
APP=my-api; RG=my-rg; REPO=org/repo
az identity create --name gh-webapp-deploy --resource-group "$RG"
PRINCIPAL=$(az identity show --name gh-webapp-deploy --resource-group "$RG" --query principalId -o tsv)
APP_ID=$(az webapp show --name "$APP" --resource-group "$RG" --query id -o tsv)
az role assignment create --assignee-object-id "$PRINCIPAL" --assignee-principal-type ServicePrincipal \
  --role "Website Contributor" --scope "$APP_ID"
az identity federated-credential create --identity-name gh-webapp-deploy --resource-group "$RG" \
  --name github-production --issuer https://token.actions.githubusercontent.com \
  --subject "repo:${REPO}:environment:production" --audiences api://AzureADTokenExchange
az identity show --name gh-webapp-deploy --resource-group "$RG" --query clientId -o tsv   # AZURE_CLIENT_ID
```

## Verify

1. Merge the workflow (copy mode), or add the caller.
2. Open a PR. **Build package** builds it; its summary shows the stack and the package size.
3. After the merge, **Deploy to App Service** runs; its summary shows the URL and, with
   `HEALTH_CHECK_PATH`, the result of the check. The repo's **Environments** show it too.

To require the build before merging, add **Build package** (copy mode) or
**webapp / Build package** (call mode, if the caller's job is called `webapp`) to the required
status checks in **Settings → Rules → Rulesets**.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Warning `No .NET web project or package.json` | The app is in a subfolder, or deeper than two levels | Set `WORKING_DIRECTORY` (or `PROJECT`) |
| `More than one web project` | Several ASP.NET projects | Set `PROJECT` to the one this Web App runs |
| `No lockfile … in '<folder>'` | A workspace member: its dependencies are hoisted to the root | Deploy it as a container (docker-build-push), or give the app its own lockfile |
| `Yarn Plug'n'Play isn't supported` | Yarn 2+ without `node_modules` | Add `nodeLinker: node-modules` to `.yarnrc.yml` |
| Azure login errors (`Missing AZURE_…`, `AADSTS700213`…) | — | See [azure-login troubleshooting](azure-login.md#troubleshooting) |
| `Deployment Failed, Error: Resource … doesn't exist` | Wrong `APP_NAME`, another subscription, or no role on it | Check the name, `AZURE_SUBSCRIPTION_ID` and the role assignment |
| `403` during the deploy | The identity lacks Website Contributor on the app | Assign it (step 2) |
| Health check fails, app shows *Application Error* | The app didn't start: wrong runtime version, missing setting, or not listening on `PORT` | Check **Monitoring → Log stream**, and the runtime in **Settings → Configuration** |
| The deploy takes minutes and the package is rebuilt | `SCM_DO_BUILD_DURING_DEPLOYMENT=true` in the app settings | Remove it: the package is already built |
| The deploy waits for approval | The `production` environment has required reviewers | Expected; approve it in the run |

## Possible extensions

- Deployment slots with swap (no downtime), for Standard plans and higher.
- Self-contained .NET publish (`--runtime linux-x64`), to not depend on the app's runtime.
- Deploying the container image from docker-build-push instead of code.
