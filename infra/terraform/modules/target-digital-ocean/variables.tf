variable "project_id" {
  type        = string
  description = "Optional DigitalOcean project ID to attach the app to"
  default     = ""
}

variable "app_name" {
  type        = string
  description = "DigitalOcean App Platform app name"
  default     = "kuest-web"
}

variable "region" {
  type        = string
  description = "DigitalOcean App Platform region"
  default     = "nyc"
}

variable "github_repo" {
  type        = string
  description = "GitHub repo in owner/repo format"
}

variable "github_branch" {
  type        = string
  description = "GitHub branch to deploy from"
  default     = "main"
}

variable "deploy_on_push" {
  type        = bool
  description = "Whether pushes on github_branch trigger automatic app redeploy"
  default     = true
}

variable "source_dir" {
  type        = string
  description = "Relative source directory inside the repository"
  default     = "/"
}

variable "dockerfile_path" {
  type        = string
  description = "Path to Dockerfile relative to repository root"
  default     = "infra/docker/Dockerfile"
}

variable "http_port" {
  type        = number
  description = "Application HTTP port"
  default     = 3000
}

variable "instance_size_slug" {
  type        = string
  description = "App Platform instance size slug"
  default     = "basic-xxs"
}

variable "instance_count" {
  type        = number
  description = "Number of application instances"
  default     = 1
}

variable "site_url" {
  type        = string
  description = "Canonical public URL for the app"
}

variable "next_public_reown_appkit_project_id" {
  type        = string
  description = "Reown AppKit project id"
}

variable "app_env" {
  type        = map(string)
  description = "Additional non-sensitive application environment variables"
  default     = {}
}

variable "secret_env" {
  type        = map(string)
  description = "Sensitive application environment variables"
  sensitive   = true
  validation {
    condition = alltrue([
      contains(keys(var.secret_env), "BETTER_AUTH_SECRET"),
      contains(keys(var.secret_env), "CRON_SECRET"),
      contains(keys(var.secret_env), "POSTGRES_URL"),
      contains(keys(var.secret_env), "SUPABASE_URL"),
      contains(keys(var.secret_env), "SUPABASE_SERVICE_ROLE_KEY"),
      contains(keys(var.secret_env), "ADMIN_WALLETS"),
      contains(keys(var.secret_env), "KUEST_ADDRESS"),
      contains(keys(var.secret_env), "KUEST_API_KEY"),
      contains(keys(var.secret_env), "KUEST_API_SECRET"),
      contains(keys(var.secret_env), "KUEST_PASSPHRASE"),
    ])
    error_message = "secret_env must include BETTER_AUTH_SECRET, CRON_SECRET, POSTGRES_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_WALLETS, and KUEST credentials."
  }
}
