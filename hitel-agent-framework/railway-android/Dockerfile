FROM ubuntu:24.04
ENV DEBIAN_FRONTEND=noninteractive ANDROID_HOME=/opt/android-sdk ANDROID_SDK_ROOT=/opt/android-sdk ANDROID_I_WANT_MY_TCG=yes
ENV PATH=/opt/android-sdk/cmdline-tools/latest/bin:/opt/android-sdk/platform-tools:/opt/android-sdk/emulator:$PATH
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl unzip openjdk-17-jdk-headless python3 libnss3 libdbus-1-3 libgl1 libpulse0 libx11-6 libxcomposite1 libxcursor1 libxi6 libxrandr2 libxtst6 libxrender1 libxkbcommon0 libfontconfig1 libasound2t64 libxcb1 libxcb-shm0 libxcb-xfixes0 libxcb-render0 libxcb-shape0 libxdamage1 libxfixes3 libxext6 libdrm2 libgbm1 && rm -rf /var/lib/apt/lists/*
RUN mkdir -p "$ANDROID_HOME/cmdline-tools" && curl -fLsS --retry 3 https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -o /tmp/tools.zip && unzip -q /tmp/tools.zip -d /tmp/android-tools && mv /tmp/android-tools/cmdline-tools "$ANDROID_HOME/cmdline-tools/latest" && rm -rf /tmp/tools.zip /tmp/android-tools
RUN yes | sdkmanager --licenses >/dev/null && sdkmanager "platform-tools" "emulator" "system-images;android-35;google_apis_playstore;x86_64"
COPY boot-probe.sh /opt/hitel/boot-probe.sh
ENTRYPOINT ["bash", "/opt/hitel/boot-probe.sh"]
