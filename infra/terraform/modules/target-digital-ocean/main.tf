terraform {
  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = ">= 2.39.0"
    }
  }
}

locals {
  app_env = merge({
    NODE_ENV                             = "production"
    SITE_URL                             = var.site_url
    NEXT_PUBLIC_REOWN_APPKIT_PROJECT_ID  = var.next_public_reown_appkit_project_id
  }, var.app_env)
}

resource "digitalocean_app" "this" {
  spec {
    name   = var.app_name
    region = var.region

    service {
      name               = "web"
      instance_count     = var.instance_count
      instance_size_slug = var.instance_size_slug
      http_port          = var.http_port
      source_dir         = var.source_dir
      dockerfile_path    = var.dockerfile_path

      github {
        repo           = var.github_repo
        branch         = var.github_branch
        deploy_on_push = var.deploy_on_push
      }

      dynamic "env" {
        for_each = local.app_env
        content {
          key   = env.key
          value = env.value
          type  = "GENERAL"
          scope = "RUN_AND_BUILD_TIME"
        }
      }

      dynamic "env" {
        for_each = toset(nonsensitive(keys(var.secret_env)))
        content {
          key   = env.value
          value = var.secret_env[env.value]
          type  = "SECRET"
          scope = "RUN_TIME"
        }
      }
    }
  }
}

resource "digitalocean_project_resources" "this" {
  count = var.project_id != "" ? 1 : 0

  project   = var.project_id
  resources = [digitalocean_app.this.urn]
}
