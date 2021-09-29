variable "region" {
  default = "sfo3"
}

variable "total_workers" {
  description = "# of workers"
  default     = 1
}

variable "token" {
  description = "DigitalOcean API token"
}

variable "ssh_keys" {
  type = list(string)
}

variable "provision_key_path" {
  default = "~/.ssh/id_ed25519"
}
