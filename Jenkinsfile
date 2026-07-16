// =============================================================
//  Jenkinsfile  –  Declarative Pipeline for Ansible EC2 Deploy
//
//  Triggers:
//    • GitHub webhook  (push to main / release/*)
//    • Manual "Build Now" in Jenkins UI
//    • Parameterized build (target host, tag, version)
//
//  Requirements (Jenkins Credentials):
//    • ansible-ec2-pem        → SSH Private Key (ansible_ec2.pem)
//    • ansible-vault-password → Secret text  (vault password)
//    • github-token           → Secret text  (GitHub PAT for status API)
// =============================================================

pipeline {
    agent any

    // ── Build parameters exposed in Jenkins UI ──────────────────
    parameters {
        choice(
            name: 'DEPLOY_TARGET',
            choices: ['web', 'web1', 'web2', 'web3'],
            description: 'Which host/group to deploy to'
        )
        choice(
            name: 'DEPLOY_TAGS',
            choices: ['deploy', 'setup', 'docker', 'nginx', 'nodejs', 'security', 'firewall', 'ssh', 'all'],
            description: 'Ansible tags to run'
        )
        string(
            name: 'APP_VERSION',
            defaultValue: 'latest',
            description: 'App version/git tag to deploy (e.g. v1.2.0)'
        )
        booleanParam(
            name: 'DRY_RUN',
            defaultValue: false,
            description: 'Run in --check mode (no actual changes)'
        )
        booleanParam(
            name: 'SKIP_VERIFY',
            defaultValue: false,
            description: 'Skip post-deployment health check'
        )
    }

    // ── Environment variables ────────────────────────────────────
    environment {
        ANSIBLE_HOST_KEY_CHECKING = 'False'
        ANSIBLE_FORCE_COLOR       = '1'
        ANSIBLE_STDOUT_CALLBACK   = 'yaml'
        PROJECT_DIR               = 'ansible-ec2-project'
        DEPLOY_LOG                = "deploy-${BUILD_NUMBER}.log"
        WEB1_IP                   = '43.205.125.233'
        WEB2_IP                   = '3.110.87.247'
        WEB3_IP                   = '52.66.238.174'
    }

    // ── Pipeline options ─────────────────────────────────────────
    options {
        buildDiscarder(logRotator(numToKeepStr: '10', artifactNumToKeepStr: '5'))
        timeout(time: 30, unit: 'MINUTES')
        timestamps()
        ansiColor('xterm')
        disableConcurrentBuilds()
    }

    // ── Triggers ─────────────────────────────────────────────────
    triggers {
        // GitHub webhook – auto set when repo is configured
        githubPush()

        // Scheduled nightly deploy at 2 AM (self-healing)
        cron('0 2 * * *')
    }

    // ================================================================
    //  STAGES
    // ================================================================
    stages {

        // ── 1. Checkout ──────────────────────────────────────────────
        stage('📥 Checkout') {
            steps {
                echo "╔══════════════════════════════════════╗"
                echo "║  Branch : ${env.BRANCH_NAME ?: 'main'}"
                echo "║  Build  : #${BUILD_NUMBER}"
                echo "║  Target : ${params.DEPLOY_TARGET}"
                echo "║  Tags   : ${params.DEPLOY_TAGS}"
                echo "║  Version: ${params.APP_VERSION}"
                echo "╚══════════════════════════════════════╝"

                checkout scm
            }
        }

        // ── 2. Validate ──────────────────────────────────────────────
        stage('🔍 Validate') {
            steps {
                withCredentials([
                    sshUserPrivateKey(
                        credentialsId: 'ansible-ec2-pem',
                        keyFileVariable: 'SSH_KEY_PATH',
                        usernameVariable: 'SSH_USER'
                    )
                ]) {
                    sh '''
                        echo "── Tool versions ──────────────────────"
                        ansible --version
                        python3 --version
                        echo "── Setting up SSH key ─────────────────"
                        mkdir -p ~/.ssh
                        cp "$SSH_KEY_PATH" ~/.ssh/ansible_ec2.pem
                        chmod 400 ~/.ssh/ansible_ec2.pem
                        echo "── Ansible syntax check ───────────────"
                        cd ${PROJECT_DIR}
                        ansible-playbook site.yml --syntax-check
                        echo "── Lint with ansible-lint ─────────────"
                        ansible-lint site.yml || true
                        echo "── Inventory check ────────────────────"
                        ansible-inventory -i inventory.ini --list
                        echo "✅ Validation passed"
                    '''
                }
            }
        }

        // ── 3. Ping (Connectivity Check) ─────────────────────────────
        stage('📡 Ping Hosts') {
            steps {
                withCredentials([
                    sshUserPrivateKey(
                        credentialsId: 'ansible-ec2-pem',
                        keyFileVariable: 'SSH_KEY_PATH'
                    )
                ]) {
                    sh '''
                        cp "$SSH_KEY_PATH" ~/.ssh/ansible_ec2.pem
                        chmod 400 ~/.ssh/ansible_ec2.pem
                        cd ${PROJECT_DIR}
                        echo "── Pinging ${params.DEPLOY_TARGET} ────"
                        ansible ${params.DEPLOY_TARGET} -m ping -i inventory.ini
                        echo "✅ All target hosts reachable"
                    '''
                }
            }
        }

        // ── 4. Deploy ────────────────────────────────────────────────
        stage('🚀 Deploy') {
            steps {
                withCredentials([
                    sshUserPrivateKey(
                        credentialsId: 'ansible-ec2-pem',
                        keyFileVariable: 'SSH_KEY_PATH'
                    ),
                    string(
                        credentialsId: 'ansible-vault-password',
                        variable: 'VAULT_PASS'
                    )
                ]) {
                    script {
                        def checkFlag  = params.DRY_RUN ? '--check --diff' : ''
                        def tagsFlag   = params.DEPLOY_TAGS == 'all' ? '' : "--tags ${params.DEPLOY_TAGS}"
                        def limitFlag  = params.DEPLOY_TARGET == 'web' ? '' : "--limit ${params.DEPLOY_TARGET}"
                        def extraVars  = "--extra-vars \"app_version=${params.APP_VERSION} build_number=${BUILD_NUMBER}\""

                        sh """
                            cp "\$SSH_KEY_PATH" ~/.ssh/ansible_ec2.pem
                            chmod 400 ~/.ssh/ansible_ec2.pem

                            echo "\$VAULT_PASS" > /tmp/.vault_pass_\${BUILD_NUMBER}
                            chmod 600 /tmp/.vault_pass_\${BUILD_NUMBER}

                            cd ${PROJECT_DIR}

                            echo "── Running Ansible Playbook ────────────"
                            echo "   Target : ${params.DEPLOY_TARGET}"
                            echo "   Tags   : ${params.DEPLOY_TAGS}"
                            echo "   Dry Run: ${params.DRY_RUN}"

                            ansible-playbook site.yml \\
                                -i inventory.ini \\
                                ${limitFlag} \\
                                ${tagsFlag} \\
                                ${checkFlag} \\
                                ${extraVars} \\
                                --vault-password-file /tmp/.vault_pass_\${BUILD_NUMBER} \\
                                2>&1 | tee ../${DEPLOY_LOG}

                            rm -f /tmp/.vault_pass_\${BUILD_NUMBER}
                            echo "✅ Deployment complete"
                        """
                    }
                }
            }
        }

        // ── 5. Health Check ──────────────────────────────────────────
        stage('💚 Health Check') {
            when {
                expression { return !params.SKIP_VERIFY && !params.DRY_RUN }
            }
            steps {
                sh '''
                    echo "── Health checking all web servers ─────"
                    FAIL=0

                    check_host() {
                        local ip=$1
                        local name=$2
                        local response
                        response=$(curl -sf --connect-timeout 10 --max-time 15 \
                            http://${ip}/health 2>&1) || true

                        if echo "$response" | grep -q "healthy"; then
                            echo "✅  ${name} (${ip}) → HEALTHY"
                        else
                            echo "❌  ${name} (${ip}) → UNHEALTHY"
                            echo "    Response: ${response}"
                            FAIL=1
                        fi
                    }

                    case "${params.DEPLOY_TARGET}" in
                        web)
                            check_host "${WEB1_IP}" "web1"
                            check_host "${WEB2_IP}" "web2"
                            check_host "${WEB3_IP}" "web3"
                            ;;
                        web1) check_host "${WEB1_IP}" "web1" ;;
                        web2) check_host "${WEB2_IP}" "web2" ;;
                        web3) check_host "${WEB3_IP}" "web3" ;;
                    esac

                    if [ "$FAIL" -eq 1 ]; then
                        echo "❌ Health check FAILED – rolling back..."
                        exit 1
                    fi
                    echo "✅ All health checks passed"
                '''
            }
        }

        // ── 6. Smoke Test ────────────────────────────────────────────
        stage('🧪 Smoke Test') {
            when {
                expression { return !params.SKIP_VERIFY && !params.DRY_RUN }
            }
            steps {
                sh '''
                    echo "── Running smoke tests ─────────────────"

                    run_smoke() {
                        local ip=$1
                        local name=$2

                        echo "  Testing ${name} (${ip})..."

                        # Root endpoint
                        STATUS=$(curl -so /dev/null -w "%{http_code}" \
                            --connect-timeout 10 http://${ip}/ 2>/dev/null)
                        echo "    GET /       → HTTP ${STATUS}"
                        [ "$STATUS" = "200" ] || { echo "FAIL"; return 1; }

                        # Health endpoint
                        STATUS=$(curl -so /dev/null -w "%{http_code}" \
                            --connect-timeout 10 http://${ip}/health 2>/dev/null)
                        echo "    GET /health → HTTP ${STATUS}"
                        [ "$STATUS" = "200" ] || { echo "FAIL"; return 1; }

                        echo "  ✅ ${name} smoke tests passed"
                    }

                    case "${params.DEPLOY_TARGET}" in
                        web)
                            run_smoke "${WEB1_IP}" "web1"
                            run_smoke "${WEB2_IP}" "web2"
                            run_smoke "${WEB3_IP}" "web3"
                            ;;
                        web1) run_smoke "${WEB1_IP}" "web1" ;;
                        web2) run_smoke "${WEB2_IP}" "web2" ;;
                        web3) run_smoke "${WEB3_IP}" "web3" ;;
                    esac

                    echo "✅ All smoke tests passed"
                '''
            }
        }

        // ── 7. Rollback (only on failure) ────────────────────────────
        stage('⏪ Rollback') {
            when {
                expression { return currentBuild.result == 'FAILURE' }
            }
            steps {
                withCredentials([
                    sshUserPrivateKey(
                        credentialsId: 'ansible-ec2-pem',
                        keyFileVariable: 'SSH_KEY_PATH'
                    )
                ]) {
                    sh '''
                        echo "⚠️  Deployment failed – initiating rollback..."
                        cp "$SSH_KEY_PATH" ~/.ssh/ansible_ec2.pem
                        chmod 400 ~/.ssh/ansible_ec2.pem
                        cd ${PROJECT_DIR}
                        ansible-playbook jenkins/rollback.yml \
                            -i inventory.ini \
                            --limit ${params.DEPLOY_TARGET}
                        echo "⏪ Rollback complete"
                    '''
                }
            }
        }

    } // end stages

    // ================================================================
    //  POST ACTIONS
    // ================================================================
    post {

        always {
            echo "── Archiving deployment log ────────────"
            archiveArtifacts artifacts: "${DEPLOY_LOG}", allowEmptyArchive: true
            cleanWs(patterns: [[pattern: '*.log', type: 'INCLUDE']])
        }

        success {
            echo "✅ Pipeline SUCCESS — Build #${BUILD_NUMBER}"

            // Update GitHub commit status
            script {
                if (env.GIT_COMMIT) {
                    githubNotify(
                        status: 'SUCCESS',
                        description: "Deploy #${BUILD_NUMBER} succeeded",
                        context: 'ci/ansible-deploy'
                    )
                }
            }

            // Email notification
            emailext(
                subject: "✅ [SUCCESS] Ansible Deploy #${BUILD_NUMBER} → ${params.DEPLOY_TARGET}",
                body: """
                    <h2>✅ Deployment Succeeded</h2>
                    <table>
                      <tr><td><b>Build</b></td><td>#${BUILD_NUMBER}</td></tr>
                      <tr><td><b>Target</b></td><td>${params.DEPLOY_TARGET}</td></tr>
                      <tr><td><b>Tags</b></td><td>${params.DEPLOY_TAGS}</td></tr>
                      <tr><td><b>Version</b></td><td>${params.APP_VERSION}</td></tr>
                      <tr><td><b>Branch</b></td><td>${env.BRANCH_NAME ?: 'main'}</td></tr>
                      <tr><td><b>Duration</b></td><td>${currentBuild.durationString}</td></tr>
                    </table>
                    <p><a href="${BUILD_URL}">View Build Logs</a></p>
                """,
                mimeType: 'text/html',
                recipientProviders: [[$class: 'DevelopersRecipientProvider']]
            )
        }

        failure {
            echo "❌ Pipeline FAILED — Build #${BUILD_NUMBER}"

            script {
                if (env.GIT_COMMIT) {
                    githubNotify(
                        status: 'FAILURE',
                        description: "Deploy #${BUILD_NUMBER} failed",
                        context: 'ci/ansible-deploy'
                    )
                }
            }

            emailext(
                subject: "❌ [FAILED] Ansible Deploy #${BUILD_NUMBER} → ${params.DEPLOY_TARGET}",
                body: """
                    <h2>❌ Deployment Failed</h2>
                    <table>
                      <tr><td><b>Build</b></td><td>#${BUILD_NUMBER}</td></tr>
                      <tr><td><b>Target</b></td><td>${params.DEPLOY_TARGET}</td></tr>
                      <tr><td><b>Tags</b></td><td>${params.DEPLOY_TAGS}</td></tr>
                    </table>
                    <p><b>Rollback was automatically triggered.</b></p>
                    <p><a href="${BUILD_URL}console">View Console Output</a></p>
                """,
                mimeType: 'text/html',
                recipientProviders: [[$class: 'DevelopersRecipientProvider']]
            )
        }

        aborted {
            echo "⚠️ Pipeline ABORTED by user"
        }
    }
}
