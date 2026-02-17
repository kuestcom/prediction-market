variable "project_id" {
  type        = string
  description = "GCP project ID"
}

variable "region" {
  type        = string
  description = "Cloud Run region"
}

variable "service_name" {
  type        = string
  description = "Cloud Run service name"
  default     = "kuest-web"
}

variable "app_image" {
  type        = string
  description = "Container image reference (digest preferred)"
}

variable "secret_version" {
  type        = string
  description = "Secret Manager version used in Cloud Run"
  default     = "latest"
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
  description = "Map of application env var names to Secret Manager secret names"
}

variable "allow_unauthenticated" {
  type        = bool
  description = "Whether to allow unauthenticated access to the Cloud Run service"
  default     = true
}

variable "ingress" {
  type        = string
  description = "Cloud Run ingress policy"
  default     = "INGRESS_TRAFFIC_ALL"
}

variable "min_instances" {
  type        = number
  description = "Minimum number of Cloud Run instances"
  default     = 0
}

variable "max_instances" {
  type        = number
  description = "Maximum number of Cloud Run instances"
  default     = 10
}

variable "container_concurrency" {
  type        = number
  description = "Maximum number of requests per container instance"
  default     = 80
}

variable "timeout_seconds" {
  type        = number
  description = "Cloud Run request timeout in seconds"
  default     = 300
}

variable "cpu_limit" {
  type        = string
  description = "CPU limit for the Cloud Run container"
  default     = "1"
}

variable "memory_limit" {
  type        = string
  description = "Memory limit for the Cloud Run container"
  default     = "1Gi"
}
