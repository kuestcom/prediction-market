terraform {
  required_version = ">= 1.6.0"

  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = ">= 2.39.0"
    }
  }
}

provider "digitalocean" {}

module "target_digital_ocean" {
  source = "../../../modules/target-digital-ocean"

  project_id                           = var.project_id
  app_name                             = var.app_name
  region                               = var.region
  github_repo                          = var.github_repo
  github_branch                        = var.github_branch
  deploy_on_push                       = var.deploy_on_push
  source_dir                           = var.source_dir
  dockerfile_path                      = var.dockerfile_path
  http_port                            = var.http_port
  instance_size_slug                   = var.instance_size_slug
  instance_count                       = var.instance_count
  site_url                             = var.site_url
  next_public_reown_appkit_project_id  = var.next_public_reown_appkit_project_id
  app_env                              = var.app_env
  secret_env                           = var.secret_env
}

output "deployment_target" {
  value       = module.target_digital_ocean.target
  description = "Deployment target"
}

output "app_id" {
  value       = module.target_digital_ocean.app_id
  description = "DigitalOcean App Platform app ID"
}

output "app_urn" {
  value       = module.target_digital_ocean.app_urn
  description = "DigitalOcean App Platform app URN"
}

output "default_ingress" {
  value       = module.target_digital_ocean.default_ingress
  description = "Default app ingress URL"
}
