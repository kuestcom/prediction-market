terraform {
  required_providers {
    null = {
      source  = "hashicorp/null"
      version = ">= 3.2.0"
    }
  }
}

resource "null_resource" "deploy" {
  triggers = {
    fly_app         = var.fly_app
    app_image       = var.app_image
    fly_config_path = var.fly_config_path
  }

  provisioner "local-exec" {
    working_dir = var.repo_root
    command     = "flyctl deploy --app ${var.fly_app} --config ${var.fly_config_path} --image ${var.app_image}"
    interpreter = ["/bin/bash", "-lc"]
  }
}
