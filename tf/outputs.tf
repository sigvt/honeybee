output "ipv4_addresses" {
  value       = digitalocean_droplet.node.*.ipv4_address
  description = "The nodes public ipv4 adresses"
}
