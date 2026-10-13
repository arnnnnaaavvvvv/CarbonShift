# CarbonShift Mathematical Specification (MATH.md)
**Document Version:** 1.0.0  
**Status:** Approved Canonical Specification  
**Canonical Units:** Power (kW), Energy (kWh), Intensity (gCO₂e/kWh), Carbon (gCO₂e), Time (seconds UTC), Data (GB), Currency (USD).

All algorithms, models, and tests must cite sections of this document (e.g. `@see MATH.md §1.2`).

---

## 1. Units Registry & Physical Dimensions

To eliminate dimensional mismatch across disparate data feeds (WattTime lbs/MWh vs. UK ESO gCO₂e/kWh vs. Boavizta Scope 3 kgCO₂e), CarbonShift enforces strict canonical base units:

| Quantity | Base Symbol | Canonical Unit | Pint Specification | Conversion Factor to Base |
| :--- | :--- | :--- | :--- | :--- |
| **Power ($P$)** | $P$ | Kilowatt (`kW`) | `ureg.kilowatt` | $\text{W} \to \text{kW} \times 10^{-3}$; $\text{MW} \to \text{kW} \times 10^3$ |
| **Energy ($E$)** | $E$ | Kilowatt-hour (`kWh`) | `ureg.kilowatt_hour` | $\text{J} \to \text{kWh} \times 2.77778 \times 10^{-7}$; $\text{MWh} \to \text{kWh} \times 10^3$ |
| **Carbon Intensity ($I$)** | $I$ | $\text{gCO}_2\text{e/kWh}$ | `ureg.gram / ureg.kilowatt_hour` | $\text{lbs/MWh} \to \text{g/kWh} \times 0.45359237$; $\text{kg/MWh} \to \text{g/kWh} \times 1$ |
| **Total Carbon ($C$)** | $C$ | $\text{gCO}_2\text{e}$ | `ureg.gram` | $\text{kgCO}_2\text{e} \to \text{g} \times 10^3$; $\text{tCO}_2\text{e} \to \text{g} \times 10^6$ |
| **Time ($t, a, d$)** | $t$ | Seconds (`s`) | `ureg.second` | UTC Unix epoch timestamps |
| **Slot Length ($\Delta_h$)** | $\Delta_h$ | Hours (`hr`) | `ureg.hour` | $\Delta_h = \frac{\Delta_{\text{seconds}}}{3600}$ |
| **Data Volume ($V$)** | $V$ | Gigabytes (`GB`) | `ureg.gigabyte` | $\text{MB} \to \text{GB} \times 10^{-3}$; $\text{TB} \to \text{GB} \times 10^3$ |
| **Cost** | $\pi$ | USD (`$`) | N/A | Floating-point currency units |

---

## 2. Core Equations

### 2.1 Server Power Curve (SPECpower Calibration)
The instantaneous power draw $P(u)$ for a server operating at CPU utilization $u \in [0, 1]$ is:

$$P(u) = P_{\text{idle}} + (P_{\text{max}} - P_{\text{idle}}) \cdot u^r \quad [\text{kW}]$$

*   $P_{\text{idle}}$: Idle chassis power consumption in $\text{kW}$.
*   $P_{\text{max}}$: Peak load chassis power consumption in $\text{kW}$.
*   $u$: CPU utilization ratio $\in [0.0, 1.0]$.
*   $r$: Non-linear curvature exponent ($r = 1.4$ calibrated from SPECpower_ssj2008 benchmarks).

### 2.2 Discrete Slot Energy Consumption
For a workload running on a host with facility Power Usage Effectiveness $\text{PUE}_r$ in region $r$:

$$E_{s} = P(u) \cdot \Delta_h \cdot \text{PUE}_r \quad [\text{kWh}]$$

### 2.3 Exact Multi-Slot Piecewise Carbon Footprint
CarbonShift explicitly prohibits using a single time-averaged carbon intensity over multi-slot workloads. For job $j$ occupying time window $[t_{\text{start}}, t_{\text{end}}]$ across discrete slots $s \in \mathcal{S}_j$:

$$C_j = \sum_{s \in \mathcal{S}_j} P(u_j) \cdot \Delta_h \cdot \text{PUE}_r \cdot I_{r,s} \cdot \omega_{j,s} \quad [\text{gCO}_2\text{e}]$$

where $\omega_{j,s} \in (0, 1]$ is the exact fraction of slot $s$ occupied by the job:

$$\omega_{j,s} = \frac{\min(t_{\text{end}}, t_{s,\text{end}}) - \max(t_{\text{start}}, t_{s,\text{start}})}{t_{s,\text{end}} - t_{s,\text{start}}}$$

### 2.4 Data Transfer Energy & Carbon
Moving $V_{\text{data}}\text{ GB}$ of state between regions $r_{\text{src}} \neq r_{\text{dst}}$:

$$E_{\text{xfer}} = V_{\text{data}} \cdot \kappa_{\text{net}} \quad [\text{kWh}]$$

$$C_{\text{xfer}} = E_{\text{xfer}} \cdot I_{\text{net}} \quad [\text{gCO}_2\text{e}]$$

*   $\kappa_{\text{net}} = 0.014\text{ kWh/GB}$ (WAN network transmission coefficient, Aslan et al. 2018; Cloud Carbon Footprint standard).
*   $I_{\text{net}}$: Emission factor of the network path ($400.0\text{ gCO}_2\text{e/kWh}$ default).

### 2.5 Total Operational Cost
$$\text{Cost}_j = \sum_{s \in \mathcal{S}_j} \left( E_{j,s} \cdot \pi_{r,s} \right) + \left( V_{\text{data}} \cdot \zeta_{r_{\text{src}}, r_{\text{dst}}} \right) \quad [\text{USD}]$$

*   $\pi_{r,s}$: Grid electricity spot price in region $r$ at slot $s$ ($\text{USD/kWh}$).
*   $\zeta_{r_{\text{src}}, r_{\text{dst}}}$: Cloud egress price between regions ($\text{USD/GB}$). $\zeta = 0$ if $r_{\text{src}} = r_{\text{dst}}$.

### 2.6 Carbon Savings Metric (%)
Carbon savings must never be computed as a ratio of aggregate sums. Daily savings are evaluated per trace day $d \in \{1, \dots, D\}$:

$$S_d = \frac{C_{\text{baseline}, d} - C_{\text{strategy}, d}}{C_{\text{baseline}, d}} \times 100\%$$

The benchmark reporting metric is the bootstrap median and 95% confidence interval over $\{S_d\}_{d=1}^D$.

---

## 3. Worked Numeric Example (Verification Contract)

All unit test suites must verify this exact numerical calculation:

### Inputs:
*   Job $j$: Duration $= 5400\text{ s}$ ($1.5\text{ hr}$), Utilization $u = 0.80$, Data $= 100\text{ GB}$.
*   Server Profile: $P_{\text{idle}} = 0.100\text{ kW}$, $P_{\text{max}} = 0.500\text{ kW}$, $r = 1.4$.
*   Region: $\text{UK-North}$, $\text{PUE} = 1.15$.
*   Job Start Time: $t = 1800\text{ s}$ (halfway into Slot 0).
*   Slots ($\Delta_h = 1.0\text{ hr} = 3600\text{ s}$):
    *   Slot 0 ($[0, 3600\text{ s}]$): $I_0 = 300.0\text{ gCO}_2\text{e/kWh}$, $\pi_0 = \$0.15/\text{kWh}$.
    *   Slot 1 ($[3600, 7200\text{ s}]$): $I_1 = 150.0\text{ gCO}_2\text{e/kWh}$, $\pi_1 = \$0.12/\text{kWh}$.
*   Transfer: $\kappa_{\text{net}} = 0.014\text{ kWh/GB}$, $I_{\text{net}} = 400.0\text{ gCO}_2\text{e/kWh}$, $\zeta = \$0.02/\text{GB}$.

### Computed Values:
1.  **Chassis Power:**  
    $$P(0.8) = 0.100 + (0.500 - 0.100) \cdot 0.8^{1.4} = 0.100 + 0.400 \cdot 0.731688 = 0.392675\text{ kW}$$
2.  **Overlaps:**  
    $\omega_{j,0} = \frac{3600 - 1800}{3600} = 0.50$; $\omega_{j,1} = \frac{7200 - 3600}{3600} = 1.00$.
3.  **Compute Energy:**  
    $E_{j,0} = 0.392675 \times 1.0 \times 1.15 \times 0.50 = 0.225788\text{ kWh}$.  
    $E_{j,1} = 0.392675 \times 1.0 \times 1.15 \times 1.00 = 0.451576\text{ kWh}$.  
    $E_{\text{compute}} = 0.677365\text{ kWh}$.
4.  **Compute Carbon:**  
    $C_{j,0} = 0.225788 \times 300.0 = 67.7365\text{ gCO}_2\text{e}$.  
    $C_{j,1} = 0.451576 \times 150.0 = 67.7365\text{ gCO}_2\text{e}$.  
    $C_{\text{compute}} = 135.4730\text{ gCO}_2\text{e}$.
5.  **Transfer Energy & Carbon:**  
    $E_{\text{xfer}} = 100 \times 0.014 = 1.40\text{ kWh}$.  
    $C_{\text{xfer}} = 1.40 \times 400.0 = 560.0\text{ gCO}_2\text{e}$.  
    $\text{Cost}_{\text{xfer}} = 100 \times \$0.02 = \$2.0000$.
6.  **Compute Cost:**  
    $\text{Cost}_{\text{compute}} = 0.225788 \times \$0.15 + 0.451576 \times \$0.12 = \$0.033868 + \$0.054189 = \$0.088057$.
7.  **Final Totals:**  
    $C_{\text{total}} = 135.4730 + 560.0 = \mathbf{695.4730\text{ gCO}_2\text{e}}$.  
    $\text{Cost}_{\text{total}} = 0.088057 + 2.0000 = \mathbf{\$2.088057}$.

---

## 4. Integer Scaling & Exactness Proof

### 4.1 CP-SAT Quantization
Continuous carbon $c_{j,r,s} \in \mathbb{R}^+$ is scaled by fixed multiplier $S = 1000$ (milligram precision):

$$\tilde{c}_{j,r,s} = \text{round}(S \cdot c_{j,r,s})$$

### 4.2 Error Bound
For job $j$ spanning at most $n_{\text{slots}}$ slots, rounding error $\epsilon_j = \left|C_j - \frac{1}{S}\tilde{C}_j\right|$ satisfies:

$$\epsilon_j \le n_{\text{slots}} \cdot \frac{0.5}{S} \quad [\text{gCO}_2\text{e}]$$

For a 24h horizon with 15-minute slots ($n_{\text{slots}} \le 96$), max error is:
$$\epsilon_j \le 96 \cdot \frac{0.5}{1000} = 0.048\text{ gCO}_2\text{e}$$

---

## 5. Statistical Verification Metrics

*   **$\epsilon$-sMAPE:**
    $$\text{sMAPE} = \frac{100\%}{N} \sum_{t=1}^N \frac{|y_t - \hat{y}_t|}{\frac{1}{2}(|y_t| + |\hat{y}_t|) + 1.0}$$
*   **MAE:**
    $$\text{MAE} = \frac{1}{N} \sum_{t=1}^N |y_t - \hat{y}_t|$$
*   **Pinball Loss at Quantile $\tau$:**
    $$\mathcal{L}_\tau(y_t, q_{\tau, t}) = \max(\tau(y_t - q_{\tau, t}), (1 - \tau)(q_{\tau, t} - y_t))$$
*   **Interval Coverage (PICP):**
    $$\text{PICP} = \frac{1}{N} \sum_{t=1}^N \mathbb{I}(q_{\alpha/2, t} \le y_t \le q_{1 - \alpha/2, t})$$
*   **Trace-Day Block Bootstrap (95% CI):**
    Resample $D$ days with replacement $B \ge 10,000$ times with fixed PRNG seed. Percentiles: $[2.5\%, 97.5\%]$.
