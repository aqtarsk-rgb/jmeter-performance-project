
pipeline {
    agent any

    environment {
        PATH = "/usr/local/bin:${env.PATH}"
        JMETER_IMAGE = 'alpine/jmeter:5.6.3'
        RESULTS_DIR = 'reports'
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Verify Docker') {
            steps {
                sh '''
                    echo "Checking Docker..."
                    docker --version
                    docker info
                '''
            }
        }

        stage('Prepare JMeter Environment') {
            steps {
                sh '''
                    echo "Pulling JMeter Docker image..."
                    docker pull "$JMETER_IMAGE"
                '''
            }
        }

        stage('Prepare Reports') {
            steps {
                sh '''
                    mkdir -p "$RESULTS_DIR"
                    rm -rf "$RESULTS_DIR"/*
                '''
            }
        }

        stage('Run JMeter Tests') {
            steps {
                script {

                    // Add or remove JMX files here.
                    // All test plans run sequentially.

                    def testPlans = [
                        'test-plans/Demo1.jmx'

                        // Add more plans like this:
                        // 'test-plans/DemoBlaze.jmx',
                        // 'test-plans/Demoblaze_LoadTest_2.jmx'
                    ]

                    if (testPlans.isEmpty()) {
                        error('No JMeter test plans configured.')
                    }

                    echo "Total JMX test plans: ${testPlans.size()}"

                    def failedPlans = []

                    for (int i = 0; i < testPlans.size(); i++) {

                        def plan = testPlans[i]
                        def testName = plan.tokenize('/').last()
                                              .replace('.jmx', '')

                        def jtlPath = "${RESULTS_DIR}/${testName}.jtl"
                        def htmlPath = "${RESULTS_DIR}/${testName}-html"

                        echo "========================================"
                        echo "Running test plan: ${plan}"
                        echo "========================================"

                        if (!fileExists(plan)) {
                            error("JMX file not found: ${plan}")
                        }

                        // Execute JMeter test
                        int executionStatus = 0

                        withEnv([
                            "TEST_PLAN=${plan}",
                            "JTL_PATH=${jtlPath}"
                        ]) {
                            executionStatus = sh(
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
                                returnStatus: true
                            )
                        }

                        if (executionStatus != 0) {
                            echo "JMeter execution failed: ${plan}"
                            failedPlans.add(plan)
                            continue
                        }

                        // Validate JTL results
                        if (!fileExists(jtlPath)) {
                            echo "JTL result file missing: ${jtlPath}"
                            failedPlans.add(plan)
                            continue
                        }

                        int totalSamples = 0
                        int failedSamples = 0

                        withEnv(["JTL_PATH=${jtlPath}"]) {

                            totalSamples = sh(
                                script: '''
                                    awk 'END { print (NR > 0 ? NR - 1 : 0) }' \
                                        "$JTL_PATH"
                                ''',
                                returnStdout: true
                            ).trim().toInteger()

                            failedSamples = sh(
                                script: '''
                                    awk -F, '
                                        NR == 1 {
                                            for (i = 1; i <= NF; i++) {
                                                if ($i == "success") {
                                                    successColumn = i
                                                }
                                            }
                                            next
                                        }
                                        successColumn > 0 &&
                                        $successColumn == "false" {
                                            count++
                                        }
                                        END { print count+0 }
                                    ' "$JTL_PATH"
                                ''',
                                returnStdout: true
                            ).trim().toInteger()
                        }

                        echo "Test plan: ${plan}"
                        echo "Total samples: ${totalSamples}"
                        echo "Failed samples: ${failedSamples}"

                        // Generate HTML dashboard
                        int reportStatus = 0

                        withEnv([
                            "JTL_PATH=${jtlPath}",
                            "HTML_PATH=${htmlPath}"
                        ]) {
                            reportStatus = sh(
                                script: '''
                                    docker run --rm \
                                        -v "$WORKSPACE:/work" \
                                        -w /work \
                                        "$JMETER_IMAGE" \
                                        -g "$JTL_PATH" \
                                        -o "$HTML_PATH"
                                ''',
                                returnStatus: true
                            )
                        }

                        if (reportStatus != 0) {
                            echo "HTML report generation failed: ${plan}"
                            failedPlans.add(plan)
                            continue
                        }

                        if (failedSamples > 0) {
                            echo "Test plan has failed samples: ${plan}"
                            failedPlans.add(plan)
                        } else {
                            echo "Test plan passed: ${plan}"
                        }
                    }

                    // Final pipeline validation
                    echo "========================================"
                    echo "FINAL TEST SUMMARY"
                    echo "========================================"

                    if (failedPlans.isEmpty()) {
                        echo "All JMeter test plans completed successfully."
                    } else {
                        echo "Failed test plans:"
                        failedPlans.each { plan ->
                            echo " - ${plan}"
                        }

                        error("One or more JMeter test plans failed.")
                    }
                }
            }
        }
    }

    post {
        always {
            echo 'Archiving JMeter reports...'

            archiveArtifacts(
                artifacts: 'reports/**',
                allowEmptyArchive: true,
                fingerprint: true
            )
        }

        success {
            echo 'JMeter pipeline completed successfully.'
        }

        failure {
            echo 'JMeter pipeline failed. Check the console output.'
        }
    }
}
