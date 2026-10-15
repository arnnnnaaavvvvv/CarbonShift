# DepPulse

> **Dependency health and upgrade intelligence for Node.js.**  
> Know how healthy your third-party dependencies are, what maintenance risks they carry, and how to safely manage upgrades.

[![CI](https://github.com/arnnnnaaavvvvv/DepPlus/actions/workflows/ci.yml/badge.svg)](https://github.com/arnnnnaaavvvvv/DepPlus/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js: >=18](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org)

---

## The Problem

Most dependency tools answer only one question: *"Is there a newer version?"* (`npm outdated`) or *"Is there a known CVE?"* (`npm audit`).

In practice, the greatest dependency risks aren't just version numbers—they are **maintenance risks**:
- Has a library been quietly abandoned by its author?
- Did the upstream GitHub repository get archived?
- Does a package declare obsolete Node engines that break on modern runtimes?
- Is a single-purpose utility actually dead, or is it simply "done" and mature?
- When upgrading, will the target version introduce breaking runtime incompatibilities?

**DepPulse** bridges this gap. It provides evidence-first, deterministic maintenance scoring and upgrade intelligence across your entire dependency tree.

---

## Honest Differentiators

| Capability | `npm outdated` | `Socket.dev` | `Renovate` | `DepPulse` |
| :--- | :--- | :--- | :--- | :--- |
| **Primary Focus** | Semver deltas | Malware & install scripts | Automated PR updates | Maintenance health & upgrade risk |
| **Maintenance Health Scoring** | None | SaaS alert heuristics | Test pass rates | **Deterministic, calibrated 0–100 score** |
| **"Done" vs "Dead" Calibration** | None | Flags inactivity | None | **Mature-stable lifecycle awareness** |
| **Anti-Spoofing Repo Verification**| Blindly trusts package.json | Internal database | Trusts git URLs | **Cryptographic provenance & identity checks** |
| **Advisory Decoupling** | N/A | Mixed into score | PR triggers | **CVEs kept strictly contextual (0 score impact)** |
| **Read-Only / Zero Mutation** | Read-only | Read-only / Firewall | Mutates lockfiles | **Strictly read-only; zero mutation** |
| **Source Code / Secret Scanning** | None | Yes | None | **Explicitly Out of Scope** (see MEJOR) |

---

## Real CLI Output

Here is the authentic output of `deppulse scan` running directly against a project:

```text
DepPulse v0.1.0 – Dependency Health & Maintenance Intelligence
──────────────────────────────────────────────────────────────────────
Manifest: package.json (npm-v3, coverage: full)
Scanned: 228 dependencies (14 direct, 214 transitive, 0 skipped)

Health Overview: Critical: 1 | High: 1 | Medium: 7 | Low (Healthy): 219
Average Health Score: 97/100
──────────────────────────────────────────────────────────────────────

Actionable Maintenance Alerts:

   CRITICAL   eslint@9.39.5 [direct] Score: 20
     ✖ Package is deprecated: This version is no longer supported. Please see https://eslint.org/version-support for other options.

   HIGH   @napi-rs/lzma-linux-x64-gnu@1.5.1 [transitive] Score: 40
     ✖ Declared engines.node '^22.20 || ^24.12 || >=25' is incompatible with all current Node.js LTS runtimes.

  MEDIUM  concat-map@0.0.1 [transitive] Score: 75
     ⚠ Stagnant release cadence: no published releases in 4641 days (>2 years). (-25)

  MEDIUM  deep-is@0.1.4 [transitive] Score: 75
     ⚠ Stagnant release cadence: no published releases in 1866 days (>2 years). (-25)

──────────────────────────────────────────────────────────────────────
✖ POLICY FAILED: Found 2 policy violation(s):
   - Dependency eslint@9.39.5 carries critical maintenance risk (score: 20). (Rule: failOnRisk contains 'critical')
   - Project contains 1 high risk dependencies, exceeding allowed limit of 0. (Rule: maxHighRiskAllowed (0))

Tip: Review flagged dependencies or update policy in deppulse.config.json
```

---

## Installation

```bash
# Run instantly with npx (no install needed)
npx deppulse scan

# Or install globally
npm install -g deppulse

# Or add as a development dependency
npm install --save-dev deppulse
```

---

## CLI Commands

### 1. `scan [path]`
Scans manifest and lockfiles, evaluates all direct and transitive dependencies, enforces health policies, and sets CI exit codes.

```bash
deppulse scan
deppulse scan ./packages/web --format json --output report.json
deppulse scan --fail-on high --verbose
```

**Flags**:
- `-f, --format <format>`: Output format: `terminal` (default), `json`, or `markdown`.
- `--fail-on <risk>`: Fail with exit code 1 if any dependency matches risk: `low`, `medium`, `high`, `critical`, `unknown`.
- `--no-cache`: Bypass local HTTP cache.
- `-o, --output <file>`: Write formatted output to file.
- `-c, --config <file>`: Custom path to `deppulse.config.json`.
- `-v, --verbose`: Display all dependencies, including healthy ones.

### 2. `analyze <package[@version]>`
Inspects upstream packuments, release timeline, repository activity, and returns a detailed health scorecard for a single package.

```bash
deppulse analyze express
deppulse analyze rimraf@3.0.2
```

### 3. `compare <package>`
Evaluates upgrade risk between two versions. Checks for breaking Node engine declarations, deprecations, and whether target releases carry unaddressed maintenance debt.

```bash
deppulse compare rimraf --from 3.0.2 --to 5.0.5
```

### 4. `explain <package>`
Prints the exact audit trail and evidence chain explaining how a package's score and risk classification were calculated.

```bash
deppulse explain request
```

---

## Scoring Methodology Summary

Every score is **deterministic**, **rule-based**, and **versioned (v1)**. No machine learning is used.

### Signals & Fatal Caps
1. **Deprecation**: If marked deprecated on npm, the score is capped at **$\max(Score) = 20$** (`critical`).
2. **Archived Repository**: If the upstream GitHub repo is archived, the score is capped at **$\max(Score) = 25$** (`critical`).
3. **Maturity-Calibrated Recency**:
   - *Mature-Stable Tier* ($\ge 4$ years old, steady adoption, multiple releases): 0 penalty for infrequent releases if Node engine compatibility is preserved.
   - *Emerging Tier*: Penalized if $> 365$ days elapse without a release.
4. **Node Engine Compatibility**: Incompatibility with active Node LTS runtimes (18, 20, 22) caps score at **40**.
5. **Anti-Spoofing & Provenance**: Packages claiming high-profile monorepos without cryptographic provenance are capped at **30** (`high`).
6. **Security Advisories**: Contextual signal only; strictly **0 contribution** to maintenance score.

### Confidence Rule
$$\text{Confidence} = C_{\text{registry}} (0.40) + C_{\text{repo}} (0.35) + C_{\text{runtime}} (0.15) + C_{\text{provenance}} (0.10)$$
If $\text{Confidence} < 0.35$, the score is `null` and risk is `unknown`. **Missing data is never penalized as poor health.**

---

## Lockfile Support

| Lockfile Format | Level | Description |
| :--- | :--- | :--- |
| `package-lock.json` (v2, v3) | **Full** | Deep direct and transitive tree analysis |
| `npm-shrinkwrap.json` | **Full** | Deep direct and transitive tree analysis |
| `package-lock.json` (v1) | **Full** | Recursive dependency parsing |
| `pnpm-lock.yaml` | **Partial** | Direct dependencies + package specifiers |
| `yarn.lock` | **Direct-Only** | Analyzes direct dependencies from `package.json` |

*Unsupported or missing lockfiles are reported as partial coverage, never silently ignored.*

---

## Privacy, Security & Data Handling

- **Read-Only**: DepPulse never runs lifecycle scripts (`postinstall`), never installs packages, and never modifies project files.
- **What Leaves Your Machine**:
  - Outbound HTTPS queries to public package registries (`registry.npmjs.org`) and GitHub API (`api.github.com`).
  - **NO project source code, NO file paths, and NO proprietary code ever leaves your machine.**
- **Credential Redaction**: Tokens (`NPM_TOKEN`, `GITHUB_TOKEN`) are strictly sanitized before reaching logs or error payloads.
- **SSRF Protection**: All network requests are restricted to HTTPS and validated against strict hostname allowlists; private/loopback/cloud-metadata IPs are blocked.

---

## Programmatic TypeScript SDK

The core engine is completely decoupled from the CLI:

```typescript
import { DepPulseEngine, getDefaultConfig } from 'deppulse';

const engine = new DepPulseEngine(getDefaultConfig());

// Scan project
const report = await engine.scan('./my-project');
console.log(`Average Score: ${report.summary.averageScore}`);

// Analyze single package
const health = await engine.analyze('wrappy');
console.log(`Risk: ${health.maintenanceRisk}, Score: ${health.score}`);
```

---

## Roadmap

- [x] Full npm lockfile v1/v2/v3 and shrinkwrap support
- [x] Deterministic scoring with mature-stable calibration
- [x] Repository anti-spoofing and provenance checks
- [x] Resilient HTTP client with retry, jitter, rate-limit handling, and disk cache
- [x] Terminal, JSON, and Markdown report formatters
- [ ] *(Planned)* Deep AST parsing for `pnpm-lock.yaml` virtual stores (v1.1)
- [ ] *(Planned)* Deep resolution for `yarn.lock` v1 & v2+ (v1.1)
- [ ] *(Planned)* Multi-package monorepo workspace matrix reports (v1.1)
- [ ] *(Planned)* Automated PR comment integration action (v1.2)

---

## Documentation

- [Architecture Specification](docs/architecture.md)
- [Scoring Methodology](docs/scoring-methodology.md)
- [Configuration Reference](docs/configuration.md)
- [CI/CD Integration](docs/ci-integration.md)
- [Limitations & Non-Goals](docs/limitations.md)

---

## Contributing

1. Fork and clone the repository.
2. Install dependencies: `npm install`
3. Run tests: `npm test`
4. Verify types and lint: `npm run typecheck && npm run lint`
5. Submit a pull request.

---

## License

[MIT](LICENSE) © 2026 Arnav
