# CI / CD Integration Guide

DepPulse is designed for seamless, safe execution in Continuous Integration environments (GitHub Actions, GitLab CI, CircleCI, Bitbucket Pipelines).

## Exit Codes

| Exit Code | Meaning | Cause | Recommended CI Action |
| :--- | :--- | :--- | :--- |
| **0** | **Passed** | All dependencies satisfy configured health policies. | Build succeeds. |
| **1** | **Policy Violation** | One or more packages breached policy (e.g. `--fail-on critical`). | Block PR merge; review maintenance alerts. |
| **2** | **Analysis / Usage Error** | Network failure, missing manifest, or invalid command arguments. | Fix syntax or check network connectivity. |

---

## GitHub Actions Example

Create `.github/workflows/dependency-health.yml`:

```yaml
name: Dependency Health Check

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]
  schedule:
    # Run weekly audit on Mondays at 9am UTC
    - cron: '0 9 * * 1'

permissions:
  contents: read
  pull-requests: write

jobs:
  deppulse:
    name: DepPulse Health Audit
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Cache DepPulse Telemetry
        uses: actions/cache@v4
        with:
          path: .deppulse/cache
          key: deppulse-cache-${{ hashFiles('package-lock.json') }}
          restore-keys: |
            deppulse-cache-

      - name: Run DepPulse Health Scan
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          npx deppulse scan --format terminal --fail-on critical --output deppulse-report.txt

      - name: Generate PR Markdown Report
        if: failure() && github.event_name == 'pull_request'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          npx deppulse scan --format markdown --output deppulse-summary.md
          gh pr comment ${{ github.event.pull_request.number }} --body-file deppulse-summary.md
```

---

## Authenticating with GitHub API

To avoid GitHub's 60 requests/hour unauthenticated rate limit on large dependency graphs, provide `GITHUB_TOKEN`:

```bash
export GITHUB_TOKEN="ghp_yourPersonalAccessTokenOrSecret"
deppulse scan
```

DepPulse strictly redacts all tokens before logging or serializing error payloads.
