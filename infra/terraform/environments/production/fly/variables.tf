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

variable "fly_config_path" {
  type        = string
  description = "Path to fly.toml relative to repo root"
  default     = "infra/fly/fly.toml"
}

locals {
  resolved_repo_root = var.repo_root != "" ? var.repo_root : abspath("${path.root}/../../../../..")
}
