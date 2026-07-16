# 🚀 Ansible EC2 Project — Full DevOps Automation

> **A production-ready Ansible project covering all 5 parts: Setup → Deployment → Security → Networking → Automation**

---

## 📋 Table of Contents

- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [Part 1: Setup](#part-1-setup)
- [Part 2: Deployment](#part-2-deployment)
- [Part 3: Security](#part-3-security)
- [Part 4: Networking](#part-4-networking)
- [Part 5: Automation](#part-5-automation)
- [Variables Reference](#variables-reference)
- [Tags Reference](#tags-reference)
- [Ansible Vault](#ansible-vault)
- [Troubleshooting](#troubleshooting)

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     CONTROL NODE                            │
│                   IP: 3.7.65.72                             │
│              (Ansible runs from here)                       │
└────────────────────────┬────────────────────────────────────┘
                         │ SSH (ansible_ec2.pem)
          ┌──────────────┼──────────────┐
          │              │              │
          ▼              ▼              ▼
  ┌───────────┐  ┌───────────┐  ┌───────────┐
  │   web1    │  │   web2    │  │   web3    │
  │43.205.125.│  │3.110.87.  │  │52.66.238. │
  │  233      │  │  247      │  │  174      │
  │           │  │           │  │           │
  │ ┌───────┐ │  │ ┌───────┐ │  │ ┌───────┐ │
  │ │ Nginx │ │  │ │ Nginx │ │  │ │ Nginx │ │
  │ │ :80   │ │  │ │ :80   │ │  │ │ :80   │ │
  │ └───┬───┘ │  │ └───┬───┘ │  │ └───┬───┘ │
  │     │     │  │     │     │  │     │     │
  │ ┌───▼───┐ │  │ ┌───▼───┐ │  │ ┌───▼───┐ │
  │ │Node.js│ │  │ │Node.js│ │  │ │Node.js│ │
  │ │ :3000 │ │  │ │ :3000 │ │  │ │ :3000 │ │
  │ └───────┘ │  │ └───────┘ │  │ └───────┘ │
  │           │  │           │  │           │
  │  Docker   │  │  Docker   │  │  Docker   │
  │  UFW      │  │  UFW      │  │  UFW      │
  │  fail2ban │  │  fail2ban │  │  fail2ban │
  └───────────┘  └───────────┘  └───────────┘
       (primary)   (secondary)   (secondary)
```

---

## ✅ Prerequisites

### On Your Control Node (3.7.65.72)

```bash
# Install Ansible
sudo apt update && sudo apt install -y ansible

# Verify installation
ansible --version   # should be >= 2.14

# Install required collections
ansible-galaxy collection install community.general
ansible-galaxy collection install ansible.posix
```

### SSH Key Setup

```bash
# Copy your PEM key to the control node
# From your local machine:
scp -i ansible_ec2.pem ansible_ec2.pem ubuntu@3.7.65.72:~/.ssh/

# On the control node, set correct permissions
chmod 400 ~/.ssh/ansible_ec2.pem

# Test connectivity to all web servers
ansible web -m ping
```

### Expected Output

```
web1 | SUCCESS => { "ping": "pong" }
web2 | SUCCESS => { "ping": "pong" }
web3 | SUCCESS => { "ping": "pong" }
```

---

## 📁 Project Structure

```
ansible-ec2-project/
│
├── ansible.cfg          ← Ansible configuration (SSH, logging, sudo)
├── inventory.ini        ← EC2 hosts: web1/web2/web3 + control node
├── site.yml             ← MASTER playbook (runs all 5 parts)
│
├── group_vars/
│   └── web.yml          ← Shared vars for [web] group
│
├── host_vars/
│   ├── web1.yml         ← web1-specific vars (43.205.125.233)
│   ├── web2.yml         ← web2-specific vars (3.110.87.247)
│   └── web3.yml         ← web3-specific vars (52.66.238.174)
│
├── roles/
│   ├── common/          ← Part 1: baseline (packages, user, hostname)
│   ├── docker/          ← Part 2: Docker CE installation
│   ├── nginx/           ← Part 2: Nginx reverse proxy
│   ├── nodejs/          ← Part 2: Node.js + deploy app
│   ├── firewall/        ← Part 3: UFW + fail2ban
│   └── ssh/             ← Part 3: SSH hardening + Vault secrets
│
├── templates/
│   ├── app.conf.j2      ← Nginx virtual host template
│   ├── myapp.service.j2 ← systemd unit template
│   ├── jail.local.j2    ← fail2ban config template
│   └── env.j2           ← App .env file template
│
├── files/               ← Static files (copied as-is)
│
└── myapp/
    ├── server.js        ← Express.js app
    ├── package.json
    └── package-lock.json
```

---

## ⚡ Quick Start

### Clone & Enter Project

```bash
git clone https://github.com/yourorg/ansible-ec2-project.git
cd ansible-ec2-project
```

### Run Everything (All 5 Parts)

```bash
ansible-playbook site.yml
```

### Run with Vault (for secrets)

```bash
ansible-playbook site.yml --ask-vault-pass
```

---

## 🔧 Part 1: Setup

**What it does:** Updates packages, installs essentials, sets timezone, creates `deploy` user, configures hostnames and kernel parameters.

```bash
# Run only setup
ansible-playbook site.yml --tags setup

# Run on a single host
ansible-playbook site.yml --tags setup --limit web1

# Check mode (dry-run)
ansible-playbook site.yml --tags setup --check --diff
```

**Verify:**

```bash
# Check package versions on all hosts
ansible web -m shell -a "uname -r && python3 --version && git --version"

# Check deploy user exists
ansible web -m shell -a "id deploy"
```

---

## 🚢 Part 2: Deployment

**What it does:** Installs Docker CE, Node.js 18, deploys the Express app, configures Nginx as a reverse proxy, sets up systemd service.

```bash
# Full deployment
ansible-playbook site.yml --tags deploy

# Deploy only Docker
ansible-playbook site.yml --tags docker

# Deploy only Nginx
ansible-playbook site.yml --tags nginx

# Deploy only Node.js app
ansible-playbook site.yml --tags nodejs

# Rolling deploy (one host at a time)
ansible-playbook site.yml --tags nodejs --forks 1
```

**Verify:**

```bash
# Check Docker
ansible web -m shell -a "docker --version && docker ps"

# Check Node.js
ansible web -m shell -a "node --version && npm --version"

# Check app health
ansible web -m uri -a "url=http://localhost:3000/health"

# Check Nginx
ansible web -m shell -a "nginx -t && systemctl status nginx"

# Test from control node
curl http://43.205.125.233/health
curl http://3.110.87.247/health
curl http://52.66.238.174/health
```

---

## 🔒 Part 3: Security

**What it does:** Hardens SSH (`PasswordAuthentication no`, `PermitRootLogin no`, `MaxAuthTries 3`), configures UFW firewall rules, enables fail2ban with nginx + SSH jails.

```bash
# Apply all security
ansible-playbook site.yml --tags security

# Only firewall
ansible-playbook site.yml --tags firewall

# Only SSH hardening
ansible-playbook site.yml --tags ssh
```

**Firewall Rules Applied:**

| Port | Protocol | Purpose       |
|------|----------|---------------|
| 22   | TCP      | SSH (rate-limited) |
| 80   | TCP      | HTTP          |
| 443  | TCP      | HTTPS         |
| 3000 | TCP      | Node.js App   |

**Verify:**

```bash
# UFW status
ansible web -m shell -a "ufw status verbose"

# fail2ban status
ansible web -m shell -a "fail2ban-client status"

# SSH config check
ansible web -m shell -a "sshd -T | grep -E 'permitrootlogin|passwordauthentication|maxauthtries'"
```

---

## 🌐 Part 4: Networking

**What it does:** Multi-host inventory management, host group configuration, network fact collection.

```bash
# Show networking facts for all hosts
ansible-playbook site.yml --tags networking

# Ad-hoc: show IPs
ansible web -m setup -a "filter=ansible_default_ipv4"

# Test connectivity between hosts
ansible web -m shell -a "ping -c 2 {{ hostvars['web1']['ansible_host'] }}"

# Show all group members
ansible web --list-hosts
```

**Inventory Groups:**

| Group   | Members          | IPs                              |
|---------|------------------|----------------------------------|
| `web`   | web1, web2, web3 | 43.205.125.233, 3.110.87.247, 52.66.238.174 |
| `control` | control_node  | 3.7.65.72                       |

---

## ⚙️ Part 5: Automation

**What it does:** Sets up cron jobs for daily re-runs, records deployment timestamps, supports Jenkins-triggered deployments.

```bash
# Apply automation
ansible-playbook site.yml --tags automation

# Manually trigger a deploy (simulating Jenkins)
ansible-playbook site.yml --tags deploy --extra-vars "app_version=1.2.0"
```

### Jenkins Pipeline Integration

The project ships with a production-grade [Jenkinsfile](file:///c:/Users/acer/ansible/ansible-ec2-project/Jenkinsfile).

#### Jenkins Files

| File | Purpose |
|------|---------|
| [Jenkinsfile](file:///c:/Users/acer/ansible/ansible-ec2-project/Jenkinsfile) | Declarative pipeline (all stages) |
| [jenkins/deploy.yml](file:///c:/Users/acer/ansible/ansible-ec2-project/jenkins/deploy.yml) | Rolling zero-downtime deploy playbook |
| [jenkins/rollback.yml](file:///c:/Users/acer/ansible/ansible-ec2-project/jenkins/rollback.yml) | Auto-rollback playbook on failure |
| [jenkins/backup.yml](file:///c:/Users/acer/ansible/ansible-ec2-project/jenkins/backup.yml) | Pre-deploy backup with retention |
| [jenkins/JENKINS_SETUP.md](file:///c:/Users/acer/ansible/ansible-ec2-project/jenkins/JENKINS_SETUP.md) | Full Jenkins installation & config guide |

#### Pipeline Stages

```
GitHub Push / Manual / Cron (02:00 daily)
              │
              ▼
     ┌─────────────────┐
     │  📥 Checkout    │  Pull code from Git
     └────────┬────────┘
              ▼
     ┌─────────────────┐
     │  🔍 Validate    │  ansible --syntax-check + ansible-lint
     └────────┬────────┘
              ▼
     ┌─────────────────┐
     │  📡 Ping Hosts  │  ansible web -m ping
     └────────┬────────┘
              ▼
  ┌───────────────────────────┐
  │  🚀 Deploy  (serial: 1)  │  Rolling – one host at a time
  │  web1 → web2 → web3       │
  └──────────────┬────────────┘
                 ▼
     ┌─────────────────┐
     │ 💚 Health Check │  curl http://<ip>/health
     └────────┬────────┘
              ▼
     ┌─────────────────┐
     │  🧪 Smoke Test  │  GET / and GET /health → HTTP 200
     └────────┬────────┘
              │
       ┌──────┴──────┐
     SUCCESS       FAILURE
       │               │
       ▼               ▼
  ✅ Email Sent   ⏪ Auto Rollback
                  + ❌ Email Sent
```

#### Build Parameters (Jenkins UI)

| Parameter | Options | Default | Description |
|-----------|---------|---------|-------------|
| `DEPLOY_TARGET` | web / web1 / web2 / web3 | `web` | Which hosts |
| `DEPLOY_TAGS` | deploy / nodejs / nginx / … | `deploy` | Ansible tags |
| `APP_VERSION` | any string | `latest` | Version label |
| `DRY_RUN` | true / false | `false` | Check mode |
| `SKIP_VERIFY` | true / false | `false` | Skip health check |

#### Required Jenkins Credentials

| Credential ID | Type | Value |
|---------------|------|-------|
| `ansible-ec2-pem` | SSH Private Key | Contents of `ansible_ec2.pem` |
| `ansible-vault-password` | Secret text | Ansible Vault password |
| `github-token` | Secret text | GitHub PAT for commit status |

#### Trigger Pipeline via API

```bash
# Trigger deploy to all web hosts
curl -X POST \
  "http://3.7.65.72:8080/job/ansible-ec2-deploy/buildWithParameters" \
  --user "admin:YOUR_API_TOKEN" \
  --data "DEPLOY_TARGET=web&DEPLOY_TAGS=deploy&APP_VERSION=v1.2.0"

# Trigger dry-run on web1 only
curl -X POST \
  "http://3.7.65.72:8080/job/ansible-ec2-deploy/buildWithParameters" \
  --user "admin:YOUR_API_TOKEN" \
  --data "DEPLOY_TARGET=web1&DEPLOY_TAGS=nodejs&DRY_RUN=true"
```

#### GitHub Webhook Setup

```
Payload URL : http://3.7.65.72:8080/github-webhook/
Content type: application/json
Events      : push
```

> See [jenkins/JENKINS_SETUP.md](file:///c:/Users/acer/ansible/ansible-ec2-project/jenkins/JENKINS_SETUP.md) for the full step-by-step guide.

---

## 📊 Variables Reference

| Variable              | Default           | Description                    |
|-----------------------|-------------------|--------------------------------|
| `app_name`            | `myapp`           | Application name               |
| `app_port`            | `3000`            | Node.js listening port         |
| `app_user`            | `deploy`          | System user to run the app     |
| `app_dir`             | `/opt/myapp`      | App deployment directory       |
| `nodejs_version`      | `18`              | Node.js major version          |
| `nginx_worker_processes` | `auto`         | Nginx worker count             |
| `http_port`           | `80`              | Nginx HTTP port                |
| `ssh_port`            | `22`              | SSH port                       |
| `fail2ban_maxretry`   | `5`               | Max failed login attempts      |
| `fail2ban_bantime`    | `1h`              | Duration to ban offending IP   |
| `timezone`            | `UTC`             | System timezone                |

---

## 🏷️ Tags Reference

| Tag        | What it runs                         |
|------------|--------------------------------------|
| `setup`    | common role (Part 1)                 |
| `common`   | same as `setup`                      |
| `deploy`   | docker + nodejs + nginx (Part 2)     |
| `docker`   | Docker CE only                       |
| `nginx`    | Nginx only                           |
| `nodejs`   | Node.js + app deploy only            |
| `security` | firewall + ssh (Part 3)              |
| `firewall` | UFW + fail2ban only                  |
| `ssh`      | SSH hardening only                   |
| `networking` | network facts display (Part 4)     |
| `automation` | cron + deployment tracking (Part 5)|
| `vault`    | Vault-encrypted secrets tasks only   |

---

## 🔐 Ansible Vault

### Create encrypted secrets file

```bash
# Create vault-encrypted variables file
ansible-vault create group_vars/vault.yml

# Edit existing vault file
ansible-vault edit group_vars/vault.yml

# Encrypt a single string
ansible-vault encrypt_string 'MySuperSecretKey' --name 'vault_app_secret_key'
ansible-vault encrypt_string 'MyDBpassw0rd!'    --name 'vault_db_password'
```

### vault.yml content example

```yaml
# group_vars/vault.yml  (keep this file encrypted!)
vault_app_secret_key: "MySuperSecretKey"
vault_db_password:    "MyDBpassw0rd!"
```

### Run with vault

```bash
# Interactive password prompt
ansible-playbook site.yml --ask-vault-pass

# Password from file (CI/CD)
echo "my-vault-password" > ~/.vault_pass
chmod 600 ~/.vault_pass
ansible-playbook site.yml --vault-password-file ~/.vault_pass
```

---

## 🛠️ Troubleshooting

### SSH Connection Issues

```bash
# Test SSH manually
ssh -i ~/.ssh/ansible_ec2.pem ubuntu@43.205.125.233

# Verbose ansible ping
ansible web1 -m ping -vvv

# Check key permissions (must be 400)
ls -la ~/.ssh/ansible_ec2.pem
```

### Permission Denied

```bash
# Re-run with become
ansible-playbook site.yml --become --become-method sudo
```

### Check Ansible Logs

```bash
# Logs are saved to ./ansible.log (configured in ansible.cfg)
tail -f ansible.log
```

### App Not Starting

```bash
# Check systemd service status
ansible web -m shell -a "systemctl status myapp"

# Check app logs
ansible web -m shell -a "journalctl -u myapp -n 50 --no-pager"

# Check port binding
ansible web -m shell -a "ss -tlnp | grep 3000"
```

### Nginx 502 Bad Gateway

```bash
# App might not be running
ansible web -m shell -a "systemctl restart myapp && systemctl status myapp"

# Check Nginx error log
ansible web -m shell -a "tail -20 /var/log/nginx/myapp_error.log"
```

---

## 📌 EC2 Hosts Quick Reference

| Alias  | Public IP        | Role      | Key              |
|--------|------------------|-----------|------------------|
| web1   | 43.205.125.233   | Primary   | ansible_ec2.pem  |
| web2   | 3.110.87.247     | Secondary | ansible_ec2.pem  |
| web3   | 52.66.238.174    | Secondary | ansible_ec2.pem  |
| control| 3.7.65.72        | Control   | ansible_ec2.pem  |

---

## 📝 License

MIT – Free to use, modify, and distribute.

---

> Made with ❤️ using **Ansible** | Covering all 5 parts of the DevOps curriculum
