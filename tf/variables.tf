variable "do_region" {
  default = "sfo3"
}

variable "do_total_workers" {
  description = "# of workers"
  default     = 1
}

variable "do_token" {
  description = "DigitalOcean API token"
}

variable "do_ssh_keys" {
  type = list(string)
}

variable "provision_key_path" {
  default = "~/.ssh/id_ed25519"
}
