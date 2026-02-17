terraform {
  required_providers {
    null = {
      source  = "hashicorp/null"
      version = ">= 3.2.0"
    }
  }
}

locals {
  base_env = {
    NODE_ENV                             = "production"
    SITE_URL                             = var.site_url
    NEXT_PUBLIC_REOWN_APPKIT_PROJECT_ID  = var.next_public_reown_appkit_project_id
    FLY_APP                              = var.fly_app
    IMAGE_REF                            = var.app_image
    ENV_FILE                             = "/dev/null"
    SKIP_RUNTIME_ENV_VALIDATION          = "0"
  }

  deployment_env = merge(local.base_env, var.app_env, var.secret_env)

  public_env_checksum = sha256(jsonencode({
    fly_app                              = var.fly_app
    app_image                            = var.app_image
    site_url                             = var.site_url
    next_public_reown_appkit_project_id  = var.next_public_reown_appkit_project_id
    app_env                              = var.app_env
  }))

  secret_env_checksum = sha256(jsonencode(nonsensitive(var.secret_env)))

  sync_secrets_command = "./infra/fly/sync-secrets.sh"
  deploy_command       = "./infra/fly/deploy.sh"
}

resource "null_resource" "sync_secrets" {
  count = var.sync_secrets ? 1 : 0

  triggers = {
    fly_app             = var.fly_app
    public_env_checksum = local.public_env_checksum
    secret_env_checksum = local.secret_env_checksum
  }

  provisioner "local-exec" {
    working_dir = var.repo_root
    command     = local.sync_secrets_command
    interpreter = ["/bin/bash", "-lc"]
    environment = local.deployment_env
  }
}

resource "null_resource" "deploy" {
  triggers = {
    public_env_checksum = local.public_env_checksum
    secret_env_checksum = local.secret_env_checksum
  }

  depends_on = var.sync_secrets ? [null_resource.sync_secrets[0]] : []

  provisioner "local-exec" {
    working_dir = var.repo_root
    command     = local.deploy_command
    interpreter = ["/bin/bash", "-lc"]
    environment = local.deployment_env
  }
}
