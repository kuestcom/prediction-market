variable "namespace" {
  type        = string
  description = "Kubernetes namespace for the runtime"
  default     = "kuest"
}

variable "app_name" {
  type        = string
  description = "Application name prefix"
  default     = "kuest-web"
}

variable "app_image" {
  type        = string
  description = "Container image for the web runtime"
}

variable "site_url" {
  type        = string
  description = "Canonical public URL for the application"
}

variable "replicas" {
  type        = number
  description = "Number of desired web replicas"
  default     = 2
}

variable "app_env" {
  type        = map(string)
  description = "Extra non-sensitive environment variables"
  default     = {}
}

variable "secret_env" {
  type        = map(string)
  description = "Sensitive environment variables"
  sensitive   = true
  validation {
    condition = alltrue([
      contains(keys(var.secret_env), "CRON_SECRET"),
      contains(keys(var.secret_env), "POSTGRES_URL"),
      contains(keys(var.secret_env), "SUPABASE_SERVICE_ROLE_KEY"),
    ])
    error_message = "secret_env must include CRON_SECRET, POSTGRES_URL, and SUPABASE_SERVICE_ROLE_KEY."
  }
}

variable "ingress_enabled" {
  type        = bool
  description = "Whether ingress should be created"
  default     = true
}

variable "ingress_class_name" {
  type        = string
  description = "Ingress class name"
  default     = "nginx"
}

variable "ingress_host" {
  type        = string
  description = "Ingress hostname"
  default     = ""
}

variable "ingress_tls_secret_name" {
  type        = string
  description = "TLS secret name for ingress"
  default     = ""
}
