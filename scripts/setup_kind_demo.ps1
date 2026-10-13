# PowerShell kind demo launcher
Write-Host "Creating Multi-Region kind cluster: carbonshift-cluster" -ForegroundColor Green
kind create cluster --config k8s/kind-cluster-config.yaml

Write-Host "Applying CarbonJob CRD..." -ForegroundColor Green
kubectl apply -f k8s/crds/carbonjob.yaml

Write-Host "Submitting flexible batch jobs with scheduling gate 'carbonshift.io/gate'..." -ForegroundColor Green
kubectl apply -f k8s/demo-workload.yaml

Write-Host "Current pod state (held in scheduling gate):" -ForegroundColor Cyan
kubectl get pods -o wide
