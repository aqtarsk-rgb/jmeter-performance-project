
pipeline {
    agent any

    environment {
        PATH = "/usr/local/bin:${env.PATH}"

        JMETER_IMAGE = 'alpine/jmeter:5.6.3'
        RESULTS_DIR = 'reports'
    }

    options {
        timestamps()
        disableConcurrentBuilds()
    }

    stages {

        // 1. Checkout source code
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

        // 3. Pull JMeter Docker image
        stage('Prepare JMeter Environment') {
            steps {
                sh '''
                    echo "Pulling JMeter Docker image..."
                    docker pull ${JMETER_IMAGE}
                '''
            }
        }

        // 4. Configure multiple JMX files
        stage('Prepare Reports') {
            steps {
                sh '''
                    echo "Preparing report directories..."

                    rm -rf "${RESULTS_DIR}"
                    mkdir -p "${RESULTS_DIR}"

                    echo "Report directory prepared"
                '''
            }
        }

        // 5. Execute all JMX files sequentially
        stage('Run Multiple JMeter Tests') {
            steps {
                script {

                    // Add or remove JMX files here
                    def testPlans = [
                        'test-plans/DemoBlaze.jmx',
                        'test-plans/Demoblaze_LoadTest_2.jmx'

                        // Add more test plans:
                        // 'test-plans/LoadTest.jmx',
                        // 'test-plans/CorrelationTest.jmx',
                        // 'test-plans/RecordingTest.jmx'
                    ]

                    def failedTests = []

                    for (plan in testPlans) {

                        def testName = plan.tokenize('/').last()
                            .replaceAll(/\.jmx$/, '')

                        echo "===================================="
                        echo "Starting JMeter test: ${plan}"
                        echo "===================================="

                        def jtlPath = "${env.RESULTS_DIR}/${testName}/results.jtl"

                        sh "mkdir -p '${env.RESULTS_DIR}/${testName}'"

                        // Verify that the JMX file exists
                        if (!fileExists(plan)) {
                            echo "ERROR: JMX file not found: ${plan}"
                            failedTests.add(plan)
                            continue
                        }

                        // Execute JMeter test
                        int executionStatus = sh(
                            script: """
                                docker run --rm \
                                    -v "\$WORKSPACE:/work" \
                                    -w /work \
                                    "\$JMETER_IMAGE" \
                                    -n \
                                    -t "${plan}" \
                                    -l "${jtlPath}" \
                                    -Jjmeter.save.saveservice.print_field_names=true
                            """,
                            returnStatus: true
                        )

                        if (executionStatus != 0) {
                            echo "ERROR: JMeter execution failed: ${plan}"
                            failedTests.add(plan)
                        } else {
                            echo "JMeter execution completed: ${plan}"
                        }
                    }
                }
            }
        }

        // 6. Validate results and generate HTML reports
        stage('Validate Results and Generate Reports') {
            steps {
                script {

                    def testPlans = [
                        'test-plans/DemoBlaze.jmx',
                        'test-plans/Demoblaze_LoadTest_2.jmx'

                        // Keep this list identical to the execution list
                    ]

                    def failedTests = []

                    for (plan in testPlans) {

                        def testName = plan.tokenize('/').last()
                            .replaceAll(/\.jmx$/, '')

                        def jtlPath = "${env.RESULTS_DIR}/${testName}/results.jtl"
                        def htmlPath = "${env.RESULTS_DIR}/${testName}/html"

                        echo "Validating results for ${testName}"

                        if (!fileExists(jtlPath) ||
                            sh(
                                script: "test -s '${jtlPath}'",
                                returnStatus: true
                            ) != 0) {

                            echo "ERROR: Missing or empty JTL file: ${jtlPath}"
                            failedTests.add(plan)
                            continue
                        }

                        // Count samples and failures
                        def totalSamples = sh(
                            script: """
                                awk -F, 'NR > 1 { count++ }
                                END { print count+0 }' '${jtlPath}'
                            """,
                            returnStdout: true
                        ).trim().toInteger()

                        def failures = sh(
                            script: """
                                awk -F, 'NR > 1 && \$8 == "false" { count++ }
                                END { print count+0 }' '${jtlPath}'
                            """,
                            returnStdout: true
                        ).trim().toInteger()

                        echo "Test: ${testName}"
                        echo "Total samples: ${totalSamples}"
                        echo "Failed samples: ${failures}"

                        if (totalSamples == 0) {
                            echo "ERROR: No samples executed"
                            failedTests.add(plan)
                            continue
                        }

                        if (failures > 0) {
                            echo "ERROR: Failed HTTP samples detected"
                            failedTests.add(plan)
                        }

                        // Generate HTML dashboard
                        int reportStatus = sh(
                            script: """
                                docker run --rm \
                                    -v "\$WORKSPACE:/work" \
                                    -w /work \
                                    "\$JMETER_IMAGE" \
                                    -g "${jtlPath}" \
                                    -o "${htmlPath}"
                            """,
                            returnStatus: true
                        )

                        if (reportStatus != 0) {
                            echo "ERROR: HTML report generation failed for ${testName}"
                            failedTests.add("${plan} (HTML report)")
                        } else {
                            echo "HTML report generated: ${htmlPath}/index.html"
                        }
                    }

                    // Final validation
                    if (failedTests) {
                        echo "Failed tests: ${failedTests.join(', ')}"
                        error("One or more JMeter tests or reports failed.")
                    }

                    echo "All JMeter tests passed validation."
                }
            }
        }
    }

    // 7. Archive reports
    post {

        always {
            echo 'Archiving JMeter performance reports...'

            archiveArtifacts(
                artifacts: 'reports/**',
                allowEmptyArchive: true
            )
        }

        success {
            echo 'All JMeter performance tests PASSED.'
            echo 'All JTL results and HTML dashboards generated.'
        }

        failure {
            echo 'One or more JMeter performance tests FAILED.'
            echo 'Please check the Jenkins Console Output.'
        }

        cleanup {
            echo 'Pipeline execution completed.'
        }
    }
}
