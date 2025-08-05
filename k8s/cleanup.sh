#!/bin/bash

# Flowo Kubernetes Cleanup Script
# This script removes all flowo resources from the Kubernetes cluster

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

print_warning "This will delete all flowo resources from the Kubernetes cluster!"
read -p "Are you sure you want to continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_status "Cleanup cancelled"
    exit 0
fi

print_status "Starting flowo cleanup from Kubernetes..."

# Delete ingress (if exists)
print_status "Deleting ingress..."
kubectl delete -f ingress.yaml --ignore-not-found=true
print_success "Ingress deleted"

# Delete Caddy
print_status "Deleting Caddy proxy..."
kubectl delete -f caddy.yaml --ignore-not-found=true
print_success "Caddy proxy deleted"

# Delete frontend
print_status "Deleting frontend..."
kubectl delete -f frontend.yaml --ignore-not-found=true
print_success "Frontend deleted"

# Delete backend
print_status "Deleting backend..."
kubectl delete -f backend.yaml --ignore-not-found=true
print_success "Backend deleted"

# Delete migration job
print_status "Deleting migration job..."
kubectl delete -f migrations.yaml --ignore-not-found=true
print_success "Migration job deleted"

# Delete PostgreSQL
print_status "Deleting PostgreSQL..."
kubectl delete -f postgresql.yaml --ignore-not-found=true
print_success "PostgreSQL deleted"

# Delete storage (warning: this will delete persistent data)
print_warning "Deleting storage resources (this will delete persistent data)..."
read -p "Are you sure you want to delete persistent volumes? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    kubectl delete -f storage.yaml --ignore-not-found=true
    print_success "Storage resources deleted"
else
    print_status "Storage resources kept"
fi

# Delete secrets and configmaps
print_status "Deleting secrets and configmaps..."
kubectl delete -f configmap.yaml --ignore-not-found=true
print_success "Secrets and configmaps deleted"

# Delete namespace
print_status "Deleting namespace..."
kubectl delete -f namespace.yaml --ignore-not-found=true
print_success "Namespace deleted"

print_success "Flowo cleanup completed successfully!"
