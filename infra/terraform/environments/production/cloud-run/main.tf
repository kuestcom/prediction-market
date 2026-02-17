terraform {
  required_version = ">= 1.6.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 6.0.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

module "target_cloud_run" {
  source = "../../../modules/target-cloud-run"

  project_id                            = var.project_id
  region                                = var.region
  service_name                          = var.service_name
  app_image                             = var.app_image
  secret_version                        = var.secret_version
  site_url                              = var.site_url
  next_public_reown_appkit_project_id   = var.next_public_reown_appkit_project_id
  app_env                               = var.app_env
  secret_env                            = var.secret_env
  allow_unauthenticated                 = var.allow_unauthenticated
  ingress                               = var.ingress
  min_instances                         = var.min_instances
  max_instances                         = var.max_instances
  container_concurrency                 = var.container_concurrency
  timeout_seconds                       = var.timeout_seconds
  cpu_limit                             = var.cpu_limit
  memory_limit                          = var.memory_limit
}

output "deployment_target" {
  value       = module.target_cloud_run.target
  description = "Deployment target"
}

output "service_name" {
  value       = module.target_cloud_run.service_name
  description = "Cloud Run service name"
}

output "region" {
  value       = module.target_cloud_run.region
  description = "Cloud Run region"
}

output "image_ref" {
  value       = module.target_cloud_run.image_ref
  description = "Image reference used for deployment"
}

output "service_uri" {
  value       = module.target_cloud_run.uri
  description = "Cloud Run public service URL"
}
