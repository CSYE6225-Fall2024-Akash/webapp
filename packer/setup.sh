#!/bin/bash
set -e

# Update and install dependencies
sudo apt-get update
sudo apt-get upgrade -y

sudo apt install unzip -y

curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

if [ $? -eq 0 ]; then
   echo installed nodejs
else
    echo installation failed
    exit

node -version
npm --version
fi

# sudo apt install curl mysql-server -y

# sudo systemctl enable mysql
# sudo systemctl start mysql

# # MySQL secure installation and setup

# echo "DB_NAME: ${DB_NAME}"
# echo "DB_USER: ${DB_USER}"
# echo "DB_PASSWORD: ${DB_PASSWORD}"

# cat <<EOF > my.cnf
# [client]
# user=root
# password=$DB_ROOT_PASSWORD
# EOF

# sudo mysql --defaults-file=my.cnf <<EOF
# SHOW DATABASES;
# CREATE DATABASE $DB_NAME;
# CREATE USER '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASSWORD';
# GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'localhost';
# FLUSH PRIVILEGES;
# SHOW DATABASES;
# EOF

# rm -f my.cnf

# echo "MySQL installation and setup completed"

# Creating a group only if it doesn't already exist
sudo groupadd csye6225


# Creating a user with nologin shell and adding them to the group at creation
sudo useradd -m -s /sbin/nologin -g csye6225 csye6225

# Check if the user was successfully created and added to the group
id csye6225

sudo mkdir -p /opt/webapp

sudo chown -R csye6225:csye6225 /opt/webapp
sudo chmod -R 755 /opt/webapp



# Setup application
cd /opt/webapp/
sudo -u csye6225 npm install


# Create app.service file
cat << EOF | sudo tee /etc/systemd/system/app.service
[Unit]
Description=Web Application Service
After=network.target

[Service]
Type=simple
User=csye6225
Group=csye6225
WorkingDirectory=/opt/webapp/webapp
EnvironmentFile=/opt/webapp/webapp/.env
ExecStart=/usr/bin/node /opt/webapp/webapp/app.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=webapp


[Install]
WantedBy=multi-user.target
EOF

sudo chmod 644 /opt/webapp/webapp/.env
# Set correct permissions for app.service
sudo chmod 644 /etc/systemd/system/app.service

# Reload systemd to recognize the new service
sudo systemctl daemon-reload

# Enable the service to start on boot
sudo systemctl enable app.service

# Start the service
sudo systemctl start app.service

sudo systemctl status app.service

echo "Application setup completed"

