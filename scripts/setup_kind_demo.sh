#!/usr/bin/env bash
set -euo pipefail

echo "=========================================================="
echo "Creating Multi-Region kind cluster: carbonshift-cluster"
echo "=========================================================="

kind create cluster --config k8s/kind-cluster-config.yaml

echo "Applying CarbonJob CRD..."
kubectl apply -f k8s/crds/carbonjob.yaml

echo "Submitting flexible batch jobs with scheduling gate 'carbonshift.io/gate'..."
kubectl apply -f k8s/demo-workload.yaml

echo "Pods are currently held in gated/pending state:"
kubectl get pods -o wide

echo "Starting local CarbonShift Controller..."
python -m carbonshift.k8s.controller
