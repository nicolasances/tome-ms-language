terraform {
  required_version = ">= 1.5"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }

  # Configure a remote backend before running this for real, e.g.:
  # backend "gcs" {
  #   bucket = "<your-terraform-state-bucket>"
  #   prefix = "tome-ms-language/workload-identity"
  # }
}

provider "google" {
  project = var.cluster_project
}
