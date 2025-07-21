#!/bin/bash

# Flowo Kubernetes Deployment Script
# This script deploys the flowo application to a Kubernetes cluster

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    print_error "kubectl is not installed or not in PATH"
    exit 1
fi

# Check if cluster is accessible
if ! kubectl cluster-info &> /dev/null; then
    print_error "Cannot connect to Kubernetes cluster"
    exit 1
fi

print_status "Starting flowo deployment to Kubernetes..."

# Create namespace
print_status "Creating namespace..."
kubectl apply -f namespace.yaml
print_success "Namespace created"

# Create secrets and configmaps
print_status "Creating secrets and configmaps..."
kubectl apply -f configmap.yaml
print_success "Secrets and configmaps created"

# Create storage
print_status "Creating storage resources..."
kubectl apply -f storage.yaml
print_success "Storage resources created"

# Deploy PostgreSQL
print_status "Deploying PostgreSQL..."
kubectl apply -f postgresql.yaml
print_success "PostgreSQL deployed"

# Wait for PostgreSQL to be ready
print_status "Waiting for PostgreSQL to be ready..."
kubectl wait --for=condition=ready pod -l app=postgresql -n flowo --timeout=300s

# Run database migrations
print_status "Running database migrations..."
kubectl apply -f migrations.yaml
kubectl wait --for=condition=complete job/alembic-migrations -n flowo --timeout=300s
print_success "Database migrations completed"

# Deploy backend
print_status "Deploying backend..."
kubectl apply -f backend.yaml
print_success "Backend deployed"

# Wait for backend to be ready
print_status "Waiting for backend to be ready..."
kubectl wait --for=condition=available deployment/flowo-backend -n flowo --timeout=300s

# Deploy frontend
print_status "Deploying frontend..."
kubectl apply -f frontend.yaml
print_success "Frontend deployed"

# Wait for frontend to be ready
print_status "Waiting for frontend to be ready..."
kubectl wait --for=condition=available deployment/flowo-frontend -n flowo --timeout=300s

# Deploy Caddy
print_status "Deploying Caddy proxy..."
kubectl apply -f caddy.yaml
print_success "Caddy proxy deployed"

# Wait for Caddy to be ready
print_status "Waiting for Caddy to be ready..."
kubectl wait --for=condition=available deployment/caddy -n flowo --timeout=300s

# Optional: Deploy ingress (comment out if not using ingress)
# print_status "Deploying ingress..."
# kubectl apply -f ingress.yaml
# print_success "Ingress deployed"

print_success "Flowo deployment completed successfully!"

# Display service information
print_status "Getting service information..."
kubectl get services -n flowo

print_status "Getting pod status..."
kubectl get pods -n flowo

print_status "To access the application:"
echo "1. For LoadBalancer service, get external IP:"
echo "   kubectl get service caddy -n flowo"
echo ""
echo "2. For port forwarding (development):"
echo "   kubectl port-forward service/caddy 8080:80 -n flowo"
echo "   Then access: http://localhost:8080"
echo ""
echo "3. For NodePort access:"
echo "   kubectl get nodes -o wide"
echo "   kubectl get service caddy -n flowo"

print_success "Deployment script completed!"
