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
  default     = "kuestcom/prediction-market"
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
  description = "Canonical public app URL"
}

variable "supabase_url" {
  type        = string
  description = "Supabase project URL"
}

variable "next_public_reown_appkit_project_id" {
  type        = string
  description = "Reown AppKit project id"
}

variable "next_public_fork_owner_guide" {
  type        = string
  description = "NEXT_PUBLIC_FORK_OWNER_GUIDE"
  default     = "false"
}

variable "app_env" {
  type        = map(string)
  description = "Additional non-sensitive env vars"
  default = {
    CLOB_URL         = "https://clob.kuest.com"
    RELAYER_URL      = "https://relayer.kuest.com"
    DATA_URL         = "https://data-api.kuest.com"
    USER_PNL_URL     = "https://user-pnl-api.kuest.com"
    COMMUNITY_URL    = "https://community.kuest.com"
    WS_CLOB_URL      = "wss://ws-subscriptions-clob.kuest.com"
    WS_LIVE_DATA_URL = "wss://ws-live-data.kuest.com"
  }
}

variable "secret_env" {
  type        = map(string)
  description = "Sensitive application env vars"
  sensitive   = true
}
