# 🤝 Contributing to CarbonShift

**Document Version:** 1.0.0-PROD  
**Target Audience:** Open-Source Contributors, Maintainers, Research Collaborators  
**Code of Conduct:** We are committed to providing a welcoming, inclusive, and harassment-free environment for everyone.

---

## 1. Getting Started

Thank you for your interest in contributing to **CarbonShift**! We welcome contributions ranging from novel forecasting models to solver performance enhancements and Kubernetes operator improvements.

### 1.1 Development Environment Setup
```powershell
# 1. Fork and clone the repository
git clone https://github.com/arnnnnaaavvvvv/CarbonShift.git
cd CarbonShift

# 2. Set up Python 3.11 virtual environment
python -m venv .venv
.\.venv\Scripts\Activate.ps1    # Linux/macOS: source .venv/bin/activate

# 3. Install development & testing dependencies
pip install --upgrade pip
pip install -r requirements.txt
pip install -e .

# 4. Set up frontend dependencies
cd web
npm install
cd ..
```

---

## 2. Development Workflow

### 2.1 Branching Strategy
- `main`: Production-ready, mathematically audited branch.
- Feature branches: `feat/<feature-name>` (e.g., `feat/xgboost-forecaster`).
- Bug fix branches: `fix/<issue-description>` (e.g., `fix/timezone-alignment`).
- Documentation branches: `docs/<topic>` (e.g., `docs/karpenter-guide`).

### 2.2 Conventional Commit Guidelines
All commit messages must adhere to the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat:` Introduces a new feature or scheduling strategy.
- `fix:` Patches a bug, solver constraint, or edge-case failure.
- `audit:` Documents or adjusts mathematical derivations and proofs.
- `test:` Adds unit tests, fuzzing suites, or Hypothesis property tests.
- `docs:` Modifies markdown documentation or diagrams.
- `refactor:` Code improvements without behavioral changes.

*Example:*
```text
feat(optimizer): add multi-tenant priority weighting to CP-SAT objective
```

---

## 3. Code Standards & Quality Gates

### 3.1 Python Backend Standards
- **Typing:** Strict type annotations everywhere (`typing.Dict`, `List`, `Optional`, `Pydantic BaseModel`).
- **Formatting & Linting:** Code is formatted with `black` (line length 100) and linted with `ruff`.
- **Type Checking:** All source code in `src/` must pass `mypy --strict`.

```powershell
# Format code
black src/ tests/

# Lint code
ruff check src/ tests/

# Verify type safety
mypy src/
```

### 3.2 TypeScript / React Frontend Standards
- **Strict Typing:** No implicit `any` types; all props and state variables must be typed.
- **Design System:** Use established design tokens in `web/src/index.css` (Obsidian Cosmic Dark palette).
- **Zero Build Warnings:** `npm run build` must compile with zero TypeScript compiler (`tsc`) errors.

```powershell
cd web
npm run build
```

---

## 4. Testing & Verification Suite

No pull request will be merged without automated tests verifying mathematical correctness and maintaining test coverage $\ge 90\%$.

### 4.1 Running Tests
```powershell
# Run unit & integration test suites with coverage report
pytest --cov=carbonshift --cov-report=term-missing tests/
```

### 4.2 Property-Based & Invariant Testing (Hypothesis)
CarbonShift uses `hypothesis` to fuzz mathematical invariants across thousands of randomized instances:
- **Conservation of Energy:** $\sum E_j = \text{const}$ regardless of chosen strategy.
- **Strict Deadline Observance:** For all completed jobs, $t_{\text{end}} \le d_j$.
- **Bounding Invariant:** $\text{Oracle} \le \text{CP-SAT} \le \text{Baselines}$.

```powershell
# Run invariant and property-based test suite
pytest tests/test_invariants.py -v
```

---

## 5. Pull Request Checklist

Before submitting a Pull Request, confirm that:
- [ ] Code passes all tests (`pytest tests/`).
- [ ] Test coverage is $\ge 90\%$.
- [ ] Mathematical formulas adhere to [docs/MATH.md](MATH.md).
- [ ] No `kube-scheduler` core binaries are modified (non-invasive Pod Gate architecture preserved).
- [ ] Frontend builds cleanly with `npm run build` in `web/`.
- [ ] Commits follow Conventional Commits formatting.
