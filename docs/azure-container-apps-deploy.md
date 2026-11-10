# Container App deploy

Workflow that deploys a Docker image to an existing
[Azure Container App](https://learn.microsoft.com/azure/container-apps/): it points the app at
the new image, waits until the new revision runs and, optionally, checks an HTTP path. Signs
in with OpenID Connect.

It doesn't build. It deploys the image [docker-build-push](docker-build-push.md) pushed for
the commit (tag `sha-<commit>`), so production runs exactly the image that was built, and
scanned by [trivy-scan](trivy-scan.md), for that commit.

| When | What it does |
|---|---|
| After **Docker build and push** pushes from the default branch | Deploys `<registry>/<image>:sha-<commit>` |
| Manual run on the default branch | Deploys the current commit's image, or the `tag` you enter (e.g. an older `sha-…`, to roll back) |
| Pull requests, tags, other branches | Nothing (docker-build-push and trivy-scan check PRs) |

- Workflow: [`.github/workflows/azure-container-apps-deploy.yml`](../.github/workflows/azure-container-apps-deploy.yml)
- Caller sample (call mode): [`examples/azure-container-apps-deploy.yml`](../examples/azure-container-apps-deploy.yml)
- Actions: only this repo's [azure-login](azure-login.md) action, as
  `rubone/shared-workflows/actions/azure-login@v1`. The deploy itself is the Azure CLI
  (`az containerapp update`), already on the runner.
- Repo access: none (no checkout); `id-token: write` in the deploy job.

---

## Requirements

- An image pushed by [docker-build-push](docker-build-push.md) (GHCR or ACR), or any image
  set in `IMAGE`.
- A **Container App** that already exists. This workflow updates its image; it doesn't
  create the app, its environment, ingress, scale rules or settings. Create it once in the
  portal or with `az containerapp create` (any image, e.g. the quickstart one).
- The app can **pull the image** from the registry. For ACR: its managed identity with
  **AcrPull** on the registry. For a private GHCR package: registry credentials on the app.
  See [Registry access](#registry-access). The workflow never sends registry credentials.
- An identity with **Container Apps Contributor** on the app (and on its environment), a
  federated credential for the `production` environment, the `AZURE_*` repository variables
  and `APP_NAME`. See [Azure setup](#azure-setup). If the organization restricts actions,
  allow `rubone/shared-workflows/*` (for the [azure-login](azure-login.md) action).

Without `APP_NAME`, the run resolves the image and warns that nothing was deployed.

---

## Usage

The same file supports two modes. Pick one per repo.

| | A) Copy (main use) | B) Call |
|---|---|---|
| Works for | Any repo, any organization | Any repo, any organization whose Actions policy allows workflows from `rubone/shared-workflows` |
| What goes in the project repo | `azure-container-apps-deploy.yml` next to `docker-build-push.yml` | One caller that builds and deploys ([example](../examples/azure-container-apps-deploy.yml)) |
| Where values go | Top-level `env:` of the copied file | `with:` inputs in the caller |
| Trigger | `workflow_run` after **Docker build and push**, and manual | `on:` in the caller; the deploy job `needs` the build |

### A) Copy

1. Copy [`.github/workflows/azure-container-apps-deploy.yml`](../.github/workflows/azure-container-apps-deploy.yml)
   to `.github/workflows/` in the target repo, next to `docker-build-push.yml`.
2. Set `APP_NAME` in `env:`, and `REGISTRY`, `IMAGE_NAME` and `ACR_NAME` with the same
   values as in `docker-build-push.yml`.
3. If you renamed docker-build-push (`name:`), change `on.workflow_run.workflows` to match.

`workflow_run` always runs the copy of this file on the default branch, so changes to it
take effect after they're merged.

**Deploy only scanned images.** With [trivy-scan](trivy-scan.md) also copied, change
`workflows: ['Docker build and push']` to `workflows: ['Trivy scan']`. The deploy then
starts after the scan of the pushed image succeeds, and a failed scan stops it. The scan's
weekly and PR runs don't trigger a deploy.

### B) Call

docker-build-push and the deploy in one workflow, so the deploy gets the image by digest:

```yaml
jobs:
  docker:
    permissions:
      contents: read
      packages: write
      id-token: write
    uses: rubone/shared-workflows/.github/workflows/docker-build-push.yml@v1
  deploy:
    needs: docker
    if: needs.docker.outputs.digest != ''   # nothing pushed on PRs
    permissions:
      id-token: write
    uses: rubone/shared-workflows/.github/workflows/azure-container-apps-deploy.yml@v1
    with:
      image: ${{ needs.docker.outputs.image }}@${{ needs.docker.outputs.digest }}
      app_name: my-api
```

To scan first, add a trivy-scan job with the same `image` and put it in the deploy's
`needs` (commented out in the [example](../examples/azure-container-apps-deploy.yml)).

### Roll back

Run the workflow manually (**Actions → Container App deploy → Run workflow**) with the tag of
an earlier image, e.g. `sha-1a2b3c4`. Each deploy's summary shows the image it replaced.
Container Apps also keeps the previous revisions: in multiple revision mode you can move
traffic back to one in the portal, without a deploy.

## Values

| `env` (copy) | Input (call) | Default | Description |
|---|---|---|---|
| `IMAGE` | `image` | `''` | Full image reference with a tag or digest. Empty = derived from the three values below and the commit: `<registry>/<image>:sha-<commit>`. |
| `REGISTRY` | `registry` | `ghcr` | `ghcr` or `acr`, as in docker-build-push. |
| `IMAGE_NAME` | `image_name` | `''` | As in docker-build-push. Empty = the repo name. |
| `ACR_NAME` | `acr_name` | `''` | ACR only: the registry name, without `.azurecr.io`. |
| `APP_NAME` | `app_name` | `''` | Name of the Container App. |
| `RESOURCE_GROUP` | `resource_group` | `''` | Its resource group. Empty = found by name in the subscription. |
| `CONTAINER_NAME` | `container_name` | `''` | Container to update, when the app has more than one (sidecars). Empty = the only one. |
| `HEALTH_CHECK_PATH` | `health_check_path` | `''` | Path requested after the revision runs (e.g. `/health`), until it answers 2xx or 3xx, up to 5 minutes; fails the run otherwise. Needs external ingress. Empty = no check. |
| `ENVIRONMENT` | `environment` | `production` | GitHub environment of the deploy job. |
| `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` | `azure_client_id`, … | `vars.AZURE_*` | The same variables as the other Azure workflows. |
| — (manual run input) | — | `''` | `tag`: image tag to deploy instead of the current commit's. |

In call mode, an empty input falls back to the `env` value.

**Outputs** (call mode): `image` (the reference deployed), `revision` (the revision running
it) and `url` (`https://<fqdn>` with external ingress; empty otherwise).

### Configuration and secrets of the app

Environment variables, secrets (or Key Vault references), scale rules, CPU and memory are
set on the Container App, not by this workflow: **Application → Containers** and
**Settings → Secrets** in the portal. A deploy keeps them and only changes the image.

## How it works

Two jobs:

1. **Resolve image** (no permissions, no checkout). Works out the image reference and checks
   it has a tag or digest, and decides whether to deploy: only for the default branch, and
   with `APP_NAME`. After docker-build-push, only when it succeeded on a push.
2. **Deploy to Container Apps** (when it deploys). Runs in the GitHub environment
   (`production`), so the repo shows its URL and deploy history, and the environment can
   require a reviewer. Then:
   - signs in with the [azure-login](azure-login.md) action;
   - finds the app (and its resource group), and the container to update;
   - runs `az containerapp update --image`, which creates a new revision. The same image
     again changes nothing;
   - waits up to 10 minutes for the revision to be provisioned and running, and fails if it
     ends up *Failed* or *Degraded* (usually: the app can't pull the image, or the container
     exits on start);
   - with `HEALTH_CHECK_PATH`, requests it on the app's URL.

Deploys to the same app are queued, never cancelled halfway.

In single revision mode (the default), Container Apps moves the traffic to the new revision
once it's ready, and the old one stops: no downtime when the app has a readiness probe or
starts quickly. In multiple revision mode, traffic follows the app's rules; the run warns if
none sends traffic to the new revision.

## Registry access

The Container App pulls the image itself, with credentials set once on the app.

**ACR** (recommended for private images): the app's system-assigned managed identity with
**AcrPull** on the registry. No password to rotate.

```bash
APP=my-api; RG=my-rg; ACR=myregistry
az containerapp identity assign --name "$APP" --resource-group "$RG" --system-assigned
APP_PRINCIPAL=$(az containerapp show --name "$APP" --resource-group "$RG" --query identity.principalId -o tsv)
az role assignment create --assignee-object-id "$APP_PRINCIPAL" --assignee-principal-type ServicePrincipal \
  --role AcrPull --scope "$(az acr show --name "$ACR" --query id -o tsv)"
az containerapp registry set --name "$APP" --resource-group "$RG" \
  --server "$ACR.azurecr.io" --identity system
```

**GHCR**: a public package needs nothing. For a private one, the app needs a username and a
personal access token with `read:packages`, which expires and is tied to a person: prefer
ACR, or make the package public if the code is public.

```bash
az containerapp registry set --name "$APP" --resource-group "$RG" \
  --server ghcr.io --username <github-user> --password <token>
```

## Azure setup

Once per app, as in [azure-login](azure-login.md#azure-setup):

1. Create a **user-assigned managed identity** (or reuse one).
2. On the Container App, **Access control (IAM) → Add role assignment**: **Container Apps
   Contributor**, assigned to the identity. Assign the same role on the app's **Container
   Apps environment**: Azure checks that the identity may use the environment
   (`managedEnvironments/join/action`) when the app is updated. Neither assignment allows
   changing other apps.
3. On the identity, add a **federated credential** with entity **Environment** and
   environment `production` (or your `ENVIRONMENT`).
4. In the repo, the `AZURE_CLIENT_ID`, `AZURE_TENANT_ID` and `AZURE_SUBSCRIPTION_ID`
   variables.

With the Azure CLI:

```bash
APP=my-api; RG=my-rg; REPO=org/repo
az identity create --name gh-containerapp-deploy --resource-group "$RG"
PRINCIPAL=$(az identity show --name gh-containerapp-deploy --resource-group "$RG" --query principalId -o tsv)
APP_ID=$(az containerapp show --name "$APP" --resource-group "$RG" --query id -o tsv)
ENV_ID=$(az containerapp show --name "$APP" --resource-group "$RG" --query properties.environmentId -o tsv)
for scope in "$APP_ID" "$ENV_ID"; do
  az role assignment create --assignee-object-id "$PRINCIPAL" --assignee-principal-type ServicePrincipal \
    --role "Container Apps Contributor" --scope "$scope"
done
az identity federated-credential create --identity-name gh-containerapp-deploy --resource-group "$RG" \
  --name github-production --issuer https://token.actions.githubusercontent.com \
  --subject "repo:${REPO}:environment:production" --audiences api://AzureADTokenExchange
az identity show --name gh-containerapp-deploy --resource-group "$RG" --query clientId -o tsv   # AZURE_CLIENT_ID
```

If docker-build-push pushes to ACR with an identity for the `main` branch, that's a
different federated credential (branch, not environment). The same identity can have both.

## Verify

1. Merge the workflow (copy mode), or the caller.
2. After the next push to `main`, **Docker build and push** pushes the image and then
   **Container App deploy** runs. Its summary shows the image, the previous one, the
   revision and the URL. The repo's **Environments** show it too.
3. In the portal, **Application → Revisions and replicas** shows the new revision.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| The deploy doesn't start after a push (copy mode) | `on.workflow_run.workflows` doesn't match docker-build-push's `name:`, or the file isn't on the default branch yet | Match the name; merge the file |
| Warning `Not deployed: set APP_NAME` | `APP_NAME` empty | Set it |
| `isn't a valid image reference with a tag or digest` | `IMAGE` without a tag, or with uppercase letters | Use `registry/name:tag` or `registry/name@sha256:…` |
| Azure login errors (`Missing AZURE_…`, `AADSTS700213`…) | — | See [azure-login troubleshooting](azure-login.md#troubleshooting) |
| `Container App '…' not found` | Wrong `APP_NAME`, another subscription, or no role on it | Check the name, `AZURE_SUBSCRIPTION_ID` and the role assignment |
| `has 2 containers (…)` | The app has sidecars | Set `CONTAINER_NAME` |
| `AuthorizationFailed` on `containerApps/write` | The identity lacks Container Apps Contributor on the app | Assign it (step 2) |
| `LinkedAuthorizationFailed` on `managedEnvironments/join/action` | The role is only on the app, not on its environment | Assign it on the environment too (step 2) |
| Revision *Failed* or *Degraded*; system log says `ImagePullBackOff` or `unauthorized` | The app can't pull the image: no registry configured, no AcrPull, an expired GHCR token, or the tag doesn't exist | See [Registry access](#registry-access); check the tag in the registry |
| Revision *Failed*; console log shows the app exiting | The container fails on start (missing setting, wrong port) | Check **Monitoring → Log stream**, and that the ingress target port matches the app |
| Health check fails, revision *Running* | Wrong path, or the app answers 4xx/5xx | Request the path in a browser; check the logs |
| Warning `no external ingress` | Ingress is off or internal only | Expected: the runner can't reach it. The revision state is still checked |
| Warning about multiple revision mode | The traffic rules pin older revisions | Shift traffic in the portal, or switch to single revision mode |
| The deploy waits for approval | The `production` environment has required reviewers | Expected; approve it in the run |

## Possible extensions

- Blue-green: deploy with 0% traffic in multiple revision mode, check it, then shift.
- Container Apps jobs (`az containerapp job update`).
- Creating the app when it doesn't exist (`az containerapp up`), for preview environments.
