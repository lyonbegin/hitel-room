#/bin/sh
# Start the embedded Sandbox control plane without changing the official nginx entrypoint.
set -eu
node /srv/hitel-sandbox/server.mjs &
