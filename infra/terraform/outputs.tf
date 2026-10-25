output "tome_ms_language_dev_gsa_email" {
  value = google_service_account.tome_ms_language_dev.email
}

output "tome_ms_language_prod_gsa_email" {
  value = google_service_account.tome_ms_language_prod.email
}

output "argocd_image_updater_gsa_email" {
  value = google_service_account.argocd_image_updater.email
}
