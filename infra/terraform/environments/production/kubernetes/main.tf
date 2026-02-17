terraform {
  required_version = ">= 1.6.0"

  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = ">= 2.27.0"
    }
  }
}

provider "kubernetes" {
  config_path    = pathexpand(var.kubeconfig_path)
  config_context = var.kube_context
}

module "target_kubernetes" {
  source = "../../../modules/target-kubernetes"

  namespace               = "kuest"
  app_name                = "kuest-web"
  app_image               = var.app_image
  site_url                = var.site_url
  replicas                = 2
  ingress_enabled         = true
  ingress_host            = "markets.example.com"
  ingress_tls_secret_name = "kuest-prod-tls"

  secret_env = var.secret_env
}
