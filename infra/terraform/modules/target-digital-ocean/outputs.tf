output "target" {
  value       = "digital-ocean"
  description = "Deployment target type"
}

output "app_id" {
  value       = digitalocean_app.this.id
  description = "DigitalOcean App Platform app ID"
}

output "app_urn" {
  value       = digitalocean_app.this.urn
  description = "DigitalOcean App Platform app URN"
}

output "default_ingress" {
  value       = digitalocean_app.this.default_ingress
  description = "Default app ingress URL"
}
