variable "repo_root" {
  type        = string
  description = "Absolute path to repository root"
}

variable "railway_project_id" {
  type        = string
  description = "Railway project ID (optional when the CLI is already linked to a project)"
  default     = ""
}

variable "railway_environment" {
  type        = string
  description = "Railway environment name or ID (required when railway_project_id is provided)"
  default     = ""
}

variable "railway_service" {
  type        = string
  description = "Railway service name or ID"
  default     = ""
}

variable "deploy_path" {
  type        = string
  description = "Path to deploy relative to repo_root"
  default     = "."
}

variable "path_as_root" {
  type        = bool
  description = "Whether Railway should treat deploy_path as the archive root"
  default     = false
}
