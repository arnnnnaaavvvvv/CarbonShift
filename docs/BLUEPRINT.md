# CarbonShift: System Architecture & Implementation Blueprint
**Document Version:** 1.0.0-PROD  
**Author:** Principal Systems Architect & Optimization Engineer  
**Status:** Approved for Implementation Blueprint

---

## 1. Executive Summary
CarbonShift is a carbon-aware workload scheduler and trace-replay simulator. It decides when and where flexible batch jobs execute to minimize carbon emissions ($\text{gCO}_2\text{e}$) and operational costs without violating Service Level Objectives (deadlines).

---

## 2. Requirements & Scope

### 2.1 Functional Requirements
*   **FR-01 (Multi-Level Architecture):**
    *   **Level 1:** Deterministic CP-SAT and heuristic scheduling.
    *   **Level 2:** Probabilistic quantile forecasting ($P10/P50/P90$) with risk-adjusted intensity dispatch.
    *   **Level 3:** Machine learning job runtime and energy prediction feeding the optimizer.
*   **FR-02 (Trace Replay):** Ingestion and replay of Google Cluster Data and Alibaba Cluster Trace workloads.
*   **FR-03 (Spatio-Temporal Shifting):** Dynamic optimization across time (deferrals) and space (inter-region migrations with transfer cost penalties).
*   **FR-04 (Rolling Horizon):** Rolling-horizon optimization with a 1-hour frozen commitment window.
*   **FR-05 (Kubernetes Controller):** Native pod gating using `carbonshift.io/gate` scheduling gates.

### 2.2 Explicit Assumptions
1.  **Job Atomicity:** Jobs are non-preemptible batch processes.
2.  **Grid Telemetry Resolution:** Discrete 15-minute or 60-minute time intervals.
3.  **Network Overhead:** Data transfer energy calibrated to $0.014\text{ kWh/GB}$.
4.  **Homogeneous Node Clusters:** Nodes within a cloud region share uniform SPECpower curves.

---

## 3. Optimization Program (OR-Tools CP-SAT)

$$\min \sum_{j \in \mathcal{J}} \sum_{r \in \mathcal{R}} \sum_{s \in \mathcal{S}} \left( \alpha \cdot \tilde{c}_{j,r,s} + \beta \cdot \tilde{k}_{j,r,s} + \gamma \cdot \text{Risk}_{j,s} \right) \cdot x_{j,r,s}$$

Subject to:
1.  **Unique Allocation:** $\sum_{r \in \mathcal{W}_j} \sum_{s=a_j + \Delta_{\text{xfer}, j, r}}^{d_j - \ell_{j,r} - m_j} x_{j,r,s} = 1 \quad \forall j \in \mathcal{J}$
2.  **Capacity Constraints:**
    $$\sum_{j \in \mathcal{J}} \sum_{s = \max(0, t - \ell_{j,r} + 1)}^{t} \text{req}_j^{\text{cpu}} \cdot x_{j,r,s} \le \text{Cap}_{r,t}^{\text{cpu}} \quad \forall r \in \mathcal{R}, \; \forall t \in \mathcal{S}$$
3.  **Integer Scaling:** $\tilde{c} = \text{round}(1000 \cdot c)$, ensuring max rounding error $\le n_{\text{slots}} \times 0.0005\text{ gCO}_2\text{e}$.

---

## 4. Evaluated Baselines
*   **Baseline A (Run-Immediately):** Immediate dispatch in arrival region.
*   **Baseline B (Greedy Lowest-Carbon-Now):** Instantaneous minimum carbon region at arrival slot.
*   **Baseline C (Delay-to-Deadline-Greedy):** Greedy selection across $[a_j, d_j - \ell_j]$ without capacity resolution.
*   **CarbonShift (CP-SAT):** Global joint integer optimization.
*   **Baseline E (Theoretical Oracle):** Upper bound with perfect ex-post foresight.

---

## 5. Benchmark Protocol
*   **Walk-Forward Splits:** Strict time-based validation without temporal leakage.
*   **Matched Deadline-Miss Curve:** Sweeping safety margin $m \in [0.0, 3.0]$ to compare strategies at equal miss rates.
*   **Block Bootstrap:** $B \ge 10,000$ iterations resampled at whole trace-day units for robust 95% confidence intervals.
