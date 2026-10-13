# 🚀 CarbonShift Production Deployment & Operations Guide

**Document Version:** 1.0.0-PROD  
**Target Environment:** Local Bare-Metal, Docker Compose, Production Kubernetes (EKS / GKE / AKS / Kind)  
**Companion Documents:** [ARCHITECTURE.md](ARCHITECTURE.md) • [API_REFERENCE.md](API_REFERENCE.md) • [MATH.md](MATH.md)

---

## 1. Prerequisites & System Requirements

### Hardware Requirements
- **Development/Testing:** 4 CPU cores, 8 GB RAM, 20 GB SSD storage.
- **Production (up to 10k jobs/hr):** 8 CPU cores, 16 GB RAM, PostgreSQL 15+, persistent NVMe storage.

### Software Dependencies
- **Python:** 3.11+
- **Node.js:** 20.x+ (with `npm` or `pnpm`)
- **Container Engine:** Docker Engine $\ge 24.0$ & Docker Compose $\ge 2.20$
- **Kubernetes (for in-cluster controller):** Kubernetes $\ge 1.26$ (native `schedulingGates` support)

---

## 2. Local Bare-Metal Development Setup

### 2.1 Backend Environment Setup
```powershell
# 1. Clone repository
git clone https://github.com/arnnnnaaavvvvv/CarbonShift.git
cd CarbonShift

# 2. Create isolated Python 3.11 virtual environment
python -m venv .venv
.\.venv\Scripts\Activate.ps1    # On Linux/macOS: source .venv/bin/activate

# 3. Upgrade pip and install core dependencies
pip install --upgrade pip
pip install -r requirements.txt
pip install -e .

# 4. Run test suite to verify solver & mathematical invariants
pytest tests/ -v
```

### 2.2 Launching the Backend Engine
```powershell
# Start FastAPI backend with automatic reloading on port 8000
uvicorn carbonshift.api.app:app --host 0.0.0.0 --port 8000 --reload
```
Navigate to `http://localhost:8000/docs` to inspect the Swagger UI.

### 2.3 Launching the Reactive Frontend
```powershell
# Navigate to web dashboard directory
cd web

# Install node dependencies
npm install

# Start development server on port 3000
npm run dev
```
Navigate to `http://localhost:3000` to interact with the Live Scheduler Studio and Grid Telemetry Matrix.

---

## 3. Containerized Deployment (Docker Compose)

CarbonShift includes a multi-container stack (`docker-compose.yml`) bundling:
1. `carbonshift-db`: PostgreSQL 15 database for persisting jobs and solver decisions.
2. `carbonshift-api`: Multi-stage distroless Python 3.11 runtime running non-root (UID 10001).
3. `carbonshift-prometheus`: Telemetry scraping engine capturing job throughput and solver latencies.

### 3.1 Launch Stack
```bash
# Build and start all services in detached mode
docker compose up --build -d

# Verify container health
docker compose ps
```

### 3.2 Verify Container Health & Endpoints
```bash
# Check API liveness probe
curl http://localhost:8000/healthz

# Inspect Prometheus metrics exposition
curl http://localhost:8000/metrics

# View logs
docker compose logs -f carbonshift-api
```

---

## 4. Kubernetes In-Cluster Production Deployment

CarbonShift operates non-invasively using **Kubernetes Scheduling Gates (`schedulingGates`)**, requiring zero modifications to the standard `kube-scheduler` binary.

### 4.1 Cluster Architecture
```
[User Pod Manifest]
        │
        ▼
[Kubernetes API Server]
        │
        ├──► [CarbonShift Mutating Webhook] (Applies carbonshift.io/gate)
        │
        ▼
[Pending Queue] ──(Gate holds Pod until clean window)──► [CarbonShift Controller]
                                                                │
                                                  (Removes Gate at optimal slot &
                                                   injects nodeAffinity)
                                                                ▼
                                                        [kube-scheduler]
                                                                │
                                                                ▼
                                                        [Green Worker Node]
```

### 4.2 Step 1: Deploy Controller RBAC & CRDs
```bash
# Apply RBAC permissions allowing controller to manage pod scheduling gates
kubectl apply -f k8s/controller/rbac.yaml
```

**RBAC Specifications (`ClusterRole`):**
```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: carbonshift-controller-role
rules:
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "list", "watch", "update", "patch"]
  - apiGroups: [""]
    resources: ["nodes"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["batch"]
    resources: ["jobs"]
    verbs: ["get", "list", "watch"]
```

### 4.3 Step 2: Deploy CarbonShift In-Cluster Controller
```bash
kubectl apply -f k8s/controller/deployment.yaml
```

### 4.4 Step 3: Submitting Flexible Batch Jobs
Submit standard Kubernetes batch jobs annotated with the `carbonshift.io/gate` scheduling gate:

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: ml-distributed-training-job
  namespace: batch-compute
  labels:
    carbonshift/flexible: "true"
    carbonshift/priority: "batch"
spec:
  template:
    metadata:
      labels:
        carbonshift/flexible: "true"
    spec:
      schedulingGates:
        - name: carbonshift.io/gate
      restartPolicy: OnFailure
      containers:
        - name: trainer
          image: pytorch/pytorch:2.2.0-cuda12.1-cudnn8-runtime
          command: ["python", "train_model.py"]
          resources:
            requests:
              cpu: "16"
              memory: "64Gi"
```

### 4.5 Step 4: Verify Lifecycle & Gate Removal
```bash
# 1. Watch pod status (will remain in 'SchedulingGated' until the clean slot arrives)
kubectl get pods -n batch-compute -w

# 2. Inspect controller decision log
kubectl logs -n carbonshift-system deployment/carbonshift-controller -f

# 3. Inspect pod annotations after gate removal
kubectl get pod <pod-name> -n batch-compute -o yaml | grep -A 10 nodeAffinity
```

---

## 5. Telemetry & Environment Configuration

CarbonShift behavior is configured via environment variables or `config/config.yaml`:

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `DATABASE_URL` | `sqlite:///./carbonshift.db` | PostgreSQL or SQLite connection string |
| `CARBONSHIFT_API_KEY` | *None* | Shared secret for securing REST endpoints |
| `ELECTRICITY_MAPS_API_KEY` | *None* | Commercial grid intensity telemetry token |
| `SOLVER_TIMEOUT_SECONDS` | `30` | Maximum CP-SAT search duration per batch instance |
| `INTEGER_SCALING_FACTOR` | `1000` | Precision multiplier ($S=1000$ represents milligrams CO₂) |
| `LOG_LEVEL` | `INFO` | Logging verbosity (`DEBUG`, `INFO`, `WARNING`, `ERROR`) |
| `DEFAULT_PUE` | `1.15` | Default Data Center Power Usage Effectiveness |

---

## 6. Observability & Production Monitoring

### Prometheus Integration
Configure your Prometheus agent to scrape the CarbonShift metrics endpoint:

```yaml
scrape_configs:
  - job_name: 'carbonshift-engine'
    scrape_interval: 15s
    static_configs:
      - targets: ['carbonshift-api.carbonshift-system.svc.cluster.local:8000']
```

### Recommended Alerting Thresholds
1. **Solver Timeout Spike (`solve_time_ms > 15000`):** Indicates extreme problem dimensionality or tight combinatorial constraints.
2. **Telemetry Stale Alarm (`time() - carbonshift_telemetry_last_updated_timestamp > 3600`):** Triggers fallback to historical persistence curves.
3. **Deadline Buffer Breach (`deadline_misses > 0`):** Immediate escalation; triggers increase of `safety_margin_slots`.
