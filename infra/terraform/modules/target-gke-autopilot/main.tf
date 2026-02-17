terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 6.0.0"
    }
  }
}

resource "google_project_service" "required" {
  for_each = toset(var.activate_apis)

  project            = var.project_id
  service            = each.key
  disable_on_destroy = false
}

resource "google_container_cluster" "this" {
  name     = var.cluster_name
  location = var.region
  project  = var.project_id

  enable_autopilot    = true
  deletion_protection = var.deletion_protection

  network    = var.network_name
  subnetwork = var.subnetwork_name

  release_channel {
    channel = var.release_channel
  }

  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  dynamic "master_authorized_networks_config" {
    for_each = length(var.master_authorized_networks) > 0 ? [1] : []
    content {
      dynamic "cidr_blocks" {
        for_each = var.master_authorized_networks
        content {
          cidr_block   = cidr_blocks.key
          display_name = cidr_blocks.value
        }
      }
    }
  }

  resource_labels = var.labels

  depends_on = [google_project_service.required]
}
