
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

        // 2. Verify Docker
        stage('Verify Docker') {
            steps {
                sh '''
                    echo "Checking Docker installation..."
                    docker --version
                    docker info
                '''
            }
        }

        // 3. Pull JMeter image
        stage('Prepare JMeter Environment') {
            steps {
                sh '''
                    echo "Pulling JMeter Docker image..."
                    docker pull ${JMETER_IMAGE}
                '''
            }
        }

        // 4. Prepare reports
        stage('Prepare Reports') {
            steps {
                sh '''
                    echo "Preparing reports directory..."
                    rm -rf "${RESULTS_DIR}"
                    mkdir -p "${RESULTS_DIR}"
                '''
            }
        }

        // 5. Execute, validate and report all JMX files
        stage('Run JMeter Tests') {
            steps {
                script {

                    // =====================================
                    // ADD OR REMOVE JMX FILES HERE ONLY
                    // =====================================

                    def testPlans = [
                        'test-plans/Demo1.jmx'

                        // To run multiple JMX files, add:
                        // 'test-plans/Demoblaze_LoadTest_2.jmx',
                        // 'test-plans/LoadTest.jmx',
                        // 'test-plans/StressTest.jmx'
                    ]

                    def failedTests = []

                    echo "Total JMX test plans: ${testPlans.size()}"

                    for (plan in testPlans) {

                        def testName = plan.tokenize('/').last()
                            .replaceAll(/\.jmx$/, '')

                        def jtlPath =
                            "${env.RESULTS_DIR}/${testName}/results.jtl"

                        def htmlPath =
                            "${env.RESULTS_DIR}/${testName}/html"

                        echo "======================================"
                        echo "Starting test: ${plan}"
                        echo "======================================"

                        if (!fileExists(plan)) {
                            echo "ERROR: JMX file not found: ${plan}"
                            failedTests.add(plan)
                            continue
                        }

                        sh "mkdir -p '${env.RESULTS_DIR}/${testName}'"

                        // Execute JMeter
                        int executionStatus = sh(
                            script: '''
                                docker run --rm \
                                    -v "$WORKSPACE:/work" \
                                    -w /work \
                                    "$JMETER_IMAGE" \
                                    -n \
                                    -t "$TEST_PLAN" \
                                    -l "$JTL_PATH" \
                                    -Jjmeter.save.saveservice.print_field_names=true
                            ''',
                            returnStatus: true,
                            environment: [
                                "TEST_PLAN=${plan}",
                                "JTL_PATH=${jtlPath}"
                            ]
                        )

                        if (executionStatus != 0) {
                            echo "ERROR: JMeter execution failed: ${plan}"
                            failedTests.add(plan)
                            continue
                        }

                        echo "JMeter execution completed: ${plan}"

                        // Check JTL file
                        if (!fileExists(jtlPath) ||
                            sh(
                                script: "test -s '${jtlPath}'",
                                returnStatus: true
                            ) != 0) {

                            echo "ERROR: JTL file missing or empty: ${jtlPath}"
                            failedTests.add(plan)
                            continue
                        }

                        // Count total samples
                        def totalSamples = sh(
                            script: """
                                awk -F, 'NR > 1 { count++ }
                                END { print count+0 }' '${jtlPath}'
                            """,
                            returnStdout: true
                        ).trim().toInteger()

                        // Count failed samples
                        def failures = sh(
                            script: """
                                awk -F, 'NR > 1 && \$8 == "false" { count++ }
                                END { print count+0 }' '${jtlPath}'
                            """,
                            returnStdout: true
                        ).trim().toInteger()


                        echo "Test name: ${testName}"
                        echo "Total samples: ${totalSamples}"
                        echo "Failed samples: ${failures}"

                        if (totalSamples == 0) {
                            echo "ERROR: Zero samples executed"
                            failedTests.add(plan)
                            continue
                        }

                        if (failures > 0) {
                            echo "ERROR: Failed HTTP samples detected"
                            failedTests.add(plan)
                        }

                        // Generate HTML dashboard
                        int reportStatus = sh(
                            script: '''
                                docker run --rm \
                                    -v "$WORKSPACE:/work" \
                                    -w /work \
                                    "$JMETER_IMAGE" \
                                    -g "$JTL_PATH" \
                                    -o "$HTML_PATH"
                            ''',
                            returnStatus: true,
                            environment: [
                                "JTL_PATH=${jtlPath}",
                                "HTML_PATH=${htmlPath}"
                            ]
                        )

                        if (reportStatus != 0) {
                            echo "ERROR: HTML report generation failed"
                            failedTests.add("${plan} (HTML report)")
                        } else {
                            echo "HTML report generated: ${htmlPath}/index.html"
                        }

                        echo "Completed test: ${plan}"
                    }

                    // Final pipeline status
                    echo "======================================"
                    echo "ALL JMX EXECUTIONS COMPLETED"
                    echo "======================================"

                    if (failedTests) {
                        echo "Failed tests: ${failedTests.join(', ')}"
                        error("One or more JMeter tests failed.")
                    }

                    echo "All JMeter tests passed validation."
                }
            }
        }
    }

    // 6. Archive reports
    post {

        always {
            echo 'Archiving JMeter reports...'

            archiveArtifacts(
                artifacts: 'reports/**',
                allowEmptyArchive: true
            )
        }

        success {
            echo 'All JMeter performance tests PASSED.'
            echo 'JTL files and HTML dashboards generated.'
        }

        failure {
            echo 'One or more JMeter tests FAILED.'
            echo 'Check Jenkins Console Output.'
        }

        cleanup {
            echo 'Pipeline execution completed.'
        }
    }
}
