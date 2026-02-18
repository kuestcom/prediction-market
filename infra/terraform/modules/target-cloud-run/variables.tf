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
  description = "Container image reference (digest preferred, explicit tag allowed, latest forbidden)"
  validation {
    condition = (
      strcontains(var.app_image, "@sha256:")
      || length(regexall("(:[^:@/]+)$", var.app_image)) > 0
    ) && length(regexall(":latest$", var.app_image)) == 0
    error_message = "app_image must be an immutable digest or explicit non-latest tag."
  }
}

variable "secret_version" {
  type        = string
  description = "Secret Manager version reference used by Cloud Run"
  default     = "latest"
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
  description = "Map of application environment variable name to Secret Manager secret name"
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

variable "allow_unauthenticated" {
  type        = bool
  description = "Whether to allow unauthenticated invocations"
  default     = true
}

variable "ingress" {
  type        = string
  description = "Cloud Run ingress policy"
  default     = "INGRESS_TRAFFIC_ALL"
  validation {
    condition = contains([
      "INGRESS_TRAFFIC_ALL",
      "INGRESS_TRAFFIC_INTERNAL_ONLY",
      "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER",
    ], var.ingress)
    error_message = "ingress must be one of INGRESS_TRAFFIC_ALL, INGRESS_TRAFFIC_INTERNAL_ONLY, or INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER."
  }
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
  validation {
    condition     = var.max_instances >= var.min_instances
    error_message = "max_instances must be greater than or equal to min_instances."
  }
}

variable "container_concurrency" {
  type        = number
  description = "Max concurrent requests per container instance"
  default     = 80
}

variable "timeout_seconds" {
  type        = number
  description = "Request timeout in seconds"
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
