variable "repo_root" {
  type        = string
  description = "Absolute path to repository root"
  default     = ""
}

variable "fly_app" {
  type        = string
  description = "Fly.io app name"
}

variable "app_image" {
  type        = string
  description = "Container image reference (digest preferred)"
}

variable "site_url" {
  type        = string
  description = "Canonical public app URL"
}

variable "supabase_url" {
  type        = string
  description = "Supabase project URL"
}

variable "next_public_reown_appkit_project_id" {
  type        = string
  description = "Reown AppKit project id"
}

variable "next_public_fork_owner_guide" {
  type        = string
  description = "NEXT_PUBLIC_FORK_OWNER_GUIDE"
  default     = "false"
}

variable "app_env" {
  type        = map(string)
  description = "Additional non-sensitive env vars"
  default = {
    CLOB_URL         = "https://clob.kuest.com"
    RELAYER_URL      = "https://relayer.kuest.com"
    DATA_URL         = "https://data-api.kuest.com"
    USER_PNL_URL     = "https://user-pnl-api.kuest.com"
    COMMUNITY_URL    = "https://community.kuest.com"
    WS_CLOB_URL      = "wss://ws-subscriptions-clob.kuest.com"
    WS_LIVE_DATA_URL = "wss://ws-live-data.kuest.com"
  }
}

variable "secret_env" {
  type        = map(string)
  description = "Sensitive runtime env vars"
  sensitive   = true
}

variable "sync_secrets" {
  type        = bool
  description = "Whether Terraform should sync Fly secrets before deploy"
  default     = true
}

variable "dry_run" {
  type        = bool
  description = "Whether to execute deploy in dry-run mode"
  default     = false
}

locals {
  resolved_repo_root = var.repo_root != "" ? var.repo_root : abspath("${path.root}/../../../../..")
}
