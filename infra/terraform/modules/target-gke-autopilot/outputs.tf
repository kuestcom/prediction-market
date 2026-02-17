output "cluster_name" {
  value       = google_container_cluster.this.name
  description = "Created GKE cluster name"
}

output "location" {
  value       = google_container_cluster.this.location
  description = "Created GKE cluster location"
}

output "endpoint" {
  value       = google_container_cluster.this.endpoint
  description = "GKE API server endpoint (without scheme)"
}

output "ca_certificate" {
  value       = google_container_cluster.this.master_auth[0].cluster_ca_certificate
  description = "Base64-encoded cluster CA certificate"
  sensitive   = true
}

output "connect_command" {
  value       = "gcloud container clusters get-credentials ${google_container_cluster.this.name} --region ${google_container_cluster.this.location} --project ${var.project_id}"
  description = "Command to fetch kubeconfig credentials for this cluster"
}
