variable "repo_root" {
  type        = string
  description = "Absolute path to repository root where infra scripts are available"
}

variable "fly_app" {
  type        = string
  description = "Fly.io app name"
}

variable "app_image" {
  type        = string
  description = "Container image reference (digest preferred, explicit tag allowed, latest forbidden)"
  validation {
    condition = (
      strcontains(var.app_image, "@sha256:")
      || length(regexall("(:[^:@/]+)$", var.app_image)) > 0
    ) && length(regexall(":latest$", var.app_image)) == 0
    error_message = "app_image must be an immutable digest or explicit non-latest tag."
  }
}

variable "site_url" {
  type        = string
  description = "Canonical public URL for the app"
}

variable "next_public_reown_appkit_project_id" {
  type        = string
  description = "Reown AppKit project id"
}

variable "app_env" {
  type        = map(string)
  description = "Additional non-sensitive application environment variables"
  default     = {}
}

variable "secret_env" {
  type        = map(string)
  description = "Sensitive application environment variables"
  sensitive   = true
  validation {
    condition = alltrue([
      contains(keys(var.secret_env), "BETTER_AUTH_SECRET"),
      contains(keys(var.secret_env), "CRON_SECRET"),
      contains(keys(var.secret_env), "POSTGRES_URL"),
      contains(keys(var.secret_env), "SUPABASE_URL"),
      contains(keys(var.secret_env), "SUPABASE_SERVICE_ROLE_KEY"),
      contains(keys(var.secret_env), "ADMIN_WALLETS"),
      contains(keys(var.secret_env), "KUEST_ADDRESS"),
      contains(keys(var.secret_env), "KUEST_API_KEY"),
      contains(keys(var.secret_env), "KUEST_API_SECRET"),
      contains(keys(var.secret_env), "KUEST_PASSPHRASE"),
    ])
    error_message = "secret_env must include BETTER_AUTH_SECRET, CRON_SECRET, POSTGRES_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_WALLETS, and KUEST credentials."
  }
}

variable "sync_secrets" {
  type        = bool
  description = "Whether Terraform should run fly/sync-secrets.sh before deploy"
  default     = true
}
