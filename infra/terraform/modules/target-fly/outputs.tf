output "target" {
  value       = "fly"
  description = "Deployment target type"
}

output "fly_app" {
  value       = var.fly_app
  description = "Fly.io app name"
}

output "image_ref" {
  value       = var.app_image
  description = "Deployed image reference"
}
