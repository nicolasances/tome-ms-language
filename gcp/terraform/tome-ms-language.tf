# ---------------------------------------------------------------
# 0. Artifact Registry
# ---------------------------------------------------------------
resource "google_artifact_registry_repository" "tome-ms-language-artifact-repo" {
    location = "europe-west1"
    repository_id = "tome-ms-language"
    description = "Artifact Registry for tome-ms-language"
    format = "DOCKER"
    
    docker_config {
        immutable_tags = true
    }

    cleanup_policy_dry_run = false
    cleanup_policies {
        id     = "keep-minimum-versions"
        action = "KEEP"
        most_recent_versions {
            keep_count            = 1
        }
    }
}

# ---------------------------------------------------------------
# 1. Service Account
# ---------------------------------------------------------------
# 1.1. Service Account 
# ---------------------------------------------------------------
resource "google_service_account" "tome-ms-language-service-account" {
  account_id = "tome-ms-language"
  display_name = "Tome Ms Language Service Account"
}

# ---------------------------------------------------------------
# 1.2. Service Account Roles
# ---------------------------------------------------------------
resource "google_project_iam_member" "tome-ms-language-role-secretmanagedaccessor" {
    project = var.gcp_pid
    role = "roles/secretmanager.secretAccessor"
    member = format("serviceAccount:%s", google_service_account.tome-ms-language-service-account.email)
}
resource "google_project_iam_member" "tome-ms-language-role-gcs" {
    project = var.gcp_pid
    role = "roles/storage.admin"
    member = format("serviceAccount:%s", google_service_account.tome-ms-language-service-account.email)
}
resource "google_project_iam_member" "tome-ms-language-role-pubsub" {
    project = var.gcp_pid
    role = "roles/pubsub.publisher"
    member = format("serviceAccount:%s", google_service_account.tome-ms-language-service-account.email)
}

# ---------------------------------------------------------------
# 2. Artifact Repository
# ---------------------------------------------------------------
resource "google_artifact_registry_repository" "tome-ms-language-registry" {
    location = var.gcp_region
    repository_id = "tome-ms-language"
    format = "DOCKER"
    description = "Tome Ms Language Artifact Registry"
    labels = {
        "created_by" = "terraform"
        "project" = var.gcp_pid
    }
}

# ---------------------------------------------------------------
# 3. Github environment secrets & variables
# ---------------------------------------------------------------
# NOTE: The repository name below must match your GitHub repo name.
resource "github_repository_environment" "tome-ms-language-github-environment" {
    repository = "tome-ms-language"
    environment = var.gcp_pid
}
resource "github_actions_environment_secret" "tome-ms-language-bucket-envsecret" {
    repository = "tome-ms-language"
    environment = var.gcp_pid
    secret_name = "BACKUP_BUCKET"
    plaintext_value  = google_storage_bucket.backup-bucket.name
}
resource "github_actions_environment_secret" "tome-ms-language-secret-cicdsakey" {
    repository = "tome-ms-language"
    environment = var.gcp_pid
    secret_name = "CICD_SERVICE_ACCOUNT"
    plaintext_value = jsonencode(jsondecode(base64decode(google_service_account_key.toto-cicd-sa-key.private_key)))
}
resource "github_actions_environment_variable" "tome-ms-language-var-pid" {
    repository = "tome-ms-language"
    environment = var.gcp_pid
    variable_name = "GCP_PID"
    value = var.gcp_pid
}
resource "github_actions_environment_secret" "tome-ms-language-secret-service-account" {
    repository = "tome-ms-language"
    environment = var.gcp_pid
    secret_name = "SERVICE_ACCOUNT"
    plaintext_value = google_service_account.tome-ms-language-service-account.email
}
resource "github_actions_environment_secret" "tome-ms-language-secret-service-base-url" {
    repository = "tome-ms-language"
    environment = var.gcp_pid
    secret_name = "SERVICE_BASE_URL"
    plaintext_value = format("https://tome-ms-language-%s", var.cloud_run_endpoint_suffix)
}
resource "github_actions_environment_secret" "tome-ms-language-secret-gale-broker-endpoint" {
    repository = "tome-ms-language"
    environment = var.gcp_pid
    secret_name = "GALE_BROKER_URL"
    plaintext_value = format("https://gale-broker-%s/galebroker", var.cloud_run_endpoint_suffix)
}

# ---------------------------------------------------------------
# 4. Google Secret Manager (Secrets)
# ---------------------------------------------------------------

variable "tome_ms_language_mongo_user" {
    description = "Mongo User for tome-ms-language"
    type = string
    sensitive = true
}
variable "tome_ms_language_mongo_pswd" {
    description = "Mongo Password for tome-ms-language"
    type = string
    sensitive = true
}
resource "google_secret_manager_secret" "tome-ms-language-mongo-user" {
    secret_id = "tome-ms-language-mongo-user"
    replication {
        auto { }
    }
}
resource "google_secret_manager_secret_version" "tome-ms-language-mongo-user-version" {
    secret = google_secret_manager_secret.tome-ms-language-mongo-user.id
    secret_data = var.tome_ms_language_mongo_user
}
resource "google_secret_manager_secret" "tome-ms-language-mongo-pswd" {
    secret_id = "tome-ms-language-mongo-pswd"
    replication {
        auto { }
    }
}
resource "google_secret_manager_secret_version" "tome-ms-language-mongo-pswd-version" {
    secret = google_secret_manager_secret.tome-ms-language-mongo-pswd.id
    secret_data = var.tome_ms_language_mongo_pswd
}


# ---------------------------------------------------------------
# 5. Cloud DNS & Domain Mapping
# ---------------------------------------------------------------

# ---------------------------------------------------------------
# 6. PubSub Subscriptions to events
# ---------------------------------------------------------------
