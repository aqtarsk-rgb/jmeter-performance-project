pipeline {
    agent any

    stages {
        stage('Checkout') {
            steps {
                echo 'JMeter Performance Testing Pipeline'
                echo 'Checking out source code'
                checkout scm
            }
        }

        stage('Verify JMeter') {
            steps {
                sh 'jmeter -v'
            }
        }
    }
}