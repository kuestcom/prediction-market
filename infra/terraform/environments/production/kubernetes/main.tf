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

module "runtime_kubernetes" {
  source = "../../../modules/runtime-kubernetes"

  namespace               = "kuest"
  app_name                = "kuest-web"
  app_image               = var.app_image
  site_url                = var.site_url
  replicas                = 2
  ingress_enabled         = true
  ingress_host            = "markets.example.com"
  ingress_tls_secret_name = "kuest-prod-tls"

  app_env = {
    SUPABASE_URL     = var.supabase_url
    CLOB_URL         = "https://clob.kuest.com"
    RELAYER_URL      = "https://relayer.kuest.com"
    DATA_URL         = "https://data-api.kuest.com"
    USER_PNL_URL     = "https://user-pnl-api.kuest.com"
    COMMUNITY_URL    = "https://community.kuest.com"
    WS_CLOB_URL      = "wss://ws-subscriptions-clob.kuest.com"
    WS_LIVE_DATA_URL = "wss://ws-live-data.kuest.com"
  }

  secret_env = var.secret_env
}
