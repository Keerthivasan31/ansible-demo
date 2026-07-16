# Jenkins Setup Guide — Ansible EC2 Deployment

## Step-by-Step: Connect Jenkins to This Project

---

## 1. Install Jenkins on the Control Node (3.7.65.72)

```bash
# SSH into your control node
ssh -i ~/.ssh/ansible_ec2.pem ubuntu@3.7.65.72

# Install Java (Jenkins dependency)
sudo apt update
sudo apt install -y openjdk-17-jdk

# Add Jenkins repo
curl -fsSL https://pkg.jenkins.io/debian-stable/jenkins.io-2023.key \
  | sudo tee /usr/share/keyrings/jenkins-keyring.asc > /dev/null

echo deb [signed-by=/usr/share/keyrings/jenkins-keyring.asc] \
  https://pkg.jenkins.io/debian-stable binary/ \
  | sudo tee /etc/apt/sources.list.d/jenkins.list > /dev/null

sudo apt update
sudo apt install -y jenkins

# Start & enable
sudo systemctl start jenkins
sudo systemctl enable jenkins

# Get initial admin password
sudo cat /var/lib/jenkins/secrets/initialAdminPassword
```

Access Jenkins at: `http://3.7.65.72:8080`

---

## 2. Install Required Jenkins Plugins

Go to **Manage Jenkins → Plugins → Available** and install:

| Plugin | Purpose |
|--------|---------|
| `Pipeline` | Declarative pipeline support |
| `Git` | GitHub integration |
| `SSH Agent` | SSH key injection in pipelines |
| `AnsiColor` | Colored console output |
| `Timestamper` | Timestamps in logs |
| `Email Extension` | Rich HTML email notifications |
| `GitHub` | GitHub webhook + status API |
| `Build Timeout` | Auto-abort long builds |
| `Workspace Cleanup` | Clean workspace after build |

---

## 3. Configure Jenkins Credentials

Go to **Manage Jenkins → Credentials → System → Global credentials → Add Credential**

### 3a. SSH Key (ansible_ec2.pem)

```
Kind:        SSH Username with private key
ID:          ansible-ec2-pem
Description: Ansible EC2 PEM Key
Username:    ubuntu
Private Key: [paste contents of ansible_ec2.pem]
```

### 3b. Ansible Vault Password

```
Kind:        Secret text
ID:          ansible-vault-password
Description: Ansible Vault master password
Secret:      [your vault password]
```

### 3c. GitHub Token (for commit status)

```
Kind:        Secret text
ID:          github-token
Description: GitHub Personal Access Token
Secret:      [your GitHub PAT with repo scope]
```

---

## 4. Install Ansible on the Jenkins Agent

```bash
# On the Jenkins server / agent
sudo apt update
sudo apt install -y ansible ansible-lint

# Install extra collections
ansible-galaxy collection install community.general
ansible-galaxy collection install ansible.posix

# Verify
ansible --version
```

---

## 5. Create a Jenkins Pipeline Job

1. Go to **New Item**
2. Enter name: `ansible-ec2-deploy`
3. Select **Pipeline** → Click **OK**

### General Tab

- ✅ `GitHub project` → URL: `https://github.com/yourorg/ansible-ec2-project`
- ✅ `This project is parameterized` (auto-detected from Jenkinsfile)

### Build Triggers Tab

- ✅ `GitHub hook trigger for GITScm polling`
- ✅ `Build periodically` → Schedule: `0 2 * * *` (nightly at 2 AM)

### Pipeline Tab

```
Definition:     Pipeline script from SCM
SCM:            Git
Repository URL: https://github.com/yourorg/ansible-ec2-project.git
Credentials:    github-token
Branch:         */main
Script Path:    Jenkinsfile
```

---

## 6. Set Up GitHub Webhook

1. Go to your GitHub repo → **Settings → Webhooks → Add webhook**
2. Fill in:

```
Payload URL:  http://3.7.65.72:8080/github-webhook/
Content type: application/json
Events:       Just the push event
Active:       ✅
```

---

## 7. Pipeline Flow Diagram

```
GitHub Push / Manual / Cron Trigger
           │
           ▼
  ┌─────────────────┐
  │  📥 Checkout    │  ← Pull code from Git
  └────────┬────────┘
           ▼
  ┌─────────────────┐
  │  🔍 Validate    │  ← ansible --syntax-check + lint
  └────────┬────────┘
           ▼
  ┌─────────────────┐
  │  📡 Ping Hosts  │  ← ansible web -m ping
  └────────┬────────┘
           ▼
  ┌─────────────────────────────────────┐
  │  🚀 Deploy (rolling, serial: 1)     │
  │  ┌──────┐  ┌──────┐  ┌──────┐      │
  │  │ web1 │→ │ web2 │→ │ web3 │      │
  │  └──────┘  └──────┘  └──────┘      │
  └────────────────────┬────────────────┘
                       ▼
  ┌─────────────────┐
  │ 💚 Health Check │  ← curl /health on each IP
  └────────┬────────┘
           ▼
  ┌─────────────────┐
  │  🧪 Smoke Test  │  ← GET / and GET /health
  └────────┬────────┘
           │
    ┌──────┴──────┐
    │             │
  SUCCESS       FAILURE
    │             │
    ▼             ▼
 ✅ Email      ⏪ Rollback
 Notification  + ❌ Email
```

---

## 8. Running the Pipeline

### Manual Trigger (Jenkins UI)

1. Open `ansible-ec2-deploy` job
2. Click **Build with Parameters**
3. Set:
   - **DEPLOY_TARGET**: `web` (all) or `web1`/`web2`/`web3`
   - **DEPLOY_TAGS**: `deploy`
   - **APP_VERSION**: `v1.0.0`
   - **DRY_RUN**: `false`
4. Click **Build**

### CLI Trigger (via Jenkins API)

```bash
# Trigger with default params
curl -X POST \
  "http://3.7.65.72:8080/job/ansible-ec2-deploy/build" \
  --user "admin:your-api-token"

# Trigger with parameters
curl -X POST \
  "http://3.7.65.72:8080/job/ansible-ec2-deploy/buildWithParameters" \
  --user "admin:your-api-token" \
  --data "DEPLOY_TARGET=web1&DEPLOY_TAGS=nodejs&APP_VERSION=v1.2.0"
```

### GitHub Webhook (automatic)

Any push to `main` branch automatically triggers the pipeline.

---

## 9. Viewing Deployment Logs

```bash
# On each EC2 web server
cat /etc/ansible-last-deploy

# Expected output:
# build_number=42
# app_version=v1.2.0
# deploy_time=2026-07-16T10:30:00Z
# deployed_by=jenkins
# host=web1
```

---

## 10. Troubleshooting

| Issue | Solution |
|-------|----------|
| `ansible: command not found` | Install ansible on Jenkins agent |
| `Permission denied (publickey)` | Check credential ID matches `ansible-ec2-pem` |
| `Vault decryption failed` | Check `ansible-vault-password` credential |
| `Pipeline stuck at Ping` | Check EC2 security group allows port 22 from Jenkins IP |
| `Health check fails after deploy` | Check `journalctl -u myapp` on target host |
| `Webhook not triggering` | Verify GitHub webhook URL and Jenkins public IP |
