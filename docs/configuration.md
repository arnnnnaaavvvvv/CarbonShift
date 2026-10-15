# DepPulse Configuration Reference

DepPulse supports optional configuration via `deppulse.config.json` in the root of your project or via the `--config <path>` CLI flag.

If no configuration file is present, safe defaults are automatically applied.

---

## Example `deppulse.config.json`

```json
{
  "version": 1,
  "scoring": {
    "minConfidenceThreshold": 0.35,
    "maturityThresholdYears": 4
  },
  "policy": {
    "failOnRisk": ["critical"],
    "maxHighRiskAllowed": 0,
    "minScore": 30,
    "treatUnknownAsFailure": false,
    "allowList": [
      {
        "name": "legacy-auth-client",
        "versionRange": "^2.1.0",
        "reason": "Migration to OAuth2 service scheduled for Q3 sprint",
        "expiresAt": "2026-12-31T23:59:59Z"
      }
    ]
  },
  "network": {
    "concurrency": 8,
    "timeoutMs": 8000,
    "maxRetries": 3,
    "allowedRegistries": [
      "https://registry.npmjs.org",
      "https://npm.pkg.github.com"
    ]
  },
  "cache": {
    "enabled": true,
    "dir": ".deppulse/cache",
    "ttlHours": 24
  }
}
```

---

## Schema Reference

### `version` (required)
- **Type**: `number` (Literal `1`)
- **Description**: Schema version. Currently only version `1` is supported.

### `scoring` (optional)
- `minConfidenceThreshold` (number, default: `0.35`): Minimum telemetry completeness score (0.0 to 1.0) required to assign a numeric health score. Telemetry below this threshold yields `score: null` and `maintenanceRisk: "unknown"`. Missing data is never penalized as poor health.
- `maturityThresholdYears` (number, default: `4`): Package age in years after which a package with multiple releases is evaluated under the **Mature-Stable** model (waiving naive release recency penalties for completed libraries).

### `policy` (optional)
- `failOnRisk` (array of strings, default: `["critical"]`): Maintenance risk tiers that fail the CI build with exit code 1. Options: `"low"`, `"medium"`, `"high"`, `"critical"`, `"unknown"`.
- `maxHighRiskAllowed` (number, default: `0`): Maximum allowable number of dependencies in the `high` risk category before failing policy.
- `minScore` (number, optional): Minimum required health score (0–100) for every scanned package.
- `treatUnknownAsFailure` (boolean, default: `false`): When `true`, packages with insufficient telemetry (`unknown`) cause a policy failure.
- `allowList` (array of exception objects): Documented exceptions that bypass policy failures:
  - `name` (string, required): Package name.
  - `versionRange` (string, default: `"*"`): Semver range to which the exception applies.
  - `reason` (string, min 5 chars, required): Human explanation for why this exception is granted.
  - `expiresAt` (ISO-8601 string, optional): Date after which the exception automatically expires.

### `network` (optional)
- `concurrency` (number, default: `8`, max: `32`): Maximum simultaneous outbound HTTP requests.
- `timeoutMs` (number, default: `8000`): Request timeout in milliseconds via `AbortSignal`.
- `maxRetries` (number, default: `3`): Number of exponential backoff retry attempts on 5xx server errors.
- `allowedRegistries` (array of URLs, default: `["https://registry.npmjs.org"]`): Whitelist of trusted registry origins for SSRF protection.

### `cache` (optional)
- `enabled` (boolean, default: `true`): Whether local disk caching is active. Can be bypassed on individual runs with `--no-cache`.
- `dir` (string, default: `".deppulse/cache"`): Filesystem directory where cached responses are stored.
- `ttlHours` (number, default: `24`): Cache time-to-live in hours.
