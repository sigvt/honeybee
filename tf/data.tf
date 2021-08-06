
data "http" "selfip" {
  url = "http://ifconfig.co/"
}

module "join-token" {
  source  = "matti/outputs/shell"
  command = "docker swarm join-token worker -q"
}
