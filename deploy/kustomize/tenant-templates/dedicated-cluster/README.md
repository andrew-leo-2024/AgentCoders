# Dedicated Cluster Tier

This tier provisions an entirely separate AKS cluster for the tenant.

## Provisioning

Triggered via Terraform/Pulumi pipeline:
1. `terraform apply` with tenant-specific variables
2. Deploy full AgentCoders stack to new cluster
3. Return kubeconfig/endpoint to tenant-manager

## Implementation Status

Phase 5 — placeholder. Use namespace-dedicated-db tier until then.
