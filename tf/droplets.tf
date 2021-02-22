# https://developers.digitalocean.com/documentation/changelog/api-v2/new-size-slugs-for-droplet-plan-changes/
# https://github.com/thojkooi/terraform-digitalocean-docker-swarm-mode/blob/master/modules/workers/scripts/join.sh

data "http" "selfip" {
  url = "http://ifconfig.co/"
}

module "join-token" {
  source  = "matti/outputs/shell"
  command = "docker swarm join-token worker -q"
}

resource "digitalocean_droplet" "node" {
  image  = "docker-20-04"
  region = "sfo3"
  count  = 1
  name   = format("vespa-worker-%02d.%s", count.index + 1, var.region)
  size   = "s-1vcpu-1gb"
  tags = [
    "vespa"
  ]

  ssh_keys = var.ssh_keys

  connection {
    host        = self.ipv4_address
    user        = "root"
    type        = "ssh"
    private_key = file(var.provision_ssh_key)
    timeout     = "2m"
  }

  provisioner "remote-exec" {
    inline = [
      "export PATH=$PATH:/usr/bin",
      "apt update",
      "apt --only-upgrade install docker-ce -y",
      "ufw allow 2377",
      "ufw allow 7946",
      "ufw allow 7946/udp",
      "ufw allow 4789/udp",
      "docker swarm join --token ${module.join-token.stdout} --advertise-addr ${self.ipv4_address} ${chomp(data.http.selfip.body)}"
    ]
  }

  # provisioner "remote-exec" {
  #   when = destroy

  #   inline = [
  #     "docker swarm leave",
  #   ]

  #   on_failure = continue
  # }
}

# TODO: remove this
resource "digitalocean_firewall" "node" {
  name = "docker-swarm"

  droplet_ids = digitalocean_droplet.node.*.id

  inbound_rule {
    protocol         = "tcp"
    port_range       = "22"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  inbound_rule {
    protocol         = "tcp"
    port_range       = "2377"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  inbound_rule {
    protocol         = "tcp"
    port_range       = "7946"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  inbound_rule {
    protocol         = "udp"
    port_range       = "7946"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  inbound_rule {
    protocol         = "udp"
    port_range       = "4789"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "tcp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "udp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "icmp"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
}
