# Configuring Argo CD for `tome-ms-language`

This is the hands-on configuration runbook for the Argo CD instance already installed on the cluster, to wire it up to this service's GitOps workflow described in [`gke-gitops-migration.md`](./gke-gitops-migration.md). It assumes Argo CD itself is installed (`kubectl get pods -n argocd` shows it running) but nothing has been configured for this service yet.

## 0. Log into Argo CD

Get the auto-generated admin password and access the UI/CLI:

```bash
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d

kubectl port-forward svc/argocd-server -n argocd 8080:443
# UI: https://localhost:8080 (user: admin, password: from above)
```

Or via the CLI (`brew install argocd` if you don't have it):
```bash
argocd login localhost:8080 --username admin --password <password-from-above> --insecure
```

Change the admin password once logged in (`argocd account update-password`) — it's meant as a bootstrap credential, not a long-term login.

## 1. Register this GitHub repo with Argo CD

Argo CD needs read access to pull manifests, and **write** access for Argo CD Image Updater's git write-back (step 4) to commit tag bumps back to `main`.

Create a fine-grained GitHub PAT scoped to just this repo with `Contents: Read and write`, then:

```bash
argocd repo add https://github.com/<org>/tome-ms-language.git \
  --username <any-value-pat-auth-ignores-it> \
  --password <YOUR_PAT>
```

Verify it connected:
```bash
argocd repo list
```
`Status` should read `Successful`.

## 2. Create the namespaces and Workload Identity bindings

If you haven't already done this part from the migration doc, do it before step 3 — otherwise the first sync will succeed but the pod will crash/fail readiness because it can't reach Secret Manager:

```bash
kubectl create namespace dev
kubectl create namespace prod
```
Then the GSA creation + IAM grants + Workload Identity bindings from [`gke-gitops-migration.md` §2](./gke-gitops-migration.md#2-workload-identity-bindings).

## 3. Create the Argo CD Applications

Commit `k8s/base/`, `k8s/overlays/dev/`, `k8s/overlays/prod/` (content in the migration doc §1) to this repo first — Argo CD needs something to point at.

Then create the two `Application` resources. These live in `k8s/argocd/` in this repo but are applied directly with `kubectl` (Argo CD manages everything *below* an Application, not the Application resource itself — there's no circular bootstrapping here):

```bash
kubectl apply -f k8s/argocd/application-dev.yaml
kubectl apply -f k8s/argocd/application-prod.yaml
```

Confirm both show up and sync:
```bash
argocd app list
argocd app get tome-ms-language-dev
```
Expect `SYNC STATUS: Synced` and `HEALTH STATUS: Healthy` within a minute or two. If it's stuck on `Progressing`, check `kubectl get pods -n dev` and `kubectl describe pod ...` — the most common cause at this stage is the readiness probe failing because Workload Identity isn't resolving yet (see Troubleshooting below).

## 4. Install and configure Argo CD Image Updater

Install it (separate from Argo CD itself):
```bash
kubectl create namespace argocd-image-updater
kubectl apply -n argocd-image-updater \
  -f https://raw.githubusercontent.com/argoproj-labs/argocd-image-updater/stable/manifests/install.yaml
```

It needs two more things to actually do anything useful:

**a) The same git write credentials as Argo CD.** Point it at the same repo-creds secret Argo CD uses, or give it its own — either way it needs `contents:write` on this repo to commit tag bumps.

**b) Read access to Artifact Registry**, via its own Workload Identity binding (same pattern as the app's own GSAs). This is already provisioned by the Terraform in `infra/terraform/` (see [the migration doc §2](./gke-gitops-migration.md#2-workload-identity-bindings)) — `terraform apply` there creates the `argocd-image-updater` GSA, grants it `roles/artifactregistry.reader` on both `totoexperiments` and `totolive`, and binds it to `CLUSTER_PROJECT.svc.id.goog[argocd-image-updater/argocd-image-updater]`.

The only remaining manual step is annotating the Kubernetes ServiceAccount that Image Updater's own install manifest creates (it isn't part of this app's Kustomize tree, so it's not declared in git the way the app's own KSA is):
```bash
kubectl annotate serviceaccount argocd-image-updater -n argocd-image-updater \
  iam.gke.io/gcp-service-account="$(terraform -chdir=infra/terraform output -raw argocd_image_updater_gsa_email)"
```

**c) The update-strategy annotations on each Application.** These are what actually turn on tracking — add them to the `metadata.annotations` of `application-dev.yaml` / `application-prod.yaml` (already included if you copied them from the migration doc; shown here for reference):

```yaml
metadata:
  annotations:
    argocd-image-updater.argoproj.io/image-list: language=europe-west1-docker.pkg.dev/totoexperiments/tome-ms-language/tome-ms-language
    argocd-image-updater.argoproj.io/language.update-strategy: semver
    argocd-image-updater.argoproj.io/write-back-method: git
    argocd-image-updater.argoproj.io/git-branch: main
    argocd-image-updater.argoproj.io/write-back-target: kustomization
```
(prod's version points at `totolive`'s image path instead — see the migration doc.)

Re-apply after editing:
```bash
kubectl apply -f k8s/argocd/application-dev.yaml
kubectl apply -f k8s/argocd/application-prod.yaml
```

## 5. Verify the end-to-end loop

1. Bump `package.json`'s version, push to a `feature/**` branch.
2. CI's "Check version was bumped" step should pass (it's new) and push the new tag to Artifact Registry.
3. Within ~2 minutes (Image Updater's default poll interval), check:
   ```bash
   kubectl logs -n argocd-image-updater deploy/argocd-image-updater
   ```
   You should see it pick up the new tag and push a commit.
4. `git log` on `main` should show a new commit from the Image Updater bot touching `k8s/overlays/dev/kustomization.yaml`'s `newTag`.
5. `argocd app get tome-ms-language-dev` should show it syncing that commit automatically (thanks to `syncPolicy.automated` already set on the Application).
6. `kubectl get pods -n dev` should show a new pod running the new tag.

## Troubleshooting

- **Pod stuck `CrashLoopBackOff` or failing readiness, logs show a Secret Manager permission error** — the Workload Identity binding is wrong or missing. Check: `kubectl get sa tome-ms-language -n dev -o yaml` has the `iam.gke.io/gcp-service-account` annotation, and `gcloud iam service-accounts get-iam-policy tome-ms-language-dev@CLUSTER_PROJECT.iam.gserviceaccount.com` shows the `roles/iam.workloadIdentityUser` binding for `CLUSTER_PROJECT.svc.id.goog[dev/tome-ms-language]`.
- **Argo CD shows `Unknown` or fails to clone the repo** — re-check `argocd repo list`; a PAT that expired or lacks `contents:write` is the usual cause.
- **Image Updater never picks up a new tag** — check it's actually watching the right image path (`argocd-image-updater.argoproj.io/image-list` must exactly match the Artifact Registry path including project), and that its GSA has `artifactregistry.reader` in the right project (dev's updater call needs it on `totoexperiments`, prod's on `totolive`).
- **New commits from Image Updater re-trigger a full CI build** — add `k8s/**` to `paths-ignore` on both workflows' `on.push` trigger (see the CI diff in the migration doc) so manifest-only commits don't loop back into a build.
