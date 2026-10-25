# GitOps Migration: Cloud Run → GKE for `tome-ms-language`

## Context

This service currently deploys to Cloud Run via two near-identical GitHub Actions workflows (`release-dev.yml` → `totoexperiments`, `release-prod.yml` → `totolive`), where a single `gcloud run deploy` command does everything: push the image, roll it out, and set env vars. A draft `k8s/tome-ms-language.yaml` exists as a first attempt at a GKE Deployment, but it's incomplete (no env vars, no Service, no ServiceAccount, hardcoded to the prod image).

The goal is to move the deploy target to an existing GKE cluster (shared by dev and prod via namespaces, Workload Identity already enabled) while keeping the same "push to a branch and you're done" workflow — no manual `kubectl`/`helm` step, no post-push chores. GitOps (Argo CD + Argo CD Image Updater) is the chosen pattern specifically because it removes Kubernetes credentials from CI entirely: CI's only job becomes "build and push an image"; a controller living in the cluster takes it from there.

Key architectural fact driving the design: this app doesn't read secrets (Mongo, JWT signing key, etc.) from env vars or Kubernetes Secrets — the `totoms` framework fetches them straight from **Google Secret Manager** at runtime using ambient credentials and the project named by the `GCP_PID` env var. On GKE, the equivalent of Cloud Run's `--service-account=` is **Workload Identity**: binding a namespaced Kubernetes ServiceAccount to a GCP ServiceAccount that holds `secretmanager.secretAccessor`.

Decisions locked in during planning:
- **GitOps controller**: Argo CD.
- **Manifests**: live in this repo under `k8s/`, as Kustomize `base/` + `overlays/{dev,prod}/` (not a separate infra repo, not Helm).
- **Tag/update strategy**: Argo CD **Image Updater**, using the **semver** strategy — not a floating/mutable tag. This requires every push to carry a genuinely new `package.json` version, enforced by a new CI "version-bump guard" step that fails the build if the current version's tag already exists in Artifact Registry (turning a forgotten bump into an immediate, loud CI failure rather than a silent no-deploy).
- **Cluster topology**: one existing cluster, `dev` and `prod` as separate namespaces (accepted shared-blast-radius trade-off).
- **Health endpoint**: verified — `totoms` registers `GET /health` unconditionally (`noAuth: true`, `ignoreBasePath: true`), reachable at `/health` on port 8080 regardless of this service's `/tomelang` basePath. Good for both liveness and readiness probes (it's a process-alive check, not a deep DB check).

### Open items to resolve before executing (placeholders used below)
1. **Which GCP project does the existing cluster live in?** (`CLUSTER_PROJECT` below). This determines where the two Workload Identity GSAs get created, and confirms the Secret Manager IAM grants into `totoexperiments`/`totolive` are cross-project.
2. **Cluster name + zone/region**, and confirmation its Workload Identity pool is the default `CLUSTER_PROJECT.svc.id.goog` (not a custom pool name).
3. **External exposure**: today's Cloud Run deploy uses `--allow-unauthenticated`. Is this service hit directly from the internet, called only by other internal services, or sitting behind a shared API gateway (the `/tomelang` basePath convention suggests the latter)? The plan below defaults to a `ClusterIP` Service; swap for an Ingress/Gateway if direct public exposure is actually needed.
4. **Confirm `SERVICE_BASE_URL` / `GALE_BROKER_URL` aren't sensitive** — they move from GitHub Environment secrets into plain-text ConfigMap values committed to git.

---

## 1. Kustomize manifest layout

Replace the draft `k8s/tome-ms-language.yaml` with:

```
k8s/
├── base/
│   ├── kustomization.yaml
│   ├── deployment.yaml
│   ├── service.yaml
│   └── serviceaccount.yaml
├── overlays/
│   ├── dev/
│   │   ├── kustomization.yaml
│   │   └── configmap.env
│   └── prod/
│       ├── kustomization.yaml
│       └── configmap.env
└── argocd/
    ├── application-dev.yaml
    └── application-prod.yaml
```

**`k8s/base/deployment.yaml`**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: tome-ms-language
  labels:
    app: tome-ms-language
spec:
  replicas: 1
  selector:
    matchLabels:
      app: tome-ms-language
  template:
    metadata:
      labels:
        app: tome-ms-language
    spec:
      serviceAccountName: tome-ms-language
      containers:
        - name: tome-ms-language
          image: europe-west1-docker.pkg.dev/PROJECT_PLACEHOLDER/tome-ms-language/tome-ms-language:PLACEHOLDER
          ports:
            - name: http
              containerPort: 8080
          envFrom:
            - configMapRef:
                name: tome-ms-language-config
          readinessProbe:
            httpGet:
              path: /health
              port: http
            initialDelaySeconds: 5
            periodSeconds: 10
            failureThreshold: 3
          livenessProbe:
            httpGet:
              path: /health
              port: http
            initialDelaySeconds: 15
            periodSeconds: 20
            failureThreshold: 3
          resources:
            requests:
              cpu: 100m
              memory: 192Mi
            limits:
              cpu: 500m
              memory: 384Mi
```
`image` is a placeholder on purpose — each overlay's `images:` transformer rewrites repo + tag, and Argo CD Image Updater later rewrites just the tag in place via a git commit.

**`k8s/base/service.yaml`**
```yaml
apiVersion: v1
kind: Service
metadata:
  name: tome-ms-language
  labels:
    app: tome-ms-language
spec:
  type: ClusterIP
  selector:
    app: tome-ms-language
  ports:
    - name: http
      port: 80
      targetPort: http
```
(See open item #3 — add an Ingress/Gateway here instead if direct public exposure is required.)

**`k8s/base/serviceaccount.yaml`**
```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: tome-ms-language
```
The Workload Identity annotation differs per environment, so it's added via a patch in each overlay rather than here.

**`k8s/base/kustomization.yaml`**
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - deployment.yaml
  - service.yaml
  - serviceaccount.yaml
commonLabels:
  app: tome-ms-language
```

**`k8s/overlays/dev/configmap.env`**
```
HYPERSCALER=gcp
SERVICE_BASE_URL=<dev value — copy from current totoexperiments GH Environment secret>
GALE_BROKER_URL=<dev value — copy from current totoexperiments GH Environment secret>
GCP_PID=totoexperiments
```

**`k8s/overlays/dev/kustomization.yaml`**
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: dev
resources:
  - ../../base
configMapGenerator:
  - name: tome-ms-language-config
    envs:
      - configmap.env
generatorOptions:
  disableNameSuffixHash: true
patches:
  - target:
      kind: ServiceAccount
      name: tome-ms-language
    patch: |-
      - op: add
        path: /metadata/annotations
        value:
          iam.gke.io/gcp-service-account: tome-ms-language-dev@CLUSTER_PROJECT_PLACEHOLDER.iam.gserviceaccount.com
images:
  - name: europe-west1-docker.pkg.dev/PROJECT_PLACEHOLDER/tome-ms-language/tome-ms-language
    newName: europe-west1-docker.pkg.dev/totoexperiments/tome-ms-language/tome-ms-language
    newTag: "1.0.0"
```
`newTag` starts pinned to the current real version for a deterministic first sync (see rollout sequencing); Image Updater takes over bumping it afterward.

**`k8s/overlays/prod/configmap.env`**
```
HYPERSCALER=gcp
SERVICE_BASE_URL=<prod value — copy from current totolive GH Environment secret>
GALE_BROKER_URL=<prod value — copy from current totolive GH Environment secret>
GCP_PID=totolive
```

**`k8s/overlays/prod/kustomization.yaml`**
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: prod
resources:
  - ../../base
configMapGenerator:
  - name: tome-ms-language-config
    envs:
      - configmap.env
generatorOptions:
  disableNameSuffixHash: true
patches:
  - target:
      kind: ServiceAccount
      name: tome-ms-language
    patch: |-
      - op: add
        path: /metadata/annotations
        value:
          iam.gke.io/gcp-service-account: tome-ms-language-prod@CLUSTER_PROJECT_PLACEHOLDER.iam.gserviceaccount.com
  - target:
      kind: Deployment
      name: tome-ms-language
    patch: |-
      - op: replace
        path: /spec/replicas
        value: 2
images:
  - name: europe-west1-docker.pkg.dev/PROJECT_PLACEHOLDER/tome-ms-language/tome-ms-language
    newName: europe-west1-docker.pkg.dev/totolive/tome-ms-language/tome-ms-language
    newTag: "1.0.0"
```

---

## 2. Workload Identity bindings

All GCP-side IAM provisioning (the two app GSAs, their Secret Manager grants, and their Workload Identity bindings) is managed by Terraform at `infra/terraform/`, not ad-hoc `gcloud` commands — see `main.tf` for the `google_service_account` / `google_project_iam_member` / `google_service_account_iam_member` resources. This keeps the IAM graph reviewable in a PR diff and re-appliable, instead of one-off commands someone has to remember they ran.

```bash
cd infra/terraform
terraform init
terraform plan \
  -var="cluster_project=CLUSTER_PROJECT"
terraform apply \
  -var="cluster_project=CLUSTER_PROJECT"
```
(`dev_project`/`prod_project` default to `totoexperiments`/`totolive` — override with `-var` if that's ever not the case.)

This creates `tome-ms-language-dev`/`tome-ms-language-prod`, grants each `roles/secretmanager.secretAccessor` in its respective project, and binds each to its namespace/KSA pair (`CLUSTER_PROJECT.svc.id.goog[dev/tome-ms-language]`, `[prod/tome-ms-language]`) via `roles/iam.workloadIdentityUser`. It also provisions the `argocd-image-updater` GSA used in the [Argo CD configuration doc](./argocd-configuration.md).

The namespaces themselves are plain Kubernetes objects, not GCP resources, so they stay as `kubectl`:
```bash
kubectl create namespace dev
kubectl create namespace prod
```

---

## 3. Argo CD install + Applications

One-time, manual/scripted cluster-admin action — not run by CI:

```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
# pin to a specific release tag instead of "stable" once chosen
```

Register this repo with Argo CD (needs write access for Image Updater's git write-back — a fine-grained PAT or GitHub App scoped to this repo with `contents:write`):
```bash
argocd repo add https://github.com/<org>/tome-ms-language.git \
  --username <bot-user-or-pat-holder> --password <PAT>
```

**`k8s/argocd/application-dev.yaml`**
```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: tome-ms-language-dev
  namespace: argocd
  annotations:
    argocd-image-updater.argoproj.io/image-list: language=europe-west1-docker.pkg.dev/totoexperiments/tome-ms-language/tome-ms-language
    argocd-image-updater.argoproj.io/language.update-strategy: semver
    argocd-image-updater.argoproj.io/write-back-method: git
    argocd-image-updater.argoproj.io/git-branch: main
    argocd-image-updater.argoproj.io/write-back-target: kustomization
spec:
  project: default
  source:
    repoURL: https://github.com/<org>/tome-ms-language.git
    targetRevision: main
    path: k8s/overlays/dev
  destination:
    server: https://kubernetes.default.svc
    namespace: dev
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
```

**`k8s/argocd/application-prod.yaml`** — identical, with `tome-ms-language-prod`, the `totolive` image path, `path: k8s/overlays/prod`, `namespace: prod`.

Apply once:
```bash
kubectl apply -f k8s/argocd/application-dev.yaml
kubectl apply -f k8s/argocd/application-prod.yaml
```
`prune: true` + `selfHeal: true` gives real GitOps semantics: manual cluster drift gets reverted, resources removed from git get removed from the cluster.

---

## 4. Argo CD Image Updater install

```bash
kubectl create namespace argocd-image-updater
kubectl apply -n argocd-image-updater -f https://raw.githubusercontent.com/argoproj-labs/argocd-image-updater/stable/manifests/install.yaml
```
Needs: read access to Argo CD's API (included in its install manifest's RBAC), the same git write credentials as Argo CD (reused repo-creds secret), and Artifact Registry read access — grant its own Workload-Identity-bound GSA `roles/artifactregistry.reader` on `totoexperiments` and `totolive`.

With `update-strategy: semver` (set on the Applications above), Image Updater polls Artifact Registry (default ~2 min), finds the highest valid semver tag, and — whenever it's higher than what's currently deployed — rewrites `images[].newTag` in the overlay's `kustomization.yaml` and **commits + pushes that change to `main`**. Argo CD's sync then picks up that commit like any other change. Every auto-deploy is a real git commit — `git log` is the deploy history, `git revert` is the rollback mechanism.

---

## 5. CI workflow changes (`release-dev.yml` and `release-prod.yml`)

**Keep unchanged**: checkout, "Authenticate to Artifact Registry", "Create Environment Variables" (still need `PACKAGE_VERSION`/`PACKAGE_NAME`).

**Add — version-bump guard, right after "Create Environment Variables":**
```yaml
    - name: Check version was bumped
      run: |
        EXISTS=$(gcloud artifacts docker tags list \
          europe-west1-docker.pkg.dev/${{ vars.GCP_PID }}/${{env.PACKAGE_NAME}}/${{env.PACKAGE_NAME}} \
          --filter="tag:${{env.PACKAGE_VERSION}}" --format="value(tag)")
        if [ -n "$EXISTS" ]; then
          echo "::error::Version ${{env.PACKAGE_VERSION}} already exists in Artifact Registry. Bump the version in package.json before pushing."
          exit 1
        fi
```

**Keep** "Build Docker image" / "Push Docker image" steps as-is — they already build/push exactly one tag equal to `PACKAGE_VERSION`, which is now guaranteed unique per push.

**Delete entirely** — "Setup GCloud" and "Deploy image" steps (the `gcloud run deploy ...` call and its `setup-gcloud` action). CI no longer needs `secrets.SERVICE_ACCOUNT`, GKE credentials, or any `kubectl`/`kustomize` invocation — that's the whole point of the GitOps decoupling. `secrets.SERVICE_BASE_URL` / `secrets.GALE_BROKER_URL` as GH secrets also become unused (values now live in the committed `configmap.env` files) — remove once confirmed per open item #4. `CICD_SERVICE_ACCOUNT` and `vars.GCP_PID` remain in use (needed for the Artifact Registry push step).

Net effect: both workflows shrink to checkout → auth → compute version → guard → build → push. Nothing in CI knows the cluster exists.

---

## 6. Optional Dockerfile hardening (separable, not required for this migration)

- Add a `.dockerignore` (currently missing: `node_modules`, `build`, `.git`, `.github`, `docs`, `*.md`) — today's `COPY . /app/` ships the whole repo including `.git` history into the image.
- Multi-stage build (builder stage runs `npm install && npm run build`; final stage only copies `build/` + runs `npm install --omit=dev`) to drop devDependencies (`mocha`, `ts-node`, `typescript`) from the runtime image.
- Replace `RUN chmod -R 777 /app` with `USER node` (the `node:20-alpine` base already has this UID 1000 user) — tightens permissions without breaking anything, since nothing in the app currently requires root.

---

## 7. Rollout sequencing (no-downtime path)

1. Confirm the open items (cluster project/name/location, exposure requirement, secret-sensitivity of the two URLs).
2. Install Argo CD and Argo CD Image Updater in the cluster (sections 3/4). Cloud Run keeps serving all real traffic — zero user impact.
3. Create the dev/prod GSAs and Workload Identity bindings (section 2). Still zero user impact.
4. Commit the new `k8s/base` + `k8s/overlays/{dev,prod}` tree (replacing the draft file), with `newTag` pinned to the current real version (`1.0.0`) for a deterministic first sync.
5. Apply the two Argo CD `Application` CRs. Verify Argo CD syncs into `dev`: pod comes up, `/health` passes, and check pod logs for successful Secret Manager fetches (not a permission-denied error) confirming Workload Identity actually resolves.
6. Validate dev end-to-end via `kubectl port-forward svc/tome-ms-language -n dev 8080:80` and real API calls against the GKE pod (hitting real `totoexperiments` Mongo + Secret Manager).
7. Repeat validation for `prod` in its own namespace before touching real prod traffic.
8. Add the CI version-bump guard (section 5) and do one end-to-end test push on a feature branch to confirm the full loop: push → CI guard passes → new tag pushed → Image Updater detects higher semver → git write-back commit → Argo CD auto-sync → new pod running.
9. Cut over real traffic: repoint whatever currently calls the Cloud Run URL (API gateway, DNS, or direct callers, per open item #3) to the new GKE Service/Ingress endpoint — dev first, then prod.
10. Decommission: once GKE has served real traffic without issues for a confidence period, delete the Cloud Run services (`gcloud run services delete tome-ms-language --project=totoexperiments` / `--project=totolive`) and remove the now-unused `secrets.SERVICE_ACCOUNT` GH secret from both GH Environments.

---

## Verification

- After step 5: `kubectl get pods -n dev` shows the pod `Running` and `1/1 Ready`; `kubectl logs -n dev <pod>` shows no Secret Manager permission errors.
- After step 6/7: manual API calls against the port-forwarded service return expected responses for both dev and prod namespaces.
- After step 8: pushing a version-bumped commit on a feature branch results in a new commit appearing in `git log` authored by the Image Updater bot within ~2 minutes, followed by a new pod rollout — confirming the whole CI → registry → Image Updater → git → Argo CD loop works without any manual kubectl/gcloud step.
- Pushing *without* bumping the version should make the CI job fail at the "Check version was bumped" step with a clear error, not silently succeed.

### Critical files
- `k8s/tome-ms-language.yaml` → replaced by `k8s/base/` + `k8s/overlays/` + `k8s/argocd/`
- `infra/terraform/` (GSAs, IAM grants, Workload Identity bindings — replaces the `gcloud` commands this doc used to show inline)
- `.github/workflows/release-dev.yml`, `.github/workflows/release-prod.yml`
- `src/Config.ts` (confirms Mongo secret names + `GCP_PID`-scoped Secret Manager access the Workload Identity design must satisfy)
- `Dockerfile` (optional hardening, section 6)
