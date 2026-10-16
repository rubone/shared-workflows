# shared-workflows

Reusable GitHub Actions workflows and composite actions to standardize CI/CD across projects.

---

## Structure

```
shared-workflows/
├── .github/
│   └── workflows/        # reusable workflows + _self-test.yml
├── actions/              # composite actions
├── examples/             # sample caller workflows
├── docs/                 # inputs, secrets, and outputs for each workflow
├── CHANGELOG.md
└── README.md
```

| Directory | Contents |
|---|---|
| `.github/workflows/` | Reusable workflows (full jobs). GitHub doesn't allow subfolders here. They only use `on: workflow_call`, so they never run on their own in this repo. `_self-test.yml` is the exception: it validates changes on every PR. |
| `actions/` | Composite actions: reusable groups of steps for use inside any job (setup, login, caching). |
| `examples/` | Sample workflows ready to copy into other projects. |
| `docs/` | Documentation for each workflow and action: inputs, secrets, and outputs. |
