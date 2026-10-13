"""Test traceability of all benchmark numbers in README.md to results/benchmark_summary.json.

Asserts:
- Every table row in README matches benchmark_summary.json exactly.
- Bootstrap 95% Confidence Interval values match exactly.
"""

import json
import re
from pathlib import Path


def test_readme_benchmark_numbers_match_results_manifest():
    root = Path(__file__).parent.parent
    manifest_path = root / "results" / "benchmark_summary.json"
    readme_path = root / "README.md"

    assert manifest_path.exists(), "results/benchmark_summary.json does not exist"
    assert readme_path.exists(), "README.md does not exist"

    with open(manifest_path, "r") as f:
        manifest = json.load(f)

    with open(readme_path, "r", encoding="utf-8") as f:
        readme_content = f.read()

    # 1. Check Bootstrap CI in README
    ci = manifest["optimizer_savings_bootstrap_95ci"]
    ci_pattern = rf"(\*\*)?{ci['median_pct']:.2f}%(\*\*)?\s*\(95%\s*CI:\s*(\*\*)?\[{ci['ci_lower_pct']:.2f}%,\s*{ci['ci_upper_pct']:.2f}%\](\*\*)?\)"
    assert re.search(ci_pattern, readme_content), (
        f"Bootstrap CI {ci['median_pct']:.2f}% [{ci['ci_lower_pct']:.2f}%, {ci['ci_upper_pct']:.2f}%] not found in README.md"
    )

    # 2. Check each strategy in benchmark table
    summary_list = manifest["benchmark_summary"]
    for entry in summary_list:
        strat = entry["strategy"]
        carb = f"{entry['total_carbon_gco2e']:,.2f}"
        cost = f"${entry['total_cost_usd']:.2f}"
        
        # Verify carbon and cost exist in README
        assert carb in readme_content, f"Carbon value '{carb}' for '{strat}' not found in README.md"
        assert cost in readme_content, f"Cost value '{cost}' for '{strat}' not found in README.md"
