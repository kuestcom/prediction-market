output "target" {
  value       = "railway"
  description = "Deployment target type"
}

output "railway_project_id" {
  value       = var.railway_project_id
  description = "Railway project ID"
}

output "railway_environment" {
  value       = var.railway_environment
  description = "Railway environment name or ID"
}

output "railway_service" {
  value       = var.railway_service
  description = "Railway service name or ID"
}

output "deploy_path" {
  value       = trimspace(var.deploy_path) != "" ? trimspace(var.deploy_path) : "."
  description = "Path deployed by the Railway CLI"
}
