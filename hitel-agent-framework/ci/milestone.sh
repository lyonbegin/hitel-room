#!/usr/bin/env bash
set -Eeuo pipefail
stage="${1:?stage required}"
state="${2:-success}"
case "$state" in started|success|failure|cancelled|skipped|blocked) ;; *) exit 2;; esac
run_url="https://github.com/${GITHUB_REPOSITORY:-lyonbegin/hitel-room}/actions/runs/${GITHUB_RUN_ID:-0}"
printf '::notice title=HITEL milestone::%s — %s\n' "$stage" "$state"
if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  printf '\n- **%s** — %s (%s UTC) — [run](%s)\n' "$stage" "$state" "$(date -u +%FT%T)" "$run_url" >> "$GITHUB_STEP_SUMMARY"
fi
# Optional HTTPS receiver; no credentials, logs, screenshots, or mission text are sent.
# Not a ChatGPT endpoint unless a supported incoming integration is actually configured.
if [[ "${HITEL_MILESTONE_WEBHOOK:-}" == https://* ]]; then
  payload="$(python3 -c 'import json,os,sys; print(json.dumps({"event":"hitel.milestone","stage":sys.argv[1],"status":sys.argv[2],"run_url":sys.argv[3],"sha":os.getenv("GITHUB_SHA"),"run_attempt":os.getenv("GITHUB_RUN_ATTEMPT"),"job":os.getenv("GITHUB_JOB")}))' "$stage" "$state" "$run_url")"
  if ! curl -fsS --max-time 10 --retry 1 -o /dev/null -H 'Content-Type: application/json' --data-binary "$payload" "$HITEL_MILESTONE_WEBHOOK" 2>/dev/null; then
    echo '::warning::Milestone webhook delivery failed; status remains available in Actions.'
  fi
fi
