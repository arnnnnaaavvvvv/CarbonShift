.PHONY: test bench lint run-api

test:
	python -m pytest tests/ -v

bench:
	python scripts/run_bench.py

audit:
	python scripts/audit_math_hand_verification.py
	python scripts/audit_integer_scaling_bound.py
	python scripts/audit_statistical_verification.py
	python scripts/audit_benchmark_validity.py
	python scripts/audit_simulator_fuzz_10k.py
	python scripts/audit_performance_profile.py

run-api:
	uvicorn carbonshift.api.app:app --host 0.0.0.0 --port 8000 --reload
