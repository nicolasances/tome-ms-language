variable "cluster_project" {
  description = "GCP project the GKE cluster (and the Workload Identity pool CLUSTER_PROJECT.svc.id.goog) lives in."
  type        = string
}

variable "dev_project" {
  description = "GCP project holding dev's Secret Manager secrets and Artifact Registry images."
  type        = string
  default     = "totoexperiments"
}

variable "prod_project" {
  description = "GCP project holding prod's Secret Manager secrets and Artifact Registry images."
  type        = string
  default     = "totolive"
}

variable "dev_namespace" {
  description = "Kubernetes namespace dev runs in."
  type        = string
  default     = "dev"
}

variable "prod_namespace" {
  description = "Kubernetes namespace prod runs in."
  type        = string
  default     = "prod"
}

variable "app_ksa_name" {
  description = "Name of the Kubernetes ServiceAccount the app's pods run as (same name in both namespaces, per k8s/base/serviceaccount.yaml)."
  type        = string
  default     = "tome-ms-language"
}

variable "image_updater_namespace" {
  description = "Namespace Argo CD Image Updater is installed into."
  type        = string
  default     = "argocd-image-updater"
}

variable "image_updater_ksa_name" {
  description = "Name of the Kubernetes ServiceAccount Argo CD Image Updater runs as."
  type        = string
  default     = "argocd-image-updater"
}
