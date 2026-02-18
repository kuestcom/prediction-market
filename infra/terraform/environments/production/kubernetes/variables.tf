variable "kubeconfig_path" {
  type        = string
  description = "Path to kubeconfig"
  default     = "~/.kube/config"
}

variable "kube_context" {
  type        = string
  description = "Kubernetes context name"
}

variable "app_image" {
  type        = string
  description = "Web app image"
}

variable "site_url" {
  type        = string
  description = "Canonical app URL"
}

variable "secret_env" {
  type        = map(string)
  description = "Sensitive application env vars"
  sensitive   = true
}
