# 📡 CarbonShift REST API Reference & OpenAPI Specification

**Document Version:** 1.0.0-PROD  
**Base URL:** `http://localhost:8000` (or cluster ingress `https://carbonshift.internal/api/v1`)  
**Interactive Swagger UI:** `http://localhost:8000/docs`  
**Interactive ReDoc:** `http://localhost:8000/redoc`

---

## 1. Overview & Authentication

CarbonShift provides an asynchronous REST API built with FastAPI. It handles workload submissions, CP-SAT combinatorial scheduling, multi-strategy trace replays, structured explainability decisions, and audit-ready ESG report exports.

### Authentication
If the `CARBONSHIFT_API_KEY` environment variable is configured in the backend environment, all requests to `/api/v1/*` must include the `X-API-Key` header:

```http
X-API-Key: your-secret-api-key-here
```
If unset, the API runs in open local-development mode.

---

## 2. Health & Telemetry Endpoints

### `GET /health`
Verifies backend service operational readiness.

**Response `200 OK`:**
```json
{
  "status": "ok",
  "version": "1.0.0"
}
```

### `GET /healthz`
Standard Kubernetes liveness and readiness probe endpoint.

**Response `200 OK`:**
```json
{
  "status": "healthy",
  "service": "carbonshift-engine",
  "version": "1.0.0"
}
```

### `GET /metrics`
Exposes system telemetry and solver counts in **Prometheus exposition format (v0.0.4)**.

**Response `200 OK` (`text/plain`):**
```text
# HELP carbonshift_schedules_total Total number of schedules generated
# TYPE carbonshift_schedules_total counter
carbonshift_schedules_total 42
# HELP carbonshift_jobs_total Total number of jobs registered
# TYPE carbonshift_jobs_total counter
carbonshift_jobs_total 350
# HELP carbonshift_engine_up Engine operational status
# TYPE carbonshift_engine_up gauge
carbonshift_engine_up 1
```

---

## 3. Scheduling & Optimization Endpoints

### `GET /api/v1/strategies`
Returns the registry of scheduling strategies available for benchmarking and comparison.

**Response `200 OK`:**
```json
{
  "strategies": [
    {
      "id": "run_now",
      "name": "Baseline A: Run-Immediately",
      "type": "heuristic"
    },
    {
      "id": "greedy_now",
      "name": "Baseline B: Greedy Lowest-Carbon",
      "type": "heuristic"
    },
    {
      "id": "delay_greedy",
      "name": "Baseline C: Delay-to-Deadline",
      "type": "heuristic"
    },
    {
      "id": "cpsat_optimizer",
      "name": "CarbonShift: CP-SAT Global Optimizer",
      "type": "exact_integer_solver"
    },
    {
      "id": "oracle",
      "name": "Baseline E: Theoretical Oracle",
      "type": "theoretical_upper_bound"
    }
  ]
}
```

---

### `POST /api/v1/jobs`
Registers and persists a list of batch workload jobs in SQLite/PostgreSQL storage.

**Request Body:**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "analytics-etl-job-42",
    "arrival_epoch_s": 1776124800.0,
    "deadline_epoch_s": 1776153600.0,
    "duration_seconds": 3600.0,
    "cpu_cores": 16.0,
    "mem_gb": 64.0,
    "data_size_gb": 12.5,
    "source_region": "eu-west",
    "region_whitelist": ["eu-west", "uk-north", "us-east"],
    "utilization": 0.75
  }
]
```

**Response `200 OK`:**
```json
{
  "status": "submitted",
  "jobs_count": 1,
  "job_ids": ["550e8400-e29b-41d4-a716-446655440000"]
}
```

---

### `POST /api/v1/schedules/plan`
Executes OR-Tools CP-SAT multi-objective optimization across the input workload batch. Computes integer-optimal time slot allocation and regional placement subject to capacity, deadline, and network migration constraints.

**Request Body (`PlanRequest`):**
```json
{
  "jobs": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "batch-embedding-indexer",
      "arrival_epoch_s": 0.0,
      "deadline_epoch_s": 43200.0,
      "duration_seconds": 7200.0,
      "cpu_cores": 32.0,
      "mem_gb": 128.0,
      "data_size_gb": 25.0,
      "source_region": "us-east",
      "region_whitelist": ["us-east", "eu-west", "uk-north"],
      "utilization": 0.85
    }
  ],
  "horizon_hours": 24,
  "risk_level": "intensity_p75",
  "alpha_carbon": 1.0,
  "beta_cost": 0.1,
  "gamma_risk": 0.5,
  "safety_margin_slots": 1
}
```

**Parameters:**
| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `jobs` | `List[Job]` | *Required* | List of candidate jobs to schedule |
| `horizon_hours` | `int` | `24` | Forecast and scheduling horizon (12 to 96 hours) |
| `risk_level` | `string` | `"intensity_p75"` | Quantile risk band (`intensity_p50`, `intensity_p75`, `intensity_p90`) |
| `alpha_carbon` | `float` | `1.0` | Weight for carbon minimization in objective function |
| `beta_cost` | `float` | `0.1` | Weight for financial cloud cost minimization |
| `gamma_risk` | `float` | `0.5` | Weight for forecast uncertainty risk minimization |
| `safety_margin_slots`| `int` | `1` | Extra buffer slots reserved prior to deadline to prevent SLO misses |

**Response `200 OK` (`Schedule`):**
```json
{
  "id": "e4b1a792-91d4-4f8e-8a9d-3c99f0123456",
  "strategy_name": "cpsat_optimizer",
  "total_carbon_gco2e": 51624.62,
  "total_cost_usd": 22.91,
  "deadline_misses": 0,
  "deadline_miss_rate": 0.0,
  "solver_status": "OPTIMAL",
  "solve_time_ms": 142.8,
  "optimality_gap": 0.0,
  "decisions": [
    {
      "job_id": "550e8400-e29b-41d4-a716-446655440000",
      "selected_region": "uk-north",
      "scheduled_start_epoch_s": 14400.0,
      "assigned_slot": 4,
      "estimated_carbon_gco2e": 482.15,
      "estimated_cost_usd": 0.32,
      "explanation": {
        "job_id": "550e8400-e29b-41d4-a716-446655440000",
        "selected_region": "uk-north",
        "selected_slot": 4,
        "carbon_saved_vs_run_now_pct": 28.4,
        "cost_delta_vs_run_now_pct": -31.2,
        "slack_hours_used": 4.0,
        "transfer_overhead_gco2e": 14.7,
        "rationale": "Deferred 4h to align with UK offshore wind generation peak, offsetting 14.7 gCO2e WAN transfer cost with 191.2 gCO2e compute abatement."
      }
    }
  ]
}
```

---

### `GET /api/v1/schedules/{schedule_id}`
Retrieves a previously computed and stored schedule along with its decision ledger.

**Response `200 OK`:**
```json
{
  "schedule_id": "e4b1a792-91d4-4f8e-8a9d-3c99f0123456",
  "strategy_name": "cpsat_optimizer",
  "total_carbon_gco2e": 51624.62,
  "total_cost_usd": 22.91,
  "deadline_misses": 0,
  "solver_status": "OPTIMAL",
  "solve_time_ms": 142.8,
  "decisions": [ ... ]
}
```

---

### `GET /api/v1/decisions/{decision_id}/explanation`
Returns a detailed explainability record for an individual job allocation decision.

**Response `200 OK`:**
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "selected_region": "uk-north",
  "selected_slot": 4,
  "carbon_saved_vs_run_now_pct": 28.4,
  "cost_delta_vs_run_now_pct": -31.2,
  "slack_hours_used": 4.0,
  "transfer_overhead_gco2e": 14.7,
  "rationale": "Deferred 4h to align with UK offshore wind generation peak, offsetting 14.7 gCO2e WAN transfer cost with 191.2 gCO2e compute abatement."
}
```

---

## 4. Simulation & Replay Endpoints

### `POST /api/v1/schedules/replay`
Executes an in-memory trace replay across all 5 benchmark strategies simultaneously under strict capacity constraints.

**Request Body (`ReplayRequest`):**
```json
{
  "num_jobs": 50,
  "horizon_hours": 24,
  "seed": 42
}
```

**Response `200 OK`:**
```json
{
  "workload_jobs_count": 50,
  "baseline_run_now": {
    "carbon_gco2e": 69908.13,
    "cost_usd": 32.77,
    "saved_pct": 0.0
  },
  "baseline_greedy_now": {
    "carbon_gco2e": 63472.91,
    "cost_usd": 27.49,
    "saved_pct": 9.21
  },
  "baseline_delay_greedy": {
    "carbon_gco2e": 53317.41,
    "cost_usd": 23.74,
    "saved_pct": 23.73
  },
  "carbonshift_optimizer": {
    "carbon_gco2e": 51624.62,
    "cost_usd": 22.91,
    "saved_pct": 26.15,
    "deadline_miss_rate_pct": 0.0,
    "solve_time_ms": 118.4
  },
  "theoretical_oracle": {
    "carbon_gco2e": 51624.50,
    "cost_usd": 22.92,
    "saved_pct": 26.15
  }
}
```

---

## 5. Audit & ESG Report Export

### `GET /api/v1/reports/esg`
Generates an audit-ready ESG Scope 2 carbon abatement ledger.

**Query Parameters:**
- `format`: `"csv"` (default) or `"json"`.

**Curl Example (CSV Download):**
```bash
curl -X GET "http://localhost:8000/api/v1/reports/esg?format=csv" -o carbonshift_esg_report.csv
```

**CSV Output Sample:**
```csv
Strategy,Total Carbon (gCO2e),CO2 Saved (%),Total Cost (USD),Cost Delta (%),Deadline Miss Rate (%)
Baseline A: Run-Immediately,69908.13,0.00,32.77,0.00,0.00
Baseline B: Greedy Lowest-Carbon,63472.91,9.21,27.49,-16.12,0.00
Baseline C: Delay-to-Deadline,53317.41,23.73,23.74,-27.55,0.00
CarbonShift: CP-SAT Optimizer,51624.62,26.15,22.91,-30.09,0.00
Baseline E: Theoretical Oracle,51624.50,26.15,22.92,-30.05,0.00
```

---

## 6. Client Code Snippets

### Python (`httpx` / `requests`)
```python
import httpx

url = "http://localhost:8000/api/v1/schedules/replay"
payload = {"num_jobs": 100, "horizon_hours": 24, "seed": 42}

response = httpx.post(url, json=payload, timeout=30.0)
data = response.json()

print(f"Carbon Saved: {data['carbonshift_optimizer']['saved_pct']}%")
print(f"Cost Savings: ${data['carbonshift_optimizer']['cost_usd']}")
```

### TypeScript (`fetch`)
```typescript
interface ReplayResult {
  carbonshift_optimizer: {
    saved_pct: number;
    deadline_miss_rate_pct: number;
    solve_time_ms: number;
  };
}

async function runBenchmark(): Promise<ReplayResult> {
  const res = await fetch('http://localhost:8000/api/v1/schedules/replay', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ num_jobs: 100, horizon_hours: 24, seed: 42 }),
  });
  return await res.json();
}
```
