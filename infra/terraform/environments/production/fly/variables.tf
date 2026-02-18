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

variable "next_public_reown_appkit_project_id" {
  type        = string
  description = "Reown AppKit project id"
}

variable "app_env" {
  type        = map(string)
  description = "Additional non-sensitive env vars"
  default     = {}
}

variable "secret_env" {
  type        = map(string)
  description = "Sensitive application env vars"
  sensitive   = true
}

variable "sync_secrets" {
  type        = bool
  description = "Whether Terraform should sync Fly secrets before deploy"
  default     = true
}

locals {
  resolved_repo_root = var.repo_root != "" ? var.repo_root : abspath("${path.root}/../../../../..")
}
