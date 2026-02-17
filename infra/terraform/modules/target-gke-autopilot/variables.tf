variable "project_id" {
  type        = string
  description = "GCP project ID where GKE Autopilot will be created"
}

variable "region" {
  type        = string
  description = "GCP region for the regional GKE Autopilot cluster"
}

variable "cluster_name" {
  type        = string
  description = "GKE cluster name"
  default     = "kuest-prod-autopilot"
}

variable "network_name" {
  type        = string
  description = "VPC network name used by the cluster"
  default     = "default"
}

variable "subnetwork_name" {
  type        = string
  description = "Subnetwork name in the selected region"
  default     = "default"
}

variable "release_channel" {
  type        = string
  description = "GKE release channel"
  default     = "REGULAR"
  validation {
    condition = contains([
      "RAPID",
      "REGULAR",
      "STABLE",
      "UNSPECIFIED",
    ], var.release_channel)
    error_message = "release_channel must be RAPID, REGULAR, STABLE, or UNSPECIFIED."
  }
}

variable "deletion_protection" {
  type        = bool
  description = "Protect cluster from accidental deletion"
  default     = true
}

variable "activate_apis" {
  type        = list(string)
  description = "Project APIs to activate before cluster creation"
  default = [
    "container.googleapis.com",
  ]
}

variable "master_authorized_networks" {
  type        = map(string)
  description = "Map of CIDR block to display name for control plane authorized networks"
  default     = {}
}

variable "labels" {
  type        = map(string)
  description = "Resource labels applied to the GKE cluster"
  default     = {}
}
