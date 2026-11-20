
FROM alpine/jmeter:5.6.3

ENV JMETER_HOME=/opt/apache-jmeter-5.6.3

# Install JMeter Plugins Manager
RUN wget -q -O "$JMETER_HOME/lib/ext/jmeter-plugins-manager-2.0.jar" \
    https://repo1.maven.org/maven2/kg/apc/jmeter-plugins-manager/2.0/jmeter-plugins-manager-2.0.jar

# Install command-line runner required by Plugins Manager
RUN wget -q -O "$JMETER_HOME/lib/cmdrunner-2.3.jar" \
    https://repo1.maven.org/maven2/kg/apc/cmdrunner/2.3/cmdrunner-2.3.jar

# Create Plugins Manager command-line script and install Custom Thread Groups
RUN java -cp "$JMETER_HOME/lib/ext/jmeter-plugins-manager-2.0.jar" \
    org.jmeterplugins.repository.PluginManagerCMDInstaller \
    && "$JMETER_HOME/bin/PluginsManagerCMD.sh" install jpgc-casutg

# Verify plugin installation
RUN find "$JMETER_HOME" -iname '*casutg*.jar' | grep .
