
pipeline {
    agent any

   environment {
    PATH = "/usr/local/bin:${env.PATH}"

    JMETER_IMAGE = 'justb4/jmeter:5.6.3'
    TEST_PLAN = 'test-plans/DemoBlaze.jmx'
    RESULTS_DIR = 'reports'
}

    options {
        timestamps()
        disableConcurrentBuilds()
    }

    stages {

        // 1. Checkout source code from GitHub
        stage('Checkout') {
            steps {
                echo 'Checking out JMeter performance project'
                checkout scm
            }
        }

        // 2. Verify Docker installation
        stage('Verify Docker') {
            steps {
                sh '''
                    echo "Checking Docker installation..."
                    docker --version
                    docker info
                '''
            }
        }

        // 3. Download JMeter Docker image
        stage('Prepare JMeter Environment') {
            steps {
                sh '''
                    echo "Pulling JMeter Docker image..."
                    docker pull ${JMETER_IMAGE}
                '''
            }
        }

        // 4. Prepare report directory
        stage('Prepare Reports') {
            steps {
                sh '''
                    mkdir -p ${RESULTS_DIR}
                    rm -rf ${RESULTS_DIR}/html
                    rm -f ${RESULTS_DIR}/results.jtl

                    echo "Report directory prepared"
                '''
            }
        }

        // 5. Execute JMeter test in non-GUI mode
        stage('Run DemoBlaze Test') {
            steps {
                sh '''
                    echo "Starting DemoBlaze performance test..."

                    docker run --rm \
                        -v "$WORKSPACE:/work" \
                        -w /work \
                        ${JMETER_IMAGE} \
                        -n \
                        -t ${TEST_PLAN} \
                        -l ${RESULTS_DIR}/results.jtl \
                        -e \
                        -o ${RESULTS_DIR}/html \
                        -Jjmeter.save.saveservice.print_field_names=true

                    echo "JMeter execution completed"
                '''
            }
        }

        // 6. Validate test results
        stage('Validate Test Results') {
            steps {
                sh '''
                    echo "Validating JMeter results..."

                    if [ ! -s ${RESULTS_DIR}/results.jtl ]; then
                        echo "ERROR: JTL results file is missing or empty"
                        exit 1
                    fi

                    echo "JTL results generated successfully"

                    awk -F, '
                        NR > 1 && $8 == "false" {
                            failures++
                        }
                        END {
                            printf "Failed samples: %d\\n", failures
                            if (failures > 0) exit 1
                        }
                    ' ${RESULTS_DIR}/results.jtl
                '''
            }
        }
    }

    // 7. Archive reports in Jenkins
    post {
        always {
            echo 'Archiving JMeter performance reports...'

            archiveArtifacts(
                artifacts: 'reports/**',
                allowEmptyArchive: true
            )
        }

        success {
            echo 'JMeter performance test PASSED'
        }

        failure {
            echo 'JMeter performance test FAILED'
        }

        cleanup {
            echo 'Pipeline execution completed'
        }
    }
}
