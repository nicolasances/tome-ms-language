# --- tome-ms-language (dev): GSA + Workload Identity + Secret Manager access ---

resource "google_service_account" "tome_ms_language_dev" {
  project      = var.cluster_project
  account_id   = "tome-ms-language-dev"
  display_name = "tome-ms-language (dev) - Workload Identity"
}

resource "google_project_iam_member" "tome_ms_language_dev_secret_access" {
  project = var.dev_project
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.tome_ms_language_dev.email}"
}

resource "google_service_account_iam_member" "tome_ms_language_dev_workload_identity" {
  service_account_id = google_service_account.tome_ms_language_dev.name
  role                = "roles/iam.workloadIdentityUser"
  member              = "serviceAccount:${var.cluster_project}.svc.id.goog[${var.dev_namespace}/${var.app_ksa_name}]"
}

# --- tome-ms-language (prod): GSA + Workload Identity + Secret Manager access ---

resource "google_service_account" "tome_ms_language_prod" {
  project      = var.cluster_project
  account_id   = "tome-ms-language-prod"
  display_name = "tome-ms-language (prod) - Workload Identity"
}

resource "google_project_iam_member" "tome_ms_language_prod_secret_access" {
  project = var.prod_project
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.tome_ms_language_prod.email}"
}

resource "google_service_account_iam_member" "tome_ms_language_prod_workload_identity" {
  service_account_id = google_service_account.tome_ms_language_prod.name
  role                = "roles/iam.workloadIdentityUser"
  member              = "serviceAccount:${var.cluster_project}.svc.id.goog[${var.prod_namespace}/${var.app_ksa_name}]"
}

# --- Argo CD Image Updater: GSA + Workload Identity + Artifact Registry read access ---

resource "google_service_account" "argocd_image_updater" {
  project      = var.cluster_project
  account_id   = "argocd-image-updater"
  display_name = "Argo CD Image Updater"
}

resource "google_project_iam_member" "image_updater_dev_registry_read" {
  project = var.dev_project
  role    = "roles/artifactregistry.reader"
  member  = "serviceAccount:${google_service_account.argocd_image_updater.email}"
}

resource "google_project_iam_member" "image_updater_prod_registry_read" {
  project = var.prod_project
  role    = "roles/artifactregistry.reader"
  member  = "serviceAccount:${google_service_account.argocd_image_updater.email}"
}

resource "google_service_account_iam_member" "image_updater_workload_identity" {
  service_account_id = google_service_account.argocd_image_updater.name
  role                = "roles/iam.workloadIdentityUser"
  member              = "serviceAccount:${var.cluster_project}.svc.id.goog[${var.image_updater_namespace}/${var.image_updater_ksa_name}]"
}
