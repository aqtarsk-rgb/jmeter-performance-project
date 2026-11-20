
pipeline {
    agent any

    environment {
        PATH = "/usr/local/bin:${env.PATH}"

        JMETER_IMAGE = 'alpine/jmeter:5.6.3'
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
                    echo "Preparing report directory..."

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

            # Check whether JTL file exists
            if [ ! -s ${RESULTS_DIR}/results.jtl ]; then
                echo "ERROR: JTL results file is missing or empty"
                exit 1
            fi

            echo "JTL results file found"

            # Count total executed samples
            TOTAL_SAMPLES=$(awk -F, '
                NR > 1 {
                    count++
                }
                END {
                    print count+0
                }
            ' ${RESULTS_DIR}/results.jtl)

            echo "Total samples: $TOTAL_SAMPLES"

            # Fail if zero requests were executed
            if [ "$TOTAL_SAMPLES" -eq 0 ]; then
                echo "ERROR: JMeter executed zero requests"
                exit 1
            fi

            # Count failed samples
            FAILURES=$(awk -F, '
                NR > 1 && $8 == "false" {
                    count++
                }
                END {
                    print count+0
                }
            ' ${RESULTS_DIR}/results.jtl)

            echo "Failed samples: $FAILURES"

            # Fail if requests failed
            if [ "$FAILURES" -gt 0 ]; then
                echo "ERROR: Performance test failures detected"
                exit 1
            fi

            echo "JMeter results validated successfully"
        '''
    }
}
        // 7. Generate HTML performance dashboard
        stage('Generate HTML Report') {
            steps {
                sh '''
                    echo "Generating JMeter HTML dashboard..."

                    docker run --rm \
                        -v "$WORKSPACE:/work" \
                        -w /work \
                        ${JMETER_IMAGE} \
                        -g ${RESULTS_DIR}/results.jtl \
                        -o ${RESULTS_DIR}/html

                    echo "HTML dashboard generated successfully"
                '''
            }
        }
    }

    // 8. Archive reports in Jenkins
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
            echo 'JTL results and HTML dashboard generated successfully'
        }

        failure {
            echo 'JMeter performance test FAILED'
            echo 'Please check the Jenkins console output'
        }

        cleanup {
            echo 'Pipeline execution completed'
        }
    }
}
