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
    SUPABASE_URL                         = var.supabase_url
    NEXT_PUBLIC_REOWN_APPKIT_PROJECT_ID  = var.next_public_reown_appkit_project_id
    NEXT_PUBLIC_FORK_OWNER_GUIDE         = var.next_public_fork_owner_guide
    FLY_APP                              = var.fly_app
    IMAGE_REF                            = var.app_image
    ENV_FILE                             = "/dev/null"
    SKIP_RUNTIME_ENV_VALIDATION          = "0"
  }

  runtime_env = merge(local.base_env, var.app_env, nonsensitive(var.secret_env))

  public_env_checksum = sha256(jsonencode({
    fly_app                              = var.fly_app
    app_image                            = var.app_image
    site_url                             = var.site_url
    supabase_url                         = var.supabase_url
    next_public_reown_appkit_project_id  = var.next_public_reown_appkit_project_id
    next_public_fork_owner_guide         = var.next_public_fork_owner_guide
    app_env                              = var.app_env
  }))

  secret_env_checksum = sha256(jsonencode(nonsensitive(var.secret_env)))

  sync_secrets_command = var.dry_run ? "./infra/fly/sync-secrets.sh --dry-run" : "./infra/fly/sync-secrets.sh"
  deploy_command       = var.dry_run ? "./infra/fly/deploy.sh --dry-run" : "./infra/fly/deploy.sh"
}

resource "null_resource" "sync_secrets" {
  count = var.sync_secrets ? 1 : 0

  triggers = {
    fly_app             = var.fly_app
    public_env_checksum = local.public_env_checksum
    secret_env_checksum = local.secret_env_checksum
    dry_run             = tostring(var.dry_run)
  }

  provisioner "local-exec" {
    working_dir = var.repo_root
    command     = local.sync_secrets_command
    interpreter = ["/bin/bash", "-lc"]
    environment = local.runtime_env
  }
}

resource "null_resource" "deploy" {
  triggers = {
    public_env_checksum = local.public_env_checksum
    secret_env_checksum = local.secret_env_checksum
    dry_run             = tostring(var.dry_run)
  }

  depends_on = var.sync_secrets ? [null_resource.sync_secrets[0]] : []

  provisioner "local-exec" {
    working_dir = var.repo_root
    command     = local.deploy_command
    interpreter = ["/bin/bash", "-lc"]
    environment = local.runtime_env
  }
}
