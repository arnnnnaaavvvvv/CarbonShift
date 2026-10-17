# Changelog

All notable changes to **DepPulse** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0] - 2026-10-17

Initial production-ready release of **DepPulse** (`deppulse`), a TypeScript CLI and decoupled engine for third-party dependency health scoring, maintenance risk detection, and upgrade intelligence.

### Added

- **Multi-Format Lockfile Parsing**:
  - Full AST-based parsing for `package-lock.json` and `npm-shrinkwrap.json` across formats v1, v2, and v3.
  - Transparent tracking of declared ranges (`package.json`) vs. resolved locked versions.
  - Detection and explicit skipping of unsupported or non-registry sources (`git`, `file:`, `workspace:`, and npm `alias`), with granular explanations surfaced in reports rather than silently dropping dependencies.

- **Deterministic Maintenance Health Scoring**:
  - Transparent 0–100 score with strictly auditable, evidence-based signals.
  - **Mature-Stable Recognition**: Waiver of inactivity penalties for battle-tested, stable packages ($\ge 4$ years old, $\ge 6$ releases, compatible with active Node.js LTS).
  - **Fatal Caps**: Deprecated packages capped at $\le 20$, archived repositories capped at $\le 25$, repo impersonation/spoofing capped at $\le 30$.
  - **Confidence Floor**: Missing metadata never lowers health scores. Packages with confidence $< 0.35$ receive `score: null` and risk `unknown`.
  - Orthogonal separation of security advisories (OSV) as purely contextual annotations with 0 score impact.

- **Resilient & Secure Network Layer**:
  - Native `fetch` with exponential backoff, full jitter, 429 Retry-After compliance, and 10-second default timeouts.
  - **SSRF Defense**: Strict loopback, private IPv4/IPv6, link-local metadata (`169.254.169.254`), and octal/hex evasion blocking.
  - **Manual Safe Redirects**: Enforces manual redirect loops with re-validation on every redirect hop to prevent redirect-based SSRF.
  - **Stream Size Clamping**: Streaming body accumulator enforcing a strict 10 MB limit even on chunked transfer-encoded responses without `content-length`.
  - **Token Redaction**: Automated sanitization of URLs, `ghp_`, `npm_`, and `Bearer` tokens from errors, logs, and outputs.

- **Strict Read-Only Local Guarantee**:
  - Zero project script execution, zero dependency installation, zero file mutation during scans.
  - Fully verified by integration filesystem-diff test comparing recursive hashes and mtimes before and after scans.

- **CLI & Reporting Engine**:
  - Commands: `scan`, `analyze`, `compare`, `explain`.
  - Formatters: Terminal (colored tables and alerts), JSON (versioned schema `1.0.0`), and Markdown (PR summary).
  - CI Policy Enforcement: Configurable thresholds (`failOn`, `maxHighRiskAllowed`, `allowList`) mapped to standard exit codes (0 = pass, 1 = policy breach, 2 = usage/analysis error).

- **Disk Caching**:
  - Content-hashed disk cache with atomic writes and configurable TTL (default 24h) in `.deppulse/cache/`.
