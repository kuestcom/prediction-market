output "target" {
  value       = "cloud-run"
  description = "Deployment target type"
}

output "service_name" {
  value       = google_cloud_run_v2_service.this.name
  description = "Cloud Run service name"
}

output "region" {
  value       = google_cloud_run_v2_service.this.location
  description = "Cloud Run region"
}

output "image_ref" {
  value       = var.app_image
  description = "Deployed image reference"
}

output "uri" {
  value       = google_cloud_run_v2_service.this.uri
  description = "Cloud Run service URL"
}
