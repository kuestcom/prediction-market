variable "repo_root" {
  type        = string
  description = "Absolute path to repository root"
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

variable "fly_config_path" {
  type        = string
  description = "Path to fly.toml relative to repo_root"
  default     = "infra/fly/fly.toml"
}
