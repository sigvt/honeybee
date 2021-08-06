terraform {
  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "1.22.2"
    }

    vultr = {
      source  = "vultr/vultr"
      version = "2.3.3"
    }
  }
}

provider "digitalocean" {
  token = var.do_token
}

# https://registry.terraform.io/providers/vultr/vultr/latest/docs/resources/instance

provider "vultr" {
  api_key = var.vultr_token
}
