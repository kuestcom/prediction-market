terraform {
  required_version = ">= 1.6.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 6.0.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

module "target_gke_autopilot" {
  source = "../../../modules/target-gke-autopilot"

  project_id                 = var.project_id
  region                     = var.region
  cluster_name               = var.cluster_name
  network_name               = var.network_name
  subnetwork_name            = var.subnetwork_name
  release_channel            = var.release_channel
  deletion_protection        = var.deletion_protection
  activate_apis              = var.activate_apis
  master_authorized_networks = var.master_authorized_networks
  labels                     = var.labels
}

output "cluster_name" {
  value       = module.target_gke_autopilot.cluster_name
  description = "GKE cluster name"
}

output "region" {
  value       = module.target_gke_autopilot.location
  description = "GKE cluster region"
}

output "endpoint" {
  value       = module.target_gke_autopilot.endpoint
  description = "GKE API endpoint"
}

output "connect_command" {
  value       = module.target_gke_autopilot.connect_command
  description = "Command to fetch kubeconfig credentials"
}
