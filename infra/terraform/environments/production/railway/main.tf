terraform {
  required_version = ">= 1.6.0"

  required_providers {
    null = {
      source  = "hashicorp/null"
      version = ">= 3.2.0"
    }
  }
}

module "target_railway" {
  source = "../../../modules/target-railway"

  repo_root           = local.resolved_repo_root
  railway_project_id  = var.railway_project_id
  railway_environment = var.railway_environment
  railway_service     = var.railway_service
  deploy_path         = var.deploy_path
  path_as_root        = var.path_as_root
}

output "deployment_target" {
  value       = module.target_railway.target
  description = "Deployment target"
}

output "railway_project_id" {
  value       = module.target_railway.railway_project_id
  description = "Railway project ID used for deployment"
}

output "railway_environment" {
  value       = module.target_railway.railway_environment
  description = "Railway environment used for deployment"
}

output "railway_service" {
  value       = module.target_railway.railway_service
  description = "Railway service used for deployment"
}

output "deploy_path" {
  value       = module.target_railway.deploy_path
  description = "Repository path deployed with Railway"
}
