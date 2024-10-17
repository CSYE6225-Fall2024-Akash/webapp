packer {
  required_plugins {
    amazon = {
      version = ">= 0.0.2"
      source  = "github.com/hashicorp/amazon"
    }
  }
}

variable "region" {
  type        = string
  default     = env("AWS_REGION")
  description = "The AWS region to build the AMI in"
}

variable "source_ami_id" {
  type        = string
  default     = "ami-0cad6ee50670e3d0e"
  description = "The source AMI ID to base the new AMI on"
}

variable "vpc_id" {
  type        = string
  default     = env("VPC_ID")
  description = "The VPC ID to launch the build instance into"
}

variable "subnet_id" {
  type        = string
  default     = env("SUBNET_ID")
  description = "The Subnet ID to launch the build instance into"
}

variable "DB_PASSWORD" {
  type        = string
  default     = env("DB_PASSWORD")
  description = "Database password for the application"
}

variable "DB_ROOT_PASSWORD" {
  type        = string
  default     = env("DB_ROOT_PASSWORD")
  description = "Root password for the database"
}

variable "DB_NAME" {
  type        = string
  default     = env("DB_NAME")
  description = "Name of the database to be used by the application"
}

variable "DB_USER" {
  type        = string
  default     = env("DB_USER")
  description = "Username for database access"
}

variable "NODE_PORT" {
  type        = string
  default     = env("NODE_PORT")
  description = "Port number for the Node.js application"
}

variable "instance_type" {
  type        = string
  default     = env("INSTANCE_TYPE")
  description = "EC2 instance type to use for building the AMI"
}

variable "ssh_username" {
  type        = string
  default     = "ubuntu"
  description = "SSH username for connecting to the instance"
}

variable "demo_acc_id" {
  type    = string
  default = "340752837329"
}

source "amazon-ebs" "my-ami" {
  ami_name      = "csye6225_${formatdate("YYYY_MM_DD_hh_mm_ss", timestamp())}"
  source_ami    = var.source_ami_id
  instance_type = "t2.small"
  region        = var.region
  ssh_username  = var.ssh_username
  ami_users     = [var.demo_acc_id]
  vpc_id        = var.vpc_id
  subnet_id     = var.subnet_id

  launch_block_device_mappings {
    delete_on_termination = true
    device_name           = "/dev/xvda"
    volume_size           = 8
    volume_type           = "gp2"
  }

}



build {
  name = "custom-webapp"
  sources = [
    "source.amazon-ebs.my-ami"
  ]



  provisioner "shell" {
    inline = [
      "sudo mkdir -p /opt/webapp",
      "sudo chown ubuntu:ubuntu /opt/webapp"
    ]
  }

  provisioner "file" {
    source      = "../../webapp/"
    destination = "/opt/webapp"
  }



  provisioner "shell" {

    script = "setup.sh"
    environment_vars = [
      "DB_NAME=${var.DB_NAME}",
      "DB_USER=${var.DB_USER}",
      "DB_PASSWORD=${var.DB_PASSWORD}"
    ]
  }
}