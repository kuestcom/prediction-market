terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = ">= 2.27.0"
    }
  }
}

locals {
  app_env = merge({
    NODE_ENV = "production"
    SITE_URL = var.site_url
  }, var.app_env)
}

resource "kubernetes_namespace_v1" "this" {
  metadata {
    name = var.namespace
  }
}

resource "kubernetes_config_map_v1" "app" {
  metadata {
    name      = "${var.app_name}-config"
    namespace = kubernetes_namespace_v1.this.metadata[0].name
  }

  data = local.app_env
}

resource "kubernetes_secret_v1" "app" {
  metadata {
    name      = "${var.app_name}-secrets"
    namespace = kubernetes_namespace_v1.this.metadata[0].name
  }

  type        = "Opaque"
  string_data = var.secret_env
}

resource "kubernetes_deployment_v1" "web" {
  metadata {
    name      = var.app_name
    namespace = kubernetes_namespace_v1.this.metadata[0].name
    labels = {
      app = var.app_name
    }
  }

  spec {
    replicas = var.replicas

    selector {
      match_labels = {
        app = var.app_name
      }
    }

    template {
      metadata {
        labels = {
          app = var.app_name
        }
      }

      spec {
        container {
          name              = "web"
          image             = var.app_image
          image_pull_policy = "IfNotPresent"

          port {
            name           = "http"
            container_port = 3000
          }

          env_from {
            config_map_ref {
              name = kubernetes_config_map_v1.app.metadata[0].name
            }
          }

          env_from {
            secret_ref {
              name = kubernetes_secret_v1.app.metadata[0].name
            }
          }

          readiness_probe {
            http_get {
              path = "/"
              port = "http"
            }
            initial_delay_seconds = 10
            period_seconds        = 10
          }

          liveness_probe {
            http_get {
              path = "/"
              port = "http"
            }
            initial_delay_seconds = 30
            period_seconds        = 20
          }

          resources {
            requests = {
              cpu    = "250m"
              memory = "512Mi"
            }

            limits = {
              cpu    = "1"
              memory = "1024Mi"
            }
          }
        }
      }
    }
  }
}

resource "kubernetes_service_v1" "web" {
  metadata {
    name      = var.app_name
    namespace = kubernetes_namespace_v1.this.metadata[0].name
  }

  spec {
    selector = {
      app = var.app_name
    }

    port {
      name        = "http"
      port        = 80
      target_port = 3000
    }
  }
}

resource "kubernetes_ingress_v1" "web" {
  count = var.ingress_enabled && var.ingress_host != "" ? 1 : 0

  metadata {
    name      = var.app_name
    namespace = kubernetes_namespace_v1.this.metadata[0].name
  }

  spec {
    ingress_class_name = var.ingress_class_name

    rule {
      host = var.ingress_host

      http {
        path {
          path      = "/"
          path_type = "Prefix"

          backend {
            service {
              name = kubernetes_service_v1.web.metadata[0].name

              port {
                number = 80
              }
            }
          }
        }
      }
    }

    dynamic "tls" {
      for_each = var.ingress_tls_secret_name != "" ? [1] : []
      content {
        hosts       = [var.ingress_host]
        secret_name = var.ingress_tls_secret_name
      }
    }
  }
}
