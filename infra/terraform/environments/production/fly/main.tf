terraform {
  required_version = ">= 1.6.0"

  required_providers {
    null = {
      source  = "hashicorp/null"
      version = ">= 3.2.0"
    }
  }
}

module "target_fly" {
  source = "../../../modules/target-fly"

  repo_root                            = local.resolved_repo_root
  fly_app                              = var.fly_app
  app_image                            = var.app_image
  site_url                             = var.site_url
  next_public_reown_appkit_project_id  = var.next_public_reown_appkit_project_id
  app_env                              = var.app_env
  secret_env                           = var.secret_env
  sync_secrets                         = var.sync_secrets
}

output "deployment_target" {
  value       = module.target_fly.target
  description = "Deployment target"
}

output "fly_app" {
  value       = module.target_fly.fly_app
  description = "Fly.io app name"
}

output "image_ref" {
  value       = module.target_fly.image_ref
  description = "Image reference used for deployment"
}
