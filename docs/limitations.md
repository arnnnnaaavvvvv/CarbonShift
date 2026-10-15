# DepPulse Technical Boundaries & Limitations

Honesty about technical capabilities and non-goals is a core design principle of DepPulse.

## 1. System Scope & Separation from MEJOR (`arnav-audit`)

- **DepPulse Scope**: Exclusively evaluates third-party packages, registry packuments, and upstream maintenance signals.
- **MEJOR Scope**: Dedicated application source-code security auditing, AST static analysis, and hardcoded secret detection.
- **Strict Isolation**: DepPulse does **not** inspect application source code, run AST parsers on user code, search for API keys/secrets, or generate auto-fixing patches.

## 2. Lockfile Coverage Matrix

| Lockfile Format | Current Support Level | Behavior |
| :--- | :--- | :--- |
| `package-lock.json` (v2, v3) | **Full Support** | Complete direct and transitive dependency graph resolution. |
| `npm-shrinkwrap.json` | **Full Support** | Complete direct and transitive dependency resolution. |
| `package-lock.json` (v1) | **Full Support** | Recursive dependency resolution. |
| `pnpm-lock.yaml` (v5, v6, v9) | **Partial Support** | Extracts packages; full virtual-store resolution is scheduled for v1.1. |
| `yarn.lock` (v1, v2+) | **Direct-Only Support** | Emits explicit warning; analyzes direct dependencies from `package.json`. Full AST parser scheduled for v1.1. |
| No lockfile found | **Direct-Only Support** | Analyzes declared ranges from `package.json`. |

DepPulse **never silently ignores** unsupported formats or guesses resolutions. It reports explicit partial coverage with actionable recovery hints.

## 3. Read-Only Safety Guarantees

DepPulse is strictly read-only:
- **No Package Lifecycle Scripts**: Does not run `preinstall`, `postinstall`, or any npm lifecycle scripts.
- **No File Mutation**: Does not alter `package.json`, lockfiles, or code files during scans.
- **No Automatic Installation**: Does not execute `npm install` or invoke package manager executables.

## 4. Telemetry Availability & Missing Data Rules

- **Private & Internal Packages**: Packages published to private registries without public internet access or unlinked git repos will yield `confidence < 0.35` and `maintenanceRisk: "unknown"`.
- **Missing Data Principle**: Missing information (e.g. an unlinked repository, missing download statistics, or missing engine fields) is **never** counted as evidence of poor health.
- **GitHub Rate Limits**: Without a `GITHUB_TOKEN`, GitHub's unauthenticated IP rate limit is 60 requests per hour. For projects with more than 30 distinct repositories, supplying a `GITHUB_TOKEN` is recommended.

## 5. Security Advisory Decoupling

Vulnerability advisories (CVEs/OSV) are reported **strictly as contextual annotations**. They have **zero contribution** to the maintenance health score. A well-maintained package receiving a zero-day patch is not unmaintained, and an abandoned package with zero reported CVEs is not healthy.
