# NOTE: Vultra Terraform provider doesn't support $3.5 vc2 instance :(
# https://api.vultr.com/v2/plans

# resource "vultr_instance" "vultr_node" {
#   plan        = "vc2-1c-1gb"
#   region      = "ewr" # New Jersey
#   count       = var.vultr_total_workers
#   hostname    = format("honeybee-vultr-%02d", count.index + 1)
#   os_id       = 387
#   ssh_key_ids = []

#   connection {
#     host        = self.main_ip
#     user        = "root"
#     type        = "ssh"
#     private_key = file(var.provision_key_path)
#     timeout     = "2m"
#   }

#   provisioner "remote-exec" {
#     inline = [
#       "ufw allow ssh",
#       "ufw allow 2377",
#       "ufw allow 7946",
#       "ufw allow 7946/udp",
#       "ufw allow 4789/udp",
#       "ufw --force enable",
#       "apt-get install apt-transport-https ca-certificates curl gnupg lsb-release -y",
#       "curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg",
#       "echo \"deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable\" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null",
#       "apt-get update",
#       "apt-get install docker-ce docker-ce-cli containerd.io -y",
#       "docker swarm join --token ${module.join-token.stdout} --advertise-addr ${self.main_ip} ${chomp(data.http.selfip.body)}"
#     ]
#   }
# }
