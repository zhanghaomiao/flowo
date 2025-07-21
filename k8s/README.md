# Flowo Kubernetes Configuration

This directory contains Kubernetes configuration files for deploying the Flowo application to a Kubernetes cluster.

## Architecture

The application consists of the following components:

- **PostgreSQL**: Database for storing application data
- **Backend**: Python FastAPI application serving the REST API
- **Frontend**: React/Vite application serving the web interface
- **Caddy**: Reverse proxy and static file server
- **Migrations**: Database initialization and schema migrations

## Files Description

- `namespace.yaml`: Creates the `flowo` namespace
- `configmap.yaml`: Contains configuration data and secrets
- `storage.yaml`: Persistent volumes and claims for data storage
- `postgresql.yaml`: PostgreSQL database deployment and service
- `migrations.yaml`: Database migration job
- `backend.yaml`: Backend API deployment and service
- `frontend.yaml`: Frontend web application deployment and service
- `caddy.yaml`: Caddy reverse proxy deployment and service
- `ingress.yaml`: Ingress configuration for external access (optional)
- `deploy.sh`: Automated deployment script
- `cleanup.sh`: Cleanup script to remove all resources

## Prerequisites

1. **Kubernetes Cluster**: A running Kubernetes cluster (local or cloud)
2. **kubectl**: Kubernetes command-line tool configured to access your cluster
3. **Container Images**: Build and push the application images to a container registry

## Building Container Images

Before deploying, you need to build and push the container images:

```bash
# Build backend image
cd backend
docker build -t your-registry/flowo-backend:latest .
docker push your-registry/flowo-backend:latest

# Build frontend image
cd ../frontend
docker build -t your-registry/flowo-frontend:latest .
docker push your-registry/flowo-frontend:latest
```

**Important**: Update the image references in the deployment files:
- `backend.yaml`: Update `image: flowo-backend:latest`
- `frontend.yaml`: Update `image: flowo-frontend:latest`
- `migrations.yaml`: Update `image: flowo-backend:latest`

## Configuration

### Secrets

Before deploying, update the secrets in `configmap.yaml`:

```bash
# Encode your secrets in base64
echo -n "your_database_name" | base64
echo -n "your_database_user" | base64
echo -n "your_database_password" | base64
```

Update the encoded values in the `flowo-secrets` section.

### Storage

The configuration uses `hostPath` volumes for simplicity. For production, consider using:
- Cloud provider storage classes (AWS EBS, GCE PD, Azure Disk)
- Network storage (NFS, Ceph)
- Dynamic provisioning with storage classes

Update the `storage.yaml` file accordingly.

### Working Directory

The application requires access to a working directory for file operations. Update the `hostPath` in:
- `backend.yaml`: `/data/flowo-working`
- `caddy.yaml`: `/data/flowo-working`

Ensure this directory exists on your Kubernetes nodes and has appropriate permissions.

## Deployment

### Automated Deployment

Use the provided script for easy deployment:

```bash
cd k8s
./deploy.sh
```

### Manual Deployment

Deploy the components in the following order:

```bash
# 1. Create namespace
kubectl apply -f namespace.yaml

# 2. Create configuration
kubectl apply -f configmap.yaml

# 3. Create storage
kubectl apply -f storage.yaml

# 4. Deploy PostgreSQL
kubectl apply -f postgresql.yaml

# 5. Wait for PostgreSQL to be ready
kubectl wait --for=condition=ready pod -l app=postgresql -n flowo --timeout=300s

# 6. Run migrations
kubectl apply -f migrations.yaml
kubectl wait --for=condition=complete job/alembic-migrations -n flowo --timeout=300s

# 7. Deploy backend
kubectl apply -f backend.yaml

# 8. Deploy frontend
kubectl apply -f frontend.yaml

# 9. Deploy Caddy proxy
kubectl apply -f caddy.yaml

# 10. Optional: Deploy ingress
kubectl apply -f ingress.yaml
```

## Accessing the Application

### LoadBalancer Service

If your cluster supports LoadBalancer services:

```bash
kubectl get service caddy -n flowo
```

Access the application using the external IP.

### Port Forwarding (Development)

For local development or testing:

```bash
kubectl port-forward service/caddy 8080:80 -n flowo
```

Then access: http://localhost:8080

### NodePort

If using NodePort:

```bash
kubectl get nodes -o wide
kubectl get service caddy -n flowo
```

Access using `<node-ip>:<node-port>`.

### Ingress

If using ingress, update `ingress.yaml` with your domain and apply:

```bash
kubectl apply -f ingress.yaml
```

## Monitoring

Check the status of your deployment:

```bash
# Get all resources
kubectl get all -n flowo

# Check pods
kubectl get pods -n flowo

# Check services
kubectl get services -n flowo

# View logs
kubectl logs -f deployment/flowo-backend -n flowo
kubectl logs -f deployment/flowo-frontend -n flowo
kubectl logs -f deployment/caddy -n flowo
```

## Scaling

Scale the application components:

```bash
# Scale backend
kubectl scale deployment flowo-backend --replicas=3 -n flowo

# Scale frontend
kubectl scale deployment flowo-frontend --replicas=3 -n flowo
```

## Cleanup

To remove all flowo resources:

```bash
./cleanup.sh
```

Or manually:

```bash
kubectl delete namespace flowo
```

## Troubleshooting

### Common Issues

1. **Image Pull Errors**: Ensure images are pushed to the registry and accessible
2. **Storage Issues**: Check if hostPath directories exist and have correct permissions
3. **Database Connection**: Verify PostgreSQL is running and accessible
4. **Resource Limits**: Adjust resource requests/limits based on your cluster capacity

### Debugging Commands

```bash
# Describe resources
kubectl describe pod <pod-name> -n flowo
kubectl describe service <service-name> -n flowo

# View events
kubectl get events -n flowo --sort-by='.lastTimestamp'

# Execute into pods
kubectl exec -it <pod-name> -n flowo -- /bin/sh

# Check resource usage
kubectl top pods -n flowo
kubectl top nodes
```

## Production Considerations

1. **Security**: Use proper RBAC, network policies, and pod security standards
2. **Storage**: Use persistent volumes with backup strategies
3. **Monitoring**: Implement monitoring and alerting (Prometheus, Grafana)
4. **Logging**: Centralized logging (ELK stack, Fluentd)
5. **SSL/TLS**: Configure proper SSL certificates
6. **High Availability**: Multi-node setup with proper anti-affinity rules
7. **Resource Management**: Set appropriate resource requests and limits
8. **Secrets Management**: Use external secret management systems
9. **Image Security**: Scan images for vulnerabilities
10. **Backup**: Regular database and configuration backups
