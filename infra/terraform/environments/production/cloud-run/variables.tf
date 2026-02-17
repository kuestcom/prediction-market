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
  description = "Map of runtime env var names to Secret Manager secret names"
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
