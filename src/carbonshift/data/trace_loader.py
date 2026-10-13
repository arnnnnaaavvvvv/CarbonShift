"""Workload trace sampler and generator for batch jobs.

Emulates distributions from Google Cluster Data (2019) and Alibaba Cluster Trace (2018).

@see docs/BLUEPRINT.md §9.1
"""

from typing import List, Optional
import numpy as np
from carbonshift.core.types import Job


def sample_cluster_trace_jobs(
    num_jobs: int = 50,
    horizon_seconds: float = 86400.0,  # 24 hours
    seed: int = 42,
    available_regions: Optional[List[str]] = None,
) -> List[Job]:
    """Generate a sampled batch workload adhering to empirical cluster trace distributions.

    - Arrivals: Poisson process.
    - Duration: Log-normal distribution (median ~1.5h, tail up to 8h).
    - CPU: Discrete tiers (2, 4, 8, 16, 32 cores).
    - Memory: Correlated with CPU (4 GB/core baseline).
    - Data: Exponential distribution (0 to 500 GB).
    """
    if available_regions is None:
        available_regions = ["uk-north", "eu-west", "us-east", "ap-south"]

    rng = np.random.RandomState(seed)
    jobs: List[Job] = []

    # Poisson arrivals sorted across the first 70% of the horizon
    raw_arrivals = rng.uniform(0.0, horizon_seconds * 0.70, size=num_jobs)
    raw_arrivals.sort()

    for idx, arrival in enumerate(raw_arrivals):
        # Duration: log-normal with mean ~3600s, clamped between 600s (10m) and 21600s (6h)
        duration = int(np.clip(rng.lognormal(mean=8.2, sigma=0.8), 600, 21600))
        
        # Slack / flexibility: deadline buffer of 2x to 5x duration
        slack_multiplier = rng.uniform(2.0, 5.0)
        slack_seconds = duration * slack_multiplier
        deadline = arrival + slack_seconds

        # CPU core sizes
        cpu_options = [2.0, 4.0, 8.0, 16.0, 32.0]
        cpu_cores = float(rng.choice(cpu_options, p=[0.3, 0.3, 0.2, 0.15, 0.05]))
        mem_gb = cpu_cores * float(rng.choice([2.0, 4.0, 8.0], p=[0.2, 0.6, 0.2]))

        # Data transfer size
        data_gb = float(round(rng.exponential(scale=30.0), 1))

        # Origin and whitelist
        src_region = str(rng.choice(available_regions))
        # 80% of jobs permit spatial shifting across all regions
        if rng.uniform(0.0, 1.0) < 0.8:
            whitelist = list(available_regions)
        else:
            whitelist = [src_region]

        jobs.append(
            Job(
                name=f"job-{idx+1:04d}",
                arrival_epoch_s=float(round(arrival, 1)),
                deadline_epoch_s=float(round(deadline, 1)),
                duration_seconds=duration,
                cpu_cores=cpu_cores,
                mem_gb=mem_gb,
                data_size_gb=data_gb,
                source_region=src_region,
                region_whitelist=whitelist,
                is_flexible=True,
                utilization=float(round(rng.uniform(0.65, 0.95), 2)),
            )
        )

    return jobs
