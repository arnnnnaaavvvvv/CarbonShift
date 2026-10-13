.PHONY: test bench lint run-api

test:
	python -m pytest tests/ -v

bench:
	python scripts/run_bench.py

run-api:
	uvicorn carbonshift.api.app:app --host 0.0.0.0 --port 8000 --reload
