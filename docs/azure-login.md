# Azure login (action)

Composite action that signs a job in to Azure with **OpenID Connect**: GitHub issues a
short-lived token for the run and Azure trusts it through a federated credential, so the repo
stores no password or client secret. Before calling `azure/login`, it checks the values and
the job's permission, and fails with an error that says what to fix:

| Check | Error |
|---|---|
| `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` set | `Missing AZURE_TENANT_ID…` |
| The three are GUIDs (IDs, not names) | `AZURE_CLIENT_ID must be a GUID…` |
| The job has `id-token: write` | `The job can't request an OIDC token…` |

After it, the Azure CLI (`az`) is signed in for the rest of the job.

- Action: [`actions/azure-login/action.yml`](../actions/azure-login/action.yml)
- Uses `azure/login` v3.1.0, pinned by commit SHA.
- Used by: [azure-static-web-apps-deploy](azure-static-web-apps-deploy.md),
  [azure-webapp-deploy](azure-webapp-deploy.md), and the upcoming Container Apps deploy.

## Usage

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: rubone/shared-workflows/actions/azure-login@v1
        with:
          client-id: ${{ vars.AZURE_CLIENT_ID }}
          tenant-id: ${{ vars.AZURE_TENANT_ID }}
          subscription-id: ${{ vars.AZURE_SUBSCRIPTION_ID }}
      - run: az account show
```

| Input | Description |
|---|---|
| `client-id` | Client ID of the managed identity or app registration with the federated credential. |
| `tenant-id` | Microsoft Entra tenant ID. |
| `subscription-id` | Azure subscription the CLI signs in to. |

## Why the Azure deploys reference it remotely, also in copy mode

The deploy workflows use `rubone/shared-workflows/actions/azure-login@v1` in both modes. A
reusable workflow can't use a local path (`./actions/…` would resolve in the calling repo),
and keeping one reference in both modes means the copied file is still a single file.

The trade-off: in copy mode, the project repo depends on this repo when the deploy runs. The
organization's Actions policy must allow actions from `rubone/shared-workflows`
(**Settings → Actions → General → Allow specified actions**: add
`rubone/shared-workflows/*`). To avoid that, replace the step with `azure/login` directly:
the action only adds the checks.

The CI workflows and the ACR login inside docker-build-push and trivy-scan stay
self-contained and don't use it.

## Azure setup

Once per identity:

1. Create a **user-assigned managed identity** (or an app registration) in Microsoft Entra.
2. Give it the role the workflow needs on the target resource (each workflow's docs say
   which).
3. Add a **federated credential** for GitHub Actions on the identity. Its subject must match
   the job's token:

   | The job… | Entity | Subject |
   |---|---|---|
   | runs in a GitHub environment (the deploy workflows) | Environment | `repo:<owner>/<repo>:environment:<name>` |
   | runs on a branch, no environment | Branch | `repo:<owner>/<repo>:ref:refs/heads/<branch>` |
   | runs on a tag | Tag (or a flexible credential for `v*`) | `repo:<owner>/<repo>:ref:refs/tags/<tag>` |

4. In the repo, **Settings → Secrets and variables → Actions → Variables**: add
   `AZURE_CLIENT_ID` (the identity's **client ID**), `AZURE_TENANT_ID` and
   `AZURE_SUBSCRIPTION_ID`. They aren't secrets.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Missing AZURE_…` | The repository variables aren't set, or in call mode the inputs are empty | Add the variables (step 4) |
| `… must be a GUID` | A name or a URL was used instead of the ID | Use the identity's client ID, the tenant ID and the subscription ID |
| `The job can't request an OIDC token` | No `id-token: write` on the job (in call mode, on the caller's job), or a PR from a fork | Add the permission. Forks never get a token |
| `AADSTS700213: No matching federated identity record found` | The credential's subject doesn't match the job (branch vs environment) | Add a credential with the subject from the table in step 3 |
| `AADSTS70021` or `No subscriptions found` | The identity has no role in that subscription | Assign the role on the resource (step 2) |
| `… is not allowed to be used in <org>` | The organization only allows some actions | Allow `rubone/shared-workflows/*`, or use `azure/login` directly |
