terraform {
  required_providers {
    null = {
      source  = "hashicorp/null"
      version = ">= 3.2.0"
    }
  }
}

locals {
  project_arg      = var.railway_project_id != "" ? "--project ${var.railway_project_id}" : ""
  environment_arg  = var.railway_environment != "" ? "--environment ${var.railway_environment}" : ""
  service_arg      = var.railway_service != "" ? "--service ${var.railway_service}" : ""
  path_as_root_arg = var.path_as_root ? "--path-as-root" : ""
  deploy_path_arg  = trimspace(var.deploy_path) != "" ? trimspace(var.deploy_path) : "."
}

resource "null_resource" "deploy" {
  triggers = {
    repo_root          = var.repo_root
    railway_project_id  = var.railway_project_id
    railway_environment = var.railway_environment
    railway_service     = var.railway_service
    deploy_path         = local.deploy_path_arg
    path_as_root        = tostring(var.path_as_root)
  }

  lifecycle {
    precondition {
      condition     = var.railway_project_id == "" || var.railway_environment != ""
      error_message = "railway_environment must be set when railway_project_id is provided."
    }
  }

  provisioner "local-exec" {
    working_dir = var.repo_root
    command     = "railway up --ci ${local.project_arg} ${local.environment_arg} ${local.service_arg} ${local.path_as_root_arg} \"${local.deploy_path_arg}\""
    interpreter = ["/bin/bash", "-lc"]
  }
}
