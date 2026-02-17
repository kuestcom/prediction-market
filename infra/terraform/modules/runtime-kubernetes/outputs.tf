output "namespace" {
  value       = kubernetes_namespace_v1.this.metadata[0].name
  description = "Namespace where resources are deployed"
}

output "service_name" {
  value       = kubernetes_service_v1.web.metadata[0].name
  description = "Kubernetes service name for the app"
}

output "ingress_host" {
  value       = var.ingress_host
  description = "Ingress hostname"
}
