
data "http" "selfip" {
  url = "https://api.ipify.org"
}

module "join-token" {
  source  = "matti/outputs/shell"
  command = "docker swarm join-token worker -q"
}
