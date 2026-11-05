#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p verification/build
javac -encoding UTF-8 -d verification/build android/app/src/main/java/app/hitel/callhandofflab/CallHandoffStateMachine.java verification/CallHandoffStateMachineTest.java
java -cp verification/build CallHandoffStateMachineTest
