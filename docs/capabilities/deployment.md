# Deployment

This microservice is built and deployed by GitHub Actions. Every deploy goes to **Cloud Run** and **GKE** in parallel (Cloud Run will be removed later).

## Branches → environments

| Push on | Workflow | GitHub environment | GKE namespace | Image tag |
|---------|----------|--------------------|---------------|-----------|
| `feature/**` | `release-dev.yml` | `totoexperiments` | `dev` | `<package.json version>-<short sha>`, e.g. `1.4.0-a1b2c3d` |
| `main` | `release-prod.yml` | `totolive` | `prod` | `<package.json version>`, e.g. `1.4.0` |

`main` does **not** deploy to dev. Changes that only touch `docs/`, `*.md` or `infra/` (and `k8s/` for prod) don't trigger a deploy.

## Version bump rule

- **Feature branches:** no bump needed. The short sha makes every tag unique. If a job is re-run for the same commit, the image already exists, so build and push are skipped and the image is redeployed.
- **`main`:** every merge needs a version bump in `package.json`. Before building, the prod workflow checks whether the tag already exists in the prod Artifact Registry and fails with *"Bump the version in package.json"* if it does. Any other error from that check (e.g. auth) also fails the job.

## How the GKE deploy works

Terraform (`nicolasances/toto-terra-gke`) owns the shape of the workload (Deployment, Service, route, resources, probes, env). CI owns which image runs: after pushing the image, the workflow runs

```bash
kubectl -n $GKE_NAMESPACE set image deployment/tome-ms-language tome-ms-language=$IMAGE
kubectl -n $GKE_NAMESPACE rollout status deployment/tome-ms-language --timeout=5m
```

The job fails if the rollout doesn't complete. Credentials come from the `toto-cicd` key (`secrets.CICD_SERVICE_ACCOUNT`). Cluster details come from the environment variables `GKE_PROJECT_ID`, `GKE_CLUSTER_NAME`, `GKE_CLUSTER_LOCATION` and `GKE_NAMESPACE`.

## Rolling back

There is no automatic rollback. A failed rollout is fixed by either:
- pushing a fix (feature branch for dev; version bump + merge to `main` for prod), or
- `kubectl -n <namespace> rollout undo deployment/tome-ms-language`.

Check which image is running with:

```bash
kubectl -n <namespace> get deploy tome-ms-language -o jsonpath='{..image}'
```
